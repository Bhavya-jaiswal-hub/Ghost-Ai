-- DropIndex
ALTER TABLE "ProjectCollaborator" DROP CONSTRAINT "ProjectCollaborator_pkey";

-- CreateIndex
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_pkey" PRIMARY KEY ("projectId", "email");
