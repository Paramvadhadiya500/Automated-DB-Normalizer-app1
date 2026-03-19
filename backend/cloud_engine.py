import boto3
import os
from dotenv import load_dotenv

# This loads your Access Keys from the .env file
load_dotenv()

# Connect to AWS RDS service
rds_client = boto3.client(
    'rds',
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION")
)

def create_rds_instance(db_instance_id):
    """
    This function tells AWS to spin up a new database.
    """
    try:
        print(f"🚀 Starting AWS Provisioning for: {db_instance_id}...")
        
        response = rds_client.create_db_instance(
            DBInstanceIdentifier=db_instance_id,
            AllocatedStorage=20,           # 20GB is the Free Tier limit
            DBInstanceClass='db.t3.micro',  # Free Tier eligible instance
            Engine='postgres',             # You can change this to 'mysql' if you prefer
            MasterUsername='admin_user',
            MasterUserPassword='NensieraSecurePass123!', # Change this later!
            PubliclyAccessible=True,       # So your React app can talk to it
            Tags=[{'Key': 'Project', 'Value': 'Automated-DB-Normalizer'}]
        )
        
        return {
            "status": "Success",
            "message": f"Database {db_instance_id} is now being created!",
            "aws_status": response['DBInstance']['DBInstanceStatus']
        }

    except Exception as e:
        return {"status": "Error", "message": str(e)}

def get_db_status(db_instance_id):
    """
    Checks if the database is 'Available' yet (AWS takes 3-5 mins to build it).
    """
    try:
        response = rds_client.describe_db_instances(DBInstanceIdentifier=db_instance_id)
        status = response['DBInstances'][0]['DBInstanceStatus']
        endpoint = response['DBInstances'][0].get('Endpoint', {}).get('Address', 'Not ready yet')
        return {"status": status, "endpoint": endpoint}
    except Exception as e:
        return {"error": str(e)}
def delete_rds_instance(db_instance_id):
    """
    Tells AWS to permanently delete the database.
    """
    try:
        print(f"⚠️ Deleting AWS RDS Instance: {db_instance_id}...")
        
        response = rds_client.delete_db_instance(
            DBInstanceIdentifier=db_instance_id,
            SkipFinalSnapshot=True, # Critical: Saves time and money by not saving a backup
            DeleteAutomatedBackups=True
        )
        
        return {
            "status": "Deleting",
            "message": f"Database {db_instance_id} is being shut down.",
            "aws_status": response['DBInstance']['DBInstanceStatus']
        }
    except Exception as e:
        return {"status": "Error", "message": str(e)}

        import psycopg2

def execute_on_rds(host, sql_command):
    """
    Connects to the real AWS RDS and runs your SQL.
    """
    try:
        # Connect using the credentials we set in create_rds_instance
        conn = psycopg2.connect(
            host=host,
            database='postgres', # Default DB name
            user='admin_user',
            password='NensieraSecurePass123!', # Must match what you used in create_rds_instance
            connect_timeout=5
        )
        cur = conn.cursor()
        cur.execute(sql_command)
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "success", "message": "Tables created on AWS RDS!"}
    except Exception as e:
        return {"status": "error", "message": f"Cloud SQL Error: {str(e)}"}