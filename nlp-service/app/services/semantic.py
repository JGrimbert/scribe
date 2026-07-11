"""Embeddings et similarité sémantique via sentence-camembert.

Les textes plus longs que max_seq_length du modèle (128 tokens pour la
variante base) sont tronqués silencieusement par sentence-transformers :
c'est pour ça que le client Nest envoie des paragraphes, pas des articles
entiers — la représentation d'un article est la moyenne de ses paragraphes.
"""

from sentence_transformers import SentenceTransformer


def embed(embedder: SentenceTransformer, texts: list[str]) -> list[list[float]]:
    vectors = embedder.encode(
        texts,
        batch_size=32,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return [[round(float(x), 6) for x in vector] for vector in vectors]


def similarity_matrix(embedder: SentenceTransformer, texts: list[str]) -> list[list[float]]:
    vectors = embedder.encode(
        texts,
        batch_size=32,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    matrix = vectors @ vectors.T
    return [[round(float(x), 4) for x in row] for row in matrix]
