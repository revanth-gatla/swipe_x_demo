from passlib.context import CryptContext
from fastapi import FastAPI, HTTPException
from database import get_db_connection
from pydantic import EmailStr

app = FastAPI(title="SWIPE X API")
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