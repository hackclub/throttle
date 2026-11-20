import "server-only";
import { getDb } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export async function logAudit(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.insert(auditLog).values({ actorId, action, targetType, targetId, meta });
}
