import random
from datetime import datetime

from sqlmodel import Session, select

from database import engine
from models import Word

_cache: dict[str, list[dict]] = {}


def load_words():
    """Cache words per mode at startup."""
    with Session(engine) as session:
        for mode in ("cotidiano", "tecnico"):
            words = session.exec(select(Word).where(Word.mode == mode)).all()
            _cache[mode] = [
                {"id": w.id, "word": w.word, "category": w.category,
                 "mode": w.mode, "sub_list": w.sub_list, "rank": w.rank,
                 "zipf": w.zipf, "definition_en": w.definition_en,
                 "translation_es": w.translation_es, "examples": w.examples,
                 "next_review": w.next_review}
                for w in words
            ]


def _get_cached(mode: str) -> list[dict]:
    if not _cache:
        load_words()
    return _cache[mode]


def pick_weighted(mode: str) -> dict:
    """Pick a word: due-for-review first (SRS), else Zipf-weighted new.

    Due words are reviewed in random order before any fresh word, so nothing
    accumulates. If none are due, draw from never-seen words by Zipf weight.
    """
    words = _get_cached(mode)
    now = datetime.now()

    due = [w for w in words if w["next_review"] and w["next_review"] <= now]
    if due:
        return random.choice(due)

    # New (never reviewed) or scheduled-in-future: sample by Zipf weight.
    weights = [10 ** w["zipf"] for w in words]
    return random.choices(words, weights=weights, k=1)[0]


def mark_reviewed(word_id: int, next_review):
    """Update the cached next_review after a review so /next stays consistent."""
    for mode in _cache:
        for w in _cache[mode]:
            if w["id"] == word_id:
                w["next_review"] = next_review
                return
