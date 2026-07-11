"""Contrats des endpoints /v1/embeddings et /v1/similarity — miroir des types
du client NestJS (backend/src/analyse/nlp-client.service.ts).
"""

from pydantic import BaseModel, Field


class EmbeddingsRequest(BaseModel):
    # Bornage défensif : le client Nest découpe lui-même en lots (~64) pour
    # rester sous les timeouts HTTP — une requête énorme est un bug client.
    texts: list[str] = Field(min_length=1, max_length=512)


class EmbeddingsResponse(BaseModel):
    model: str
    dimensions: int
    # Vecteurs L2-normalisés : la similarité cosinus se réduit au produit
    # scalaire côté consommateur.
    vectors: list[list[float]]


class SimilarityRequest(BaseModel):
    texts: list[str] = Field(min_length=2, max_length=128)


class SimilarityResponse(BaseModel):
    model: str
    # Matrice symétrique de similarités cosinus, diagonale à 1.
    matrix: list[list[float]]
