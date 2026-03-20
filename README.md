# ☁️ Enterprise Cloud Architect Center

A full-stack, interactive Database-as-a-Service (DBaaS) platform that allows developers to visually design, validate, and instantly provision multi-model AWS databases (SQL & NoSQL) without writing infrastructure code.

## 🚀 Key Features

* **Multi-Model Support:** Toggle seamlessly between Relational (SQL) and Document (NoSQL) database architectures.
* **Visual Schema Builder:** Drag-and-drop React Flow canvas to design tables, define foreign keys, and map DynamoDB access patterns.
* **Automated Normalization Engine:** Python backend runs mathematical validation (1NF, 2NF, 3NF) on SQL schemas before allowing deployment.
* **One-Click AWS Provisioning:** Uses `boto3` to instantly spin up Amazon RDS (PostgreSQL/MySQL) or DynamoDB tables in the `ap-south-1` region.
* **Infrastructure as Code (IaC) Export:** Automatically generates production-ready `.tf` (Terraform) scripts based on the visual design.
* **Local Sandbox:** Test SQL schemas locally using an in-memory SQLite deployment.

## 🛠️ Tech Stack

* **Frontend:** React.js, React Flow, HTML-to-Image
* **Backend:** Python, FastAPI, Pydantic (Data Validation)
* **Cloud & DevOps:** AWS RDS, AWS DynamoDB, Boto3 (AWS SDK), Terraform

## 🧠 Architecture Flow

1.  **Design:** User defines schema visually in the React frontend.
2.  **Validate:** FastAPI receives the JSON payload and routes it to the correct rulebook (SQL Normalization vs. NoSQL Key Validation).
3.  **Deploy:** The Python Cloud Engine executes Boto3 commands to provision the requested resources securely on AWS.