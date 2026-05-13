-- DropIndex
ALTER TABLE "ProjectCollaborator" DROP CONSTRAINT "ProjectCollaborator_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCollaborator_projectId_email_key" ON "ProjectCollaborator"("projectId", "email");
