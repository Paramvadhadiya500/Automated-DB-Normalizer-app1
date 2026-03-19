# 🚀 Automated Database Normalizer & Architecture Sandbox

A full-stack, algorithmic architecture tool that allows developers to visually map out relational database schemas and automatically validates them against strict DBMS normalization rules (1NF, 2NF, 3NF). Passing schemas can be instantly compiled and deployed to a local, in-memory SQLite sandbox.

## ✨ Core Features
* **Visual ERD Canvas:** Drag-and-drop interface to build tables, define columns, and map primary/foreign keys.
* **Algorithmic Validation Engine:** A Python backend that mathematically analyzes schemas for partial and transitive dependencies to ensure 3NF compliance.
* **Instant Sandbox Deployment:** Dynamically translates valid JSON schemas into `CREATE TABLE` SQL scripts and spins up an isolated SQLite database in memory.
* **Export to SQL:** Download the generated production-ready `.sql` files directly to your local machine.

## 🛠️ Tech Stack
* **Frontend:** React, Vite, React Flow (Custom Stateful Nodes)
* **Backend:** Python, FastAPI
* **Database Engine:** SQLite (In-Memory)
* **API Communication:** RESTful endpoints with strict CORS management

## 🚀 How to Run Locally

### 1. Start the Python Backend
```bash
cd database-api
python -m venv venv
# Activate the environment (Windows: .\venv\Scripts\activate | Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload