-- AlterTable
ALTER TABLE "document_analyses" ADD COLUMN     "topics" JSONB,
ADD COLUMN     "topicsComputedAt" TIMESTAMP(3);
