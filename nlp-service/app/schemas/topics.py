"""Contrats des endpoints /v1/jobs/* — miroir des types du client NestJS."""

from typing import Literal

from pydantic import BaseModel, Field


class SegmentIn(BaseModel):
    """Un segment de ~200-400 mots découpé côté Nest (jamais à cheval sur
    deux nœuds) — id opaque pour le service, le client y encode le nodeId."""

    id: str
    text: str


class TopicsJobRequest(BaseModel):
    # HDBSCAN a besoin d'un minimum de documents pour clusteriser quoi que
    # ce soit — en deçà, erreur explicite plutôt que résultat absurde.
    segments: list[SegmentIn] = Field(min_length=20, max_length=20000)
    min_topic_size: int | None = Field(default=None, ge=2)


class JobCreated(BaseModel):
    jobId: str


class TopicWord(BaseModel):
    word: str
    weight: float


class TopicOut(BaseModel):
    # -1 = hors thème (outliers HDBSCAN)
    topic: int
    count: int
    words: list[TopicWord]


class SegmentAssignment(BaseModel):
    id: str
    topic: int


class ProjectionPoint(BaseModel):
    """Position d'un segment dans la projection UMAP 2D, normalisée 0..1."""

    id: str
    x: float
    y: float


class TopicsResult(BaseModel):
    model: str
    params: dict
    topics: list[TopicOut]
    assignments: list[SegmentAssignment]
    projection: list[ProjectionPoint]


class JobStatusResponse(BaseModel):
    jobId: str
    kind: str
    status: Literal["queued", "running", "done", "error"]
    pct: float
    step: str
    error: str | None = None
    result: TopicsResult | None = None
