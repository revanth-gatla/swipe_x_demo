"""
SWIPE X — LinkedIn Job Dataset Importer
========================================
Downloads the LinkedIn job postings dataset from Hugging Face,
cleans/normalizes the data, and inserts it into the jobs table.

Safe to re-run: uses ON CONFLICT to skip duplicates.
Preserves all existing jobs.

Usage:
    python import_linkedin_jobs.py
"""

import os
import sys
import csv
import io
import re
import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE, override=True)

DATASET_URL = "https://huggingface.co/datasets/xanderios/linkedin-job-postings/resolve/main/job_postings.csv"
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "job_postings.csv"

BATCH_SIZE = 500  # insert this many rows per batch


def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "swipe_x"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD"),
    )


# ---------------------------------------------------------------------------
# Step 1: Download dataset
# ---------------------------------------------------------------------------

def download_dataset():
    """Download the CSV if not already present."""
    if CSV_PATH.exists():
        size_mb = CSV_PATH.stat().st_size / (1024 * 1024)
        print(f"[INFO] Dataset already downloaded: {CSV_PATH} ({size_mb:.1f} MB)")
        return

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[INFO] Downloading dataset from Hugging Face...")
    print(f"       URL: {DATASET_URL}")

    import urllib.request
    urllib.request.urlretrieve(DATASET_URL, CSV_PATH)

    size_mb = CSV_PATH.stat().st_size / (1024 * 1024)
    print(f"[OK]   Downloaded: {CSV_PATH} ({size_mb:.1f} MB)")


# ---------------------------------------------------------------------------
# Step 2: Inspect & load CSV
# ---------------------------------------------------------------------------

def load_csv():
    """Load CSV and return list of dicts."""
    print(f"[INFO] Loading CSV...")
    import pandas as pd

    # Read with pandas for robustness (handles quoting, encoding, etc.)
    df = pd.read_csv(CSV_PATH, dtype=str, keep_default_na=False)
    print(f"[OK]   Loaded {len(df)} rows, columns: {list(df.columns)}")
    return df


# ---------------------------------------------------------------------------
# Step 3: Clean and normalize
# ---------------------------------------------------------------------------

def clean_text(val):
    """Strip whitespace and normalize empty strings to None."""
    if val is None:
        return None
    val = str(val).strip()
    if val == "" or val.lower() == "nan" or val.lower() == "none":
        return None
    return val


def normalize_salary(row):
    """Build a human-readable salary string from min/med/max + pay_period + currency."""
    min_s = clean_text(row.get("min_salary"))
    med_s = clean_text(row.get("med_salary"))
    max_s = clean_text(row.get("max_salary"))
    period = clean_text(row.get("pay_period"))
    currency = clean_text(row.get("currency"))

    parts = []

    # Try to build range
    if min_s and max_s:
        try:
            min_v = float(min_s)
            max_v = float(max_s)
            if min_v > 0 and max_v > 0:
                if min_v == max_v:
                    parts.append(f"{min_v:,.0f}")
                else:
                    parts.append(f"{min_v:,.0f} - {max_v:,.0f}")
        except ValueError:
            pass
    elif med_s:
        try:
            med_v = float(med_s)
            if med_v > 0:
                parts.append(f"{med_v:,.0f}")
        except ValueError:
            pass

    if not parts:
        return None

    result = parts[0]
    if currency:
        result = f"{currency} {result}"
    if period:
        result = f"{result}/{period.lower()}"

    # Truncate to fit VARCHAR(100)
    return result[:100] if result else None


def extract_company_from_domain(posting_domain):
    """Extract a readable company name from posting_domain like 'google.com'."""
    if not posting_domain:
        return None
    # Remove www., .com, .org, etc.
    name = posting_domain.lower()
    name = re.sub(r'^(www\.)', '', name)
    name = re.sub(r'\.(com|org|net|io|co|us|uk|de|fr|ca|au|in|edu|gov)(\.[a-z]+)?$', '', name)
    # Capitalize
    name = name.replace('-', ' ').replace('_', ' ').title()
    return name if name else None


def normalize_work_type(formatted_work_type):
    """Map LinkedIn work types to our job_type values."""
    if not formatted_work_type:
        return None
    mapping = {
        "full-time": "Full-time",
        "part-time": "Part-time",
        "contract": "Contract",
        "temporary": "Temporary",
        "internship": "Internship",
        "volunteer": "Volunteer",
        "other": "Other",
    }
    return mapping.get(formatted_work_type.lower().strip(), formatted_work_type.strip()[:50])


def normalize_work_mode(remote_allowed):
    """Convert remote_allowed (0/1/True/False) to work_mode."""
    if remote_allowed is None:
        return None
    val = str(remote_allowed).strip().lower()
    if val in ("1", "true", "yes"):
        return "Remote"
    elif val in ("0", "false", "no"):
        return None  # Not necessarily "On-site", could be hybrid — don't assume
    return None


def transform_row(row):
    """
    Transform a raw CSV row dict into a cleaned record ready for insertion.
    Returns None if the row should be skipped.
    """
    title = clean_text(row.get("title"))
    description = clean_text(row.get("description"))
    job_id = clean_text(row.get("job_id"))

    # Skip if no title or no job_id
    if not title or not job_id:
        return None

    # Build company name: try posting_domain since company_id is numeric
    company = extract_company_from_domain(clean_text(row.get("posting_domain")))
    if not company:
        company = "Unknown"

    location = clean_text(row.get("location"))
    # Truncate location to fit VARCHAR(100)
    if location and len(location) > 100:
        location = location[:97] + "..."

    required_skills = clean_text(row.get("skills_desc"))
    salary = normalize_salary(row)
    job_type = normalize_work_type(clean_text(row.get("formatted_work_type")))
    application_url = clean_text(row.get("application_url"))
    if application_url and len(application_url) > 500:
        application_url = application_url[:500]

    experience_level = clean_text(row.get("formatted_experience_level"))
    remote_allowed_raw = clean_text(row.get("remote_allowed"))

    remote_allowed = None
    if remote_allowed_raw:
        val = remote_allowed_raw.strip().lower()
        if val in ("1", "true", "yes"):
            remote_allowed = True
        elif val in ("0", "false", "no"):
            remote_allowed = False

    work_mode = normalize_work_mode(remote_allowed_raw)

    return {
        "title": title[:200],  # VARCHAR(200)
        "company": company[:200],  # VARCHAR(200)
        "location": location,
        "description": description,
        "required_skills": required_skills,
        "experience_required": None,  # LinkedIn has levels, not numeric years
        "salary": salary,
        "job_type": job_type,
        "application_url": application_url,
        "experience_level": experience_level[:50] if experience_level else None,
        "remote_allowed": remote_allowed,
        "work_mode": work_mode,
        "source": "linkedin",
        "source_job_id": str(job_id),
    }


# ---------------------------------------------------------------------------
# Step 4: Insert into jobs table
# ---------------------------------------------------------------------------

INSERT_SQL = """
INSERT INTO jobs (
    title, company, location, description, required_skills,
    experience_required, salary, job_type, application_url,
    experience_level, remote_allowed, work_mode,
    source, source_job_id
)
VALUES (
    %(title)s, %(company)s, %(location)s, %(description)s, %(required_skills)s,
    %(experience_required)s, %(salary)s, %(job_type)s, %(application_url)s,
    %(experience_level)s, %(remote_allowed)s, %(work_mode)s,
    %(source)s, %(source_job_id)s
)
ON CONFLICT (source, source_job_id) DO NOTHING;
"""


def insert_jobs(records):
    """Insert cleaned records into jobs table in batches."""
    conn = get_db_connection()
    cursor = conn.cursor()

    total_inserted = 0
    total_skipped = 0

    try:
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i : i + BATCH_SIZE]
            for rec in batch:
                cursor.execute(INSERT_SQL, rec)
                if cursor.rowcount > 0:
                    total_inserted += 1
                else:
                    total_skipped += 1

            conn.commit()
            print(f"  Batch {i // BATCH_SIZE + 1}: processed {len(batch)} rows")

        return total_inserted, total_skipped

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------------------------
# Step 5: Verify
# ---------------------------------------------------------------------------

def verify():
    """Print summary statistics after import."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT COUNT(*) FROM jobs;")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM jobs WHERE source = 'existing';")
        existing = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM jobs WHERE source = 'linkedin';")
        linkedin = cursor.fetchone()[0]

        cursor.execute("""
            SELECT experience_level, COUNT(*)
            FROM jobs
            WHERE source = 'linkedin'
            GROUP BY experience_level
            ORDER BY COUNT(*) DESC;
        """)
        exp_levels = cursor.fetchall()

        print(f"\n{'='*50}")
        print(f"  VERIFICATION SUMMARY")
        print(f"{'='*50}")
        print(f"  Total jobs:       {total}")
        print(f"  Existing jobs:    {existing}")
        print(f"  LinkedIn jobs:    {linkedin}")
        print(f"\n  Experience levels (LinkedIn):")
        for level, count in exp_levels:
            print(f"    {level or 'NULL'}: {count}")
        print(f"{'='*50}\n")

    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  SWIPE X — LinkedIn Job Dataset Importer")
    print("=" * 60)

    # Step 1: Download
    download_dataset()

    # Step 2: Load CSV
    df = load_csv()

    # Step 3: Transform & clean
    print(f"[INFO] Cleaning and normalizing {len(df)} rows...")
    records = []
    skipped = 0
    for _, row in df.iterrows():
        rec = transform_row(row.to_dict())
        if rec:
            records.append(rec)
        else:
            skipped += 1

    print(f"[OK]   {len(records)} valid records, {skipped} skipped (missing title/job_id)")

    # Step 4: Insert
    print(f"[INFO] Inserting into jobs table (batch size: {BATCH_SIZE})...")
    inserted, duplicates = insert_jobs(records)
    print(f"[OK]   Inserted: {inserted}, Skipped (duplicates): {duplicates}")

    # Step 5: Verify
    verify()

    print("[DONE] Import complete!")


if __name__ == "__main__":
    main()
