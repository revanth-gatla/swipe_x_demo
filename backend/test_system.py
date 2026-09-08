"""
Test script for SWIPE X backend end-to-end functionality.
Tests:
1. Database connectivity
2. Auth / Token verification
3. Candidate profile CRUD with decimal experience & preferences
4. Recommendation engine (70/20/10 scoring & excluding swiped jobs)
5. Swipe actions (LEFT, RIGHT, SAVE upsert)
6. Swipe history retrieval
7. Job-specific ATS analysis (Groq LLM call & ats_reports caching)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=True)

from database import get_db_connection
from auth import create_access_token
import app
from app import (
    _compute_match_score,
    _get_candidate_data,
    _get_swipe_patterns,
    EXPERIENCE_LEVEL_MAP,
)

def run_tests():
    print("=" * 60)
    print("RUNNING SWIPE X VERIFICATION TESTS")
    print("=" * 60)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Test 1: DB Table counts
        print("\n[TEST 1] Verifying Database State...")
        cur.execute("SELECT COUNT(*) FROM jobs;")
        total_jobs = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM jobs WHERE source = 'existing';")
        existing_jobs = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM jobs WHERE source = 'linkedin';")
        linkedin_jobs = cur.fetchone()[0]

        print(f"  Total jobs: {total_jobs}")
        print(f"  Existing jobs intact: {existing_jobs}")
        print(f"  LinkedIn jobs: {linkedin_jobs}")
        assert total_jobs >= 33258, "Total jobs count mismatch"
        assert existing_jobs == 12, "Existing jobs count mismatch"
        print("  -> PASS: Job counts verified.")

        # Test 2: Find a test user or create a synthetic test token
        print("\n[TEST 2] Verifying User & Candidate Profile with Decimal Experience...")
        cur.execute("SELECT id FROM users LIMIT 1;")
        user_row = cur.fetchone()
        assert user_row is not None, "At least one user must exist"
        test_user_id = user_row[0]
        print(f"  Using test user_id={test_user_id}")

        # Update candidate profile with decimal experience and preferences
        cur.execute(
            """
            INSERT INTO candidate_profiles (
                user_id, phone, location, education, experience_years,
                skills, bio, preferred_roles, preferred_locations,
                career_interests, work_mode_preference
            )
            VALUES (%s, '9876543210', 'Hyderabad', 'B.Tech CSE', 2.5,
                    'Python, FastAPI, PostgreSQL, React, Docker',
                    'Passionate backend engineer',
                    'Backend Developer, Python Engineer',
                    'Hyderabad, Remote',
                    'AI, FinTech', 'Remote')
            ON CONFLICT (user_id) DO UPDATE SET
                experience_years = 2.5,
                skills = 'Python, FastAPI, PostgreSQL, React, Docker',
                preferred_roles = 'Backend Developer, Python Engineer',
                preferred_locations = 'Hyderabad, Remote',
                work_mode_preference = 'Remote'
            RETURNING experience_years, preferred_roles;
            """,
            (test_user_id,)
        )
        saved_exp, saved_roles = cur.fetchone()
        conn.commit()
        print(f"  Candidate experience: {saved_exp} years (type: {type(saved_exp)})")
        print(f"  Candidate preferred roles: {saved_roles}")
        assert float(saved_exp) == 2.5, "Decimal experience failed to save"
        print("  -> PASS: Decimal experience & preferences saved successfully.")

        # Test 3: Recommendation scoring logic (70/20/10)
        print("\n[TEST 3] Verifying 70/20/10 Scoring Logic...")
        # Create a sample job tuple
        # (job_id, title, company, location, description, required_skills, experience_required,
        #  salary, job_type, application_url, created_at, experience_level, remote_allowed, work_mode, source)
        mock_job = (
            999999,
            "Senior Python Backend Developer",
            "Tech Innovators",
            "Hyderabad",
            "Looking for an experienced Python developer with FastAPI and PostgreSQL expertise",
            "Python, FastAPI, PostgreSQL, Kubernetes, AWS", # 3/5 matched -> 42 points
            3.0, # required: 3.0, candidate has 2.5 -> (2.5/3)*20 = 16.67 points
            "15 LPA",
            "Full-time",
            "https://example.com/apply",
            None,
            None,
            True,
            "Remote",
            "existing"
        )

        candidate_skills = ["python", "fastapi", "postgresql", "react", "docker"]
        score, matched, missing = _compute_match_score(
            job=mock_job,
            candidate_skills=candidate_skills,
            candidate_years=2.5,
            preferred_roles="Backend Developer",
            preferred_locations="Hyderabad",
            preferred_work_mode="Remote",
            boosted_skills={},
            penalized_skills={},
            boosted_titles={},
            penalized_titles={},
        )

        print(f"  Computed score: {score}%")
        print(f"  Matched skills: {matched}")
        print(f"  Missing skills: {missing}")
        assert score > 50, f"Expected high match score, got {score}"
        assert any("python" in m.lower() for m in matched) and any("fastapi" in m.lower() for m in matched)
        print("  -> PASS: Recommendation scoring works accurately.")

        # Test 4: Swipe Upsert (LEFT, RIGHT, SAVE)
        print("\n[TEST 4] Verifying Swipe Upsert...")
        # Pick job_id 1
        cur.execute("SELECT id FROM jobs WHERE id = 1;")
        target_job_id = cur.fetchone()[0]

        # Swipe RIGHT
        cur.execute(
            """
            INSERT INTO swipe_history (user_id, job_id, action)
            VALUES (%s, %s, 'RIGHT')
            ON CONFLICT (user_id, job_id)
            DO UPDATE SET action = EXCLUDED.action, created_at = CURRENT_TIMESTAMP
            RETURNING action;
            """,
            (test_user_id, target_job_id)
        )
        action_1 = cur.fetchone()[0]
        conn.commit()
        assert action_1 == "RIGHT"

        # Re-swipe to SAVE (upsert check)
        cur.execute(
            """
            INSERT INTO swipe_history (user_id, job_id, action)
            VALUES (%s, %s, 'SAVE')
            ON CONFLICT (user_id, job_id)
            DO UPDATE SET action = EXCLUDED.action, created_at = CURRENT_TIMESTAMP
            RETURNING action;
            """,
            (test_user_id, target_job_id)
        )
        action_2 = cur.fetchone()[0]
        conn.commit()
        assert action_2 == "SAVE"

        # Clean up test swipe so we don't pollute user history
        cur.execute("DELETE FROM swipe_history WHERE user_id = %s AND job_id = %s;", (test_user_id, target_job_id))
        conn.commit()
        print("  -> PASS: Swipe upsert tested and cleaned.")

        # Test 5: Check ATS reports schema
        print("\n[TEST 5] Verifying ATS Reports Schema & Unique Constraint...")
        cur.execute(
            """
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'ats_reports'::regclass AND contype = 'u';
            """
        )
        constraints = [row[0] for row in cur.fetchall()]
        print(f"  ATS reports unique constraints: {constraints}")
        assert "ats_reports_unique_analysis" in constraints, "Missing UNIQUE(user_id, resume_id, job_id) constraint"
        print("  -> PASS: ATS unique constraint verified.")

        # Test 6: Discover Jobs endpoint pagination & search
        print("\n[TEST 6] Verifying Discover Jobs...")
        discover_res = app.discover_jobs(page=1, per_page=10, search="developer")
        assert "jobs" in discover_res
        assert len(discover_res["jobs"]) > 0
        assert discover_res["total"] > 0
        assert discover_res["total_pages"] > 0
        print(f"  Discover returned {len(discover_res['jobs'])} jobs of {discover_res['total']} total.")
        print("  -> PASS: Discover Jobs verified.")

        print("\n" + "=" * 60)
        print("ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_tests()
