# Zipf-Lexicon

A minimal, dark-themed English vocabulary learning app ranked by **Zipf frequency**,
split into two corpora: **Cotidiano** (everyday US English) and **Técnico**
(professional software/CS English).

Words are shown as flashcards ordered by real usage frequency (Zipf), enriched with
definitions, natural Spanish translations, **IPA phonetics**, and 5 in-context example
sentences — with **spaced-repetition review (SM-2)**, **speech-recognition shadowing**,
a **daily standup simulator**, and a **terminal CLI** for power users.

![stack](https://img.shields.io/badge/backend-FastAPI-teal) ![stack](https://img.shields.io/badge/frontend-React%20%2B%20Vite-blue) ![stack](https://img.shields.io/badge/db-SQLite-lightgrey) ![stack](https://img.shields.io/badge/srs-SM--2-orange)

---

## Architecture

```
zipf-lexicon/
├── backend/                     # FastAPI + SQLModel + SQLite
│   ├── main.py                  # API app: routes, review, expressions
│   ├── models.py                # Word SQLModel table (+ SRS + ipa fields)
│   ├── database.py              # SQLite engine + lightweight migrations
│   ├── data/
│   │   └── tech_phrasal_verbs.json  # Expression catalog for standups (static)
│   ├── services/
│   │   ├── selection.py         # Zipf-weighted + due-first (SRS) sampling
│   │   └── srs.py               # SM-2 spaced-repetition algorithm
│   └── scripts/
│       ├── seed_database.py         # Parse markdown corpus → SQLite (309k)
│       ├── seed_from_json.py        # O(1) direct import of pre-enriched JSON
│       ├── enrich_database.py       # Batch enrichment via local Ollama LLM
│       ├── enrich_from_open_data.py # WordNet + Tatoeba bulk enrichment (O(1), no APIs)
│       └── enrich_ipa.py            # Fill IPA transcriptions via eng_to_ipa
├── cli/
│   └── lexicon.py               # Terminal client (next/search/stats/review)
└── frontend/                    # React 19 + Vite + Tailwind CSS v4
    └── src/
        ├── App.jsx              # Root state, view routing, keyboard shortcuts
        ├── Shell.jsx            # Layout header, mode switcher, health badge
        ├── config/modes.js      # Per-mode accent theming
        ├── components/
        │   ├── FlashCard.jsx        # Word card (def, ES, IPA, examples, TTS)
        │   ├── SpeechEvaluator.jsx  # Web Speech API shadowing (R key)
        │   ├── SearchModal.jsx      # ⌘K command palette
        │   ├── BookmarksModal.jsx   # Saved words + progress stats
        │   └── StandupSimulator.jsx # Daily standup writing practice
        └── utils/storage.js         # localStorage bookmarks / learned
```

**Stack**

| Layer | Tech |
|-------|------|
| Backend | Python 3, FastAPI, SQLModel (SQLAlchemy), Uvicorn, NLTK, eng-to-ipa |
| Frontend | React 19, Vite 8, Tailwind CSS v4, framer-motion, lucide-react, OxLint |
| CLI | Python 3 stdlib (argparse + urllib) |
| Database | SQLite (`backend/database.db`) |

---

## Zipf Data Pipeline

Each word carries a **Zipf value** (`1-8`, higher = more frequent). When drawing a new
flashcard, the backend samples with weight `W = 10^zipf`, biasing the UI toward genuinely
useful vocabulary.

### Source corpus

`Palabras más usadas en inglés US y en inglés técnico de software.md` (~309k words):
- **Cotidiano**: 307,629 general English words (`sub_list = GENERAL`)
- **Técnico**: 1,663 words from the CSAVL / CSAVL-S / CSWL academic lists

### Enrichment — three paths

Words start with empty `definition_en`, `translation_es`, `examples` and are filled in by
any of these routes:

1. **Direct JSON import (O(1))** — `scripts/seed_from_json.py`
   Loads pre-generated JSON and UPDATEs matching rows by `(word, mode, sub_list)`:
   ```bash
   python scripts/seed_from_json.py "path/to/enriched.json"
   ```
   Fastest option — no inference, instant result.

2. **Open-data bulk enrichment (O(1), no APIs)** — `scripts/enrich_from_open_data.py`
   Uses **WordNet** (nltk) for definitions/categories and **Tatoeba** eng↔spa sentence
   pairs for 5 real example sentences. Thousands of words in minutes, zero cost:
   ```bash
   python scripts/enrich_from_open_data.py --limit 5000 --mode cotidiano
   ```
   Args: `--limit N`, `--mode cotidiano|tecnico`. (Download Tatoeba TSVs once into
   `backend/data/tatoeba/`, git-ignored.)

3. **Live inference (Ollama)** — `scripts/enrich_database.py`
   For very specific terms absent from the above. Concurrent (`ThreadPoolExecutor`)
   with `tqdm`; skips already-enriched rows:
   ```bash
   ollama pull qwen2.5:1.5b
   python scripts/enrich_database.py --limit 100 --modes tecnico
   ```

### IPA phonetics — `scripts/enrich_ipa.py`

Fills the `ipa` column via the `eng_to_ipa` library (pure dict+rules, no downloads):
```bash
python scripts/enrich_ipa.py --mode tecnico
```

---

## Spaced Repetition (SM-2)

Replaces pure random sampling with a **forgetting-curve** scheduler:

- Each word carries SM-2 state: `easiness_factor` (default 2.5), `interval_days`,
  `repetitions`, and `next_review`.
- `GET /api/words/next` returns **due-for-review words first**; if none are due, it
  falls back to Zipf-weighted sampling of new words.
- Grading (1=Again, 2=Hard, 3=Good, 4=Easy) updates the intervals and easiness via
  `POST /api/words/{id}/review`. Cache stays consistent via `mark_reviewed`.

---

## Running Locally

### Backend (port 8001)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # fastapi uvicorn sqlmodel tqdm nltk eng-to-ipa
python scripts/seed_database.py   # one-time: parse corpus → database.db
uvicorn main:app --port 8001 --reload
```

Health check: `http://localhost:8001/api/health`. (Port **8001**; 8000 is avoided.)

### Frontend (Vite dev, port 5173)

```bash
cd frontend
npm install
npm run dev        # development server (http://localhost:5173)
npm run build      # production build → dist/
npm run preview    # serve the built app
npm run lint       # OxLint
```

CORS is pre-configured for `http://localhost:5173`.

---

## API Endpoints

All under `http://localhost:8001`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health (`{"status":"ok"}`) |
| GET | `/api/words/count` | Total words, split by mode |
| GET | `/api/words/next?mode=cotidiano\|tecnico` | Next word (SRS due-first, else Zipf-weighted) |
| POST | `/api/words/{id}/review` | Grade a word `{grade: 1-4}` (SM-2), returns new schedule |
| GET | `/api/words/search?q=...&mode=...&limit=N` | Substring search, Zipf-desc |
| GET | `/api/words/enrichment-status` | Enrichment progress (`total`, `enriched`, `percent`) |
| GET | `/api/words/{id}` | Fetch one word by primary key |
| GET | `/api/expressions?category=...` | Tech/standup expression catalog (25 entries) |

### Sample word payload

```json
{
  "id": 1,
  "word": "system",
  "category": "n",
  "mode": "tecnico",
  "sub_list": "CSAVL",
  "rank": 1,
  "zipf": 5.56,
  "definition_en": "A set of interconnected components that work together as a whole to perform a defined task.",
  "translation_es": "Sistema",
  "ipa": "ˈsɪstəm",
  "examples": "[{\"en\": \"The operating system manages hardware.\", \"es\": \"El sistema operativo gestiona el hardware.\"}, ...]",
  "easiness_factor": 2.5,
  "interval_days": 0,
  "repetitions": 0,
  "next_review": null
}
```

> `examples` is a **JSON string** in the DB; the frontend parses it defensively
> (`FlashCard.jsx`) and falls back to `[]` on any failure.

---

## Frontend Features

- **Flashcards** — word with **IPA transcription**, category, Zipf badge, rank,
  click-to-hear pronunciation (Web Speech TTS), collapsible Spanish translation,
  5 interactive EN/ES examples and bookmark/learned actions.
- **Speech shadowing** — `SpeechEvaluator` records via the mic (`R` key or button),
  compares recognized vs expected text and shows an accuracy badge.
- **SRS grading bar** — Again/Hard/Good/Easy buttons with keyboard `1`-`4`.
- **Mode toggle** — Cotidiano 🌐 / Técnico 💻 with animated pill.
- **Search (`⌘K`)** — command palette with debounce, arrow-key nav, enter-to-load.
- **Bookmarks & Progress (`⌘B`)** — save words, mark learned, per-mode stats + avg Zipf
  (in `localStorage`).
- **Standup Simulator** — written-communication practice: Yesterday/Today/Blockers
  fields with dynamic connectors, client-side detection of tech expressions
  (fetched from `/api/expressions`), and a copy-paste-ready standup.
- **Keyboard** — `1-4` grade, `Space`/`→` skip, `P` pronounce, `R` shadowing,
  `⌘K` search, `⌘B` bookmarks.
- **Empty states** — graceful "awaiting enrichment" placeholders + backend health badge.

---

## Terminal CLI (`cli/lexicon.py`)

Python-stdlib client for the local API, with ANSI-colored, dark-theme output
(neon-green word, grey IPA, amber translation). Requires the backend on port 8001.

```bash
./cli/lexicon.py next --mode tecnico        # fetch a word: IPA, def, ES, example
./cli/lexicon.py next --mode cotidiano
./cli/lexicon.py search algorithm           # Zipf-desc results + translations
./cli/lexicon.py search data --limit 10 --mode tecnico
./cli/lexicon.py stats                      # enrichment % + corpus counts
./cli/lexicon.py review 42 4                # grade a word 1-4 (SM-2)
```

---

## Notes & Trade-offs

- **Sampling cache**: words are loaded into memory at startup (~309k) for O(1) weighted
  picks; effective but trades a few hundred MB of RAM.
- **Single-user, local-first**: no auth / no multi-device sync. SRS progress lives in
  SQLite (`words` table); bookmarks/learned live in `localStorage` per browser.
- **Speech recognition** requires Chrome/Edge + mic permission.
- **Tatoeba dataset** (~561MB) is downloaded once into `backend/data/tatoeba/` and
  git-ignored; the static `tech_phrasal_verbs.json` is committed.
