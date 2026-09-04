"""Batch vocabulary enrichment via Ollama (local LLM)."""

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import urllib.request
import urllib.error

from sqlmodel import Session, select, col

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import engine, create_db_and_tables
from models import Word

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:1.5b"
WORKERS = 3

PROMPT_TEMPLATE = """You are a vocabulary assistant. For the English word below, return ONLY valid JSON with these fields:
- "definition_en": concise English definition (1 sentence)
- "translation_es": natural Spanish translation
- "examples": array of exactly 5 objects with "en" (English sentence) and "es" (Spanish translation), each 8-15 words, using the word naturally

Context: {context}

Word: "{word}"

Respond with ONLY the JSON object, no explanation, no markdown fences."""


def call_ollama(prompt: str, timeout: int = 120) -> dict | None:
    data = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 512},
    }).encode()
    req = urllib.request.Request(
        OLLAMA_URL,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result = json.loads(resp.read())
            text = result.get("response", "").strip()
            # Strip markdown fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text[: text.rfind("```")]
            return json.loads(text)
    except (urllib.error.URLError, json.JSONDecodeError, Exception) as e:
        print(f"  ERROR: {e}")
        return None


def build_prompt(word: str, mode: str) -> str:
    context = (
        "everyday English"
        if mode == "cotidiano"
        else "technical computer science / software engineering English"
    )
    return PROMPT_TEMPLATE.format(word=word, context=context)


def enrich_words(limit: int = 50, modes: list[str] | None = None):
    create_db_and_tables()
    modes = modes or ["cotidiano", "tecnico"]

    with Session(engine) as session:
        for mode in modes:
            stmt = (
                select(Word)
                .where(Word.mode == mode)
                .where(col(Word.definition_en) == "")
                .order_by(Word.zipf.desc())
                .limit(limit)
            )
            words = session.exec(stmt).all()
            print(f"\n{'='*50}")
            print(f"Mode: {mode} — {len(words)} words to enrich")
            print(f"{'='*50}")

            # Concurrently fetch LLM results; write back as they complete.
            # ponytail: single global write lock — DB is SQLite/serialized anyway.
            import threading

            lock = threading.Lock()

            def process(w):
                result = call_ollama(build_prompt(w.word, mode))
                if result and "definition_en" in result:
                    with lock:
                        w.definition_en = result["definition_en"]
                        w.translation_es = result.get("translation_es", "")
                        if "examples" in result and isinstance(result["examples"], list):
                            w.examples = json.dumps(
                                result["examples"][:5], ensure_ascii=False
                            )
                        session.add(w)
                        session.commit()
                    return True
                return False

            with ThreadPoolExecutor(max_workers=WORKERS) as ex:
                futures = [ex.submit(process, w) for w in words]
                successes = 0
                for fut in tqdm(as_completed(futures), total=len(futures)):
                    if fut.result():
                        successes += 1

            print(f"\nEnriched {successes}/{len(words)} words in {mode}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Enrich vocabulary definitions via Ollama")
    parser.add_argument("--limit", type=int, default=50, help="Words per mode (default: 50)")
    parser.add_argument("--modes", nargs="+", default=["cotidiano", "tecnico"])
    args = parser.parse_args()
    enrich_words(limit=args.limit, modes=args.modes)
