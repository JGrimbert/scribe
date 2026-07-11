"""Contrats de l'endpoint /v1/lexical — miroir des types du client NestJS
(backend/src/analyse/dto.ts). Toute évolution ici doit être répercutée là-bas.
"""

from pydantic import BaseModel, ConfigDict, Field


class LexicalUnitIn(BaseModel):
    """Une unité de texte (en pratique : un nœud/article Scribe), texte brut sans HTML."""

    id: str
    text: str


class LexicalRequest(BaseModel):
    units: list[LexicalUnitIn]


class UnitStats(BaseModel):
    id: str
    sentences: int
    words: int
    avgSentenceLength: float
    ttr: float
    lexicalDensity: float


class EntityUnitCount(BaseModel):
    id: str
    count: int


class EntityOut(BaseModel):
    text: str
    label: str
    count: int
    units: list[EntityUnitCount]


class GlobalStats(BaseModel):
    sentences: int
    tokens: int
    words: int
    uniqueLemmas: int
    # TTR (type-token ratio) calculé sur les lemmes : sensible à la longueur
    # du texte, à comparer entre unités de tailles proches seulement.
    ttr: float
    lexicalDensity: float
    avgSentenceLength: float
    posCounts: dict[str, int]


class LexicalResponse(BaseModel):
    # "global" est un mot réservé Python → alias de sérialisation uniquement
    # (FastAPI sérialise by_alias par défaut).
    model_config = ConfigDict(populate_by_name=True)

    model: str
    global_: GlobalStats = Field(serialization_alias="global", alias="global")
    units: list[UnitStats]
    entities: list[EntityOut]
