"""Massive vocabulary enrichment from open data (WordNet + Tatoeba), no APIs.

For every DB word missing a definition:
  1. WordNet -> definition_en + category (n/v/adj/adv)
  2. Tatoeba eng/spa sentence pairs -> up to 5 {"en","es"} examples
  3. Batch-write back to SQLite

Words absent from WordNet (proper nouns, technical neologisms) are skipped so
the Ollama/JSON paths remain the fallback for them.
"""

import argparse
import re
import sys
from pathlib import Path

from sqlmodel import Session, select, col

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import engine, create_db_and_tables
from models import Word

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "tatoeba"
ENG_TSV = DATA_DIR / "eng_sentences.tsv"
SPA_TSV = DATA_DIR / "spa_sentences.tsv"
LINKS_CSV = DATA_DIR / "links.csv"

POS_MAP = {"n": "n", "v": "v", "a": "adj", "r": "adv", "s": "adj"}

_WORD_RE = re.compile(r"[\w']+")


def load_wordnet():
    from nltk.corpus import wordnet as wn

    return wn


def build_eng_index(target_words: set[str]):
    """Return {word: [(sentence, eng_id), ...]} for sentences containing targets.

    Streams eng_sentences.tsv once. Token matches are case-insensitive on
    exact word boundaries.
    """
    index: dict[str, list[tuple[str, int]]] = {w: [] for w in target_words}
    lower = {w.lower(): w for w in target_words}

    with open(ENG_TSV, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 3:
                continue
            eng_id, _lang, sentence = parts
            for tok in _WORD_RE.findall(sentence.lower()):
                orig = lower.get(tok)
                if orig:
                    index[orig].append((sentence, int(eng_id)))
                    break  # one hit per sentence is enough
    return index


def load_spa():
    """Return {spa_id: sentence}."""
    spa = {}
    with open(SPA_TSV, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) == 3:
                spa[int(parts[0])] = parts[2]
    return spa


def build_es_mapping(eng_ids: set[int], spa: dict[int, str]):
    """Scan links.csv once; return {eng_id: [spa_sentence, ...]} for eng_ids."""
    mapping: dict[int, list[str]] = {}
    with open(LINKS_CSV, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 2:
                continue
            e, s = int(parts[0]), int(parts[1])
            if e in eng_ids:
                es = spa.get(s)
                if es:
                    mapping.setdefault(e, []).append(es)
    return mapping


def enrich(limit: int = 0, mode: str | None = None):
    create_db_and_tables()
    wn = load_wordnet()

    with Session(engine) as session:
        stmt = select(Word).where(col(Word.definition_en) == "")
        if mode:
            stmt = stmt.where(Word.mode == mode)
        stmt = stmt.order_by(Word.zipf.desc())
        if limit:
            stmt = stmt.limit(limit)
        words = session.exec(stmt).all()
        print(f"Loaded {len(words)} words to enrich")

        target_words = {w.word for w in words}
        print("Building English sentence index...")
        eng_index = build_eng_index(target_words)
        print("Loading Spanish sentences...")
        spa = load_spa()

        # Gather eng ids used per word to build the es mapping efficiently
        eng_ids = set()
        for w in words:
            for _sent, eid in eng_index.get(w.word, []):
                eng_ids.add(eid)
        print(f"Building ES translation mapping ({len(eng_ids)} en ids)...")
        es_map = build_es_mapping(eng_ids, spa)
        print("Mapping done")

        updated = skipped = 0
        BATCH = 500
        for i, w in enumerate(tqdm(words)):
            syn = wn.synsets(w.word)
            if not syn:
                skipped += 1
                continue
            s = syn[0]
            w.definition_en = s.definition()
            w.category = POS_MAP.get(s.pos(), w.category)

            examples = []
            for sent, eid in eng_index.get(w.word, []):
                es_list = es_map.get(eid, [])
                if es_list:
                    examples.append({"en": sent, "es": es_list[0]})
                else:
                    examples.append({"en": sent, "es": ""})
                if len(examples) >= 5:
                    break
            if examples:
                import json

                w.examples = json.dumps(examples, ensure_ascii=False)

            session.add(w)
            updated += 1
            if (i + 1) % BATCH == 0:
                session.commit()

        session.commit()
        print(f"\nDone: {updated} enriched, {skipped} skipped (not in WordNet)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich vocab from WordNet + Tatoeba")
    parser.add_argument("--limit", type=int, default=0, help="Max words (0 = all)")
    parser.add_argument("--mode", choices=["cotidiano", "tecnico"], default=None)
    args = parser.parse_args()
    enrich(limit=args.limit, mode=args.mode)
