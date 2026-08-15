from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db_connection
from passlib.context import CryptContext
from pydantic import EmailStr,BaseModel
from auth import create_access_token,verify_token


app = FastAPI(title="SWIPE X API")
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
        (email,))
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
def create_profile(profile: ProfileRequest,user_id: int = Depends(get_user_id)):
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