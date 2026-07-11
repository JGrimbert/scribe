-- Nuage de mots réorienté sur les lemmes spaCy (volet lexical) : la
-- fréquence lexicale TS pure (word-frequency.ts) est retirée.
ALTER TABLE "document_analyses" DROP COLUMN "wordFrequency";
