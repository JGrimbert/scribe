"""Singletons des modèles NLP, chargés une fois au démarrage (lifespan).

Le chargement de fr_core_news_lg prend ~10 s et ~500 Mo de RAM : le serveur
n'accepte aucune requête tant qu'il n'est pas terminé, ce qui évite d'avoir
à gérer un état "modèle en cours de chargement" dans chaque endpoint.
"""

import spacy
from spacy.language import Language

from app import config

_nlp: Language | None = None


def load() -> None:
    global _nlp
    if _nlp is None:
        _nlp = spacy.load(config.SPACY_MODEL)


def get_nlp() -> Language:
    if _nlp is None:
        raise RuntimeError("Modèle spaCy non chargé — load() doit être appelé au démarrage")
    return _nlp


def spacy_model_id() -> str:
    nlp = get_nlp()
    return f"{nlp.meta['lang']}_{nlp.meta['name']}-{nlp.meta['version']}"
