# SWIPE X – Candidate Workflow

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

7. Swipe-Based Job Interaction

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
8. Applications

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
The Saved Jobs section contains jobs saved by the candidate.

Candidates can:

View saved jobs
Apply for a saved job
Remove a saved job

Backend APIs(used):
GET    /saved-jobs
POST   /jobs/{job_id}/apply
DELETE /jobs/{job_id}/save


----
10. Core Candidate Workflow

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



####The main purpose of the Candidate Workflow is to provide a simple AI-powered, swipe-based job discovery and application experience.