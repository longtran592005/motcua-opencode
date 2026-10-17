-- AlterTable
ALTER TABLE "step_instances" ADD COLUMN     "allow_reject" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allow_supplement" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "escalate_to" "Role",
ADD COLUMN     "leo_thang_sau_gio" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "nhac_truoc_gio" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "sla_hours" INTEGER NOT NULL DEFAULT 48;
