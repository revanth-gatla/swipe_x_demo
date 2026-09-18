import os
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv
import psycopg2

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=False)


def get_db_connection():
    """
    Connect to PostgreSQL.
    Prefers DATABASE_URL (provided by Render / cloud platforms) with SSL.
    Falls back to individual POSTGRES_* env vars for local development.
    """
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        # Render provides postgres:// but psycopg2 requires postgresql://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)

        try:
            connection = psycopg2.connect(database_url, sslmode="require")
        except Exception:
            connection = psycopg2.connect(database_url)
    else:
        connection = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "swipe_x"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD")
        )

    return connection