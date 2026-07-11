-- AlterTable
ALTER TABLE "document_analyses" ADD COLUMN     "semantic" JSONB,
ADD COLUMN     "semanticComputedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "embedding_cache" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedding_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "embedding_cache_model_contentHash_key" ON "embedding_cache"("model", "contentHash");
