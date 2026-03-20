import sqlite3
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from cloud_engine import create_rds_instance, get_db_status, delete_rds_instance, execute_on_rds
# Add the new imports!
from cloud_engine import create_dynamodb_table, check_dynamodb_status, delete_dynamodb_table

from cloud_engine import create_rds_instance, get_db_status, delete_rds_instance, execute_on_rds

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. Define the Data Models ---

class Column(BaseModel):
    name: str
    data_type: str
    is_primary_key: bool = False
    is_sort_key: Optional[bool] = False  # <--- NEW: Python now understands Sort Keys

class Dependency(BaseModel):
    determinants: List[str]
    dependents: List[str]

class TableSchema(BaseModel):
    name: str
    columns: List[Column]
    dependencies: List[Dependency] = []
    db_mode: str = "sql"  # <--- NEW: Tells Python which rulebook to use


# --- 2. The Normalization Logic ---

# 🆕 THE DYNAMODB RULEBOOK
def analyze_dynamodb(table: TableSchema):
    violations = []
    pk_count = sum(1 for col in table.columns if col.is_primary_key)
    sk_count = sum(1 for col in table.columns if col.is_sort_key)

    if pk_count == 0:
        violations.append("DynamoDB requires exactly ONE Partition Key (PK).")
    elif pk_count > 1:
        violations.append("DynamoDB cannot have more than one Partition Key.")

    if sk_count > 1:
        violations.append("DynamoDB cannot have more than one Sort Key (SK).")

    allowed_types = ["S", "N", "BOOL"]
    for col in table.columns:
        if (col.is_primary_key or col.is_sort_key) and col.data_type.upper() not in allowed_types:
            violations.append(f"Key '{col.name}' has invalid type. DynamoDB keys must be S, N, or BOOL.")

    return violations

# THE SQL RULEBOOK
def analyze_1nf(table: TableSchema):
    violations = []
    for col in table.columns:
        if col.data_type.upper() in ["LIST", "ARRAY", "JSON", "OBJECT"]:
            violations.append(f"Column '{col.name}' violates 1NF: Multi-valued attribute ({col.data_type}).")
    if not any(col.is_primary_key for col in table.columns):
        violations.append(f"Table '{table.name}' violates 1NF: No Primary Key defined.")
    return violations

def analyze_2nf(table: TableSchema):
    violations = analyze_1nf(table)
    if violations: return violations 
    pk_columns = [col.name for col in table.columns if col.is_primary_key]
    if len(pk_columns) <= 1: return violations
    for dep in table.dependencies:
        is_partial_key = all(det in pk_columns for det in dep.determinants) and len(dep.determinants) < len(pk_columns)
        if is_partial_key:
            non_prime_dependents = [d for d in dep.dependents if d not in pk_columns]
            if non_prime_dependents:
                violations.append(f"Table '{table.name}' violates 2NF: Partial dependency on {dep.determinants}.")
    return violations

def analyze_3nf(table: TableSchema):
    violations = analyze_2nf(table)
    if violations: return violations 
    pk_columns = [col.name for col in table.columns if col.is_primary_key]
    for dep in table.dependencies:
        is_determinant_non_key = not all(d in pk_columns for d in dep.determinants)
        if is_determinant_non_key:
            non_key_dependents = [d for d in dep.dependents if d not in pk_columns]
            if non_key_dependents:
                violations.append(f"Table '{table.name}' violates 3NF: Transitive dependency via {dep.determinants}.")
    return violations


# --- 3. Normalization API Endpoints ---

@app.post("/api/normalize/analyze")
def analyze_full_schema(table: TableSchema):
    # 🆕 THE SMART ROUTER: Checks the toggle switch
    if table.db_mode == "dynamodb":
        errors = analyze_dynamodb(table)
        if errors:
            return {"status": "failed", "violations": errors}
        return {"status": "passed", "message": "Valid NoSQL Schema! Ready for DynamoDB."}
    else: 
        errors = analyze_3nf(table)
        if errors:
            return {"status": "failed", "violations": errors}
        return {"status": "passed", "message": "Flawless Schema! It passes 1NF, 2NF, and 3NF!"}


# --- 4. The Local Sandbox Engine ---

@app.post("/api/sandbox/deploy")
def deploy_to_sandbox(table: TableSchema):
    columns_sql = []
    pk_columns = [col.name for col in table.columns if col.is_primary_key]
    for col in table.columns:
        columns_sql.append(f"{col.name} {col.data_type}")
    if pk_columns:
        columns_sql.append(f"PRIMARY KEY ({', '.join(pk_columns)})")
    create_table_sql = f"CREATE TABLE {table.name} (\n  " + ",\n  ".join(columns_sql) + "\n);"
    try:
        conn = sqlite3.connect(':memory:')
        cursor = conn.cursor()
        cursor.execute(create_table_sql)
        conn.close()
        return {"status": "success", "message": "Sandbox DB Created!", "sql": create_table_sql}
    except Exception as e:
        return {"status": "error", "message": f"SQL Error: {str(e)}"}


# --- 5. CLOUD EXECUTOR (For pushing SQL tables to AWS) ---

class SchemaDeployRequest(BaseModel):
    host: str
    table_schema: TableSchema

@app.post("/api/cloud/deploy")
async def deploy_to_real_rds(request: SchemaDeployRequest):
    columns_sql = []
    pk_columns = [col.name for col in request.table_schema.columns if col.is_primary_key]
    for col in request.table_schema.columns:
        columns_sql.append(f"{col.name} {col.data_type}")
    if pk_columns:
        columns_sql.append(f"PRIMARY KEY ({', '.join(pk_columns)})")
    create_table_sql = f"CREATE TABLE {request.table_schema.name} ({', '.join(columns_sql)});"
    result = execute_on_rds(request.host, create_table_sql)
    return result


# --- 6. AWS INFRASTRUCTURE PROVISIONING (The Smart Router) ---

class CloudDeployRequest(BaseModel):
    db_name: str
    vpc_sg_id: Optional[str] = None  
    db_engine: str = "postgres"      

@app.post("/deploy-to-aws")
async def deploy_rds(request: CloudDeployRequest):
    # THE SMART ROUTER: Which engine are we building?
    if request.db_engine == "dynamodb":
        result = create_dynamodb_table(request.db_name)
        return result
    else:
        result = create_rds_instance(
            db_instance_id=request.db_name, 
            vpc_security_group_id=request.vpc_sg_id, 
            engine=request.db_engine
        )
        return result

# Notice we added `db_engine` to the URL so Python knows which AWS service to check!
@app.get("/check-aws-status")
async def check_rds(db_name: str, db_engine: str = "postgres"):
    if db_engine == "dynamodb":
        return check_dynamodb_status(db_name)
    return get_db_status(db_name)

@app.delete("/delete-aws-db")
async def kill_rds(db_name: str, db_engine: str = "postgres"):
    if db_engine == "dynamodb":
        return delete_dynamodb_table(db_name)
    return delete_rds_instance(db_name)

@app.post("/api/cloud/terraform")
async def generate_terraform(request: CloudDeployRequest):
    """Generates a professional Terraform script for SQL or NoSQL."""
    
    # If NoSQL, generate DynamoDB Terraform
    if request.db_engine == "dynamodb":
        tf_code = f"""
provider "aws" {{
  region = "ap-south-1"
}}

resource "aws_dynamodb_table" "nensiera_nosql" {{
  name           = "{request.db_name}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {{
    name = "id"
    type = "S"
  }}
  
  tags = {{
    Environment = "Production"
    Project     = "Automated-DB-Normalizer"
  }}
}}
"""
        return {"terraform_code": tf_code.strip()}

    # Otherwise, generate standard RDS Terraform
    engine_version = "15.4" if request.db_engine == "postgres" else "8.0"
    param_group = "default.postgres15" if request.db_engine == "postgres" else "default.mysql8.0"
    tf_code = f"""
provider "aws" {{
  region = "ap-south-1"
}}

resource "aws_db_instance" "nensiera_database" {{
  identifier           = "{request.db_name}"
  allocated_storage    = 20
  engine               = "{request.db_engine}"
  engine_version       = "{engine_version}"
  instance_class       = "db.t3.micro"
  username             = "admin_user"
  password             = "SECURE_PASSWORD_HERE" 
  parameter_group_name = "{param_group}"
  skip_final_snapshot  = true
  publicly_accessible  = true
}}
"""
    return {"terraform_code": tf_code.strip()}