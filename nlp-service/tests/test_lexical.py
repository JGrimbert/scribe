"""Tests du service lexical sur le vrai modèle fr_core_news_lg (chargé une
fois par session pytest — ~10 s au démarrage, c'est assumé : un modèle mocké
ne testerait rien d'utile sur la lemmatisation/NER françaises).
"""

import pytest
import spacy

from app import config
from app.schemas.lexical import LexicalUnitIn
from app.services.lexical import analyze_units

TEXTE_A = (
    "Jean Grimbert traversa Paris sous la pluie. Il pensait à Marguerite, "
    "restée seule à Lyon. Les rues luisaient d'une lumière étrange."
)
TEXTE_B = "Paris ne dormait jamais. Jean le savait depuis toujours."


@pytest.fixture(scope="session")
def nlp():
    return spacy.load(config.SPACY_MODEL)


@pytest.fixture(scope="session")
def result(nlp):
    return analyze_units(
        nlp,
        [LexicalUnitIn(id="n1", text=TEXTE_A), LexicalUnitIn(id="n2", text=TEXTE_B)],
    )


def test_stats_par_unite(result):
    assert [u.id for u in result["units"]] == ["n1", "n2"]
    n1 = result["units"][0]
    assert n1.sentences == 3
    assert n1.words > 15
    assert 0 < n1.ttr <= 1
    assert 0 < n1.lexicalDensity < 1
    assert n1.avgSentenceLength == pytest.approx(n1.words / n1.sentences, abs=0.01)


def test_stats_globales(result):
    g = result["global"]
    assert g.sentences == 5
    assert g.words == sum(u.words for u in result["units"])
    assert g.uniqueLemmas <= g.words
    assert g.posCounts.get("NOUN", 0) > 0
    assert g.posCounts.get("VERB", 0) > 0


def test_entites_agregees_entre_unites(result):
    by_key = {(e.text, e.label): e for e in result["entities"]}
    paris = by_key.get(("Paris", "LOC"))
    assert paris is not None, f"entités détectées : {list(by_key)}"
    assert paris.count == 2
    assert {u.id for u in paris.units} == {"n1", "n2"}


def test_lemmes_nuage(result):
    by_lemma = {l.lemma: l for l in result["lemmas"]}
    # verbe conjugué ramené à l'infinitif
    assert "penser" in by_lemma
    assert by_lemma["penser"].pos == "VERB"
    # accents préservés (pas de normalisation NFD comme l'ancien word-frequency.ts)
    assert "lumière" in by_lemma
    # nom propre : casse d'origine conservée, agrégé entre les deux unités
    paris = by_lemma.get("Paris")
    assert paris is not None, f"lemmes détectés : {list(by_lemma)}"
    assert paris.pos == "PROPN"
    assert paris.count == 2
    assert {n.id for n in paris.nodes} == {"n1", "n2"}
    # mots vides (filtrés au niveau du lemme) et natures hors périmètre absents
    assert "jusque" not in by_lemma
    assert all(l.pos in {"NOUN", "PROPN", "ADJ", "VERB", "ADV"} for l in result["lemmas"])


def test_lemmes_fusionnent_genre_et_nombre(nlp):
    result = analyze_units(
        nlp,
        [
            LexicalUnitIn(
                id="n1",
                text="Un mur vert, une porte verte, des murs verts, des grilles vertes.",
            )
        ],
    )
    by_lemma = {l.lemma: l for l in result["lemmas"]}
    # masculin/féminin/singulier/pluriel repliés sur un seul lemme
    assert "vert" in by_lemma
    assert by_lemma["vert"].pos == "ADJ"
    assert by_lemma["vert"].count == 4
    assert "verte" not in by_lemma
    assert "verts" not in by_lemma


def test_unite_vide(nlp):
    result = analyze_units(nlp, [LexicalUnitIn(id="vide", text="")])
    unit = result["units"][0]
    assert unit.words == 0
    assert unit.ttr == 0.0
    assert result["global"].words == 0
    assert result["graph"].edges == []
    assert result["lemmas"] == []


def test_graphe_cooccurrences(nlp):
    # La co-présence chat/jardin revient dans 4 phrases → arête attendue
    # (seuil GRAPH_MIN_EDGE_COUNT = 3). Les phrases mer/bateau, sans lien
    # avec le jardin, sont indispensables : si « jardin » apparaissait dans
    # toutes les phrases, sa NPMI avec « chat » serait exactement 0
    # (indépendance statistique) et l'arête serait filtrée.
    texte = (
        "Le chat traversait le jardin en silence. "
        "Un chat dormait au fond du jardin. "
        "Le chat guettait les oiseaux du jardin. "
        "Ce chat connaissait chaque recoin du jardin. "
        "La pluie tombait sur le jardin désert. "
        "Le bateau quittait la mer au crépuscule. "
        "La mer portait le bateau vers le large. "
        "Un bateau dérivait sur la mer étale."
    )
    result = analyze_units(nlp, [LexicalUnitIn(id="n1", text=texte)])
    graph = result["graph"]

    lemmas = {node.lemma for node in graph.nodes}
    assert {"chat", "jardin"} <= lemmas

    edge_keys = {tuple(sorted((e.source, e.target))) for e in graph.edges}
    assert ("chat", "jardin") in edge_keys
    assert ("chat", "pluie") not in edge_keys

    chat_jardin = next(
        e for e in graph.edges if tuple(sorted((e.source, e.target))) == ("chat", "jardin")
    )
    assert chat_jardin.count == 4
    assert -1 <= chat_jardin.npmi <= 1
