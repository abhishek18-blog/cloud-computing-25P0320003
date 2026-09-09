# Library Management System - Cloud-Native Microservice Architecture

A multi-language, polyglot persistence microservices architecture for a digital library management system, built to satisfy all architectural constraints for Cloud Computing deployment.

---

## 🏛 Architecture Overview

```
                      +-----------------------------+
                      |     Client Web Browser      |
                      +--------------+--------------+
                                     |
                                     | Port 3000 / 80
                                     v
+-------------------------------------------------------------------------+
| VM 1: EDGE / GATEWAY LAYER                                              |
|                                                                         |
|   +-----------------------+              +--------------------------+   |
|   |  Frontend Web Portal  |              |       API Gateway        |   |
|   |  (Nginx + HTML/JS/CSS)|              |  (Node.js Express Proxy) |   |
|   |  Port: 3000 / 80      +------------->+  Port: 8080              |   |
|   +-----------------------+              +-------------+------------+   |
+--------------------------------------------------------|----------------+
                                                         |
                            +----------------------------+----------------------------+
                            | /api/books/*                                            | /api/members/*
                            |                                                         | /api/borrowings/*
                            v                                                         v
+-----------------------------------------+   +---------------------------------------------+
| VM 2: BOOK CATALOG SERVICE              |   | VM 3: MEMBER & BORROWING SERVICE            |
|                                         |   |                                             |
|   +----------------------------------+  |   |   +-------------------------------------+   |
|   | Book Catalog Microservice        |  |   |   | Member & Borrowing Microservice     |   |
|   | (Python 3.11 FastAPI)            |  |   |   | (Node.js 20 Express)                |   |
|   | Port: 8001                       |  |   |   | Port: 8002                          |   |
|   +----------------+-----------------+  |   |   +------------------+------------------+   |
|                    |                    |   |                      |                      |
|                    v                    |   |                      v                      |
|   +----------------------------------+  |   |   +-------------------------------------+   |
|   | PostgreSQL Database              |  |   |   | MySQL 8.0 Database                  |   |
|   | (PostgreSQL 16)                  |  |   |   | Port: 3306                          |   |
|   | Port: 5432                       |  |   |   +-------------------------------------+   |
|   +----------------------------------+  |   |                                             |
+-----------------------------------------+   +---------------------------------------------+
```

---

## 📋 Architectural Constraints Compliance Matrix

| Constraint | Requirement | Implementation in this Project |
| :--- | :--- | :--- |
| **1. VM Distribution** | Each backend microservice + dedicated DB on its own Cloud VM | Separate standalone compose files (`book-service/docker-compose.vm.yml`, `member-borrow-service/docker-compose.vm.yml`, `api-gateway/docker-compose.vm.yml`) configured for multi-VM deployment. |
| **2. System Limits** | 2-4 microservices (excluding gateway), plus Frontend UI & API Gateway | **2 Backend Microservices** (`book-service`, `member-borrow-service`) + **1 API Gateway** + **1 Frontend UI**. |
| **3. Routing** | API Gateway must act as sole entry point | All frontend requests and external traffic flow through `API Gateway (:8080)`, routing `/api/books` and `/api/members`/`/api/borrowings` to respective backend VMs. |
| **4. Configuration** | No hardcoded credentials or IP addresses; use environment variables | All service URLs, DB credentials, and hostnames are injected strictly through `.env` files. |
| **5. Languages & DBs** | $\ge 2$ distinct languages and $\ge 2$ distinct DB engines | **Python FastAPI (PostgreSQL 16)** and **Node.js Express (MySQL 8.0)**. |

---

## 🚀 Quick Start (Unified Local Deployment)

To run the entire system locally with a single command:

```bash
# 1. Clone the repository
git clone <repo-url>
cd cloudcomputing-25P0320003

# 2. Build and launch all 6 containers
docker compose up --build -d

# 3. Verify running containers
docker compose ps
```

### Access URLs:
- **Frontend Web Portal**: [http://localhost:3000](http://localhost:3000)
- **API Gateway**: [http://localhost:8080](http://localhost:8080)
- **Aggregated Health Diagnostic**: [http://localhost:8080/health](http://localhost:8080/health)
- **Book Service API**: [http://localhost:8001/books](http://localhost:8001/books)
- **Member Service API**: [http://localhost:8002/members](http://localhost:8002/members)

---

## ☁️ Multi-VM Cloud Deployment Guide (AWS / Azure / GCP)

To deploy across 3 separate Cloud Virtual Machines:

### Step 1: VM 2 Deployment (Book Catalog Service + PostgreSQL)
On **VM 2 (e.g., Public/Private IP: `10.0.1.20`)**:
```bash
# Clone repository and navigate to book-service
cd cloudcomputing-25P0320003/book-service

# Configure environment variables
cp .env.example .env
nano .env

# Launch PostgreSQL and Book Catalog Service
docker compose -f docker-compose.vm.yml up --build -d

# Verify health
curl http://localhost:8001/health
```

### Step 2: VM 3 Deployment (Member & Borrowing Service + MySQL)
On **VM 3 (e.g., Public/Private IP: `10.0.1.30`)**:
```bash
# Navigate to member-borrow-service
cd cloudcomputing-25P0320003/member-borrow-service

# Configure environment variables (Point BOOK_SERVICE_URL to VM 2 IP)
cp .env.example .env
echo "BOOK_SERVICE_URL=http://10.0.1.20:8001" >> .env

# Launch MySQL and Member Service
docker compose -f docker-compose.vm.yml up --build -d

# Verify health
curl http://localhost:8002/health
```

### Step 3: VM 1 Deployment (API Gateway + Frontend)
On **VM 1 (e.g., Public IP: `203.0.113.10`)**:
```bash
# Navigate to api-gateway
cd cloudcomputing-25P0320003/api-gateway

# Configure environment variables pointing to backend VMs
cp .env.example .env
cat <<EOF > .env
PORT=8080
NODE_ENV=production
BOOK_SERVICE_URL=http://10.0.1.20:8001
MEMBER_SERVICE_URL=http://10.0.1.30:8002
EOF

# Launch Gateway and Frontend
docker compose -f docker-compose.vm.yml up --build -d

# Verify Aggregated Health Check
curl http://localhost:8080/health
```

---

## 📡 API Reference & Testing Guide

All endpoints can be tested through the API Gateway on port `8080`:

### 1. Health Diagnostic
```bash
curl http://localhost:8080/health
```

### 2. Books Catalog API (PostgreSQL + Python)
```bash
# Get all books
curl http://localhost:8080/api/books

# Search books
curl "http://localhost:8080/api/books?search=Cloud"

# Add a new book
curl -X POST http://localhost:8080/api/books \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Site Reliability Engineering",
    "author": "Niall Murphy & Betsy Beyer",
    "isbn": "978-1491929124",
    "category": "DevOps",
    "total_copies": 5,
    "available_copies": 5
  }'

# Delete a book
curl -X DELETE http://localhost:8080/api/books/1
```

### 3. Member Management API (MySQL + Node.js)
```bash
# Get all members
curl http://localhost:8080/api/members

# Register a member
curl -X POST http://localhost:8080/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah Connor",
    "email": "sarah.c@unigoa.ac.in",
    "phone": "+91-9888776655",
    "membership_type": "STUDENT"
  }'
```

### 4. Issue & Return Desk API (Inter-Service Sync)
```bash
# Issue / Borrow a book (Checks availability and decrements stock in PostgreSQL)
curl -X POST http://localhost:8080/api/borrowings/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "book_id": 2,
    "notes": "MCA Cloud Lab Reference"
  }'

# List active loans
curl "http://localhost:8080/api/borrowings?status=BORROWED"

# Return a book (Marks returned and increments stock in PostgreSQL)
curl -X POST http://localhost:8080/api/borrowings/return/1
```

---

## 🐳 Docker Hygiene & Security Practices

- **Non-Root Execution**: Microservices run under unprivileged `appuser` (Python) and `node` (Node.js) users.
- **Multi-Stage & Slim Base Images**: Using `python:3.11-slim`, `node:20-alpine`, `nginx:alpine`, and `postgres:16-alpine` to minimize image footprint and attack surface.
- **Docker Health Checks**: Automated interval-based health probing for all microservices and databases.
- **Isolated Bridge Networks**: Containers communicate internally over a secured user-defined bridge network (`library-net`).
- **Persistent Data Volumes**: `postgres_data` and `mysql_data` ensure state is safely preserved across container restarts.

---

## 🛠 Tech Stack Summary

- **Book Catalog Microservice**: Python 3.11, FastAPI, SQLAlchemy 2.0, PostgreSQL 16
- **Member & Borrowing Microservice**: Node.js 20, Express, MySQL 8.0
- **API Gateway**: Node.js Express, `http-proxy-middleware`, Axios
- **Frontend Dashboard**: HTML5, Vanilla CSS3 (Custom Design System), Modern JavaScript, Nginx Alpine
- **Container Orchestration**: Docker, Docker Compose
# cloud-computing-25P0320003
