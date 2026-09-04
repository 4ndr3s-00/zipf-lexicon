"""SM-2 spaced repetition algorithm (Anki-style 4-grade scale)."""

from datetime import datetime, timedelta

MIN_EF = 1.3
HARD_INTERVAL = 1.2  # multiplier for a "hard" rating

# Map our 4-grade scale (1=Again 2=Hard 3=Good 4=Easy) to SM-2's 1-5 scale.
_GRADE_TO_SM2 = {1: 1, 2: 2, 3: 4, 4: 5}


def review(word, grade: int, now: datetime | None = None) -> dict:
    """Apply an SM-2 review to a Word row and return the updated SRS state."""
    now = now or datetime.now()
    q5 = _GRADE_TO_SM2[grade]

    ef = word.easiness_factor
    ef = ef + (0.1 - (5 - q5) * (0.08 + (5 - q5) * 0.02))
    if ef < MIN_EF:
        ef = MIN_EF

    reps = word.repetitions
    interval = word.interval_days

    if q5 >= 3:  # Good / Easy -> advance
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = round(interval * ef)
        reps += 1
        if grade == 4:  # Easy -> a bit faster
            interval = max(interval + 1, round(interval * 1.3))
    else:  # Again / Hard -> reset
        reps = 0
        interval = 1 if grade == 1 else max(1, round(interval * HARD_INTERVAL))

    word.easiness_factor = round(ef, 2)
    word.interval_days = interval
    word.repetitions = reps
    word.next_review = now + timedelta(days=interval)

    return {
        "grade": grade,
        "easiness_factor": round(ef, 2),
        "interval_days": interval,
        "repetitions": reps,
        "next_review": word.next_review.isoformat(),
    }
