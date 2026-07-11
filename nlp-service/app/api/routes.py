import spacy
from fastapi import APIRouter, HTTPException

from app.core import jobs, models
from app.schemas.lexical import LexicalRequest, LexicalResponse
from app.schemas.semantic import (
    EmbeddingsRequest,
    EmbeddingsResponse,
    SimilarityRequest,
    SimilarityResponse,
)
from app.schemas.topics import JobCreated, JobStatusResponse, TopicsJobRequest
from app.services.lexical import analyze_units
from app.services.semantic import embed, similarity_matrix
from app.services.topics import run_topics

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "spacy": {"version": spacy.__version__, "model": models.spacy_model_id()},
        "embeddings": {"model": models.embedding_model_id()},
    }


@router.post("/v1/lexical", response_model=LexicalResponse)
def lexical(request: LexicalRequest) -> LexicalResponse:
    result = analyze_units(models.get_nlp(), request.units)
    return LexicalResponse(
        model=models.spacy_model_id(),
        global_=result["global"],
        units=result["units"],
        entities=result["entities"],
        graph=result["graph"],
        lemmas=result["lemmas"],
    )


@router.post("/v1/embeddings", response_model=EmbeddingsResponse)
def embeddings(request: EmbeddingsRequest) -> EmbeddingsResponse:
    embedder = models.get_embedder()
    vectors = embed(embedder, request.texts)
    return EmbeddingsResponse(
        model=models.embedding_model_id(),
        dimensions=embedder.get_embedding_dimension(),
        vectors=vectors,
    )


@router.post("/v1/similarity", response_model=SimilarityResponse)
def similarity(request: SimilarityRequest) -> SimilarityResponse:
    return SimilarityResponse(
        model=models.embedding_model_id(),
        matrix=similarity_matrix(models.get_embedder(), request.texts),
    )


@router.post("/v1/jobs/topics", response_model=JobCreated)
def start_topics_job(request: TopicsJobRequest) -> JobCreated:
    nlp = models.get_nlp()
    embedder = models.get_embedder()
    model_id = models.embedding_model_id()
    job_id = jobs.submit(
        "topics",
        lambda set_progress: run_topics(
            nlp, embedder, model_id, request.segments, request.min_topic_size, set_progress
        ),
    )
    return JobCreated(jobId=job_id)


@router.get("/v1/jobs/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: str) -> JobStatusResponse:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} inconnu (service redémarré ?)")
    return JobStatusResponse(
        jobId=job.id,
        kind=job.kind,
        status=job.status,
        pct=round(job.pct, 1),
        step=job.step,
        error=job.error,
        result=job.result if job.status == "done" else None,
    )
