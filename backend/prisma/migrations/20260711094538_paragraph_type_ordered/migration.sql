-- CreateEnum
CREATE TYPE "ParagraphType" AS ENUM ('TEXT', 'LIST');

-- AlterTable
ALTER TABLE "paragraphs" ADD COLUMN     "ordered" BOOLEAN,
ADD COLUMN     "type" "ParagraphType" NOT NULL DEFAULT 'TEXT';
