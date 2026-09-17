from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db_connection
from passlib.context import CryptContext
from pydantic import EmailStr, BaseModel
from auth import create_access_token, verify_token
import os
import shutil
import uuid
import fitz
from fastapi import UploadFile, File
from groq import Groq
import json
from pathlib import Path
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import re
import traceback
import time
import math

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE, override=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not set. Add it to backend/.env or as an environment variable.")

app = FastAPI(title="SWIPE X API")

# Build CORS origins: always allow localhost, plus deployed frontend URL if set
_cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_frontend_url = os.getenv("FRONTEND_URL")
if _frontend_url:
    _cors_origins.append(_frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # 1. Auto-seed database with 33,000+ jobs if needed
    try:
        from auto_seed import seed_database
        seed_database()
    except Exception as e:
        print("[Startup] Auto-seed warning:", e)

    # 2. Warm up in-memory jobs catalog cache
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        _get_cached_jobs_catalog(cur)
        cur.close()
        conn.close()
        print("[Startup] Jobs catalog cache pre-warmed into memory (33,000+ jobs ready).")
    except Exception as e:
        print("[Startup] Catalog pre-warm skipped or failed:", e)

client = Groq(api_key=GROQ_API_KEY)
security = HTTPBearer()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

def get_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    user_id = verify_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    return user_id


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileRequest(BaseModel):
    phone: str = ""
    location: str = ""
    education: str = ""
    experience_years: float = 0
    skills: str = ""
    bio: str = ""
    preferred_roles: str = ""
    preferred_locations: str = ""
    career_interests: str = ""
    work_mode_preference: str = ""


class SwipeRequest(BaseModel):
    job_id: int
    action: str  # LEFT, RIGHT, SAVE


# ---------------------------------------------------------------------------
# Health / test
# ---------------------------------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "SWIPE X Backend"
    }


@app.get("/test-db")
def test_db():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT current_database();"
    )

    result = cursor.fetchone()

    cursor.close()
    connection.close()

    return {
        "database": result[0]
    }


# ---------------------------------------------------------------------------
# Auth: Register + Login
# ---------------------------------------------------------------------------

@app.post("/register")
def register(
    name: str,
    email: EmailStr,
    password: str
):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE email = %s;
            """,
            (email,)
        )

        existing_user = cursor.fetchone()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Email already registered"
            )

        hashed_password = pwd_context.hash(password)

        cursor.execute(
            """
            INSERT INTO users
            (name, email, password)
            VALUES (%s, %s, %s)
            RETURNING id;
            """,
            (
                name,
                email,
                hashed_password
            )
        )

        user_id = cursor.fetchone()[0]

        connection.commit()

        return {
            "message": "Registration successful",
            "user_id": user_id
        }

    finally:
        cursor.close()
        connection.close()


@app.post("/login")
def login(data: LoginRequest):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id, name, password
            FROM users
            WHERE email = %s;
            """,
            (data.email,)
        )

        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User does not exist"
            )

        user_id = user[0]
        name = user[1]
        stored_password = user[2]

        if not pwd_context.verify(
            data.password,
            stored_password
        ):
            raise HTTPException(
                status_code=401,
                detail="Incorrect password"
            )

        token = create_access_token(user_id)

        return {
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "name": name
        }

    finally:
        cursor.close()
        connection.close()


# ---------------------------------------------------------------------------
# Profile CRUD (with new preference fields)
# ---------------------------------------------------------------------------

@app.post("/profile")
def create_profile(
    profile: ProfileRequest,
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO candidate_profiles
            (
                user_id,
                phone,
                location,
                education,
                experience_years,
                skills,
                bio,
                preferred_roles,
                preferred_locations,
                career_interests,
                work_mode_preference
            )
            VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                user_id,
                profile.phone,
                profile.location,
                profile.education,
                profile.experience_years,
                profile.skills,
                profile.bio,
                profile.preferred_roles,
                profile.preferred_locations,
                profile.career_interests,
                profile.work_mode_preference,
            )
        )

        profile_id = cursor.fetchone()[0]

        connection.commit()
        invalidate_recommendation_cache(user_id)

        return {
            "message": "Profile created successfully",
            "profile_id": profile_id
        }

    finally:
        cursor.close()
        connection.close()


@app.get("/profile")
def get_profile(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                phone,
                location,
                education,
                experience_years,
                skills,
                bio,
                preferred_roles,
                preferred_locations,
                career_interests,
                work_mode_preference
            FROM candidate_profiles
            WHERE user_id = %s;
            """,
            (user_id,)
        )

        profile = cursor.fetchone()

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Profile not found"
            )

        return {
            "phone": profile[0],
            "location": profile[1],
            "education": profile[2],
            "experience_years": float(profile[3]) if profile[3] is not None else 0,
            "skills": profile[4],
            "bio": profile[5],
            "preferred_roles": profile[6] or "",
            "preferred_locations": profile[7] or "",
            "career_interests": profile[8] or "",
            "work_mode_preference": profile[9] or "",
        }

    finally:
        cursor.close()
        connection.close()


@app.put("/profile")
def update_profile(
    profile: ProfileRequest,
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            UPDATE candidate_profiles
            SET
                phone = %s,
                location = %s,
                education = %s,
                experience_years = %s,
                skills = %s,
                bio = %s,
                preferred_roles = %s,
                preferred_locations = %s,
                career_interests = %s,
                work_mode_preference = %s
            WHERE user_id = %s
            RETURNING id;
            """,
            (
                profile.phone,
                profile.location,
                profile.education,
                profile.experience_years,
                profile.skills,
                profile.bio,
                profile.preferred_roles,
                profile.preferred_locations,
                profile.career_interests,
                profile.work_mode_preference,
                user_id,
            )
        )

        result = cursor.fetchone()

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Profile not found"
            )

        connection.commit()
        invalidate_recommendation_cache(user_id)

        return {
            "message": "Profile updated successfully",
            "profile_id": result[0]
        }

    finally:
        cursor.close()
        connection.close()


# ---------------------------------------------------------------------------
# Jobs (read)
# ---------------------------------------------------------------------------

@app.get("/jobs")
def get_jobs():
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                title,
                company,
                location,
                description,
                required_skills,
                experience_required,
                salary,
                job_type,
                application_url,
                created_at,
                experience_level,
                remote_allowed,
                work_mode,
                source
            FROM jobs
            ORDER BY created_at DESC
            LIMIT 100;
            """
        )

        jobs = cursor.fetchall()

        return [
            {
                "id": j[0],
                "title": j[1],
                "company": j[2],
                "location": j[3],
                "description": j[4],
                "required_skills": j[5],
                "experience_required": float(j[6]) if j[6] is not None else None,
                "salary": j[7],
                "job_type": j[8],
                "application_url": j[9],
                "created_at": str(j[10]) if j[10] else None,
                "experience_level": j[11],
                "remote_allowed": j[12],
                "work_mode": j[13],
                "source": j[14],
            }
            for j in jobs
        ]

    finally:
        cursor.close()
        connection.close()


@app.get("/jobs/{job_id}")
def get_job(job_id: int):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                title,
                company,
                location,
                description,
                required_skills,
                experience_required,
                salary,
                job_type,
                application_url,
                created_at,
                experience_level,
                remote_allowed,
                work_mode,
                source
            FROM jobs
            WHERE id = %s;
            """,
            (job_id,)
        )

        job = cursor.fetchone()

        if not job:
            raise HTTPException(
                status_code=404,
                detail="Job not found"
            )

        return {
            "id": job[0],
            "title": job[1],
            "company": job[2],
            "location": job[3],
            "description": job[4],
            "required_skills": job[5],
            "experience_required": float(job[6]) if job[6] is not None else None,
            "salary": job[7],
            "job_type": job[8],
            "application_url": job[9],
            "created_at": str(job[10]) if job[10] else None,
            "experience_level": job[11],
            "remote_allowed": job[12],
            "work_mode": job[13],
            "source": job[14],
        }

    finally:
        cursor.close()
        connection.close()


@app.get("/discover-jobs")
def discover_jobs(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
):
    """
    Browse all jobs with server-side pagination and optional search.
    No authentication required for browsing.
    """
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 20
    if per_page > 100:
        per_page = 100

    offset = (page - 1) * per_page

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        search_term = search.strip()

        if search_term:
            like_pattern = f"%{search_term}%"
            cursor.execute(
                """
                SELECT COUNT(*) FROM jobs
                WHERE title ILIKE %s
                   OR company ILIKE %s
                   OR location ILIKE %s;
                """,
                (like_pattern, like_pattern, like_pattern)
            )
            total = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT
                    id, title, company, location, description,
                    required_skills, experience_required, salary,
                    job_type, application_url, created_at,
                    experience_level, remote_allowed, work_mode, source
                FROM jobs
                WHERE title ILIKE %s
                   OR company ILIKE %s
                   OR location ILIKE %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s;
                """,
                (like_pattern, like_pattern, like_pattern, per_page, offset)
            )
        else:
            cursor.execute("SELECT COUNT(*) FROM jobs;")
            total = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT
                    id, title, company, location, description,
                    required_skills, experience_required, salary,
                    job_type, application_url, created_at,
                    experience_level, remote_allowed, work_mode, source
                FROM jobs
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s;
                """,
                (per_page, offset)
            )

        jobs = cursor.fetchall()
        total_pages = max(1, (total + per_page - 1) // per_page)

        return {
            "jobs": [
                {
                    "id": j[0],
                    "title": j[1],
                    "company": j[2],
                    "location": j[3],
                    "description": (j[4] or "")[:250],
                    "required_skills": j[5],
                    "experience_required": float(j[6]) if j[6] is not None else None,
                    "salary": j[7],
                    "job_type": j[8],
                    "application_url": j[9],
                    "created_at": str(j[10]) if j[10] else None,
                    "experience_level": j[11],
                    "remote_allowed": j[12],
                    "work_mode": j[13],
                    "source": j[14],
                }
                for j in jobs
            ],
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
        }

    finally:
        cursor.close()
        connection.close()


# ---------------------------------------------------------------------------
# Resume: single-action upload → parse → extract
# ---------------------------------------------------------------------------

def _extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF using PyMuPDF."""
    pdf = fitz.open(file_path)
    text = ""
    for page in pdf:
        text += page.get_text()
    pdf.close()
    return text


def _extract_resume_details_via_llm(resume_text: str) -> dict:
    """Call LLM to extract skills and experience from resume text."""
    prompt = f"""
    Analyze this resume and extract:

    1. Skills (list of technical and professional skills)
    2. Work experience (summary with years)

    Return ONLY valid JSON:

    {{
        "skills": ["skill1", "skill2"],
        "experience": "experience summary with years"
    }}

    Resume:
    {resume_text[:8000]}
    """

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    ai_result = response.choices[0].message.content

    if not ai_result or not ai_result.strip():
        return {"skills": [], "experience": ""}

    ai_result = ai_result.strip()

    if ai_result.startswith("```"):
        ai_result = ai_result.replace("```json", "", 1)
        ai_result = ai_result.replace("```", "", 1)
        ai_result = ai_result.strip()

    return json.loads(ai_result)


@app.post("/resume/upload")
def upload_resume(
    file: UploadFile = File(...),
    user_id: int = Depends(get_user_id)
):
    """
    Single-action resume upload:
    1. Save file
    2. Parse PDF → extract text
    3. Call LLM → extract skills + experience
    4. Store everything in resumes table
    5. Return all extracted data

    Does NOT touch candidate_profiles.
    """
    connection = get_db_connection()
    cursor = connection.cursor()

    file_path = None

    try:
        os.makedirs("resumes", exist_ok=True)

        original_filename = file.filename
        extension = os.path.splitext(original_filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{extension}"
        file_path = os.path.join("resumes", unique_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Step 2: Parse PDF
        extracted_text = _extract_text_from_pdf(file_path)

        # Step 3: Extract details via LLM
        skills = []
        experience = ""

        if extracted_text and extracted_text.strip():
            try:
                extracted_data = _extract_resume_details_via_llm(extracted_text)
                skills = extracted_data.get("skills", [])
                experience = extracted_data.get("experience", "")
            except Exception as e:
                print(f"[WARN] LLM extraction failed: {e}")
                # Continue anyway — at least we have the text

        skills_str = ", ".join(skills) if isinstance(skills, list) else str(skills)

        # Step 4: Store in database
        cursor.execute(
            """
            INSERT INTO resumes
            (user_id, file_name, file_path, extracted_text,
             extracted_skills, extracted_experience)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                user_id,
                original_filename,
                file_path,
                extracted_text,
                skills_str,
                experience,
            )
        )

        resume_id = cursor.fetchone()[0]
        connection.commit()
        invalidate_recommendation_cache(user_id)

        return {
            "message": "Resume uploaded and processed successfully",
            "resume_id": resume_id,
            "file_name": original_filename,
            "extracted_text": extracted_text[:500] if extracted_text else "",
            "skills": skills,
            "experience": experience,
        }

    except Exception as e:
        connection.rollback()

        if file_path and os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail=f"Resume upload failed: {str(e)}"
        )

    finally:
        cursor.close()
        connection.close()


@app.get("/resume")
def get_resume(
    user_id: int = Depends(get_user_id)
):
    """Get the latest resume for the current user."""
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                file_name,
                extracted_text,
                extracted_skills,
                extracted_experience,
                uploaded_at
            FROM resumes
            WHERE user_id = %s
            ORDER BY uploaded_at DESC
            LIMIT 1;
            """,
            (user_id,)
        )

        resume = cursor.fetchone()

        if not resume:
            return {"resume": None}

        return {
            "resume": {
                "id": resume[0],
                "file_name": resume[1],
                "extracted_text": resume[2],
                "skills": resume[3],
                "experience": resume[4],
                "uploaded_at": str(resume[5]) if resume[5] else None,
            }
        }

    finally:
        cursor.close()
        connection.close()


# ---------------------------------------------------------------------------
# Recommendation Engine (70/20/10 + preferences + swipe feedback)
# ---------------------------------------------------------------------------

# Global In-Memory Recommendation Cache
# Key: user_id -> {"data": response_dict, "timestamp": float}
_RECOMMENDATION_CACHE = {}
_REC_CACHE_TTL = 900  # 15 minutes TTL

def invalidate_recommendation_cache(user_id: int = None):
    """Invalidate recommendation cache for a specific user or all users."""
    global _RECOMMENDATION_CACHE
    if user_id is not None:
        _RECOMMENDATION_CACHE.pop(user_id, None)
    else:
        _RECOMMENDATION_CACHE.clear()

# Global In-Memory Jobs Catalog Cache (avoids querying 33,000 rows across DB socket on every request)
_JOBS_CATALOG_CACHE = {
    "items": [],
    "timestamp": 0,
}
_JOBS_CATALOG_TTL = 3600  # 1 hour

def _get_cached_jobs_catalog(cursor):
    """Retrieve all jobs from pre-indexed memory cache, refreshing from DB only every 1 hour."""
    global _JOBS_CATALOG_CACHE
    now = time.time()
    if _JOBS_CATALOG_CACHE["items"] and (now - _JOBS_CATALOG_CACHE["timestamp"] < _JOBS_CATALOG_TTL):
        return _JOBS_CATALOG_CACHE["items"]

    cursor.execute(
        """
        SELECT
            id, title, company, location,
            substring(description from 1 for 300) AS desc_snippet,
            required_skills, experience_required, salary,
            job_type, application_url, created_at,
            experience_level, remote_allowed, work_mode, source
        FROM jobs;
        """
    )
    rows = cursor.fetchall()
    items = []
    for r in rows:
        req_skills_str = r[5] or ""
        raw_skills = [s.strip() for s in req_skills_str.split(",") if s.strip()]
        skills_set = {s.lower() for s in raw_skills}

        req_years = float(r[6] or 0)
        if req_years == 0 and r[11]:
            req_years = EXPERIENCE_LEVEL_MAP.get(r[11].lower().strip(), 0)

        t_lower = (r[1] or "").lower()
        items.append({
            "id": r[0],
            "title": r[1] or "",
            "company": r[2] or "",
            "location": r[3] or "",
            "description": r[4] or "",
            "required_skills": r[5],
            "salary": r[7],
            "job_type": r[8],
            "application_url": r[9],
            "experience_required": float(r[6]) if r[6] is not None else None,
            "experience_level": r[11],
            "remote_allowed": bool(r[12]),
            "work_mode": r[13],
            "source": r[14],
            "raw_row": r,
            "title_lower": t_lower,
            "title_words": t_lower.split(),
            "location_lower": (r[3] or "").lower(),
            "skills_set": skills_set,
            "raw_skills": raw_skills,
            "req_years": req_years,
        })

    _JOBS_CATALOG_CACHE["items"] = items
    _JOBS_CATALOG_CACHE["timestamp"] = now
    return items

def invalidate_jobs_catalog_cache():
    """Invalidate jobs catalog cache when jobs are imported/modified."""
    global _JOBS_CATALOG_CACHE
    _JOBS_CATALOG_CACHE["items"] = []
    _JOBS_CATALOG_CACHE["timestamp"] = 0

def _clean_skill_label(skill_str: str) -> str:
    """Clean and normalize a skill label to avoid large sentence badges."""
    if not skill_str:
        return ""
    s = skill_str.strip()
    # Strip common requirement boilerplate prefixes
    s = re.sub(
        r"^(?:job\s+requirements?|requirements?|must\s+(?:have|be)|ability\s+to|responsible\s+for|preferred\s+(?:qualifications?|skills?)|and|or|with|to)[:\s\-]+",
        "",
        s,
        flags=re.IGNORECASE
    ).strip()
    # If the string contains multiple sentences or semicolons, take first concise clause
    if len(s) > 40:
        parts = re.split(r"[.;\n]", s)
        first_clause = parts[0].strip()
        if len(first_clause) <= 35 and len(first_clause) > 2:
            s = first_clause
        else:
            s = s[:32].rstrip() + "..."
    return s.strip()

# Experience level → approximate year ranges for matching
EXPERIENCE_LEVEL_MAP = {
    "internship": 0,
    "entry level": 0.5,
    "associate": 2,
    "mid-senior level": 5,
    "director": 10,
    "executive": 15,
}


def _get_candidate_data(cursor, user_id):
    """Gather candidate profile + resume data."""
    # Profile
    cursor.execute(
        """
        SELECT
            skills,
            experience_years,
            preferred_roles,
            preferred_locations,
            career_interests,
            work_mode_preference,
            location
        FROM candidate_profiles
        WHERE user_id = %s;
        """,
        (user_id,)
    )
    profile = cursor.fetchone()

    # Latest resume
    cursor.execute(
        """
        SELECT
            extracted_skills,
            extracted_experience
        FROM resumes
        WHERE user_id = %s
        ORDER BY uploaded_at DESC
        LIMIT 1;
        """,
        (user_id,)
    )
    resume = cursor.fetchone()

    return profile, resume


def _get_swipe_patterns(cursor, user_id):
    """
    Analyze swipe history to extract preference patterns.
    Returns boosted_skills (from RIGHT/SAVE) and penalized_skills (from LEFT).
    """
    cursor.execute(
        """
        SELECT
            sh.action,
            j.required_skills,
            j.title,
            j.location,
            j.job_type
        FROM swipe_history sh
        JOIN jobs j ON sh.job_id = j.id
        WHERE sh.user_id = %s;
        """,
        (user_id,)
    )
    swipes = cursor.fetchall()

    boosted_skills = {}
    penalized_skills = {}
    boosted_titles = {}
    penalized_titles = {}

    for action, skills, title, location, job_type in swipes:
        skill_list = [
            s.strip().lower()
            for s in (skills or "").split(",")
            if s.strip()
        ]
        title_words = [
            w.strip().lower()
            for w in (title or "").split()
            if len(w.strip()) > 2
        ]

        if action == "RIGHT":
            for s in skill_list:
                boosted_skills[s] = boosted_skills.get(s, 0) + 2
            for w in title_words:
                boosted_titles[w] = boosted_titles.get(w, 0) + 1
        elif action == "SAVE":
            for s in skill_list:
                boosted_skills[s] = boosted_skills.get(s, 0) + 1
        elif action == "LEFT":
            for s in skill_list:
                penalized_skills[s] = penalized_skills.get(s, 0) + 1
            for w in title_words:
                penalized_titles[w] = penalized_titles.get(w, 0) + 1

    return boosted_skills, penalized_skills, boosted_titles, penalized_titles


def _compute_match_score(job, candidate_skills, candidate_years,
                         preferred_roles, preferred_locations,
                         preferred_work_mode,
                         boosted_skills, penalized_skills,
                         boosted_titles, penalized_titles):
    """
    Compute the recommendation score for a single job.
    Returns (score, matched_skills, missing_skills).
    """
    (
        job_id, title, company, location, description,
        required_skills, experience_required, salary,
        job_type, application_url, created_at,
        experience_level, remote_allowed, work_mode, source
    ) = job

    # --- 70% SKILLS MATCHING ---
    raw_required_skills = [
        s.strip()
        for s in (required_skills or "").split(",")
        if s.strip()
    ]
    required_skill_list = [s.lower() for s in raw_required_skills]

    if not required_skill_list:
        skill_score = 35  # Half credit if no requirements listed
        matched_skills = []
        missing_skills = []
    else:
        matched_skills = []
        missing_skills = []
        for i, skill_lower in enumerate(required_skill_list):
            raw_s = raw_required_skills[i]
            matched_candidate_skill = None
            for cs in candidate_skills:
                cs_lower = cs.lower().strip()
                if not cs_lower:
                    continue
                # 1. Exact match
                if cs_lower == skill_lower:
                    matched_candidate_skill = cs
                    break
                # 2. Word-boundary match (prevents single letters like 'c' matching inside 'education')
                if len(cs_lower) <= 2:
                    if re.search(r'(?<![a-zA-Z0-9])' + re.escape(cs_lower) + r'(?![a-zA-Z0-9])', skill_lower):
                        if not re.search(r'^(?:education|degree|doctorate|bachelor|master|phd|high school)', skill_lower):
                            matched_candidate_skill = cs
                            break
                else:
                    if re.search(r'\b' + re.escape(cs_lower) + r'\b', skill_lower):
                        matched_candidate_skill = cs
                        break
                    elif len(skill_lower) >= 3 and re.search(r'\b' + re.escape(skill_lower) + r'\b', cs_lower):
                        matched_candidate_skill = cs
                        break

            if matched_candidate_skill:
                # If raw requirement was a paragraph, use the clean concise candidate skill name!
                if len(raw_s) > 35:
                    clean_match = matched_candidate_skill.title()
                else:
                    clean_match = _clean_skill_label(raw_s) or matched_candidate_skill.title()
                if clean_match and clean_match not in matched_skills:
                    matched_skills.append(clean_match)
            else:
                clean_missing = _clean_skill_label(raw_s)
                if clean_missing and clean_missing not in missing_skills:
                    missing_skills.append(clean_missing)

        skill_score = (
            len(matched_skills) / len(required_skill_list)
        ) * 70

    # --- 20% EXPERIENCE MATCHING ---
    required_years = float(experience_required or 0)

    # If no numeric requirement, try experience_level
    if required_years == 0 and experience_level:
        level_key = experience_level.lower().strip()
        required_years = EXPERIENCE_LEVEL_MAP.get(level_key, 0)

    if required_years == 0:
        experience_score = 20
    elif candidate_years >= required_years:
        experience_score = 20
    elif candidate_years > 0:
        experience_score = (candidate_years / required_years) * 20
    else:
        experience_score = 0

    # --- 10% ROLE RELEVANCE ---
    text = f"{title or ''} {description or ''}".lower()
    role_relevance = 0

    for cs in candidate_skills:
        if cs in text:
            role_relevance += 1

    role_score = min(role_relevance * 2, 10)

    # --- PREFERENCE BONUS (up to +10) ---
    pref_bonus = 0

    if preferred_roles:
        pref_role_list = [
            r.strip().lower()
            for r in preferred_roles.split(",")
            if r.strip()
        ]
        for pr in pref_role_list:
            if pr in (title or "").lower():
                pref_bonus += 3
                break

    if preferred_locations:
        pref_loc_list = [
            l.strip().lower()
            for l in preferred_locations.split(",")
            if l.strip()
        ]
        for pl in pref_loc_list:
            if pl in (location or "").lower():
                pref_bonus += 3
                break

    if preferred_work_mode:
        pm = preferred_work_mode.lower().strip()
        if pm == "remote" and remote_allowed:
            pref_bonus += 2
        elif pm == "on-site" and not remote_allowed:
            pref_bonus += 2
        elif pm in (work_mode or "").lower():
            pref_bonus += 2

    pref_bonus = min(pref_bonus, 10)

    # --- SWIPE FEEDBACK ADJUSTMENT (up to +/- 5) ---
    swipe_adjustment = 0

    for skill in required_skill_list:
        if skill in boosted_skills:
            swipe_adjustment += 0.5
        if skill in penalized_skills:
            swipe_adjustment -= 0.5

    title_lower = (title or "").lower()
    for word in title_lower.split():
        if word in boosted_titles:
            swipe_adjustment += 0.3
        if word in penalized_titles:
            swipe_adjustment -= 0.3

    swipe_adjustment = max(-5, min(5, swipe_adjustment))

    # --- TOTAL ---
    total = skill_score + experience_score + role_score + pref_bonus + swipe_adjustment
    total = max(0, min(100, round(total)))

    return total, matched_skills, missing_skills


def _fast_match_score(
    item, candidate_skills_set, candidate_years,
    pref_roles_list, pref_locs_list,
    preferred_work_mode,
    boosted_skills, penalized_skills,
    boosted_titles, penalized_titles
):
    """
    Ultra-fast numeric scoring pass over pre-indexed job dictionary.
    Returns integer match score (0-100) in microseconds.
    """
    skills_set = item["skills_set"]
    if not skills_set:
        skill_score = 35.0
    else:
        matched = len(candidate_skills_set & skills_set)
        skill_score = (matched / len(skills_set)) * 70.0

    req_years = item["req_years"]
    if req_years == 0 or candidate_years >= req_years:
        exp_score = 20.0
    elif candidate_years > 0:
        exp_score = (candidate_years / req_years) * 20.0
    else:
        exp_score = 0.0

    t_lower = item["title_lower"]
    role_score = min(sum(2 for cs in candidate_skills_set if cs in t_lower), 10.0)

    pref_bonus = 0.0
    if pref_roles_list and any(pr in t_lower for pr in pref_roles_list):
        pref_bonus += 3.0
    if pref_locs_list and any(pl in item["location_lower"] for pl in pref_locs_list):
        pref_bonus += 3.0
    if preferred_work_mode:
        pwm = preferred_work_mode.lower().strip()
        if pwm == "remote" and item["remote_allowed"]:
            pref_bonus += 2.0
        elif pwm == "on-site" and not item["remote_allowed"]:
            pref_bonus += 2.0
        elif pwm in item["location_lower"] or pwm in (item["work_mode"] or "").lower():
            pref_bonus += 2.0

    swipe_adj = 0.0
    if boosted_skills or penalized_skills:
        for s in skills_set:
            if s in boosted_skills:
                swipe_adj += 0.5
            if s in penalized_skills:
                swipe_adj -= 0.5

    if boosted_titles or penalized_titles:
        for w in item["title_words"]:
            if w in boosted_titles:
                swipe_adj += 0.3
            if w in penalized_titles:
                swipe_adj -= 0.3

    swipe_adj = max(-5.0, min(5.0, swipe_adj))

    total = skill_score + exp_score + role_score + pref_bonus + swipe_adj
    return max(0, min(100, round(total)))


@app.get("/recommended-jobs")
def get_recommended_jobs(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        profile, resume = _get_candidate_data(cursor, user_id)

        # Strictly enforce profile and resume completion
        has_profile = bool(profile and (profile[0] or profile[1] is not None or profile[2]))
        has_resume = bool(resume and (resume[0] or resume[1]))

        if not has_profile and not has_resume:
            return {
                "candidate": {
                    "skills": [],
                    "experience_years": 0,
                },
                "recommendations": [],
                "profile_completed": False,
                "resume_uploaded": False,
                "message": "Please complete your candidate profile and upload your resume to get AI job recommendations."
            }

        if not has_profile:
            return {
                "candidate": {
                    "skills": [],
                    "experience_years": 0,
                },
                "recommendations": [],
                "profile_completed": False,
                "resume_uploaded": True,
                "message": "Please complete your candidate profile to set your skills, experience, and job preferences."
            }

        if not has_resume:
            return {
                "candidate": {
                    "skills": [],
                    "experience_years": 0,
                },
                "recommendations": [],
                "profile_completed": True,
                "resume_uploaded": False,
                "message": "Please upload your resume to enable ATS matching and verified skill extraction."
            }

        # Collect candidate skills from profile + resume
        candidate_skills = set()

        if profile:
            profile_skills = profile[0] or ""
            for s in profile_skills.split(","):
                s = s.strip().lower()
                if s:
                    candidate_skills.add(s)

        if resume:
            resume_skills = resume[0] or ""
            for s in resume_skills.split(","):
                s = s.strip().lower()
                if s:
                    candidate_skills.add(s)

        if not candidate_skills:
            # No skills at all — return empty with message
            return {
                "candidate": {
                    "skills": [],
                    "experience_years": 0,
                },
                "recommendations": [],
                "profile_completed": True,
                "resume_uploaded": True,
                "message": "Please add skills to your profile or upload a resume with skills to get recommendations."
            }

        candidate_skills = list(candidate_skills)

        # Get already-swiped job IDs
        cursor.execute(
            "SELECT job_id FROM swipe_history WHERE user_id = %s;",
            (user_id,)
        )
        swiped_ids = {row[0] for row in cursor.fetchall()}

        # Check in-memory recommendation cache
        now = time.time()
        cached_entry = _RECOMMENDATION_CACHE.get(user_id)
        if cached_entry and (now - cached_entry["timestamp"] < _REC_CACHE_TTL):
            cached_data = cached_entry["data"]
            cached_recs = cached_data.get("recommendations", [])
            # Filter out any newly swiped IDs
            active_recs = [r for r in cached_recs if r["job_id"] not in swiped_ids]
            if active_recs:
                return {
                    "candidate": cached_data.get("candidate", {}),
                    "recommendations": active_recs[:50],
                    "total_available": len(active_recs),
                    "profile_completed": True,
                    "resume_uploaded": True,
                    "cached": True,
                }

        # Candidate experience years
        candidate_years = 0
        if profile and profile[1] is not None:
            candidate_years = float(profile[1])
        elif resume and resume[1]:
            # Try extracting from resume experience text
            exp_match = re.search(
                r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)",
                (resume[1] or "").lower()
            )
            if exp_match:
                candidate_years = float(exp_match.group(1))

        # Preferences
        preferred_roles = profile[2] if profile else ""
        preferred_locations = profile[3] if profile else ""
        preferred_work_mode = profile[5] if profile else ""

        # Swipe patterns
        boosted_skills, penalized_skills, boosted_titles, penalized_titles = \
            _get_swipe_patterns(cursor, user_id)

        # Retrieve all jobs from in-memory catalog cache (0ms I/O)
        jobs = _get_cached_jobs_catalog(cursor)

        candidate_skills_set = {s.lower() for s in candidate_skills}
        pref_roles_list = [
            r.strip().lower() for r in preferred_roles.split(",") if r.strip()
        ] if preferred_roles else []
        pref_locs_list = [
            l.strip().lower() for l in preferred_locations.split(",") if l.strip()
        ] if preferred_locations else []

        # Stage 1: Ultra-fast numeric scoring pass across all 33k jobs
        scored_jobs = []
        for item in jobs:
            job_id = item["id"]

            # Skip already-swiped jobs
            if job_id in swiped_ids:
                continue

            score = _fast_match_score(
                item, candidate_skills_set, candidate_years,
                pref_roles_list, pref_locs_list,
                preferred_work_mode,
                boosted_skills, penalized_skills,
                boosted_titles, penalized_titles,
            )

            scored_jobs.append((score, item))

        # Sort by match score descending
        scored_jobs.sort(key=lambda item: item[0], reverse=True)

        # Stage 2: Detailed matched & missing skills formatting ONLY for top 50
        recommendations = []
        for score, item in scored_jobs[:50]:
            _, matched, missing = _compute_match_score(
                item["raw_row"], candidate_skills, candidate_years,
                preferred_roles, preferred_locations,
                preferred_work_mode,
                boosted_skills, penalized_skills,
                boosted_titles, penalized_titles,
            )

            recommendations.append({
                "job_id": item["id"],
                "title": item["title"],
                "company": item["company"],
                "location": item["location"],
                "description": item["description"],
                "required_skills": item["required_skills"],
                "salary": item["salary"],
                "job_type": item["job_type"],
                "application_url": item["application_url"],
                "experience_required": item["experience_required"],
                "experience_level": item["experience_level"],
                "remote_allowed": item["remote_allowed"],
                "work_mode": item["work_mode"],
                "match_score": score,
                "matched_skills": matched,
                "missing_skills": missing,
            })

        result_payload = {
            "candidate": {
                "skills": candidate_skills,
                "experience_years": candidate_years,
            },
            "recommendations": recommendations,
            "total_available": len(scored_jobs),
            "profile_completed": True,
            "resume_uploaded": True,
            "cached": False,
        }

        # Store in global memory cache
        _RECOMMENDATION_CACHE[user_id] = {
            "data": result_payload,
            "timestamp": time.time(),
        }

        return result_payload

    finally:
        cursor.close()
        connection.close()


# ---------------------------------------------------------------------------
# Swipe System
# ---------------------------------------------------------------------------

@app.post("/swipe")
def swipe_job(
    data: SwipeRequest,
    user_id: int = Depends(get_user_id)
):
    """
    Record a swipe action (LEFT/RIGHT/SAVE).
    Uses upsert so re-swiping updates the existing record.
    """
    action = data.action.upper().strip()

    if action not in ("LEFT", "RIGHT", "SAVE"):
        raise HTTPException(
            status_code=400,
            detail="Invalid action. Must be LEFT, RIGHT, or SAVE."
        )

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        # Verify job exists
        cursor.execute(
            "SELECT id FROM jobs WHERE id = %s;",
            (data.job_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Job not found"
            )

        # Upsert: insert or update
        cursor.execute(
            """
            INSERT INTO swipe_history (user_id, job_id, action)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, job_id)
            DO UPDATE SET action = EXCLUDED.action, created_at = CURRENT_TIMESTAMP
            RETURNING id, action;
            """,
            (user_id, data.job_id, action)
        )

        result = cursor.fetchone()
        connection.commit()

        # Update in-memory recommendation cache by removing swiped job
        if user_id in _RECOMMENDATION_CACHE:
            cached_data = _RECOMMENDATION_CACHE[user_id]["data"]
            cached_recs = cached_data.get("recommendations", [])
            cached_data["recommendations"] = [
                r for r in cached_recs if r["job_id"] != data.job_id
            ]

        return {
            "message": f"Job {action.lower()}ed successfully",
            "swipe_id": result[0],
            "action": result[1],
        }

    finally:
        cursor.close()
        connection.close()


@app.get("/swipe-history")
def get_swipe_history(
    page: Optional[int] = None,
    per_page: Optional[int] = None,
    action: Optional[str] = None,
    user_id: int = Depends(get_user_id)
):
    """Get the user's swipe history with job details (supports pagination, max 20 per page)."""
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        where_clauses = ["sh.user_id = %s"]
        params = [user_id]

        if action and action.upper() in ("RIGHT", "LEFT", "SAVE"):
            where_clauses.append("sh.action = %s")
            params.append(action.upper())

        where_sql = " AND ".join(where_clauses)

        # Total count
        cursor.execute(
            f"""
            SELECT COUNT(*)
            FROM swipe_history sh
            WHERE {where_sql};
            """,
            tuple(params)
        )
        total = cursor.fetchone()[0]

        # Support pagination (default: return all if not requested)
        if page is not None or per_page is not None:
            p = max(1, page or 1)
            pp = 20 if per_page is None else max(1, min(100, per_page))
            offset = (p - 1) * pp
            query_params = list(params) + [pp, offset]
            limit_clause = "LIMIT %s OFFSET %s"
            total_pages = math.ceil(total / pp) if total > 0 and pp > 0 else 1
        else:
            p = 1
            pp = total if total > 0 else 20
            query_params = list(params)
            limit_clause = ""
            total_pages = 1

        cursor.execute(
            f"""
            SELECT
                sh.id,
                sh.job_id,
                j.title,
                j.company,
                j.location,
                j.salary,
                sh.action,
                sh.created_at
            FROM swipe_history sh
            JOIN jobs j ON sh.job_id = j.id
            WHERE {where_sql}
            ORDER BY sh.created_at DESC
            {limit_clause};
            """,
            tuple(query_params)
        )

        history = cursor.fetchall()
        total_pages = math.ceil(total / pp) if total > 0 and pp > 0 else 1

        formatted_history = [
            {
                "id": h[0],
                "job_id": h[1],
                "title": h[2],
                "company": h[3],
                "location": h[4],
                "salary": h[5],
                "action": h[6],
                "created_at": str(h[7]) if h[7] else None,
            }
            for h in history
        ]

        return {
            "history": formatted_history,
            "total": total,
            "page": p,
            "per_page": pp,
            "total_pages": total_pages,
        }

    finally:
        cursor.close()
        connection.close()


# ---------------------------------------------------------------------------
# Job-Specific ATS Analysis
# ---------------------------------------------------------------------------

@app.post("/ats/analyze/{job_id}")
def analyze_ats(
    job_id: int,
    user_id: int = Depends(get_user_id)
):
    """
    Job-specific ATS analysis:
    Compares the candidate's resume against a specific job.
    Returns score, matched skills, missing skills, and suggestions.
    Caches results in ats_reports.
    """
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        # Get latest resume
        cursor.execute(
            """
            SELECT id, extracted_text, extracted_skills
            FROM resumes
            WHERE user_id = %s
            ORDER BY uploaded_at DESC
            LIMIT 1;
            """,
            (user_id,)
        )
        resume = cursor.fetchone()

        if not resume:
            raise HTTPException(
                status_code=404,
                detail="No resume found. Please upload a resume first."
            )

        resume_id = resume[0]
        resume_text = resume[1]
        resume_skills = resume[2]

        if not resume_text:
            raise HTTPException(
                status_code=400,
                detail="Resume has not been parsed. Please re-upload."
            )

        # Get the job
        cursor.execute(
            """
            SELECT
                title, company, description, required_skills,
                experience_required, education_required,
                responsibilities, experience_level
            FROM jobs
            WHERE id = %s;
            """,
            (job_id,)
        )
        job = cursor.fetchone()

        if not job:
            raise HTTPException(
                status_code=404,
                detail="Job not found"
            )

        job_title = job[0]
        job_company = job[1]
        job_description = job[2] or ""
        job_skills = job[3] or ""
        job_experience = job[4]
        job_education = job[5] or ""
        job_responsibilities = job[6] or ""
        job_exp_level = job[7] or ""

        # Check for cached report
        cursor.execute(
            """
            SELECT
                ats_score, matched_skills, missing_skills,
                suggestions, updated_at
            FROM ats_reports
            WHERE user_id = %s AND resume_id = %s AND job_id = %s;
            """,
            (user_id, resume_id, job_id)
        )
        cached = cursor.fetchone()

        if cached:
            return {
                "ats_score": float(cached[0]) if cached[0] else 0,
                "matched_skills": cached[1] or "",
                "missing_skills": cached[2] or "",
                "suggestions": cached[3] or "",
                "cached": True,
                "analyzed_at": str(cached[4]) if cached[4] else None,
                "job_title": job_title,
                "job_company": job_company,
            }

        # Build ATS analysis prompt
        prompt = f"""
You are an expert ATS (Applicant Tracking System) analyzer.

Compare this RESUME against this specific JOB and provide a detailed analysis.

=== JOB DETAILS ===
Title: {job_title}
Company: {job_company}
Required Skills: {job_skills}
Experience: {job_experience or job_exp_level or 'Not specified'}
Education: {job_education or 'Not specified'}
Responsibilities: {job_responsibilities[:1000] if job_responsibilities else 'Not specified'}
Description: {job_description[:2000]}

=== CANDIDATE RESUME ===
{resume_text[:5000]}

=== INSTRUCTIONS ===
Analyze how well this resume matches this specific job.

Return ONLY valid JSON in this exact format:
{{
    "ats_score": <number 0-100>,
    "matched_skills": "comma-separated list of skills found in both resume and job",
    "missing_skills": "comma-separated list of job-required skills missing from resume",
    "suggestions": "2-3 specific, actionable improvement suggestions"
}}
"""

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0
        )

        ai_result = response.choices[0].message.content

        if not ai_result or not ai_result.strip():
            raise HTTPException(
                status_code=500,
                detail="AI returned an empty response"
            )

        ai_result = ai_result.strip()

        if ai_result.startswith("```"):
            ai_result = re.sub(r"^```(?:json)?\s*", "", ai_result)
            ai_result = re.sub(r"\s*```\s*$", "", ai_result)

        ats_data = json.loads(ai_result)

        ats_score = max(0, min(100, float(ats_data.get("ats_score", 0))))
        matched_skills = str(ats_data.get("matched_skills", ""))
        missing_skills = str(ats_data.get("missing_skills", ""))
        suggestions = str(ats_data.get("suggestions", ""))

        # Upsert into ats_reports
        cursor.execute(
            """
            INSERT INTO ats_reports
            (user_id, resume_id, job_id, ats_score,
             matched_skills, missing_skills, suggestions)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, resume_id, job_id)
            DO UPDATE SET
                ats_score = EXCLUDED.ats_score,
                matched_skills = EXCLUDED.matched_skills,
                missing_skills = EXCLUDED.missing_skills,
                suggestions = EXCLUDED.suggestions,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id;
            """,
            (
                user_id, resume_id, job_id,
                ats_score, matched_skills,
                missing_skills, suggestions,
            )
        )

        connection.commit()

        return {
            "ats_score": ats_score,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "suggestions": suggestions,
            "cached": False,
            "job_title": job_title,
            "job_company": job_company,
        }

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="AI returned invalid JSON for ATS analysis"
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"ATS analysis failed: {str(e)}"
        )

    finally:
        cursor.close()
        connection.close()


@app.get("/ats/report/{job_id}")
def get_ats_report(
    job_id: int,
    user_id: int = Depends(get_user_id)
):
    """Get cached ATS report for a job (without re-running LLM)."""
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                ar.ats_score,
                ar.matched_skills,
                ar.missing_skills,
                ar.suggestions,
                ar.updated_at,
                j.title,
                j.company
            FROM ats_reports ar
            JOIN jobs j ON ar.job_id = j.id
            WHERE ar.user_id = %s AND ar.job_id = %s
            ORDER BY ar.updated_at DESC
            LIMIT 1;
            """,
            (user_id, job_id)
        )

        report = cursor.fetchone()

        if not report:
            return {"report": None}

        return {
            "report": {
                "ats_score": float(report[0]) if report[0] else 0,
                "matched_skills": report[1] or "",
                "missing_skills": report[2] or "",
                "suggestions": report[3] or "",
                "analyzed_at": str(report[4]) if report[4] else None,
                "job_title": report[5],
                "job_company": report[6],
            }
        }

    finally:
        cursor.close()
        connection.close()