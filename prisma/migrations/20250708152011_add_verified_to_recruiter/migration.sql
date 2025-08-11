-- AlterTable
ALTER TABLE "_UserTasks" ADD CONSTRAINT "_UserTasks_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_UserTasks_AB_unique";
