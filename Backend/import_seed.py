import json
import sqlite3
from pathlib import Path
from sqlalchemy import text
from main import Base, engine, SessionLocal, Event, Admin, User, Booking, Bookmark, Rating

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "maxshow.db"
SEED_PATH = BASE_DIR / "seed_data.json"

from sqlalchemy import inspect

def import_data():
    # 1. Create all tables first using SQLAlchemy schema
    print("Creating tables on configured database engine...")
    Base.metadata.create_all(bind=engine)

    # 1.1 Run auto-migrations on existing tables
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
        with engine.connect() as conn:
            if "events" in tables:
                e_cols = {c["name"] for c in insp.get_columns("events")}
                if "state" not in e_cols:
                    conn.execute(text("ALTER TABLE events ADD COLUMN state VARCHAR(100) NOT NULL DEFAULT 'Maharashtra'"))
                    conn.commit()
                if "city" not in e_cols:
                    conn.execute(text("ALTER TABLE events ADD COLUMN city VARCHAR(100) NOT NULL DEFAULT 'Pune'"))
                    conn.commit()
    except Exception as em:
        print(f"Migration note: {em}")

    if not SEED_PATH.exists():
        print(f"Seed file not found: {SEED_PATH}")
        return

    with open(SEED_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 2. Sync to active SQLAlchemy database (MySQL or configured database)
    db = SessionLocal()
    try:
        events_data = data.get("events", [])
        for ed in events_data:
            st = ed.get("state")
            ct = ed.get("city")
            if not st or not ct:
                from main import parse_location_state_and_city
                parsed_st, parsed_ct = parse_location_state_and_city(ed.get("location"))
                st = st or parsed_st
                ct = ct or parsed_ct

            existing = db.query(Event).filter(
                (Event.slug == ed["slug"]) | (Event.custom_id == ed.get("custom_id")) | (Event.id == ed["id"])
            ).first()
            if existing:
                existing.title = ed["title"]
                existing.event_type = ed["event_type"]
                existing.venue = ed["venue"]
                existing.time = ed["time"]
                existing.state = st or "Maharashtra"
                existing.city = ct or "Pune"
                existing.location = ed["location"]
                existing.price = ed["price"]
                existing.image = ed["image"]
                existing.description = ed["description"]
                existing.category = ed["category"]
                existing.day = ed.get("day", "weekend")
                existing.rating = ed.get("rating", 4.8)
                existing.rating_count = ed.get("rating_count", 50)
            else:
                new_event = Event(
                    id=ed["id"],
                    custom_id=ed.get("custom_id"),
                    slug=ed["slug"],
                    title=ed["title"],
                    event_type=ed["event_type"],
                    venue=ed["venue"],
                    time=ed["time"],
                    state=st or "Maharashtra",
                    city=ct or "Pune",
                    location=ed["location"],
                    price=ed["price"],
                    image=ed["image"],
                    description=ed["description"],
                    category=ed["category"],
                    day=ed.get("day", "weekend"),
                    rating=ed.get("rating", 4.8),
                    rating_count=ed.get("rating_count", 50),
                )
                db.add(new_event)
        db.commit()
        print(f"SQLAlchemy sync: {len(events_data)} events synced.")
    finally:
        db.close()

    # 3. Also sync local sqlite file for offline support
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys = OFF;")
        # Ensure events columns exist in SQLite
        cur.execute("PRAGMA table_info(events);")
        sqlite_cols = {row[1] for row in cur.fetchall()}
        if sqlite_cols:
            if "state" not in sqlite_cols:
                cur.execute("ALTER TABLE events ADD COLUMN state VARCHAR(100) NOT NULL DEFAULT 'Maharashtra';")
            if "city" not in sqlite_cols:
                cur.execute("ALTER TABLE events ADD COLUMN city VARCHAR(100) NOT NULL DEFAULT 'Pune';")
            conn.commit()

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
        conn.commit()
        conn.close()
        print("SQLite backup database synchronized.")
    except Exception as e:
        print(f"SQLite sync note: {e}")

    print("Database successfully synchronized with local data!")

if __name__ == "__main__":
    import_data()
