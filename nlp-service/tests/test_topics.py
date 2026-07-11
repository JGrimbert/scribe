"""Test du pipeline BERTopic sur un corpus synthétique à thèmes évidents.

Volontairement lent (~1-2 min : vrai embedder + compilation numba d'UMAP au
premier run) — c'est le seul moyen de vérifier que la chaîne
embeddings → UMAP → HDBSCAN → c-TF-IDF tient debout avec nos paramètres.
"""

import pytest
import spacy
from sentence_transformers import SentenceTransformer

from app import config
from app.schemas.topics import SegmentIn
from app.services.topics import run_topics

MER = [
    "Les vagues se brisaient sur la coque du navire tandis que les marins hissaient les voiles.",
    "Le capitaine scrutait l'horizon, guettant la tempête qui menaçait la traversée.",
    "Le port s'éveillait, les chalutiers rentraient chargés de poissons et d'embruns.",
    "L'océan s'étendait à perte de vue, houle grise sous un ciel de sel.",
]
CUISINE = [
    "Elle pétrissait la pâte à pain, farine et levain entre les doigts.",
    "Le ragoût mijotait doucement, parfumant la cuisine d'oignons et de thym.",
    "Il dressa les assiettes : légumes rôtis, sauce réduite, herbes fraîches.",
    "Le four exhalait une odeur de tarte aux pommes et de beurre chaud.",
]
GUERRE = [
    "Les soldats avançaient dans la tranchée, baïonnette au canon, sous la mitraille.",
    "L'artillerie pilonnait la colline depuis l'aube, la terre tremblait.",
    "Le régiment épuisé bivouaquait dans les ruines du village bombardé.",
    "Les obus sifflaient au-dessus des casques, l'assaut était imminent.",
]


@pytest.fixture(scope="session")
def embedder():
    return SentenceTransformer(config.EMBEDDING_MODEL)


@pytest.fixture(scope="session")
def nlp():
    return spacy.load(config.SPACY_MODEL)


def test_trois_themes_evidents(nlp, embedder):
    segments = [
        SegmentIn(id=f"{theme}::{i}", text=text)
        for theme, corpus in (("mer", MER), ("cuisine", CUISINE), ("guerre", GUERRE))
        for i in range(7)
        for text in corpus
    ]

    progress_steps = []
    result = run_topics(
        nlp,
        embedder,
        "test-model",
        segments,
        min_topic_size=8,
        set_progress=lambda pct, step: progress_steps.append((pct, step)),
    )

    assert len(result.assignments) == len(segments)
    assert len(result.projection) == len(segments)
    assert all(0 <= p.x <= 1 and 0 <= p.y <= 1 for p in result.projection)
    real_topics = [t for t in result.topics if t.topic != -1]
    assert len(real_topics) >= 2
    assert all(len(t.words) > 0 for t in real_topics)
    assert progress_steps and progress_steps[-1][0] > 60

    # Les segments d'un même thème source doivent majoritairement tomber
    # dans le même cluster.
    by_source: dict[str, list[int]] = {}
    for assignment in result.assignments:
        by_source.setdefault(assignment.id.split("::")[0], []).append(assignment.topic)
    for source, topic_ids in by_source.items():
        assigned = [t for t in topic_ids if t != -1]
        assert assigned, f"tous les segments '{source}' sont hors thème"
        majority = max(set(assigned), key=assigned.count)
        assert assigned.count(majority) / len(assigned) > 0.5, source
