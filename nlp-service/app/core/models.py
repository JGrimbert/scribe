"""Singletons des modèles NLP, chargés une fois au démarrage (lifespan).

Le chargement (spaCy ~10 s, sentence-transformers + torch ~20 s, ~2,5 Go de
RAM au total) bloque le démarrage : le serveur n'accepte aucune requête tant
qu'il n'est pas terminé, ce qui évite d'avoir à gérer un état "modèle en
cours de chargement" dans chaque endpoint.
"""

import spacy
from sentence_transformers import SentenceTransformer
from spacy.language import Language

from app import config

_nlp: Language | None = None
_embedder: SentenceTransformer | None = None


def load() -> None:
    global _nlp, _embedder
    if _nlp is None:
        _nlp = spacy.load(config.SPACY_MODEL)
    if _embedder is None:
        _embedder = SentenceTransformer(config.EMBEDDING_MODEL)


def get_nlp() -> Language:
    if _nlp is None:
        raise RuntimeError("Modèle spaCy non chargé — load() doit être appelé au démarrage")
    return _nlp


def get_embedder() -> SentenceTransformer:
    if _embedder is None:
        raise RuntimeError("Modèle d'embeddings non chargé — load() doit être appelé au démarrage")
    return _embedder


def spacy_model_id() -> str:
    nlp = get_nlp()
    return f"{nlp.meta['lang']}_{nlp.meta['name']}-{nlp.meta['version']}"


def embedding_model_id() -> str:
    # Le nom HF suffit comme identifiant de version pour la clé de cache côté
    # Nest — le dépôt est figé, pas de versioning sémantique exploitable.
    return config.EMBEDDING_MODEL
