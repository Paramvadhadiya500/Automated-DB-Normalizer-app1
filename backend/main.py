import sqlite3 # ADD THIS TO THE VERY TOP OF YOUR FILE!
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

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

# NEW: Tells Python which columns determine other columns
class Dependency(BaseModel):
    determinants: List[str]  # e.g., ["student_id"]
    dependents: List[str]    # e.g., ["student_name"]

class TableSchema(BaseModel):
    name: str
    columns: List[Column]
    dependencies: List[Dependency] = [] # Default is empty list if none exist

# ---------------------------------

# --- 2. The Normalization Logic ---

def analyze_1nf(table: TableSchema):
    violations = []
    
    # Rule 1: Check for atomic values
    for col in table.columns:
        if col.data_type.upper() in ["LIST", "ARRAY", "JSON", "OBJECT"]:
            violations.append(f"Column '{col.name}' violates 1NF: Contains multi-valued attributes ({col.data_type}).")
            
    # Rule 2: Check for a Primary Key
    has_pk = any(col.is_primary_key for col in table.columns)
    if not has_pk:
        violations.append(f"Table '{table.name}' violates 1NF: No Primary Key defined.")
        
    return violations

# --- 3. The New API Endpoint ---

@app.post("/api/normalize/1nf")
def check_first_normal_form(table: TableSchema):
    errors = analyze_1nf(table)
    
    if len(errors) > 0:
        return {"status": "failed", "1nf_violations": errors}
    
    return {"status": "passed", "message": "Schema passes 1NF!"}

# --- 2. The Normalization Logic ---

# (Keep your existing analyze_1nf function here)

def analyze_2nf(table: TableSchema):
    # Rule 1: It must pass 1NF first!
    violations = analyze_1nf(table)
    if len(violations) > 0:
        return violations 
        
    # Find all columns that make up the Primary Key
    pk_columns = [col.name for col in table.columns if col.is_primary_key]
    
    # Golden Rule of 2NF: If the Primary Key is just ONE column, 
    # partial dependencies are impossible. It automatically passes 2NF!
    if len(pk_columns) <= 1:
        return violations
        
    # Rule 2: Check for Partial Dependencies
    for dep in table.dependencies:
        # Check if the determinant is only a *part* of the Primary Key
        is_partial_key = all(det in pk_columns for det in dep.determinants) and len(dep.determinants) < len(pk_columns)
        
        if is_partial_key:
            # Find which dependent columns are not part of the Primary Key
            non_prime_dependents = [d for d in dep.dependents if d not in pk_columns]
            
            if non_prime_dependents:
                violations.append(
                    f"Table '{table.name}' violates 2NF: Partial dependency found. "
                    f"Columns {non_prime_dependents} depend only on {dep.determinants}, which is just part of the composite Primary Key."
                )
                
    return violations

# --- 3. The API Endpoints ---

# (Keep your existing 1nf endpoint here)

@app.post("/api/normalize/2nf")
def check_second_normal_form(table: TableSchema):
    errors = analyze_2nf(table)
    
    if len(errors) > 0:
        return {"status": "failed", "2nf_violations": errors}
    
    return {"status": "passed", "message": "Schema passes 1NF and 2NF!"}

# --- The 3NF Logic ---
def analyze_3nf(table: TableSchema):
    # Rule 1: It must pass 2NF first! (Which automatically checks 1NF)
    violations = analyze_2nf(table)
    if len(violations) > 0:
        return violations 
        
    pk_columns = [col.name for col in table.columns if col.is_primary_key]
    
    # Rule 2: Check for Transitive Dependencies
    for dep in table.dependencies:
        # Check if the determinant (the "cause") is NOT the primary key
        is_determinant_non_key = not all(d in pk_columns for d in dep.determinants)
        
        if is_determinant_non_key:
            # Check if the dependent (the "effect") is also NOT the primary key
            non_key_dependents = [d for d in dep.dependents if d not in pk_columns]
            
            if non_key_dependents:
                violations.append(
                    f"Table '{table.name}' violates 3NF: Transitive dependency found. "
                    f"Column(s) {non_key_dependents} depend on {dep.determinants}, but neither is the Primary Key."
                )
                
    return violations

# --- The MASTER API Endpoint ---
@app.post("/api/normalize/analyze")
def analyze_full_schema(table: TableSchema):
    # Running analyze_3nf creates a waterfall that checks 2NF and 1NF too!
    errors = analyze_3nf(table)
    
    if len(errors) > 0:
        return {"status": "failed", "violations": errors} # Unified 'violations' key
    
    return {"status": "passed", "message": "Flawless Schema! It passes 1NF, 2NF, and 3NF!"}

# --- Phase 7: The Sandbox Engine ---

@app.post("/api/sandbox/deploy")
def deploy_to_sandbox(table: TableSchema):
    # 1. Translate JSON into SQL
    columns_sql = []
    pk_columns = []
    
    for col in table.columns:
        # Format the column string (e.g., "user_id INT")
        col_str = f"{col.name} {col.data_type}"
        columns_sql.append(col_str)
        
        if col.is_primary_key:
            pk_columns.append(col.name)
            
    # Add the PRIMARY KEY constraint if there are any keys
    if pk_columns:
        pk_str = f"PRIMARY KEY ({', '.join(pk_columns)})"
        columns_sql.append(pk_str)
        
    # Assemble the final SQL command
    create_table_sql = f"CREATE TABLE {table.name} (\n  " + ",\n  ".join(columns_sql) + "\n);"
    
    # 2. Spin up the Database in RAM
    try:
        # ':memory:' tells SQLite to build this database entirely in fast RAM, not on the hard drive
        conn = sqlite3.connect(':memory:')
        cursor = conn.cursor()
        
        # Execute your generated SQL!
        cursor.execute(create_table_sql)
        conn.commit()
        conn.close()
        
        return {
            "status": "success",
            "message": "Database successfully spun up in Sandbox!",
            "sql": create_table_sql
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"SQL Error: {str(e)}"
        }