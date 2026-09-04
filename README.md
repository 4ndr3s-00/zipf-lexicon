# Zipf-Lexicon

A minimal, dark-themed English vocabulary learning app ranked by **Zipf frequency**,
split into two corpora: **Cotidiano** (everyday US English) and **Técnico**
(professional software/CS English).

Words are displayed as flashcards ordered by real usage frequency (Zipf), with
definitions, natural Spanish translations, and 5 in-context example sentences —
all directly browsable and searchable.

![stack](https://img.shields.io/badge/backend-FastAPI-teal) ![stack](https://img.shields.io/badge/frontend-React%20%2B%20Vite-blue) ![stack](https://img.shields.io/badge/db-SQLite-lightgrey)

---

## Architektur

```
zipf-lexicon/
├── backend/                 # FastAPI + SQLModel + SQLite
│   ├── main.py              # API app + routes + enrichment-status
│   ├── models.py            # Word SQLModel table
│   ├── database.py          # SQLite engine + session factory
│   ├── services/
│   │   └── selection.py     # Zipf-weighted random sampling (cached)
│   └── scripts/
│       ├── seed_database.py     # Parse markdown corpus → SQLite (309k words)
│       ├── seed_from_json.py    # O(1) direct import of pre-enriched JSON
│       └── enrich_database.py   # Batch enrichment via local Ollama LLM
└── frontend/                # React 19 + Vite + Tailwind CSS v4
    └── src/
        ├── App.jsx          # Root state, keyboard shortcuts, modal wiring
        ├── Shell.jsx        # Layout header, mode switcher, health badge
        ├── config/modes.js  # Per-mode accent theming
        ├── components/
        │   ├── FlashCard.jsx        # Word card (def, translation, examples, TTS)
        │   ├── SearchModal.jsx      # ⌘K command palette
        │   └── BookmarksModal.jsx   # Saved words + progress stats
        └── utils/storage.js         # localStorage bookmarks / learned
```

**Stack**

| Layer | Tech |
|-------|------|
| Backend | Python 3, FastAPI, SQLModel (SQLAlchemy), Uvicorn |
| Frontend | React 19, Vite 8, Tailwind CSS v4, framer-motion, lucide-react, OxLint |
| Database | SQLite (`backend/database.db`) |

---

## Zipf Data Pipeline

Each word carries a **Zipf value** (`1-8`, higher = more frequent). When drawing
the next flashcard, the backend samples with weight `W = 10^zipf`, so a word at
Zipf 5 has 10× the chance of one at Zipf 4 — the UI is biased toward genuinely
useful vocabulary.

### Source corpus

`Palabras más usadas en inglés US y en inglés técnico de software.md` (~309k words):
- **Cotidiano**: 307,629 general English words (`sub_list = GENERAL`)
- **Técnico**: 1,663 words from the CSAVL / CSAVL-S / CSWL academic lists

### Enrichment — two paths

Words are stored with empty `definition_en`, `translation_es`, `examples` until
enriched. Two supported routes:

1. **Direct JSON import (O(1))** — `scripts/seed_from_json.py`
   Loads pre-generated JSON files (structured once outside the runtime) and
   UPDATEs matching rows by `(word, mode, sub_list)`:
   ```bash
   python scripts/seed_from_json.py "path/to/enriched.json"
   ```
   Fastest option — no model inference, instant result.

2. **Live inference (OLLaMA)** — `scripts/enrich_database.py`
   Fetches definitions/translations/5 examples from a local Ollama model with
   concurrency (`ThreadPoolExecutor`) and a `tqdm` progress bar. Skips rows
   already enriched (`WHERE definition_en = ''`). Fit for large backfills:
   ```bash
   ollama pull qwen2.5:1.5b
   python scripts/enrich_database.py --limit 100 --modes tecnico
   ```
   Args: `--limit N` (per mode), `--modes cotidiano tecnico`.

---

## Running Locally

### Backend (port 8001)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt       # fastapi uvicorn sqlmodel tqdm
python scripts/seed_database.py       # one-time: parse corpus → database.db
uvicorn main:app --port 8001 --reload
```

The API mounts at `http://localhost:8001`. Health check:
`http://localhost:8001/api/health`.

> Port 8000 is intentionally avoided; this project uses **8001**.

### Frontend (Vite dev, port 5173)

```bash
cd frontend
npm install
npm run dev          # development server (http://localhost:5173)
npm run build        # production build → dist/
npm run preview      # serve the built app
npm run lint         # OxLint
```

CORS is pre-configured to allow `http://localhost:5173`.

---

## API Endpoints

All under `http://localhost:8001`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health (`{"status":"ok"}`) |
| GET | `/api/words/count` | Total words, split by mode |
| GET | `/api/words/next?mode=cotidiano\|tecnico` | Next Zipf-weighted random word |
| GET | `/api/words/search?q=...&mode=...&limit=N` | Search by substring, Zipf-desc |
| GET | `/api/words/enrichment-status` | Enrichment progress (`total`, `enriched`, `percent`) |
| GET | `/api/words/{id}` | Fetch one word by primary key |

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
  "examples": "[{\"en\": \"The operating system manages hardware.\", \"es\": \"El sistema operativo gestiona el hardware.\"}, ...]"
}
```

> `examples` is a **JSON string** in the DB; the frontend parses it defensively
> (`FlashCard.jsx`) and falls back to `[]` on any failure.

---

## Frontend Features

- **Flashcards** — word, category, Zipf badge, rank, click-to-hear pronunciation
  (Web Speech API TTS), collapsible translation, 5 interactive EN/ES examples.
- **Mode toggle** — switch between Cotidiano 🌐 and Técnico 💻 with animated pill.
- **Search (`⌘K`)** — command palette with debounce, arrow-key navigation, enter-to-load.
- **Bookmarks & Progress** — save words (`⌘B`), mark as learned, view per-mode
  stats and average Zipf; persisted in `localStorage`.
- **Keyboard** — `Space`/`→` next word, `P` pronounce, `⌘K` search, `⌘B` bookmarks.
- **Empty states** — graceful "awaiting enrichment" placeholders and a backend
  health indicator in the header.

---

## Notes & Trade-offs

- **Sampling cache**: words are loaded into memory at startup (~309k) for O(1)
  weighted picks; effective but trades a few hundred MB of RAM.
- **Enrichment coverage**: only the top words per mode are enriched by default;
  the Ollama pipeline is additive and skips existing rows.
- **Single-user, local-first**: no auth, no multi-device sync; progress lives in
  `localStorage` per browser.
