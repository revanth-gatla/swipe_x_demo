# SWIPE X — AI-Powered Job Discovery & Recommendation Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Container-Docker%20%26%20Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)

**SWIPE X** is an intelligent, modern job discovery and recommendation platform designed to eliminate recruitment fatigue. Combining a swipe-based card interface with a 70/20/10 AI matching algorithm, real-time ATS resume compatibility analysis, and a search catalog of over 33,000+ tech jobs, SWIPE X helps candidates find and evaluate career opportunities faster and smarter.

---

## Key Features

### 1. Intelligent 70/20/10 Recommendation Engine
- **70% Content Similarity**: TF-IDF vectorization and cosine similarity between candidate resume/skills and job requirements.
- **20% Interaction Feedback**: Adaptive scoring dynamically adjusted by candidate swipe behavior (upvoting similar roles on "Interested", downvoting on "Pass").
- **10% Role & Experience Alignment**: Baseline matching on title keywords, experience level, and preferred locations.

### 2. Interactive Swipe Deck
- Intuitive card swiping (touch drag, mouse drag, click, and keyboard shortcuts):
  - **Swipe Right** (`→`): Interested / High Match
  - **Swipe Left** (`←`): Pass / Not Interested
  - **Swipe Down** (`↓`): Save for Later
- Live progress indicator and responsive card animation with action badges.

### 3. Discover Jobs Catalog
- Full-text search across 33,000+ real-world tech positions (LinkedIn job dataset).
- Real-time search by job title, company name, or geographic location.
- Multi-badge metadata (employment type, workplace mode, salary estimates, experience requirements).
- Paginated grid layout with instant save and direct application links.

### 4. Job-Specific ATS Compatibility Scanner
- Analyzes candidate's uploaded resume directly against any specific position.
- Highlights:
  - **ATS Compatibility Score** (0–100%)
  - **Matched Keywords & Skills**
  - **Missing Critical Requirements**
  - **Actionable Optimization Suggestions** to improve resume visibility.
- Automatically cached and instantly available in the Complete Details modal.

### 5. Adaptive Dark & Light Modes
- Seamless theme toggle positioned in the candidate workspace topbar.
- Full dark mode palette with high-contrast typography, borderless swipe indicators, and styled modals.
- Persistent state saved to `localStorage` and system theme awareness.

### 6. Candidate Workspace & Swipe History
- **Resume Hub**: Upload and parse PDF/DOCX resumes with automated skill extraction.
- **Candidate Profile**: Configurable skills, target titles, experience level, and location preferences.
- **Swipe History**: Chronological log of all interactions with status filters (*Applied*, *Saved*, *Passed*).

---

## System Architecture

```text
                          +------------------------------------------+
                          |           SWIPE X Client (React)         |
                          |  - Swipe Card Deck & Gesture Engine      |
                          |  - Discover Jobs Catalog & Pagination    |
                          |  - Dark / Light Theme Controller         |
                          |  - Inline ATS Scan Reports & Modals      |
                          +--------------------+---------------------+
                                               |
                                               | HTTP / REST (Port 5173 / Nginx)
                                               v
                          +--------------------+---------------------+
                          |           FastAPI Application            |
                          |  - JWT Authentication & Authorization    |
                          |  - 70/20/10 AI Recommendation Pipeline   |
                          |  - TF-IDF Keyword Extraction Engine      |
                          |  - ATS Resume Compatibility Analyzer     |
                          |  - Job Catalog & Search Endpoints        |
                          +--------------------+---------------------+
                                               |
                                               | SQL Queries (Port 5432)
                                               v
                          +--------------------+---------------------+
                          |          PostgreSQL 16 Database          |
                          |  - users, profiles, resumes              |
                          |  - jobs (33k+ dataset), user_swipes      |
                          |  - ats_scans (cached compatibility data) |
                          +------------------------------------------+
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Vanilla CSS Design System, Lucide Icons |
| **Backend** | FastAPI, Uvicorn, Python 3.11+, Pydantic v2 |
| **Machine Learning** | Scikit-Learn (TfidfVectorizer, cosine_similarity), NumPy |
| **Resume Processing** | PyPDF2, pdfplumber, python-docx |
| **Database** | PostgreSQL 16, psycopg2-binary |
| **Authentication** | OAuth2 Password Bearer, JWT (python-jose), Passlib (bcrypt) |
| **DevOps & Containers** | Docker, Docker Compose, Multi-stage builds, Nginx |

---

## Project Structure

```text
job-discovery-platform/
├── backend/
│   ├── app.py                     # Main FastAPI endpoints and business logic
│   ├── auth.py                    # JWT authentication, token issuance, password hashing
│   ├── database.py                # Database connection pooling & schema migrations
│   ├── import_linkedin_jobs.py    # Ingestion script for 33k+ tech jobs dataset
│   ├── test_system.py             # Automated API and system test suite
│   ├── requirements.txt           # Python dependencies
│   └── Dockerfile                 # Backend container definition
│
├── frontend/
│   ├── src/
│   │   ├── components/            # Layout, Navigation, ProtectedRoute
│   │   ├── pages/                 # RecommendedJobs, DiscoverJobs, Profile, Resume, SwipeHistory, Login
│   │   ├── services/              # API client and client-side report caching
│   │   ├── App.css                # Component-level styles
│   │   ├── index.css              # Global design system & Dark/Light mode tokens
│   │   └── App.jsx                # Route definitions
│   ├── nginx.conf                 # Production reverse proxy configuration
│   ├── package.json               # Frontend dependencies
│   └── Dockerfile                 # Frontend multi-stage container definition
│
├── docs/
│   └── dockerize.md               # Complete Docker containerization guide
├── docker-compose.yml             # Full-stack Docker orchestration
├── start.bat                      # Windows quick-start batch script
├── start_project.ps1              # PowerShell quick-start script
└── README.md                      # Project documentation
```

---

## Getting Started

### Option 1: Running with Docker (Recommended)

Make sure Docker Desktop is installed and running, then execute:

```bash
docker compose up -d --build
```

Access the services:
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL**: `localhost:5432`

> For full details on container configuration, volumes, and troubleshooting, see [docs/dockerize.md](docs/dockerize.md).

---

### Option 2: Running Locally Without Docker

#### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL 14+ running locally

#### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Configure your environment variables in `backend/.env`:
```env
DB_NAME=swipe_x_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
SECRET_KEY=your_secure_secret_key_here
```

Start the FastAPI backend:
```bash
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at [http://localhost:5173](http://localhost:5173).

---

## Core API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new candidate account |
| `POST` | `/auth/login` | Authenticate and obtain JWT bearer token |
| `GET` | `/profile` | Fetch user profile and preferences |
| `PUT` | `/profile` | Update profile information and skills |
| `POST` | `/resume/upload` | Upload and parse candidate resume |
| `GET` | `/jobs/recommendations` | Get personalized jobs based on 70/20/10 AI algorithm |
| `GET` | `/jobs/discover` | Search and paginate the 33,000+ job catalog |
| `POST` | `/jobs/swipe` | Record swipe action (`LEFT`, `RIGHT`, `SAVE`) |
| `GET` | `/jobs/swipe-history` | Retrieve user's swipe and application history |
| `POST` | `/ats/scan/{job_id}` | Generate job-specific ATS compatibility score |

---

## Documentation

- Detailed Docker & Container Deployment Guide: [docs/dockerize.md](docs/dockerize.md)

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.