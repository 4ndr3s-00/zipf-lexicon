"""Import directly-enriched vocabulary from a JSON file into database.db.

Matches existing rows by (word, mode, sub_list) and updates definition_en,
translation_es, and examples. Skips rows not found. Keeps DB's zipf/rank.
"""

import argparse
import json
import sys
from pathlib import Path

from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import engine, create_db_and_tables
from models import Word


def import_json(path: str):
    create_db_and_tables()
    with open(path, encoding="utf-8") as f:
        entries = json.load(f)

    updated = not_found = 0

    with Session(engine) as session:
        for e in entries:
            stmt = select(Word).where(
                Word.word == e["word"],
                Word.mode == e.get("mode", "tecnico"),
                Word.sub_list == e.get("sub_list"),
            )
            w = session.exec(stmt).first()
            if not w:
                not_found += 1
                print(f"  NOT FOUND: {e['word']}")
                continue

            w.definition_en = e["definition_en"]
            w.translation_es = e.get("translation_es", "")
            w.category = e.get("category", w.category)
            if "examples" in e and isinstance(e["examples"], list):
                w.examples = json.dumps(e["examples"][:5], ensure_ascii=False)
            session.add(w)
            updated += 1

        session.commit()

    print(f"\nUpdated {updated} words, {not_found} not found.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import enriched vocab from JSON")
    parser.add_argument("path", help="Path to JSON file of enriched words")
    args = parser.parse_args()
    import_json(args.path)
