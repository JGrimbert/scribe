-- CreateTable
CREATE TABLE "document_analyses" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wordFrequency" JSONB NOT NULL,
    "registres" JSONB,

    CONSTRAINT "document_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_analyses_documentId_key" ON "document_analyses"("documentId");

-- AddForeignKey
ALTER TABLE "document_analyses" ADD CONSTRAINT "document_analyses_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
