from typing import Optional
from sqlmodel import SQLModel, Field


class Word(SQLModel, table=True):
    __tablename__ = "words"

    id: Optional[int] = Field(default=None, primary_key=True)
    word: str
    category: str = ""
    mode: str  # "cotidiano" | "tecnico"
    sub_list: Optional[str] = None  # "CSAVL", "CSAVL-S", "CSWL", "GENERAL"
    rank: int
    zipf: float
    definition_en: str = ""
    translation_es: str = ""
    examples: str = "[]"  # JSON array string
