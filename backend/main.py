import sqlite3
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional  # <--- Optional is the magic word that fixes the 422 error!

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

class Dependency(BaseModel):
    determinants: List[str]
    dependents: List[str]

class TableSchema(BaseModel):
    name: str
    columns: List[Column]
    dependencies: List[Dependency] = []

# --- 2. The Normalization Logic ---

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

# Renamed this so it doesn't clash with the AWS Provisioner!
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

# --- 6. AWS INFRASTRUCTURE PROVISIONING (The Engine Fix) ---

class CloudDeployRequest(BaseModel):
    db_name: str
    vpc_sg_id: Optional[str] = None  # Safely accepts null from React
    db_engine: str = "postgres"      # Accepts the database type

@app.post("/deploy-to-aws")
async def deploy_rds(request: CloudDeployRequest):
    result = create_rds_instance(
        db_instance_id=request.db_name, 
        vpc_security_group_id=request.vpc_sg_id, 
        engine=request.db_engine
    )
    return result

@app.get("/check-aws-status")
async def check_rds(db_name: str):
    result = get_db_status(db_name)
    return result

@app.delete("/delete-aws-db")
async def kill_rds(db_name: str):
    result = delete_rds_instance(db_name)
    return result

@app.post("/api/cloud/terraform")
async def generate_terraform(request: CloudDeployRequest):
    """Generates a professional Terraform script based on the chosen engine."""
    engine_version = "15.4" if request.db_engine == "postgres" else "8.0"
    param_group = "default.postgres15" if request.db_engine == "postgres" else "default.mysql8.0"
    
    tf_code = f"""
provider "aws" {{
  region = "us-east-1"
}}

resource "aws_db_instance" "nensiera_database" {{
  identifier           = "{request.db_name}"
  allocated_storage    = 20
  engine               = "{request.db_engine}"
  engine_version       = "{engine_version}"
  instance_class       = "db.t3.micro"
  username             = "admin_user"
  password             = "SECURE_PASSWORD_HERE" # Fetch from AWS SSM in production
  parameter_group_name = "{param_group}"
  skip_final_snapshot  = true
  publicly_accessible  = true
  
  tags = {{
    Environment = "Production"
    Project     = "Automated-DB-Normalizer"
  }}
}}
"""
    return {"terraform_code": tf_code.strip()}