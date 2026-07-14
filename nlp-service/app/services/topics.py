"""Extraction de thèmes par BERTopic sur les segments d'un corpus.

Choix de paramètres (persistés dans le résultat, cf. `params`) :
- UMAP `random_state` fixé — sans ça, deux runs sur le même corpus donnent
  des thèmes différents, inacceptable pour un travail éditorial.
- `min_topic_size` proportionnel au corpus (borné à 8 minimum) : sur un
  manuscrit de ~400-800 segments, des clusters de 3-4 segments seraient du
  bruit, pas des thèmes.
- c-TF-IDF sur unigrammes/bigrammes, stopwords français de spaCy, tokens de
  3+ lettres (élimine les élisions l'/d'/j' résiduelles), sans min_df (cf.
  commentaire sur le vectorizer).
"""

from collections import Counter

from bertopic import BERTopic
from hdbscan import HDBSCAN
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import CountVectorizer
from spacy.lang.fr.stop_words import STOP_WORDS
from spacy.language import Language
from umap import UMAP

from app.core.jobs import SetProgress
from app.schemas.topics import (
    ProjectionPoint,
    SegmentAssignment,
    SegmentIn,
    TopicOut,
    TopicsResult,
    TopicWord,
)

EMBED_CHUNK = 64
TOP_WORDS = 10
TOKEN_PATTERN = r"(?u)\b[a-zà-ÿ]{3,}\b"


def _default_min_topic_size(n_segments: int) -> int:
    return max(8, n_segments // 50)


# Le c-TF-IDF travaille sur les lemmes, pas les formes fléchies — sinon
# « arbre »/« arbres » ou « cheval »/« chevaux » comptent comme des termes
# distincts et se diluent mutuellement dans la représentation des thèmes.
# Le clustering, lui, reste sur les embeddings du texte BRUT (les formes
# fléchies portent du sens pour CamemBERT).
#
# Filtrage POS indispensable en plus de la lemmatisation : sans lui, les
# verbes génériques (pouvoir, faire, aller...), dilués entre leurs dizaines
# de formes conjuguées avant lemmatisation, se concentrent sur un seul lemme
# et dominent tous les thèmes (constaté sur manuscrit réel). ADJ conservé :
# il porte les intitulés distinctifs (« cinétique hypostase »).
LEMMA_POS = {"NOUN", "PROPN", "ADJ"}


def _lemmatize(nlp: Language, texts: list[str], set_progress: SetProgress) -> list[str]:
    lemmatized = []
    n = len(texts)
    for i, doc in enumerate(nlp.pipe(texts, batch_size=32, disable=["parser", "ner"])):
        lemmatized.append(
            " ".join(t.lemma_.lower() for t in doc if t.is_alpha and t.pos_ in LEMMA_POS)
        )
        if i % 50 == 0:
            set_progress(50 + 12 * (i + 1) / n, "lemmatisation des segments")
    return lemmatized


def run_topics(
    nlp: Language,
    embedder: SentenceTransformer,
    model_id: str,
    segments: list[SegmentIn],
    min_topic_size: int | None,
    set_progress: SetProgress,
) -> TopicsResult:
    import numpy as np

    texts = [s.text for s in segments]
    n = len(texts)
    effective_min_topic_size = min_topic_size or _default_min_topic_size(n)

    # Embeddings par morceaux pour pouvoir remonter une progression fine —
    # c'est l'étape la plus longue (l'essentiel du temps CPU).
    vectors = []
    for start in range(0, n, EMBED_CHUNK):
        vectors.append(
            embedder.encode(
                texts[start : start + EMBED_CHUNK],
                batch_size=32,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
        )
        set_progress(50 * min(1.0, (start + EMBED_CHUNK) / n), "vectorisation des segments")
    embeddings = np.vstack(vectors)

    lemmatized_texts = _lemmatize(nlp, texts, set_progress)

    set_progress(64, "réduction de dimension et clustering")
    umap_model = UMAP(
        n_neighbors=15, n_components=5, min_dist=0.0, metric="cosine", random_state=42
    )
    # "leaf" plutôt que "eom" : sur un roman (voix narrative homogène), eom
    # agglutine tout dans un cluster géant — constaté sur manuscrit réel :
    # 719 segments sur 762 dans un seul "thème". leaf découpe aux feuilles de
    # la hiérarchie de densité ; min_samples découplé (5) pour ne pas rendre
    # le clustering trop conservateur.
    hdbscan_model = HDBSCAN(
        min_cluster_size=effective_min_topic_size,
        min_samples=5,
        metric="euclidean",
        cluster_selection_method="leaf",
        prediction_data=True,
    )
    # Pas de min_df : le vectorizer est ajusté par BERTopic sur les documents
    # concaténés PAR THÈME (étape c-TF-IDF) — min_df=2 y élaguerait justement
    # les termes propres à un seul thème, ceux qui doivent le représenter.
    vectorizer_model = CountVectorizer(
        stop_words=list(STOP_WORDS),
        ngram_range=(1, 2),
        token_pattern=TOKEN_PATTERN,
    )
    # language="french" est indispensable : avec le défaut ("english"), le
    # pré-traitement c-TF-IDF de BERTopic supprime tout caractère non-ASCII —
    # apostrophes ET accents ("d'une" → "dune", "étrange" → "trange").
    topic_model = BERTopic(
        language="french",
        umap_model=umap_model,
        hdbscan_model=hdbscan_model,
        vectorizer_model=vectorizer_model,
        calculate_probabilities=False,
        verbose=False,
    )
    # Les documents passés à fit_transform ne servent qu'au c-TF-IDF (le
    # clustering utilise les embeddings fournis) → on lui donne les lemmes.
    assigned = topic_model.fit_transform(lemmatized_texts, embeddings)[0]

    # Deuxième UMAP dédié à la visualisation (2D, min_dist plus lâche pour
    # étaler les points) — celui du clustering (5D, min_dist=0) est optimisé
    # pour HDBSCAN, pas pour l'œil. Coordonnées normalisées 0..1, le frontend
    # choisit son échelle.
    set_progress(80, "projection 2D")
    # n_neighbors plus large et min_dist plus lâche que l'UMAP de clustering :
    # privilégie la structure globale et évite d'expulser les petits clusters
    # à l'infini (ce qui viderait le centre de la carte).
    coords = UMAP(
        n_neighbors=30, n_components=2, min_dist=0.25, metric="cosine", random_state=42
    ).fit_transform(embeddings)
    # Cadrage sur les percentiles 1-99 + écrêtage, pas min-max : UMAP envoie
    # parfois un petit cluster très à l'écart, et une min-max stricte
    # écraserait toute la structure principale en un amas minuscule (constaté
    # sur manuscrit réel). Les points écrêtés se posent au bord de la carte.
    #
    # Échelle UNIQUE sur les deux axes (pas un span par axe) : sinon x et y
    # sont étirés différemment et le nuage se déforme — deux points à distance
    # égale n'apparaîtraient plus à distance égale. Centré dans [0,1] ; le
    # facteur 0.9 laisse une marge pour que le gros du nuage ne colle pas aux
    # bords.
    lo = np.percentile(coords, 1, axis=0)
    hi = np.percentile(coords, 99, axis=0)
    center = (lo + hi) / 2
    span = float(np.max(hi - lo)) or 1.0
    normalized = np.clip(0.5 + 0.9 * (coords - center) / span, 0.0, 1.0)
    projection = [
        ProjectionPoint(id=segment.id, x=round(float(x), 3), y=round(float(y), 3))
        for segment, (x, y) in zip(segments, normalized)
    ]

    set_progress(92, "représentation des thèmes")
    counts = Counter(assigned)
    topics = [
        TopicOut(
            topic=topic_id,
            count=counts.get(topic_id, 0),
            words=[
                TopicWord(word=word, weight=round(float(weight), 4))
                for word, weight in (topic_model.get_topic(topic_id) or [])[:TOP_WORDS]
            ],
        )
        for topic_id in sorted(counts)
    ]

    return TopicsResult(
        model=model_id,
        params={
            "minTopicSize": effective_min_topic_size,
            "umap": {"nNeighbors": 15, "nComponents": 5, "minDist": 0.0, "randomState": 42},
            "hdbscan": {"clusterSelectionMethod": "leaf", "minSamples": 5},
            "ngramRange": [1, 2],
            "cTfIdf": {"lemmatized": True, "pos": sorted(LEMMA_POS)},
            "segments": n,
        },
        topics=topics,
        assignments=[
            SegmentAssignment(id=segment.id, topic=int(topic))
            for segment, topic in zip(segments, assigned)
        ],
        projection=projection,
    )
