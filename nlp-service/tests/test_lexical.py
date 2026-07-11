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


def test_unite_vide(nlp):
    result = analyze_units(nlp, [LexicalUnitIn(id="vide", text="")])
    unit = result["units"][0]
    assert unit.words == 0
    assert unit.ttr == 0.0
    assert result["global"].words == 0
