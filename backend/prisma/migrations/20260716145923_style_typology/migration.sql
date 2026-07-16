-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "styleInventory" JSONB,
ADD COLUMN     "styleTypology" JSONB;

-- AlterTable
ALTER TABLE "paragraphs" ADD COLUMN     "highlight" TEXT,
ADD COLUMN     "styleName" TEXT;
