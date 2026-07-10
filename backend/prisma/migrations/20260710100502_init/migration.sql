-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('AXE', 'BLOC', 'ARTICLE');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAxes" INTEGER NOT NULL,
    "totalBlocs" INTEGER NOT NULL,
    "totalArticles" INTEGER NOT NULL,
    "totalMots" INTEGER NOT NULL,
    "totalCaracteres" INTEGER NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "indexGlobal" INTEGER,
    "connexe" JSONB,
    "mots" INTEGER,
    "caracteres" INTEGER,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paragraphs" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "paragraphs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nodes_documentId_idx" ON "nodes"("documentId");

-- CreateIndex
CREATE INDEX "nodes_parentId_idx" ON "nodes"("parentId");

-- CreateIndex
CREATE INDEX "paragraphs_nodeId_idx" ON "paragraphs"("nodeId");

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
