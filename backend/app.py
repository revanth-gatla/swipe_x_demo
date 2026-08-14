from fastapi import FastAPI
from database import get_db_connection

app = FastAPI(title="SWIPE X API")

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