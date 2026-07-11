import spacy
from fastapi import APIRouter

from app.core import models
from app.schemas.lexical import LexicalRequest, LexicalResponse
from app.services.lexical import analyze_units

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "spacy": {"version": spacy.__version__, "model": models.spacy_model_id()},
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
