-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "lastDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "_UserTasks" ADD CONSTRAINT "_UserTasks_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_UserTasks_AB_unique";

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "CampusAmbassador"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
