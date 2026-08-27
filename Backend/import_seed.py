import json
import sqlite3
from pathlib import Path
from main import Base, engine

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "maxshow.db"
SEED_PATH = BASE_DIR / "seed_data.json"

def import_data():
    # 1. Create all tables first using SQLAlchemy schema
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    if not SEED_PATH.exists():
        print(f"Seed file not found: {SEED_PATH}")
        return

    with open(SEED_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA foreign_keys = OFF;")

    table_order = ["admins", "users", "events", "bookings", "bookmarks", "ratings"]

    for table in table_order:
        rows = data.get(table, [])
        if not rows:
            continue

        columns = list(rows[0].keys())
        placeholders = ", ".join(["?" for _ in columns])
        col_names = ", ".join(columns)

        query = f"INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders})"
        values = [[row[col] for col in columns] for row in rows]
        cur.executemany(query, values)
        print(f"Imported {len(rows)} records into '{table}'.")

    conn.commit()
    conn.close()
    print("Database successfully synchronized with local data!")

if __name__ == "__main__":
    import_data()
