/*
  Warnings:

  - You are about to drop the column `type` on the `nodes` table. All the data in the column will be lost.
  - Added the required column `level` to the `nodes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "nodes" DROP COLUMN "type",
ADD COLUMN     "level" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "NodeType";
