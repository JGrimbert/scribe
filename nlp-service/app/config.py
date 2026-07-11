import os

# fr_core_news_lg par défaut (meilleure NER/lemmatisation que md) ;
# surchargeable pour les tests ou pour basculer sur fr_dep_news_trf plus tard.
SPACY_MODEL = os.environ.get("SCRIBE_SPACY_MODEL", "fr_core_news_lg")

# sentence-camembert (CamemBERT affiné pour la similarité de phrases) — PAS
# CamemBERT brut, dont le mean-pooling non affiné est médiocre en similarité.
# Variante -large disponible (meilleure, ~3× plus lente sur CPU).
EMBEDDING_MODEL = os.environ.get("SCRIBE_EMBEDDING_MODEL", "dangvantuan/sentence-camembert-base")
