from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text

DATABASE_URL = "sqlite:///database.db"
engine = create_engine(DATABASE_URL, echo=False)

# SM-2 columns added to an already-seeded DB (SQLModel can't ALTER).
SRS_COLUMNS = {
    "easiness_factor": "REAL NOT NULL DEFAULT 2.5",
    "interval_days": "INTEGER NOT NULL DEFAULT 0",
    "repetitions": "INTEGER NOT NULL DEFAULT 0",
    "next_review": "DATETIME",
    "ipa": "TEXT NOT NULL DEFAULT ''",
}


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        existing = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(words)"))
        }
        for col, ddl in SRS_COLUMNS.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE words ADD COLUMN {col} {ddl}"))


def get_session():
    with Session(engine) as session:
        yield session

