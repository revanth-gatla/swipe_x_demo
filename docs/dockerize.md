```# SWIPE X - Docker Documentation

## 1. Overview

SWIPE X is a job discovery platform consisting of:

- React + Vite frontend
- FastAPI backend
- PostgreSQL database

Docker is used to containerize the application and run the services together using Docker Compose.

## 2. Architecture

```text
                    SWIPE X
                       |
              Docker Compose
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
     Frontend       Backend       PostgreSQL
     Nginx          FastAPI          16
      :5173          :8000          :5432
        |              |
        +--------------+
              API

3. Technologies Used

| Component        | Technology     |
| ---------------- | -------------- |
| Frontend         | React + Vite   |
| Frontend Server  | Nginx          |
| Backend          | FastAPI        |
| Backend Server   | Uvicorn        |
| Database Driver  | psycopg2       |
| Database         | PostgreSQL 16  |
| Containerization | Docker         |
| Orchestration    | Docker Compose |


##4. Why Docker Is Used

Docker provides a consistent environment for running SWIPE X.
Without Docker, developers may need to manually configure:

Python
Python dependencies
Node.js
npm dependencies
PostgreSQL
PostgreSQL configuration
Backend server
Frontend server

With Docker, these components are packaged into containers and managed using Docker Compose.

The complete application can be started using:
</>docker compose up -d --build

#5.Project Docker Strutcure

job-discovery-platform/
│
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── app.py
│   ├── auth.py
│   ├── database.py
│   └── requirements.txt
│
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf
│   └── src/
│
├── docker-compose.yml
│
└── docs/
    └── dockerize.md


#6. Prerequisites

The following are required:
Docker Desktop
WSL 2 on Windows
Git

Docker Desktop should be running before starting the application.

Check Docker:
</>
docker --version
docker compose version
check WSL:
</>
wsl --status
wsl -l -v

#7. Environment Variables
Backend environment variables are stored locally in:
backend/.env

##8. Security
The following files must remain locally
backend/.env
*.env
swipe_x_backup.sql
jobs_data.sql

The .gitignore file is used to prevent these files from being tracked.

#9. Docker Compose Services
The docker-compose.yml file contains three services:
postgres
backend
frontend

PostgreSQL Service
The PostgreSQL service uses: postgres:16-alpine
It stores database data using:postgres_data
The backend waits for PostgreSQL to become healthy before starting.

Backend Service
The backend is built using:backend/Dockerfile
It runs FastAPI using Uvicorn on port:8000
The backend connects to PostgreSQL using:postgres:5432

Frontend Service
The frontend is built using:frontend/Dockerfile
The React/Vite application is built first and then served using Nginx.
The frontend is exposed on:5173


##10. Backend Dockerization

The backend Dockerfile performs the following steps:
1.Uses a Python base image.
2.Sets the working directory.
3.Copies requirements.txt.
4.Installs Python dependencies.
5.Copies the backend source code.
6.Starts the FastAPI application using Uvicorn.

The backend dependencies are defined in:backend/requirements.txt


##11. Frontend Dockerization

The frontend Dockerfile uses a multi-stage build.

*Build Stage

Node.js is used to:
1.Install npm dependencies.
2.Copy the React/Vite source code.
3.Build the frontend application.

*Production Stage

The generated frontend files are copied into an Nginx image.
Nginx serves the React application.


##12. Nginx Configuration:

Nginx is used to serve the production build of the React application.
React Router requires an SPA fallback so that routes continue to work when the browser refreshes a page.
The Nginx configuration uses a fallback similar to:try_files $uri $uri/ /index.html;

This supports routes such as:
/login
/register
/profile
/saved-jobs
/applications

##13. PostgreSQL Connection:

The project uses psycopg2 as the PostgreSQL database driver.
The connection is created in:backend/database.py

The connection uses environment variables such as:
POSTGRES_HOST
POSTGRES_PORT
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD

The basic architecture is:
FastAPI
   |
   v
psycopg2
   |
   v
PostgreSQL

**psycopg2 usage:
psycopg2 is a Python PostgreSQL adapter.

It allows the FastAPI backend to:
.Open PostgreSQL connections
.Execute SQL queries
.Insert records
.Update records
.Delete records
.Retrieve records

##14. Database Administration:

The PostgreSQL database can be accessed using:
.PostgreSQL Shell (psql)
The project uses psycopg2 from Python to communicate with PostgreSQL.

##15. Docker Networking
Docker Compose automatically creates a network for the services.
The backend can communicate with PostgreSQL using:postgres:5432
The frontend communicates with the backend through the exposed host port:localhost:8000

The communication flow is:
Browser
   |
   v
Frontend
localhost:5173
   |
   | HTTP API
   v
Backend
localhost:8000
   |
   | PostgreSQL connection
   v
PostgreSQL
postgres:5432```

