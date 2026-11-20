"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ROLES, type Role, type RoleState } from "./form-state";

export async function setUserRole(_prev: RoleState, formData: FormData): Promise<RoleState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!ROLES.includes(role)) return { error: "Pick a role." };
  if (userId === admin.id && role !== "admin") return { error: "You can't demote yourself." };

  const db = await getDb();
  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return { error: "That user doesn't exist." };
  if (target.role === role) return { saved: true };

  await db.update(users).set({ role }).where(eq(users.id, userId));
  await logAudit(admin.id, "user.role", "user", userId, { from: target.role, to: role });

  revalidatePath("/admin", "layout");
  return { saved: true };
}
