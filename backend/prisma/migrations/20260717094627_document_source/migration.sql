-- CreateTable
CREATE TABLE "document_sources" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_sources_documentId_key" ON "document_sources"("documentId");

-- AddForeignKey
ALTER TABLE "document_sources" ADD CONSTRAINT "document_sources_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
