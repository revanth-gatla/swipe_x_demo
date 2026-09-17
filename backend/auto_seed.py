"""
SWIPE X — Automatic Database Seeder
====================================
Runs during deployment or application startup.
Checks if the PostgreSQL database is populated (jobs table exists and has rows).
If not, decompresses and streams the database dump (swipe_x_dump.sql.gz)
into PostgreSQL using the fast native bulk COPY protocol and executes DDL/DML.

Safe to re-run: idempotent, skips automatically if data is already present.
"""

import os
import sys
import gzip
import io
import time
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=False)

from database import get_db_connection

DUMP_PATH = BASE_DIR / "data" / "swipe_x_dump.sql.gz"


def is_db_seeded(conn) -> bool:
    """Check if jobs table exists and contains records."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'jobs'
                );
            """)
            exists = cur.fetchone()[0]
            if not exists:
                return False
            cur.execute("SELECT COUNT(*) FROM jobs;")
            cnt = cur.fetchone()[0]
            return cnt > 0
    except Exception as e:
        print(f"[SEED] Check table status: {e}")
        conn.rollback()
        return False


def seed_database():
    """Seed the database from compressed SQL dump if empty."""
    print("[SEED] Checking database status...")
    if not DUMP_PATH.exists():
        print(f"[SEED] WARNING: Dump file not found at {DUMP_PATH}, skipping auto-seed.")
        return False

    conn = get_db_connection()
    conn.autocommit = False

    try:
        if is_db_seeded(conn):
            print("[SEED] Database is already initialized with job data. Skipping seed.")
            return True

        print(f"[SEED] Seeding database from {DUMP_PATH.name} ({DUMP_PATH.stat().st_size / 1024 / 1024:.1f} MB compressed)...")
        start_time = time.time()

        with conn.cursor() as cur:
            with gzip.open(DUMP_PATH, "rt", encoding="utf-8", errors="ignore") as f:
                in_copy = False
                copy_stmt = None
                copy_buffer = []
                stmt_buffer = []

                for line in f:
                    if line.startswith(("\\restrict", "\\unrestrict")):
                        continue

                    if in_copy:
                        if line.strip() == "\\.":
                            # End of COPY block -> stream via copy_expert
                            in_copy = False
                            data_str = "".join(copy_buffer)
                            cur.copy_expert(copy_stmt, io.StringIO(data_str))
                            copy_buffer = []
                            copy_stmt = None
                        else:
                            copy_buffer.append(line)
                    else:
                        if line.upper().startswith("COPY ") and "FROM STDIN" in line.upper():
                            in_copy = True
                            # Format statement for copy_expert: remove trailing semicolon
                            copy_stmt = line.strip().rstrip(";")
                        else:
                            stmt_buffer.append(line)
                            if line.strip().endswith(";"):
                                sql = "".join(stmt_buffer).strip()
                                stmt_buffer = []
                                # Skip transaction commands that interfere with outer transaction
                                if sql.upper().startswith(("BEGIN", "COMMIT", "ROLLBACK")):
                                    continue
                                # Skip owner commands
                                if "OWNER TO" in sql.upper():
                                    continue
                                cur.execute(sql)

        conn.commit()
        elapsed = time.time() - start_time
        print(f"[SEED] SUCCESS! Database seeded with 33,000+ jobs in {elapsed:.2f}s.")
        return True

    except Exception as e:
        print(f"[SEED] ERROR during database seed: {e}")
        conn.rollback()
        raise e
    finally:
        conn.close()


if __name__ == "__main__":
    seed_database()
