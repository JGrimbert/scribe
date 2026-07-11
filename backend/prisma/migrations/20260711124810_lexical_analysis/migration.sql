-- AlterTable
ALTER TABLE "document_analyses" ADD COLUMN     "lexical" JSONB,
ADD COLUMN     "lexicalComputedAt" TIMESTAMP(3),
ALTER COLUMN "wordFrequency" DROP NOT NULL;
