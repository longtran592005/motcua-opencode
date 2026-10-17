-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "workflow_snapshot" JSONB;

-- AlterTable
ALTER TABLE "signatures" ADD COLUMN     "provider" TEXT;

-- AlterTable
ALTER TABLE "step_instances" ADD COLUMN     "da_qua_han" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leo_thang_luc" TIMESTAMP(3),
ADD COLUMN     "nhac_luc" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workflow_steps" ADD COLUMN     "escalate_to" "Role",
ADD COLUMN     "leo_thang_sau_gio" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "nhac_truoc_gio" INTEGER NOT NULL DEFAULT 12;
