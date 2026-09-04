import random
from functools import lru_cache

from sqlmodel import Session, select

from database import engine
from models import Word

_cache: dict[str, list[dict]] = {}


def load_words():
    """Cache words and precomputed weights per mode at startup."""
    with Session(engine) as session:
        for mode in ("cotidiano", "tecnico"):
            words = session.exec(select(Word).where(Word.mode == mode)).all()
            _cache[mode] = [
                {"id": w.id, "word": w.word, "category": w.category,
                 "mode": w.mode, "sub_list": w.sub_list, "rank": w.rank,
                 "zipf": w.zipf, "definition_en": w.definition_en,
                 "translation_es": w.translation_es, "examples": w.examples}
                for w in words
            ]


def _get_cached(mode: str) -> list[dict]:
    if not _cache:
        load_words()
    return _cache[mode]


def pick_weighted(mode: str) -> dict:
    """Pick one word using Zipf-weighted random selection.

    Weight = 10^zipf so a word at zipf 5 has 10x the probability of one at zipf 4.
    """
    words = _get_cached(mode)
    weights = [10 ** w["zipf"] for w in words]
    return random.choices(words, weights=weights, k=1)[0]
