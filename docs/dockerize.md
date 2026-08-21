# SWIPE X - Docker Documentation

## 1. Overview

SWIPE X is a job discovery platform consisting of:

- React + Vite frontend
- FastAPI backend
- PostgreSQL database

Docker is used to containerize the application and run the services together using Docker Compose.

---

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
```

---

## 3. Technologies Used

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

---

## 4. Why Docker Is Used

Docker provides a consistent environment for running SWIPE X.

Without Docker, developers may need to manually configure:

- Python
- Python dependencies
- Node.js
- npm dependencies
- PostgreSQL
- PostgreSQL configuration
- Backend server
- Frontend server

With Docker, these components are packaged into containers and managed using Docker Compose.

The complete application can be started using:

```bash
docker compose up -d --build
```

---

## 5. Project Docker Structure

```text
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
```

---

## 6. Prerequisites

The following are required:

- Docker Desktop
- WSL 2 on Windows
- Git

Docker Desktop should be running before starting the application.

Check Docker:

```bash
docker --version
docker compose version
```

Check WSL:

```bash
wsl --status
wsl -l -v
```

---

## 7. Environment Variables

Backend environment variables are stored locally in:

```text
backend/.env
```

---

## 8. Docker Compose Services

The `docker-compose.yml` file contains three services:

- `postgres`
- `backend`
- `frontend`

### PostgreSQL Service

- The PostgreSQL service uses: `postgres:16-alpine`  
- It stores database data using: `postgres_data`  
- The backend waits for PostgreSQL to become healthy before starting.

### Backend Service

- The backend is built using: `backend/Dockerfile`  
- It runs FastAPI using Uvicorn on port: `8000`  
- The backend connects to PostgreSQL using: `postgres:5432`

### Frontend Service

- The frontend is built using: `frontend/Dockerfile`  
- The React/Vite application is built first and then served using Nginx.  
- The frontend is exposed on: `5173`

---

## 9. Backend Dockerization

The backend Dockerfile performs the following steps:

1. Uses a Python base image.
2. Sets the working directory.
3. Copies `requirements.txt`.
4. Installs Python dependencies.
5. Copies the backend source code.
6. Starts the FastAPI application using Uvicorn.

The backend dependencies are defined in:

```text
backend/requirements.txt
```

---

## 10. Frontend Dockerization

The frontend Dockerfile uses a multi-stage build.

### Build Stage

Node.js is used to:

1. Install npm dependencies.
2. Copy the React/Vite source code.
3. Build the frontend application.

### Production Stage

The generated frontend files are copied into an Nginx image.  
Nginx serves the React application.

---

## 11. Nginx Configuration

Nginx is used to serve the production build of the React application.

React Router requires an SPA fallback so that routes continue to work when the browser refreshes a page.

The Nginx configuration uses a fallback similar to:

```nginx
try_files $uri $uri/ /index.html;
```

This supports routes such as:

- `/login`
- `/register`
- `/profile`
- `/saved-jobs`
- `/applications`

---

## 12. PostgreSQL Connection

The project uses `psycopg2` as the PostgreSQL database driver.

The connection is created in:

```text
backend/database.py
```

The connection uses environment variables such as:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

The basic architecture is:

```text
FastAPI
   |
   v
psycopg2
   |
   v
PostgreSQL
```

### psycopg2 Usage

`psycopg2` is a Python PostgreSQL adapter.

It allows the FastAPI backend to:

- Open PostgreSQL connections
- Execute SQL queries
- Insert records
- Update records
- Delete records
- Retrieve records

---

## 13. Database Administration

The PostgreSQL database can be accessed using:

- PostgreSQL Shell (`psql`)

The project uses `psycopg2` from Python to communicate with PostgreSQL.

---

## 14. Docker Networking

Docker Compose automatically creates a network for the services.

- The backend can communicate with PostgreSQL using: `postgres:5432`  
- The frontend communicates with the backend through the exposed host port: `localhost:8000`

The communication flow is:

```text
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
postgres:5432
```

---

## 15. Frontend API Configuration

The frontend uses: `VITE_API_URL`

The Docker frontend build uses: `http://localhost:8000`

Therefore, API requests from the browser are sent to: `http://localhost:8000`

The frontend is available at: `http://localhost:5173`

---

## 16. CORS

FastAPI is configured with CORS middleware so that the frontend can communicate with the backend.

- The frontend runs at: `http://localhost:5173`  
- The backend runs at: `http://localhost:8000`

Therefore, the backend must allow requests from the frontend origin.

---

## 17. Building the Docker Images

From the project root:

```bash
docker compose build
```

To rebuild without using the build cache:

```bash
docker compose build --no-cache
```

To validate the Compose configuration:

```bash
docker compose config -q
```

If there is no output, the Compose configuration is valid.

---

## 18. Starting the Application

Start the containers:

```bash
docker compose up -d
```

Build and start:

```bash
docker compose up -d --build
```

The `-d` option runs the containers in detached mode.

---

## 19. Checking Container Status

Run:

```bash
docker compose ps
```

Expected services:

- `swipe-x-postgres`
- `swipe-x-backend`
- `swipe-x-frontend`

PostgreSQL should show a healthy status.

---

## 20. Application URLs

- Frontend: `http://localhost:5173`  
- Backend: `http://localhost:8000`  
- PostgreSQL: `localhost:5432`

---

## 21. Database Persistence

The volume is mounted at:

```text
/var/lib/postgresql/data
```

This allows PostgreSQL data to persist when the container is stopped or recreated.

Avoid using:

```bash
docker compose down -v
```

unless the database volumes are intentionally being deleted.

---

## 22. Resume Persistence

If the backend service contains the following Docker volume:

```yaml
volumes:
  - resume_data:/app/resumes
```

and the Compose file declares:

```yaml
volumes:
  postgres_data:
  resume_data:
```

then uploaded resume files are persisted using the `resume_data` volume.  
This prevents uploaded files from being lost when the backend container is recreated.

---

## 23. Database Initialization and Migration

- The original PostgreSQL database was created during development using PostgreSQL tools and SQL commands.  
- During Dockerization, the database was migrated into the Docker PostgreSQL container.  
- A temporary database backup was created during this process.  
- The database backup files are kept outside GitHub because they may contain application data.

For a completely fresh machine, the database schema and required seed data should be initialized through a reproducible SQL initialization/seed process.

---

## 24. PostgreSQL Tables

The SWIPE X database contains tables including:

- `users`
- `candidate_profiles`
- `jobs`
- `resumes`
- `saved_jobs`
- `applications`

To list the tables inside Docker PostgreSQL:

```bash
docker exec -it swipe-x-postgres psql -U postgres -d swipe_x -c "\dt"
```

---

## 25. Accessing PostgreSQL Shell

Open PostgreSQL inside the Docker container:

```bash
docker exec -it swipe-x-postgres psql -U postgres -d swipe_x
```

Inside the `psql` shell:

```sql
-- List tables
\dt

-- Check users
SELECT COUNT(*) FROM users;

-- Check jobs
SELECT COUNT(*) FROM jobs;

-- Exit
\q
```

---

## 26. Viewing Logs

Backend logs:

```bash
docker compose logs backend
```

Frontend logs:

```bash
docker compose logs frontend
```

PostgreSQL logs:

```bash
docker compose logs postgres
```

All logs:

```bash
docker compose logs
```

Follow logs continuously:

```bash
docker compose logs -f
```

---

## 27. Stopping the Application

Stop the containers:

```bash
docker compose down
```

This stops and removes the containers while keeping named Docker volumes.

---

## 28. Restarting the Application

Start again:

```bash
docker compose up -d
```

Rebuild and start:

```bash
docker compose up -d --build
```

---

## 29. Troubleshooting

### Docker Engine Is Not Running

- Open Docker Desktop and make sure the Docker Engine is running.  
- Check:

  ```bash
  docker info
  ```

### PostgreSQL Is Not Starting

- Check:

  ```bash
  docker compose ps
  ```

- Then:

  ```bash
  docker compose logs postgres
  ```

### Backend Cannot Connect to PostgreSQL

- Verify in `backend/.env`:

  ```env
  POSTGRES_HOST=postgres
  POSTGRES_PORT=5432
  ```

- Then check:

  ```bash
  docker compose logs backend
  docker compose logs postgres
  ```

### Database Table Does Not Exist

- Check the tables:

  ```bash
  docker exec -it swipe-x-postgres psql -U postgres -d swipe_x -c "\dt"
  ```

- If tables are missing, verify the database initialization or migration process.

### Frontend Cannot Reach Backend

- Check:

  ```bash
  docker compose ps
  ```

- Then open:

  ```text
  http://localhost:8000
  ```

- Verify the frontend API URL:

  ```env
  VITE_API_URL=http://localhost:8000
  ```

### React Route Gives 404 After Refresh

- Check the Nginx configuration and make sure the SPA fallback is configured:

  ```nginx
  try_files $uri $uri/ /index.html;
  ```

---

## 30. Complete Docker Workflow

The complete workflow is:

```text
Start Docker Desktop
        |
        v
Configure backend/.env
        |
        v
Validate Docker Compose
        |
        v
Build Docker Images
        |
        v
Start Containers
        |
        v
Check Container Status
        |
        v
Verify PostgreSQL
        |
        v
Open Frontend
        |
        v
Test Backend
        |
        v
Test Database
        |
        v
Test SWIPE X Features
```

Main commands:

```bash
docker compose config -q
docker compose build
docker compose up -d
docker compose ps
```

---

## 31. Testing Checklist

After starting Docker, verify:

- Docker Engine is running  
- PostgreSQL container is running  
- PostgreSQL health check passes  
- Backend container is running  
- Frontend container is running  
- Frontend opens successfully  
- Backend API is accessible  
- PostgreSQL connection works  
- User registration works  
- User login works  
- Profile functionality works  
- Resume upload works  
- Resume parsing works  
- ATS functionality works  
- AI job matching works  
- Saved jobs work  
- Applications work  

---

## 32. Running SWIPE X on Another Computer

Docker makes the application environment portable.

A mentor or another developer can use:

```text
GitHub Repository
       |
       v
Clone Repository
       |
       v
Checkout revanth-gatla
       |
       v
Install Docker Desktop
       |
       v
Create backend/.env
       |
       v
docker compose up -d --build
       |
       v
Open http://localhost:5173
```

The application runs on the other computer's own Docker environment.  
Their `localhost` refers to their own computer.  
They do not need access to the developer's `localhost` or Docker containers.

---

## 33. Important Note About PostgreSQL Data

Docker images and Docker Compose configuration can be shared through GitHub.  
Docker volumes are local to each machine.

Therefore:

**Your Computer**

```text
+-- postgres_data
+-- Docker containers
```

**Mentor's Computer**

```text
+-- separate postgres_data
+-- separate Docker containers
```

The mentor's Docker PostgreSQL database does not automatically contain the developer's local database volume.

For complete portability, database schema creation and required seed data should be provided through a reproducible SQL initialization or migration process.

---

## 34. Final Architecture

```text
                         USER
                          |
                          v
                   Web Browser
                          |
                          | HTTP
                          v
                +-------------------+
                | Frontend Container|
                | React + Nginx     |
                | Port: 80          |
                +---------+---------+
                          |
                          | API Requests
                          v
                +-------------------+
                | Backend Container |
                | FastAPI + Uvicorn |
                | Port: 8000        |
                +---------+---------+
                          |
                          | psycopg2
                          v
                +-------------------+
                | PostgreSQL        |
                | postgres:16-alpine|
                | Port: 5432        |
                +-------------------+
                          |
                    postgres_data
                    Docker Volume
```

---

## 35. Final Result

SWIPE X has been containerized using Docker and Docker Compose.

The final environment contains:

- Frontend       → React + Vite + Nginx  
- Backend        → FastAPI + Uvicorn  
- Database       → PostgreSQL 16  
- Database Driver→ psycopg2  
- Networking     → Docker Compose Network  
- Persistence    → Docker Volumes  
- Configuration  → Environment Variables  

The application can be started using:

```bash
docker compose up -d --build
```

The frontend is available at:

```text
http://localhost:5173
```

The backend is available at:

```text
http://localhost:8000
```

Docker provides a consistent environment for running the SWIPE X frontend, backend, and PostgreSQL services together.