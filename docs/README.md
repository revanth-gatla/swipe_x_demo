# SWIPE X – Candidate Workflow & System Architecture

## 1. Overview

**SWIPE X** is an AI-powered job discovery and recommendation platform designed to eliminate recruitment fatigue and streamline career exploration.

By combining an intuitive swipe-based interaction deck, a weighted **70/20/10 AI recommendation engine**, a searchable catalog of **33,000+ real-world tech positions**, automated **ATS resume compatibility scanning**, and an adaptive **Dark/Light Mode UI**, SWIPE X delivers a high-impact, frictionless experience for job seekers.

---

## 2. Complete Candidate Journey

```text
                           +---------------------------+
                           |    Candidate Register     |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |      Candidate Login      |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |  Candidate Profile Setup  |
                           |  (Skills, Target Titles)  |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |  Upload & Parse Resume    |
                           |  (PDF Extraction & ATS)   |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |   70/20/10 AI Matching    |
                           |   (Recommendations Deck)  |
                           +-------------+-------------+
                                         |
                +------------------------+------------------------+
                |                                                 |
                v                                                 v
    +-----------------------+                         +-----------------------+
    | Interactive SwipeDeck |                         | Discover Jobs Catalog |
    |   (Swipe Card UI)     |                         | (33k+ Search & Filter)|
    +-----------+-----------+                         +-----------+-----------+
                |                                                 |
                +------------------------+------------------------+
                                         |
                                         v
                           +---------------------------+
                           | View Complete Job Details |
                           |   (Internal ATS Scan)     |
                           +-------------+-------------+
                                         |
        +--------------------------------+--------------------------------+
        |                                |                                |
        v                                v                                v
  ← SWIPE LEFT                     ↓ SWIPE DOWN                     SWIPE RIGHT →
    [ PASS ]                         [ SAVE ]                       [ INTERESTED ]
        |                                |                                |
        v                                v                                v
  Next Recommendation               Saved Jobs                     Applied / High Match
        |                                |                                |
        +--------------------------------+--------------------------------+
                                         |
                                         v
                           +---------------------------+
                           |    Swipe History Log      |
                           |   (Filter & Application)  |
                           +---------------------------+
```

---

## 3. Core Modules & Candidate Features

### 3.1 Authentication & Security
- **Registration**: Quick candidate registration with full name, email, and secure password.
- **Login & JWT**: Generates signed JSON Web Tokens (JWT) for stateless, secure session authorization.
- **Protected Routes**: Candidates securely access their personal profile, uploaded resumes, AI recommendations, and application history.

### 3.2 Candidate Profile
- **Career Preferences**: Target job titles, industry domain, and preferred workplace type (Remote / Hybrid / On-site).
- **Qualifications**: Experience level (years of experience as numeric representation) and educational background.
- **Skills Inventory**: Comma-separated list of technical proficiencies, frameworks, and programming languages.
- **Bio & Contact Details**: Professional overview, location, and contact information.

### 3.3 Resume Hub & Automated Parsing
- **PDF Extraction**: Extracts raw text cleanly from uploaded PDF resumes using high-performance parsing (`fitz` / PyMuPDF).
- **Automated Skill Extraction**: Identifies core competencies, libraries, tools, and years of experience automatically.
- **Candidate Re-use**: Uploaded resume data is persistently stored and reused across recommendation feeds and ATS scans without re-uploading.

### 3.4 70/20/10 AI Job Matching Engine
Recommendations are dynamically scored using a hybrid recommendation algorithm:
1. **70% Content Similarity**: Vector-based cosine similarity and TF-IDF comparison between candidate skills/resume and job requirements.
2. **20% Interaction Feedback**: Adaptive weights based on historical swipe activity (reinforcing categories the user marks as *Interested*, penalizing patterns marked as *Pass*).
3. **10% Role & Seniority Alignment**: Exact and fuzzy matching on target job title, seniority, and years of experience.

Each recommended card displays:
- Overall match percentage (0–100%)
- Matched candidate skills (highlighted in green)
- Missing job requirements (highlighted in amber/red)
- Key metadata: Company, location, employment type, salary estimates.

### 3.5 Interactive Swipe-Based Interaction
Candidates interact with AI-matched cards with responsive drag gestures, clicks, or keyboard navigation:
- **Swipe Right (`→`) / Click Interested**: Marks the job as interested / applied. Reinforces the AI model to recommend similar roles.
- **Swipe Left (`←`) / Click Pass**: Skips the job. The recommendation engine downvotes similar roles in future cycles.
- **Swipe Down (`↓`) / Click Save**: Adds the job to the candidate's Saved Jobs tab for later evaluation.

### 3.6 Internal & On-Demand ATS Resume Compatibility Scan
- Whenever a candidate clicks **"View Complete Details"** on any job card in either the **Recommended Jobs** or **Discover Jobs** section, an automated ATS scan runs internally against their current active resume.
- **Low User Friction**: Candidates do not need to manually trigger separate scans or re-upload resumes.
- **Cached Performance**: Once calculated, the scan is cached in the database for instant retrieval.
- **Comprehensive ATS Report**:
  - **ATS Compatibility Score** (0–100%)
  - **Identified Keyword Matches**
  - **Missing Critical Skills**
  - **Tailored Improvement Recommendations** to optimize the candidate's resume for that specific role.

### 3.7 Discover Jobs Catalog (33,000+ Jobs)
- Comprehensive searchable directory populated with 33,000+ real-world tech positions.
- **Instant Search**: Filter by job title, company name, or geographic location in real time.
- **Paginated Grid View**: Clean browsing with direct external apply links and quick-save buttons.
- **Complete Details Modal**: Full job description with embedded ATS compatibility scanner.

### 3.8 Swipe History & Interaction Tracking
- Chronological timeline of every interaction performed by the candidate.
- Filter interactions by status: **All**, **Interested**, **Saved**, or **Passed**.
- Direct application links to finalize pending applications.

### 3.9 Adaptive Dark & Light Modes
- User-selectable mode toggle located in the navigation header (left of the user profile).
- High-contrast typography and borderless swipe indicators tailored for Dark Mode.
- Complete adaptive styling across all modals, ATS reports, and job cards.
- Persistent state saved in browser storage.

---

## 4. System Architecture

```text
+--------------------------------------------------------------------------------+
|                               FRONTEND LAYER                                   |
|  React 19 + Vite | React Router DOM | Axios Interceptors | Modern CSS3 Tokens  |
|                                                                                |
|  [ Recommended Jobs ]   [ Discover Jobs ]   [ Resume Hub ]   [ Profile ]       |
|    (Swipe Gesture Deck)   (33k+ Catalog)     (PDF Upload)     (Preferences)    |
+---------------------------------------+----------------------------------------+
                                        |
                                        | REST API / JSON (Bearer JWT Auth)
                                        v
+--------------------------------------------------------------------------------+
|                                BACKEND LAYER                                   |
|                    FastAPI (Python 3.11+) + Uvicorn Worker                     |
|                                                                                |
|  +---------------------+  +----------------------+  +-----------------------+  |
|  |   Auth & Security   |  | 70/20/10 AI Matcher  |  | ATS Scanner (Groq)    |  |
|  |   (JWT, Bcrypt)     |  | (TF-IDF & Cosine)    |  | (LLM + Heuristics)    |  |
|  +---------------------+  +----------------------+  +-----------------------+  |
|  +---------------------+  +----------------------+  +-----------------------+  |
|  | Resume Extraction   |  | Catalog & Search     |  | Swipe History Tracker |  |
|  | (fitz / PyMuPDF)    |  | (Pagination / Index) |  | (Activity Log)        |  |
|  +---------------------+  +----------------------+  +-----------------------+  |
+---------------------------------------+----------------------------------------+
                                        |
                                        | SQL Queries / Connection Pooling
                                        v
+--------------------------------------------------------------------------------+
|                               DATABASE LAYER                                   |
|                            PostgreSQL 16 Engine                                |
|                                                                                |
|  - users                 - candidate_profiles     - resumes                    |
|  - jobs (33k+ dataset)   - user_swipes            - ats_scans                  |
+--------------------------------------------------------------------------------+
```

---

## 5. Main Candidate API Endpoints

All protected endpoints require the HTTP header:  
`Authorization: Bearer <access_token>`

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `POST` | `/register` | Register a new candidate account | No |
| `POST` | `/login` | Authenticate and retrieve JWT access token | No |
| `GET` | `/` | API status and health check | No |
| `GET` | `/test-db` | Database connection validation | No |
| `POST` | `/profile` | Create initial candidate profile | Yes |
| `GET` | `/profile` | Retrieve candidate profile and skills | Yes |
| `PUT` | `/profile` | Update candidate profile attributes | Yes |
| `POST` | `/resume/upload` | Upload PDF resume, extract text and parse skills | Yes |
| `GET` | `/resume` | Retrieve parsed resume metadata and skills | Yes |
| `GET` | `/recommended-jobs` | Fetch AI-matched jobs (70/20/10 algorithm) | Yes |
| `GET` | `/discover-jobs` | Search & paginate 33,000+ jobs catalog | Yes |
| `GET` | `/jobs/{job_id}` | Fetch full details for a single job | Yes |
| `POST` | `/swipe` | Record swipe action (`interested`, `save`, `pass`) | Yes |
| `GET` | `/swipe-history` | Fetch history of candidate interactions | Yes |
| `POST` | `/ats/analyze/{job_id}` | Trigger ATS resume compatibility scan | Yes |
| `GET` | `/ats/report/{job_id}` | Retrieve cached ATS compatibility report | Yes |

---

## 6. How to Run the Project Using Docker

SWIPE X is fully containerized using Docker and Docker Compose for seamless deployment across environments.

### Step 1: Verify Prerequisites
Ensure Docker and Docker Compose are installed:
```bash
docker --version
docker compose version
```

### Step 2: Configure Environment Variables
Ensure the backend environment file exists at `backend/.env`:
```env
GROQ_API_KEY=<your_groq_api_key>
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=swipe_x
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET_KEY=your_jwt_secret_key
```

### Step 3: Build Docker Containers
Build the container images from the root directory:
```bash
docker compose build
```

### Step 4: Launch Application Services
Start all services (PostgreSQL, Backend API, and Frontend Nginx) in detached mode:
```bash
docker compose up -d
```

### Step 5: Verify Running Containers
Check that all three containers are healthy:
```bash
docker ps
```

You should see:
- `swipe-x-postgres` (PostgreSQL 16)
- `swipe-x-backend` (FastAPI on port 8000)
- `swipe-x-frontend` (React + Nginx on port 5173 or 80)

### Step 6: Access the Application
Open your browser and navigate to:
```text
http://localhost:5173
```

---

## 7. Useful Docker Commands

| Action | Command |
|---|---|
| Start services | `docker compose up -d` |
| View combined logs | `docker compose logs -f` |
| View backend logs | `docker compose logs -f backend` |
| View frontend logs | `docker compose logs -f frontend` |
| View database logs | `docker compose logs -f postgres` |
| Rebuild and start | `docker compose up --build -d` |
| Stop services | `docker compose down` |
| Stop and remove volumes | `docker compose down -v` |
