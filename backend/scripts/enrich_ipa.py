"""Quick IPA enrichment using the eng_to_ipa library (no downloads, no APIs)."""

import argparse
import sys
from pathlib import Path

from sqlmodel import Session, select, col

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import engine, create_db_and_tables
from models import Word


def enrich_ipa(limit: int = 0, mode: str | None = None):
    import eng_to_ipa as ipa

    create_db_and_tables()

    with Session(engine) as session:
        stmt = select(Word).where(col(Word.ipa) == "")
        if mode:
            stmt = stmt.where(Word.mode == mode)
        stmt = stmt.order_by(Word.zipf.desc())
        if limit:
            stmt = stmt.limit(limit)
        words = session.exec(stmt).all()
        print(f"Loaded {len(words)} words to IPA-enrich")

        updated = skipped = 0
        BATCH = 2000
        for i, w in enumerate(tqdm(words)):
            try:
                trans = ipa.convert(w.word)
                if trans:
                    w.ipa = trans
                    session.add(w)
                    updated += 1
                else:
                    skipped += 1
            except Exception:
                skipped += 1
            if (i + 1) % BATCH == 0:
                session.commit()

        session.commit()
        print(f"\nDone: {updated} IPA-enriched, {skipped} skipped")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fill IPA transcriptions via eng_to_ipa")
    parser.add_argument("--limit", type=int, default=0, help="Max words (0 = all)")
    parser.add_argument("--mode", choices=["cotidiano", "tecnico"], default=None)
    args = parser.parse_args()
    enrich_ipa(limit=args.limit, mode=args.mode)
