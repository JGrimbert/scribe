import spacy
from fastapi import APIRouter

from app.core import models
from app.schemas.lexical import LexicalRequest, LexicalResponse
from app.schemas.semantic import (
    EmbeddingsRequest,
    EmbeddingsResponse,
    SimilarityRequest,
    SimilarityResponse,
)
from app.services.lexical import analyze_units
from app.services.semantic import embed, similarity_matrix

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
