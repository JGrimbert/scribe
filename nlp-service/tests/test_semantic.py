"""Tests du service sémantique sur le vrai sentence-camembert-base (chargé
une fois par session — même parti pris que test_lexical.py : un modèle mocké
ne testerait rien de la qualité des représentations françaises).
"""

import math

import pytest
from sentence_transformers import SentenceTransformer

from app import config
from app.services.semantic import embed, similarity_matrix

PLUIE_A = "La pluie tombait sans fin sur les toits de la ville endormie."
PLUIE_B = "Une averse interminable noyait les rues de la cité."
CUISINE = "La recette demande deux œufs, de la farine et du sucre."


@pytest.fixture(scope="session")
def embedder():
    return SentenceTransformer(config.EMBEDDING_MODEL)


def test_embed_normalise(embedder):
    vectors = embed(embedder, [PLUIE_A, CUISINE])
    assert len(vectors) == 2
    assert len(vectors[0]) == embedder.get_embedding_dimension()
    for vector in vectors:
        norm = math.sqrt(sum(x * x for x in vector))
        assert norm == pytest.approx(1.0, abs=1e-3)


def test_similarite_semantique_coherente(embedder):
    matrix = similarity_matrix(embedder, [PLUIE_A, PLUIE_B, CUISINE])
    assert matrix[0][0] == pytest.approx(1.0, abs=1e-3)
    assert matrix[0][1] == pytest.approx(matrix[1][0], abs=1e-4)
    # Deux évocations de pluie doivent être plus proches entre elles que
    # d'une recette de cuisine.
    assert matrix[0][1] > matrix[0][2]
    assert matrix[0][1] > matrix[1][2]


def test_embed_deterministe(embedder):
    v1 = embed(embedder, [PLUIE_A])[0]
    v2 = embed(embedder, [PLUIE_A])[0]
    assert v1 == v2
