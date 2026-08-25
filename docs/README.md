```# SWIPE X – Candidate Workflow

## 1. Overview

The Candidate Workflow allows users to register, create their profile, upload and analyze their resume, discover AI-matched jobs, and manage job applications and saved jobs.

---

## 2. Complete Candidate Flow


Register / Login
       ↓
Candidate Dashboard
       ↓
Profile
       ↓
Resume & ATS
       ↓
AI Job Matching
       ↓
Job Cards
       ↓
┌────────────┬────────────┬────────────┐
│  ← LEFT    │  ↓ DOWN    │  RIGHT →   │
│   SKIP     │   SAVE     │   APPLY    │
└────────────┴────────────┴────────────┘
       │           │            │
       ↓           ↓            ↓
    Next Job   Saved Jobs   Applications
                              │
                              ↓
                       Application Status
    
## 3. Authentication

The candidate first creates an account and logs in.

Register
   ↓
Login
   ↓
Access Token
   ↓
Candidate Dashboard

--The authenticated candidate can access protected features such as Profile, Resume, AI Matching, Applications and Saved Jobs.

4. Candidate Profile

The candidate maintains their professional information:

Phone Number
Location
Education
Experience
Skills
About / Bio

This information helps build the candidate's profile and contributes to job matching.

## 5 - Resume&ATS

The candidate uploads a PDF resume.

Upload Resume
      ↓
Parse Resume
      ↓
Extract Skills & Experience
      ↓
ATS Analysis
      ↓
ATS Score

The extracted resume information is used by the AI job-matching workflow.

----
##6. AI Job Matching

The system compares the candidate's profile/resume information with available jobs.

The matching process considers:

Candidate skills
Required job skills
Candidate experience
Required experience
Job title and description relevance

Each recommended job receives a match percentage and displays matched and missing skills.
------

##7. Swipe-Based Job Interaction

The candidate interacts with job cards by dragging them.

← Left: Skip
Drag Job Card ←
       ↓
     SKIP
       ↓
Next Job

The job is skipped and no application or saved-job record is created.

↓ Down: Save
Drag Job Card ↓
       ↓
     SAVE
       ↓
Saved Jobs

The job is stored in the candidate's saved jobs.

Backend API:
POST /jobs/{job_id}/save

→ Right: Apply
Drag Job Card →
       ↓
     APPLY
       ↓
Applications

Backend API:
POST /jobs/{job_id}/apply

The initial application status is: Applied

----
##8. Applications

The Applications section shows all jobs applied for by the candidate.

Each application contains:

Job
Company
Application ID
Applied Date
Status
-
Applications are retrieved using:
GET /applications

---
##9.The Saved Jobs section contains jobs saved by the candidate.

Candidates can:

View saved jobs
Apply for a saved job
Remove a saved job

Backend APIs(used):
GET    /saved-jobs
POST   /jobs/{job_id}/apply
DELETE /jobs/{job_id}/save


----
##10. Core Candidate Workflow

The complete candidate-side workflow is:
                    CANDIDATE
                       │
                       ▼
                 REGISTER / LOGIN
                       │
                       ▼
                    PROFILE
                       │
                       ▼
                  RESUME & ATS
                       │
                       ▼
                 AI JOB MATCHING
                       │
                       ▼
                    JOB CARD
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       ← LEFT       ↓ DOWN       RIGHT →
        SKIP         SAVE          APPLY
          │            │            │
          ▼            ▼            ▼
      NEXT JOB    SAVED JOBS   APPLICATIONS
                       │
                       ▼
                     APPLY
                       │
                       ▼
                 APPLICATIONS


----------
MAIN CANDIDATE APIS(BACKEND):
| Action           | API                          |
| ---------------- | ---------------------------- |
| Register         | `POST /register`             |
| Login            | `POST /login`                |
| Profile          | `GET/POST/PUT /profile`      |
| Get Jobs         | `GET /jobs`                  |
| AI Matches       | `GET /recommended-jobs`      |
| Apply            | `POST /jobs/{job_id}/apply`  |
| Applications     | `GET /applications`          |
| Save Job         | `POST /jobs/{job_id}/save`   |
| Saved Jobs       | `GET /saved-jobs`            |
| Remove Saved Job | `DELETE /jobs/{job_id}/save` |



####The main purpose of the Candidate Workflow is to provide a simple AI-powered, swipe-based job discovery and application experience.```

```
---->To run the application using docker:

## 11. How to Run the Project Using Docker

SwipeX can be run completely using Docker and Docker Compose. Follow the steps below to set up and run the application.

### Step 1: Install Docker

Install and start **Docker Desktop** on your system.

Verify that Docker is installed:

```bash
docker --version
```

Verify Docker Compose:

```bash
docker compose version
```

Make sure Docker Desktop is running before continuing.

---

### Step 2: Clone the Repository

Clone the SwipeX repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
```

Navigate to the project directory:

```bash
cd <PROJECT_FOLDER_NAME>
```

---

### Step 3: Configure Environment Variables

Create the required `.env` files according to the project's configuration.

The backend environment should contain the required database configuration, secret key, and GROQ API key.

Example:

```env
DATABASE_URL=<YOUR_DATABASE_URL>
SECRET_KEY=<YOUR_SECRET_KEY>
GROQ_API_KEY=<YOUR_GROQ_API_KEY>
```

The frontend environment should contain the backend API URL.

Example:

```env
VITE_API_URL=http://localhost:<BACKEND_PORT>
```

> Never commit `.env` files or API keys to the GitHub repository.

---

### Step 4: Build the Docker Images

From the root directory of the project, run:

```bash
docker compose build
```

This builds the Docker images required by the SwipeX application.

---

### Step 5: Start the Application

Start all configured services using:

```bash
docker compose up
```

To run the application in the background:

```bash
docker compose up -d
```

Docker Compose will start the services defined in the `docker-compose.yml` file.

---

### Step 6: Check Running Containers

Verify that all required containers are running:

```bash
docker ps
```

The SwipeX frontend, backend, database, and other configured services should appear in the list.

---

### Step 7: Check Container Logs

If required, view the application logs using:

```bash
docker compose logs
```

To view logs for a specific service:

```bash
docker compose logs <service_name>
```

---

### Step 8: Access SwipeX

Once all containers are running, open the frontend in your browser:

```text
http://localhost:<FRONTEND_PORT>
```

Use the frontend port configured in the project's `docker-compose.yml` file.

---

### Step 9: Test the Candidate Workflow

After opening SwipeX:

```text
Register
   ↓
Login
   ↓
Candidate Profile
   ↓
Upload Resume
   ↓
Resume Parsing & ATS
   ↓
AI Job Matching
   ↓
Recommended Job Cards
   ↓
 ┌─────────┬─────────┬─────────┐
 │  SKIP   │  SAVE   │  APPLY  │
 └─────────┴─────────┴─────────┘
```

Verify that the candidate can:

* Register and login
* Complete the profile
* Upload a resume
* Generate the ATS analysis
* View the ATS score
* View AI-recommended jobs
* View job match percentages
* Skip jobs
* Save jobs
* Apply for jobs
* View saved jobs
* View applications

---

### Step 10: Stop the Application

To stop the running Docker containers:

```bash
docker compose down
```

This stops and removes the containers while keeping the Docker images and persistent volumes.

---

### Step 11: Restart the Application

If the Docker images have already been built, start the application again using:

```bash
docker compose up -d
```

If code or Docker configuration has been changed and the images need to be rebuilt:

```bash
docker compose up --build -d
```

---

### Step 12: Useful Docker Commands

**Build the application:**

```bash
docker compose build
```

**Start the application:**

```bash
docker compose up
```

**Start in background:**

```bash
docker compose up -d
```

**Rebuild and start:**

```bash
docker compose up --build -d
```

**Check running containers:**

```bash
docker ps
```

**View logs:**

```bash
docker compose logs
```

**Stop the application:**

```bash
docker compose down
```

**Stop and remove volumes:**

```bash
docker compose down -v
```

> Use `docker compose down -v` carefully because removing volumes may delete persistent local database data.

---

### Docker Execution Flow

```text
Clone Repository
       ↓
Configure .env
       ↓
Start Docker Desktop
       ↓
docker compose build
       ↓
docker compose up -d
       ↓
Docker Containers Start
       ↓
Frontend + Backend + Database
       ↓
Open localhost URL
       ↓
SwipeX Application



