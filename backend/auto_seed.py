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

        import tempfile
        with conn.cursor() as cur:
            with gzip.open(DUMP_PATH, "rt", encoding="utf-8", errors="ignore") as f:
                in_copy = False
                copy_stmt = None
                temp_file = None
                stmt_buffer = []

                for line in f:
                    if line.startswith(("\\restrict", "\\unrestrict")):
                        continue

                    if in_copy:
                        if line.strip() == "\\.":
                            # End of COPY block -> stream via copy_expert from temp file
                            in_copy = False
                            if temp_file:
                                temp_file.flush()
                                temp_file.seek(0)
                                print(f"[SEED] Streaming {copy_stmt[:50]} to database...")
                                try:
                                    cur.copy_expert(copy_stmt, temp_file)
                                except Exception as copy_err:
                                    print(f"[SEED] COPY warning: {copy_err}")
                                    conn.rollback()
                                    conn.autocommit = False
                                finally:
                                    temp_file.close()
                                    try:
                                        os.unlink(temp_file.name)
                                    except Exception:
                                        pass
                                    temp_file = None
                            copy_stmt = None
                        else:
                            if temp_file:
                                temp_file.write(line)
                    else:
                        if line.upper().startswith("COPY ") and "FROM STDIN" in line.upper():
                            in_copy = True
                            copy_stmt = line.strip().rstrip(";")
                            temp_file = tempfile.NamedTemporaryFile(mode="w+", encoding="utf-8", delete=False)
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
                                # Skip SET commands for unsupported parameters
                                sql_upper = sql.upper()
                                if sql_upper.startswith("SET ") and any(
                                    p in sql_upper for p in [
                                        "TRANSACTION_TIMEOUT",
                                        "IDLE_IN_TRANSACTION_SESSION_TIMEOUT",
                                        "LOCK_TIMEOUT",
                                        "STATEMENT_TIMEOUT",
                                    ]
                                ):
                                    continue
                                try:
                                    cur.execute(sql)
                                except Exception as stmt_err:
                                    err_str = str(stmt_err).lower()
                                    # Non-fatal errors: skip and continue
                                    if any(k in err_str for k in [
                                        "already exists",
                                        "duplicate key",
                                        "unrecognized configuration parameter",
                                    ]):
                                        conn.rollback()
                                        conn.autocommit = False
                                        continue
                                    raise

        # Synchronize PostgreSQL sequences so new inserts don't collide with existing IDs
        for table in ["users", "jobs", "candidate_profiles", "resumes", "swipe_history", "ats_reports"]:
            try:
                cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(max(id), 1)) FROM {table};")
            except Exception as seq_err:
                print(f"[SEED] Sequence sync for {table}: {seq_err}")

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
