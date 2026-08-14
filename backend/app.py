from fastapi import FastAPI

app = FastAPI(title="SWIPE X API")


@app.get("/")
def home():
    return {"message": "SWIPE X Backend"}