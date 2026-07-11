import os

# fr_core_news_lg par défaut (meilleure NER/lemmatisation que md) ;
# surchargeable pour les tests ou pour basculer sur fr_dep_news_trf plus tard.
SPACY_MODEL = os.environ.get("SCRIBE_SPACY_MODEL", "fr_core_news_lg")
