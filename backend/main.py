from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, func, select, col

from database import create_db_and_tables, get_session
from models import Word
from services.selection import load_words, pick_weighted, mark_reviewed
from services.srs import review

app = FastAPI(title="Zipf Lexicon API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    load_words()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/words/count")
def word_count(session: Session = Depends(get_session)):
    rows = session.exec(select(Word.mode, func.count()).group_by(Word.mode)).all()
    counts = {mode: count for mode, count in rows}
    return {
        "total": sum(counts.values()),
        "cotidiano": counts.get("cotidiano", 0),
        "tecnico": counts.get("tecnico", 0),
    }


@app.get("/api/words/next")
def word_next(mode: str = Query(..., pattern="^(cotidiano|tecnico)$")):
    return pick_weighted(mode)


class ReviewRequest(BaseModel):
    grade: int  # 1=Again 2=Hard 3=Good 4=Easy


@app.post("/api/words/{word_id}/review")
def word_review(
    word_id: int,
    body: ReviewRequest,
    session: Session = Depends(get_session),
):
    if body.grade not in (1, 2, 3, 4):
        raise HTTPException(status_code=400, detail="grade must be 1, 2, 3 or 4")
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    result = review(word, body.grade)
    session.add(word)
    session.commit()
    session.refresh(word)
    mark_reviewed(word.id, word.next_review)
    return {"id": word.id, "word": word.word, **result}


@app.get("/api/words/search")
def word_search(
    q: str = Query(..., min_length=1),
    mode: str = Query("cotidiano", pattern="^(cotidiano|tecnico)$"),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    stmt = (
        select(Word)
        .where(Word.mode == mode)
        .where(col(Word.word).contains(q))
        .order_by(Word.zipf.desc())
        .limit(limit)
    )
    return session.exec(stmt).all()


@app.get("/api/words/enrichment-status")
def enrichment_status(session: Session = Depends(get_session)):
    total = session.exec(select(func.count()).select_from(Word)).one()
    enriched = session.exec(
        select(func.count()).select_from(Word).where(col(Word.definition_en) != "")
    ).one()
    return {
        "total": total,
        "enriched": enriched,
        "pending": total - enriched,
        "percent": round(enriched / total * 100, 1) if total else 0,
    }


@app.get("/api/words/{word_id}")
def word_by_id(word_id: int, session: Session = Depends(get_session)):
    word = session.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    return word
