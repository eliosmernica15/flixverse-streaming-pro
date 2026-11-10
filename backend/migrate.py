"""Apply the complete database schema and update its recorded version."""

from database import close_db_pool, init_db


if __name__ == "__main__":
    try:
        init_db(schema_sync=True)
        print("Database schema is up to date.")
    finally:
        close_db_pool()
