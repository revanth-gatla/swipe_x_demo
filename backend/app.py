from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db_connection
from passlib.context import CryptContext
from pydantic import EmailStr, BaseModel
from auth import create_access_token, verify_token
import os
import shutil
from fastapi import UploadFile, File
from pypdf import PdfReader
from groq import Groq
import json

app = FastAPI(title="SWIPE X API")
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
security = HTTPBearer()


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


class ProfileRequest(BaseModel):
    phone: str
    location: str
    education: str
    experience_years: int
    skills: str
    bio: str


class JobRequest(BaseModel):
    title: str
    company: str
    location: str
    description: str
    required_skills: str
    experience_required: int
    salary: str
    job_type: str
    application_url: str


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


@app.get("/")
def home():
    return {"message": "SWIPE X Backend"}


@app.get("/test-db")
def test_db():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT current_database();")
    result = cursor.fetchone()

    cursor.close()
    connection.close()

    return {"database": result[0]}


@app.post("/register")
def register(name: str, email: EmailStr, password: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id FROM users WHERE email = %s;",
        (email,)
    )

    existing_user = cursor.fetchone()

    if existing_user:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    hashed_password = pwd_context.hash(password)

    cursor.execute(
        """
        INSERT INTO users (name, email, password)
        VALUES (%s, %s, %s)
        RETURNING id;
        """,
        (name, email, hashed_password)
    )

    user_id = cursor.fetchone()[0]

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Registration successful",
        "user_id": user_id
    }


@app.post("/login")
def login(email: EmailStr, password: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id, password FROM users WHERE email = %s;",
        (email,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    user_id = user[0]
    stored_password = user[1]

    if not pwd_context.verify(password, stored_password):
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(user_id)

    cursor.close()
    connection.close()

    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer"
    }


@app.post("/profile")
def create_profile(
    profile: ProfileRequest,
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO candidate_profiles
        (user_id, phone, location, education, experience_years, skills, bio)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            user_id,
            profile.phone,
            profile.location,
            profile.education,
            profile.experience_years,
            profile.skills,
            profile.bio
        )
    )

    profile_id = cursor.fetchone()[0]

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Profile created successfully",
        "profile_id": profile_id
    }


@app.get("/profile")
def get_profile(user_id: int = Depends(get_user_id)):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT phone, location, education,
               experience_years, skills, bio
        FROM candidate_profiles
        WHERE user_id = %s;
        """,
        (user_id,)
    )

    profile = cursor.fetchone()

    cursor.close()
    connection.close()

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Profile not found"
        )

    return {
        "phone": profile[0],
        "location": profile[1],
        "education": profile[2],
        "experience_years": profile[3],
        "skills": profile[4],
        "bio": profile[5]
    }


@app.put("/profile")
def update_profile(
    profile: ProfileRequest,
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE candidate_profiles
        SET phone = %s,
            location = %s,
            education = %s,
            experience_years = %s,
            skills = %s,
            bio = %s
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
            user_id
        )
    )

    result = cursor.fetchone()

    if not result:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Profile not found"
        )

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Profile updated successfully",
        "profile_id": result[0]
    }


@app.get("/jobs")
def get_jobs():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, title, company, location, description,
               required_skills, experience_required, salary,
               job_type, application_url, created_at
        FROM jobs
        ORDER BY created_at DESC;
        """
    )

    jobs = cursor.fetchall()

    cursor.close()
    connection.close()

    return jobs


@app.post("/jobs")
def create_job(job: JobRequest):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO jobs
        (title, company, location, description, required_skills,
         experience_required, salary, job_type, application_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            job.title,
            job.company,
            job.location,
            job.description,
            job.required_skills,
            job.experience_required,
            job.salary,
            job.job_type,
            job.application_url
        )
    )

    job_id = cursor.fetchone()[0]

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Job created successfully",
        "job_id": job_id
    }


@app.get("/jobs/{job_id}")
def get_job(job_id: int):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, title, company, location, description,
               required_skills, experience_required, salary,
               job_type, application_url, created_at
        FROM jobs
        WHERE id = %s;
        """,
        (job_id,)
    )

    job = cursor.fetchone()

    cursor.close()
    connection.close()

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
        "experience_required": job[6],
        "salary": job[7],
        "job_type": job[8],
        "application_url": job[9],
        "created_at": job[10]
    }


@app.post("/jobs/{job_id}/apply")
def apply_for_job(
    job_id: int,
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id FROM jobs WHERE id = %s;",
        (job_id,)
    )

    job = cursor.fetchone()

    if not job:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    cursor.execute(
        """
        SELECT id
        FROM applications
        WHERE user_id = %s AND job_id = %s;
        """,
        (user_id, job_id)
    )

    existing_application = cursor.fetchone()

    if existing_application:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=409,
            detail="Already applied for this job"
        )

    cursor.execute(
        """
        INSERT INTO applications (user_id, job_id)
        VALUES (%s, %s)
        RETURNING id;
        """,
        (user_id, job_id)
    )

    application_id = cursor.fetchone()[0]

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Application submitted successfully",
        "application_id": application_id
    }


@app.get("/applications")
def get_my_applications(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT applications.id,
               applications.job_id,
               jobs.title,
               jobs.company,
               applications.status,
               applications.applied_at
        FROM applications
        JOIN jobs
        ON applications.job_id = jobs.id
        WHERE applications.user_id = %s
        ORDER BY applications.applied_at DESC;
        """,
        (user_id,)
    )

    applications = cursor.fetchall()

    cursor.close()
    connection.close()

    return applications


@app.put("/applications/{application_id}/status")
def update_application_status(
    application_id: int,
    status: str,
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE applications
        SET status = %s
        WHERE id = %s
        RETURNING id, status;
        """,
        (status, application_id)
    )

    application = cursor.fetchone()

    if not application:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Application status updated",
        "application_id": application[0],
        "status": application[1]
    }


@app.post("/jobs/{job_id}/save")
def save_job(
    job_id: int,
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id FROM jobs WHERE id = %s;",
        (job_id,)
    )

    job = cursor.fetchone()

    if not job:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    cursor.execute(
        """
        SELECT id
        FROM saved_jobs
        WHERE user_id = %s AND job_id = %s;
        """,
        (user_id, job_id)
    )

    existing_save = cursor.fetchone()

    if existing_save:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=409,
            detail="Job already saved"
        )

    cursor.execute(
        """
        INSERT INTO saved_jobs (user_id, job_id)
        VALUES (%s, %s)
        RETURNING id;
        """,
        (user_id, job_id)
    )

    saved_id = cursor.fetchone()[0]

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Job saved successfully",
        "saved_id": saved_id
    }


@app.get("/saved-jobs")
def get_saved_jobs(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT saved_jobs.id,
               jobs.id,
               jobs.title,
               jobs.company,
               jobs.location,
               jobs.salary,
               saved_jobs.saved_at
        FROM saved_jobs
        JOIN jobs
        ON saved_jobs.job_id = jobs.id
        WHERE saved_jobs.user_id = %s
        ORDER BY saved_jobs.saved_at DESC;
        """,
        (user_id,)
    )

    saved_jobs = cursor.fetchall()

    cursor.close()
    connection.close()

    return saved_jobs


@app.delete("/jobs/{job_id}/save")
def remove_saved_job(
    job_id: int,
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        DELETE FROM saved_jobs
        WHERE user_id = %s AND job_id = %s
        RETURNING id;
        """,
        (user_id, job_id)
    )

    saved_job = cursor.fetchone()

    if not saved_job:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Saved job not found"
        )

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Job removed from saved jobs"
    }


@app.post("/resume/upload")
def upload_resume(
    file: UploadFile = File(...),
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    os.makedirs("resumes", exist_ok=True)

    file_path = f"resumes/{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cursor.execute(
        """
        INSERT INTO resumes (user_id, file_name, file_path)
        VALUES (%s, %s, %s)
        RETURNING id;
        """,
        (user_id, file.filename, file_path)
    )

    resume_id = cursor.fetchone()[0]

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Resume uploaded successfully",
        "resume_id": resume_id,
        "file_name": file.filename
    }


@app.post("/resume/parse")
def parse_resume(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, file_path
        FROM resumes
        WHERE user_id = %s
        ORDER BY uploaded_at DESC
        LIMIT 1;
        """,
        (user_id,)
    )

    resume = cursor.fetchone()

    if not resume:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    resume_id = resume[0]
    file_path = resume[1]

    reader = PdfReader(file_path)

    extracted_text = ""

    for page in reader.pages:
        extracted_text += page.extract_text() or ""

    cursor.execute(
        """
        UPDATE resumes
        SET extracted_text = %s
        WHERE id = %s;
        """,
        (extracted_text, resume_id)
    )

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Resume parsed successfully",
        "resume_id": resume_id,
        "extracted_text": extracted_text
    }


@app.post("/resume/extract")
def extract_resume_details(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, extracted_text
        FROM resumes
        WHERE user_id = %s
        ORDER BY uploaded_at DESC
        LIMIT 1;
        """,
        (user_id,)
    )

    resume = cursor.fetchone()

    if not resume:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    resume_id = resume[0]
    resume_text = resume[1]

    if not resume_text:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="Resume has not been parsed yet"
        )

    prompt = f"""
    Analyze this resume and extract:

    1. Skills
    2. Work experience

    Return ONLY valid JSON:

    {{
        "skills": ["skill1", "skill2"],
        "experience": "experience details"
    }}

    Resume:
    {resume_text}
    """

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    ai_result = response.choices[0].message.content
    print("AI RESULT:", repr(ai_result))

    if not ai_result or not ai_result.strip():
        raise HTTPException(
            status_code=500,
            detail="AI returned an empty response"
        )

    ai_result = ai_result.strip()
    if ai_result.startswith("```"):
        ai_result = ai_result.replace("```json", "", 1)
        ai_result = ai_result.replace("```", "", 1)
        ai_result = ai_result.strip()
#json load
    extracted_data = json.loads(ai_result)

    skills = extracted_data["skills"]
    experience = extracted_data["experience"]

    cursor.execute(
        """
        UPDATE resumes
        SET extracted_skills = %s,
            extracted_experience = %s
        WHERE id = %s;
        """,
        (
            ", ".join(skills),
            experience,
            resume_id
        )
    )

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "Resume details extracted successfully",
        "skills": skills,
        "experience": experience
    }


@app.post("/resume/ats")
def analyze_ats(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, extracted_text
        FROM resumes
        WHERE user_id = %s
        ORDER BY uploaded_at DESC
        LIMIT 1;
        """,
        (user_id,)
    )

    resume = cursor.fetchone()

    if not resume:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    resume_id = resume[0]
    resume_text = resume[1]

    if not resume_text:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="Resume has not been parsed yet"
        )

    prompt = f"""
    Analyze the following resume for ATS compatibility.

    Give an ATS score from 0 to 100.

    Consider:
    - Skills
    - Work experience
    - Education
    - Keywords
    - Resume content
    - Overall relevance

    Return ONLY a number between 0 and 100.

    Resume:
    {resume_text}
    """

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    ai_result = response.choices[0].message.content.strip()

    try:
        ats_score = int(ai_result)
    except ValueError:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=500,
            detail="AI returned an invalid ATS score"
        )

    if ats_score < 0 or ats_score > 100:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=500,
            detail="Invalid ATS score"
        )

    cursor.execute(
        """
        UPDATE resumes
        SET ats_score = %s
        WHERE id = %s;
        """,
        (ats_score, resume_id)
    )

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "message": "ATS analysis completed",
        "resume_id": resume_id,
        "ats_score": ats_score
    }


@app.get("/recommended-jobs")
def get_recommended_jobs(
    user_id: int = Depends(get_user_id)
):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT extracted_skills, extracted_experience
        FROM resumes
        WHERE user_id = %s
        ORDER BY uploaded_at DESC
        LIMIT 1;
        """,
        (user_id,)
    )

    resume = cursor.fetchone()

    if not resume:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    skills = resume[0]
    experience = resume[1]

    if not skills:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="Resume skills have not been extracted yet"
        )

    cursor.execute(
        """
        SELECT id, title, company, location,
               required_skills, experience_required
        FROM jobs
        ORDER BY created_at DESC;
        """
    )

    jobs = cursor.fetchall()

    if not jobs:
        cursor.close()
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="No jobs available"
        )

    job_data = []

    for job in jobs:
        job_data.append({
            "id": job[0],
            "title": job[1],
            "company": job[2],
            "location": job[3],
            "required_skills": job[4],
            "experience_required": job[5]
        })

    prompt = f"""
    Match this candidate with the available jobs.

    Candidate skills:
    {skills}

    Candidate experience:
    {experience}

    Available jobs:
    {job_data}

    Rank the jobs from best match to lowest match.

    Return ONLY valid JSON in this format:

    {{
        "recommendations": [
            {{
                "job_id": 1,
                "match_score": 90
            }}
        ]
    }}

    Match score must be between 0 and 100.
    """

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0,
        response_format={"type": "json_object"}
    )

    ai_result = response.choices[0].message.content.strip()
    if ai_result.startswith("```"):
        ai_result = ai_result.replace("```json", "", 1)
        ai_result = ai_result.replace("```", "", 1)
        ai_result = ai_result.strip()

#json load
    recommendations = json.loads(ai_result)

    cursor.close()
    connection.close()

    return recommendations