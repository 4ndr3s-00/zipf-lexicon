#!/usr/bin/env python3
"""Parse the markdown corpus and seed the SQLite database."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import Word

CORPUS_PATH = Path(__file__).resolve().parent.parent.parent / "Palabras más usadas en inglés US y en inglés técnico de software.md"


def parse_technical_tables(text: str):
    """Parse CSAVL, CSAVL-S, and CSWL tables. Returns list of dicts."""
    words = []
    current_sub_list = None

    for line in text.splitlines():
        line = line.strip()

        if "## 1.1 CSAVL " in line and "suplementaria" not in line:
            current_sub_list = "CSAVL"
            continue
        elif "## 1.2 CSAVL-S" in line:
            current_sub_list = "CSAVL-S"
            continue
        elif "## 1.3 CSWL" in line:
            current_sub_list = "CSWL"
            continue
        elif line.startswith("# Parte 2"):
            break

        if not line.startswith("|") or not current_sub_list:
            continue
        if "---" in line or "Rango" in line or "Palabra" in line:
            continue

        parts = [p.strip() for p in line.split("|")]
        parts = [p for p in parts if p]

        if current_sub_list in ("CSAVL", "CSAVL-S"):
            if len(parts) < 4:
                continue
            rank_s, word, category, zipf_s = parts[0], parts[1], parts[2], parts[3]
            if zipf_s == "—":
                continue
            try:
                rank = int(rank_s)
                zipf = float(zipf_s)
            except ValueError:
                continue
            words.append({
                "word": word,
                "category": category,
                "mode": "tecnico",
                "sub_list": current_sub_list,
                "rank": rank,
                "zipf": zipf,
            })
        elif current_sub_list == "CSWL":
            if len(parts) < 3:
                continue
            rank_s, word, zipf_s = parts[0], parts[1], parts[2]
            if zipf_s == "—":
                continue
            try:
                rank = int(rank_s)
                zipf = float(zipf_s)
            except ValueError:
                continue
            words.append({
                "word": word,
                "category": "",
                "mode": "tecnico",
                "sub_list": "CSWL",
                "rank": rank,
                "zipf": zipf,
            })

    return words


def parse_general_english(text: str):
    """Parse the general English lists (rank. word — zipf)."""
    words = []
    in_general = False

    for line in text.splitlines():
        line = line.strip()

        if line.startswith("# Parte 2"):
            in_general = True
            continue
        if not in_general:
            continue

        m = re.match(r"^(\d+)\.\s+(\S+)\s+[—–-]\s+([\d.]+)$", line)
        if m:
            rank = int(m.group(1))
            word = m.group(2)
            zipf = float(m.group(3))
            words.append({
                "word": word,
                "category": "",
                "mode": "cotidiano",
                "sub_list": "GENERAL",
                "rank": rank,
                "zipf": zipf,
            })

    return words


def seed():
    text = CORPUS_PATH.read_text(encoding="utf-8")

    technical = parse_technical_tables(text)
    general = parse_general_english(text)

    print(f"Parsed {len(technical)} technical words")
    print(f"Parsed {len(general)} general English words")

    create_db_and_tables()

    with Session(engine) as session:
        existing = session.exec(select(Word)).all()
        if existing:
            print(f"Database already has {len(existing)} words, skipping seed.")
            return

        all_words = technical + general
        seen = set()
        inserted = 0

        for w in all_words:
            key = (w["word"], w["mode"], w.get("sub_list"))
            if key in seen:
                continue
            seen.add(key)

            db_word = Word(
                word=w["word"],
                category=w["category"],
                mode=w["mode"],
                sub_list=w["sub_list"],
                rank=w["rank"],
                zipf=w["zipf"],
                definition_en="",
                translation_es="",
                examples="[]",
            )
            session.add(db_word)
            inserted += 1

        session.commit()
        print(f"Inserted {inserted} words into database.db")


if __name__ == "__main__":
    seed()
