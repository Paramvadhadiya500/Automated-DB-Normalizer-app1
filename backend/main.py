import sqlite3
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from cloud_engine import delete_rds_instance # Update your import at the top!
# Import your new AWS Cloud Engine
from cloud_engine import create_rds_instance, get_db_status
from cloud_engine import execute_on_rds # Add to imports!

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

# --- 5. THE NEW AWS CLOUD ENGINE ENDPOINTS ---

@app.post("/deploy-to-aws")
async def deploy_rds():
    """Starts the creation of a real AWS RDS instance."""
    result = create_rds_instance("nensiera-cafe-db")
    return result

@app.get("/check-aws-status")
async def check_rds():
    """Checks if your AWS database is 'Available' yet."""
    result = get_db_status("nensiera-cafe-db")
    return result

@app.delete("/delete-aws-db")
async def kill_rds():
    """Triggers the permanent deletion of the RDS instance."""
    result = delete_rds_instance("nensiera-cafe-db")
    return result

class CloudDeployRequest(BaseModel):
    host: str
    table_schema: TableSchema

@app.post("/api/cloud/deploy")
async def deploy_to_real_rds(request: CloudDeployRequest):
    # 1. Reuse your existing SQL generator logic
    # (Extracting this logic into a helper function is cleaner, but let's keep it simple for now)
    columns_sql = []
    pk_columns = [col.name for col in request.table_schema.columns if col.is_primary_key]
    for col in request.table_schema.columns:
        columns_sql.append(f"{col.name} {col.data_type}")
    if pk_columns:
        columns_sql.append(f"PRIMARY KEY ({', '.join(pk_columns)})")
        
    create_table_sql = f"CREATE TABLE {request.table_schema.name} ({', '.join(columns_sql)});"
    
    # 2. Push to AWS
    result = execute_on_rds(request.host, create_table_sql)
    return result