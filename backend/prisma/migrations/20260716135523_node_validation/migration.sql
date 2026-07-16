-- CreateTable
CREATE TABLE "node_validations" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "node_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "node_validations_nodeId_key" ON "node_validations"("nodeId");

-- AddForeignKey
ALTER TABLE "node_validations" ADD CONSTRAINT "node_validations_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
