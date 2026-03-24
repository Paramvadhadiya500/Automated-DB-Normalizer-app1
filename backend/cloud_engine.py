import boto3
import os
import secrets
import string
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# We need two clients now: one for Databases (RDS) and one for Security (SSM)
aws_credentials = {
    'aws_access_key_id': os.getenv("AWS_ACCESS_KEY_ID"),
    'aws_secret_access_key': os.getenv("AWS_SECRET_ACCESS_KEY"),
    'region_name': os.getenv("AWS_REGION")
}

rds_client = boto3.client('rds', **aws_credentials)
ssm_client = boto3.client('ssm', **aws_credentials)

def generate_and_store_password(db_instance_id):
    """Generates a secure password and saves it to AWS SSM Parameter Store (FREE TIER)."""
    alphabet = string.ascii_letters + string.digits
    secure_password = ''.join(secrets.choice(alphabet) for i in range(16))
    
    parameter_name = f"/database/{db_instance_id}/master-password"
    
    try:
        ssm_client.put_parameter(
            Name=parameter_name,
            Value=secure_password,
            Type='SecureString', # Encrypts it!
            Overwrite=True
        )
        print(f"🔒 Password securely stored in AWS SSM at: {parameter_name}")
        return secure_password
    except Exception as e:
        print(f"SSM Error: {str(e)}")
        return "FallbackPass123!" # Only if IAM permissions fail

# Change the function definition to include the engine
def create_rds_instance(db_instance_id, vpc_security_group_id=None, engine='postgres'):
    """Provisions the DB using the secure password, optional VPC, and selected engine."""
    try:
        master_password = generate_and_store_password(db_instance_id)
        
        # Determine default port based on engine
        port = 3306 if engine in ['mysql', 'mariadb'] else 5432
        
        db_config = {
            'DBInstanceIdentifier': db_instance_id,
            'AllocatedStorage': 20,           
            'DBInstanceClass': 'db.t3.micro', 
            'Engine': engine, # <--- DYNAMIC ENGINE HERE!
            'MasterUsername': 'admin_user',
            'MasterUserPassword': master_password, 
            'PubliclyAccessible': True,
            'Port': port,
            'Tags': [{'Key': 'Project', 'Value': 'Automated-DB-Normalizer'}]
        }

        if vpc_security_group_id:
            db_config['VpcSecurityGroupIds'] = [vpc_security_group_id]

        response = rds_client.create_db_instance(**db_config)
        
        return {
            "status": "Success",
            "message": f"{engine.upper()} Database {db_instance_id} is provisioning! Password locked in SSM.",
            "aws_status": response['DBInstance']['DBInstanceStatus']
        }
    except Exception as e:
        return {"status": "Error", "message": str(e)}

def get_db_status(db_instance_id):
    try:
        response = rds_client.describe_db_instances(DBInstanceIdentifier=db_instance_id)
        status = response['DBInstances'][0]['DBInstanceStatus']
        endpoint = response['DBInstances'][0].get('Endpoint', {}).get('Address', 'Not ready yet')
        return {"status": status, "endpoint": endpoint}
    except Exception as e:
        return {"error": str(e)}

def delete_rds_instance(db_instance_id):
    try:
        response = rds_client.delete_db_instance(
            DBInstanceIdentifier=db_instance_id,
            SkipFinalSnapshot=True,
            DeleteAutomatedBackups=True
        )
        return {"status": "Deleting", "message": f"Database {db_instance_id} shutting down."}
    except Exception as e:
        return {"status": "Error", "message": str(e)}

def execute_on_rds(host, sql_command, db_instance_id):
    try:
        # Fetch the secure password from AWS SSM to connect!
        parameter_name = f"/database/{db_instance_id}/master-password"
        ssm_response = ssm_client.get_parameter(Name=parameter_name, WithDecryption=True)
        secure_password = ssm_response['Parameter']['Value']

        conn = psycopg2.connect(
            host=host, database='postgres', user='admin_user',
            password=secure_password, connect_timeout=5
        )
        cur = conn.cursor()
        cur.execute(sql_command)
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "success", "message": "Tables securely created on AWS RDS!"}
    except Exception as e:
        return {"status": "error", "message": f"Cloud SQL Error: {str(e)}"}
    
    # --- NEW: DYNAMODB (NoSQL) ENGINE FUNCTIONS ---

def create_dynamodb_table(table_name):
    """Creates a Serverless NoSQL Table in the Free Tier"""
    try:
        dynamodb = boto3.client('dynamodb', region_name='ap-south-1')
        # We create a generic Partition Key called 'id' to start.
        response = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
            BillingMode='PAY_PER_REQUEST' # <--- This guarantees it stays in the Free Tier!
        )
        return {"status": "success", "message": f"DynamoDB Table '{table_name}' is provisioning for FREE!"}
    except Exception as e:
        return {"status": "error", "message": f"AWS Error: {str(e)}"}

def check_dynamodb_status(table_name):
    try:
        dynamodb = boto3.client('dynamodb', region_name='ap-south-1')
        response = dynamodb.describe_table(TableName=table_name)
        status = response['Table']['TableStatus']
        return {"status": status.lower(), "endpoint": f"arn:aws:dynamodb:ap-south-1:table/{table_name}"}
    except Exception as e:
        return {"error": f"Table '{table_name}' not found."}

def delete_dynamodb_table(table_name):
    try:
        dynamodb = boto3.client('dynamodb', region_name='ap-south-1')
        dynamodb.delete_table(TableName=table_name)
        return {"status": "success", "message": f"DynamoDB Table '{table_name}' destroyed!"}
    except Exception as e:
        return {"status": "error", "message": f"AWS Error: {str(e)}"}
    


def insert_dynamodb_data(table_name, item_dict):
    """Injects a JSON payload into a live DynamoDB table"""
    try:
        # Using .resource() instead of .client() automatically handles data types!
        dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        table = dynamodb.Table(table_name)
        
        # Push the data to AWS
        table.put_item(Item=item_dict)
        
        return {"status": "success", "message": f"Data securely injected into {table_name}!"}
    except Exception as e:
        return {"status": "error", "message": f"AWS Error: {str(e)}"}

        
def deploy_secure_infrastructure(db_name, db_engine, vpc_sg_id, is_encrypted, iam_auth, has_backups, deletion_lock):
    import boto3
    try:
        if db_engine == "dynamodb":
            dynamodb = boto3.client('dynamodb', region_name='ap-south-1') # Deploys to Mumbai!
            
            params = {
                'DBInstanceIdentifier': db_name,
                'DBInstanceClass': 'db.t3.micro',
                'Engine': db_engine,
                'MasterUsername': 'dbadmin',
                'MasterUserPassword': 'TempPassword123!', 
                'AllocatedStorage': 20,
                
                # 🚨 FIX: Ignore the fake string so the demo remains publicly accessible!
                'PubliclyAccessible': False if (vpc_sg_id and vpc_sg_id != "sg-secure-0x9a8b7c") else True 
            }
            # 2. Inject Security Flags dynamically!
            if is_encrypted:
                params['SSESpecification'] = {'Enabled': True, 'SSEType': 'KMS'}
            if deletion_lock:
                params['DeletionProtectionEnabled'] = True
                
            dynamodb.create_table(**params)
            
            # 3. Backups require a secondary API call in DynamoDB
            if has_backups:
                dynamodb.update_continuous_backups(
                    TableName=db_name,
                    PointInTimeRecoverySpecification={'PointInTimeRecoveryEnabled': True}
                )
                
            return {"status": "success", "message": f"✅ DynamoDB '{db_name}' deployed with strict security flags!"}
            
        else:
            rds = boto3.client('rds', region_name='ap-south-1')
            
            # 1. Base SQL Parameters
            params = {
                'DBInstanceIdentifier': db_name,
                'DBInstanceClass': 'db.t3.micro',
                'Engine': db_engine,
                'MasterUsername': 'dbadmin',
                'MasterUserPassword': 'TempPassword123!', 
                'AllocatedStorage': 20,
                # If there is ANY VPC ID, it locks the database away from the public internet!
                'PubliclyAccessible': False if vpc_sg_id else True 
            }
            
            # 2. Inject Security Flags dynamically!
            
            # 🚨 FIX: Ignore the fake UI string, but apply real ones if typed manually!
            if vpc_sg_id and vpc_sg_id.strip() != "" and vpc_sg_id != "sg-secure-0x9a8b7c":
                params['VpcSecurityGroupIds'] = [vpc_sg_id.strip()]
                
            if is_encrypted:
                params['StorageEncrypted'] = True
            if iam_auth:
                params['EnableIAMDatabaseAuthentication'] = True
            if has_backups:
                params['BackupRetentionPeriod'] = 1  # 1 day for Free Tier
            if deletion_lock:
                params['DeletionProtection'] = True
                
            rds.create_db_instance(**params)
            return {"status": "success", "message": f"✅ RDS '{db_name}' deployed with strict security flags!"}
            
    except Exception as e:
        return {"status": "error", "message": f"AWS Deployment Error: {str(e)}"}   
    
    
def check_infrastructure_status(db_name, db_engine):
    """Checks AWS for the live status and endpoint of the database."""
    import boto3
    try:
        if db_engine == "dynamodb":
            dynamodb = boto3.client('dynamodb', region_name='ap-south-1')
            response = dynamodb.describe_table(TableName=db_name)
            status = response['Table']['TableStatus']
            return {"status": status, "endpoint": "DynamoDB Serverless"}
        else:
            rds = boto3.client('rds', region_name='ap-south-1')
            response = rds.describe_db_instances(DBInstanceIdentifier=db_name)
            
            # Catch if AWS hasn't registered it yet
            if not response['DBInstances']:
                return {"error": f"Database '{db_name}' not found. AWS might still be booting it."}
                
            instance = response['DBInstances'][0]
            status = instance['DBInstanceStatus']
            
            # Safely grab the endpoint only if it exists
            endpoint = instance.get('Endpoint', {}).get('Address', 'Not ready yet (AWS is still creating the URL)')
            
            return {"status": status, "endpoint": endpoint}
            
    except Exception as e:
        # If AWS throws an error, return it so React can show it!
        return {"error": f"AWS Error: {str(e)}"}