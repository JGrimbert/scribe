"""Analyse lexicale spaCy : stats par unité + agrégats corpus + entités nommées.

Unité = un nœud Scribe (article). Le traitement passe par nlp.pipe() pour
bénéficier du batching interne de spaCy — sur un manuscrit complet, c'est
plusieurs fois plus rapide qu'une boucle d'appels nlp(texte).
"""

import math
import re
from collections import Counter
from itertools import combinations

from spacy.language import Language
from spacy.lang.fr.stop_words import STOP_WORDS
from spacy.tokens import Doc

from app.schemas.lexical import (
    EntityOut,
    EntityUnitCount,
    GlobalStats,
    LexicalGraph,
    LexicalGraphEdge,
    LexicalGraphNode,
    LexicalUnitIn,
    UnitStats,
)

# Mots "pleins" pour la densité lexicale (noms, verbes, adjectifs, adverbes,
# noms propres) — par opposition aux mots grammaticaux (déterminants,
# prépositions, pronoms, auxiliaires...).
CONTENT_POS = {"NOUN", "PROPN", "VERB", "ADJ", "ADV"}

# Réseau lexical : noms et noms propres seulement — inclure verbes/adjectifs
# noie le graphe sous des liens génériques (faire, grand, petit...).
GRAPH_POS = {"NOUN", "PROPN"}
GRAPH_MAX_NODES = 50
GRAPH_MAX_EDGES = 120
GRAPH_MIN_EDGE_COUNT = 3

_WS_RE = re.compile(r"\s+")


def _entity_key(text: str, label: str) -> tuple[str, str]:
    # Espaces internes normalisés (retours à la ligne dans une entité multi-mots)
    return _WS_RE.sub(" ", text.strip()), label


def _unit_stats(unit_id: str, doc: Doc) -> tuple[UnitStats, set[str], Counter, int, int]:
    words = 0
    lemmas: set[str] = set()
    content_words = 0
    pos_counts: Counter = Counter()

    for token in doc:
        if token.is_space or token.is_punct:
            continue
        pos_counts[token.pos_] += 1
        if not token.is_alpha:
            continue
        words += 1
        lemmas.add(token.lemma_.lower())
        if token.pos_ in CONTENT_POS:
            content_words += 1

    sentences = sum(1 for _ in doc.sents)
    stats = UnitStats(
        id=unit_id,
        sentences=sentences,
        words=words,
        avgSentenceLength=round(words / sentences, 2) if sentences else 0.0,
        ttr=round(len(lemmas) / words, 4) if words else 0.0,
        lexicalDensity=round(content_words / words, 4) if words else 0.0,
    )
    return stats, lemmas, pos_counts, content_words, sentences


def _sentence_graph_lemmas(doc: Doc) -> list[set[str]]:
    per_sentence: list[set[str]] = []
    for sent in doc.sents:
        lemmas = {
            token.lemma_.lower()
            for token in sent
            if token.pos_ in GRAPH_POS
            and token.is_alpha
            and len(token.lemma_) >= 3
            and token.lemma_.lower() not in STOP_WORDS
        }
        if len(lemmas) >= 2:
            per_sentence.append(lemmas)
    return per_sentence


# NPMI (PMI normalisée, -1..1) sur la co-présence à l'échelle de la phrase :
# départage les paires vraiment associées des paires simplement fréquentes —
# un comptage brut mettrait les deux lemmes les plus courants en tête de
# toutes les arêtes.
def _build_graph(
    lemma_sentences: Counter, pair_sentences: Counter, total_sentences: int
) -> LexicalGraph:
    top = [lemma for lemma, _ in lemma_sentences.most_common(GRAPH_MAX_NODES)]
    kept = set(top)

    edges: list[LexicalGraphEdge] = []
    for (a, b), count in pair_sentences.items():
        if count < GRAPH_MIN_EDGE_COUNT or a not in kept or b not in kept:
            continue
        p_ab = count / total_sentences
        p_a = lemma_sentences[a] / total_sentences
        p_b = lemma_sentences[b] / total_sentences
        npmi = math.log(p_ab / (p_a * p_b)) / -math.log(p_ab)
        if npmi <= 0:
            continue
        edges.append(LexicalGraphEdge(source=a, target=b, count=count, npmi=round(npmi, 3)))
    edges.sort(key=lambda e: (e.npmi, e.count), reverse=True)
    edges = edges[:GRAPH_MAX_EDGES]

    connected = {e.source for e in edges} | {e.target for e in edges}
    nodes = [
        LexicalGraphNode(lemma=lemma, count=lemma_sentences[lemma])
        for lemma in top
        if lemma in connected
    ]
    return LexicalGraph(sentences=total_sentences, nodes=nodes, edges=edges)


def analyze_units(nlp: Language, units: list[LexicalUnitIn]) -> dict:
    unit_stats: list[UnitStats] = []
    all_lemmas: set[str] = set()
    pos_counts: Counter = Counter()
    entity_counts: dict[tuple[str, str], dict] = {}
    graph_lemma_sentences: Counter = Counter()
    graph_pair_sentences: Counter = Counter()

    total_tokens = 0
    total_words = 0
    total_sentences = 0
    total_content_words = 0

    ids = [u.id for u in units]
    texts = [u.text for u in units]

    for unit_id, doc in zip(ids, nlp.pipe(texts, batch_size=16)):
        stats, lemmas, unit_pos, content_words, sentences = _unit_stats(unit_id, doc)
        unit_stats.append(stats)
        all_lemmas |= lemmas
        pos_counts.update(unit_pos)
        total_tokens += len(doc)
        total_words += stats.words
        total_sentences += sentences
        total_content_words += content_words

        for sentence_lemmas in _sentence_graph_lemmas(doc):
            graph_lemma_sentences.update(sentence_lemmas)
            graph_pair_sentences.update(
                tuple(sorted(pair)) for pair in combinations(sentence_lemmas, 2)
            )

        for ent in doc.ents:
            key = _entity_key(ent.text, ent.label_)
            if not key[0]:
                continue
            entry = entity_counts.setdefault(key, {"count": 0, "units": Counter()})
            entry["count"] += 1
            entry["units"][unit_id] += 1

    entities = [
        EntityOut(
            text=text,
            label=label,
            count=entry["count"],
            units=[
                EntityUnitCount(id=uid, count=c)
                for uid, c in entry["units"].most_common()
            ],
        )
        for (text, label), entry in entity_counts.items()
    ]
    entities.sort(key=lambda e: e.count, reverse=True)

    global_stats = GlobalStats(
        sentences=total_sentences,
        tokens=total_tokens,
        words=total_words,
        uniqueLemmas=len(all_lemmas),
        ttr=round(len(all_lemmas) / total_words, 4) if total_words else 0.0,
        lexicalDensity=round(total_content_words / total_words, 4) if total_words else 0.0,
        avgSentenceLength=round(total_words / total_sentences, 2) if total_sentences else 0.0,
        posCounts=dict(pos_counts.most_common()),
    )

    graph = _build_graph(graph_lemma_sentences, graph_pair_sentences, max(total_sentences, 1))

    return {"global": global_stats, "units": unit_stats, "entities": entities, "graph": graph}
