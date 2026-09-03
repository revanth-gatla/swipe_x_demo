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

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE, override=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in backend/.env")

app = FastAPI(title="SWIPE X API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)

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
    required_skill_list = [
        s.strip().lower()
        for s in (required_skills or "").split(",")
        if s.strip()
    ]

    if not required_skill_list:
        skill_score = 35  # Half credit if no requirements listed
        matched_skills = []
        missing_skills = []
    else:
        matched_skills = [
            skill for skill in required_skill_list
            if any(
                skill == cs or skill in cs or cs in skill
                for cs in candidate_skills
            )
        ]
        missing_skills = [
            skill for skill in required_skill_list
            if skill not in matched_skills
        ]
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


@app.get("/recommended-jobs")
def get_recommended_jobs(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        profile, resume = _get_candidate_data(cursor, user_id)

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
                "message": "Please complete your profile or upload a resume to get recommendations."
            }

        candidate_skills = list(candidate_skills)

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

        # Get already-swiped job IDs (exclude from recommendations)
        cursor.execute(
            "SELECT job_id FROM swipe_history WHERE user_id = %s;",
            (user_id,)
        )
        swiped_ids = {row[0] for row in cursor.fetchall()}

        # Fetch all jobs
        cursor.execute(
            """
            SELECT
                id, title, company, location, description,
                required_skills, experience_required, salary,
                job_type, application_url, created_at,
                experience_level, remote_allowed, work_mode, source
            FROM jobs
            ORDER BY created_at DESC;
            """
        )

        jobs = cursor.fetchall()

        recommendations = []

        for job in jobs:
            job_id = job[0]

            # Skip already-swiped jobs
            if job_id in swiped_ids:
                continue

            score, matched, missing = _compute_match_score(
                job, candidate_skills, candidate_years,
                preferred_roles, preferred_locations,
                preferred_work_mode,
                boosted_skills, penalized_skills,
                boosted_titles, penalized_titles,
            )

            recommendations.append({
                "job_id": job_id,
                "title": job[1],
                "company": job[2],
                "location": job[3],
                "description": (job[4] or "")[:300],
                "required_skills": job[5],
                "salary": job[7],
                "job_type": job[8],
                "application_url": job[9],
                "experience_required": float(job[6]) if job[6] is not None else None,
                "experience_level": job[11],
                "remote_allowed": job[12],
                "work_mode": job[13],
                "match_score": score,
                "matched_skills": matched,
                "missing_skills": missing,
            })

        # Sort by match score descending
        recommendations.sort(
            key=lambda j: j["match_score"],
            reverse=True
        )

        # Return top 50 recommendations
        return {
            "candidate": {
                "skills": candidate_skills,
                "experience_years": candidate_years,
            },
            "recommendations": recommendations[:50],
            "total_available": len(recommendations),
        }

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
    user_id: int = Depends(get_user_id)
):
    """Get the user's swipe history with job details."""
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
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
            WHERE sh.user_id = %s
            ORDER BY sh.created_at DESC;
            """,
            (user_id,)
        )

        history = cursor.fetchall()

        return [
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