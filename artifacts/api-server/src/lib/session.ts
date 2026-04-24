import { Request } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface SessionData {
  userId: number;
  sessionToken: string;
}

export async function getUserFromRequest(req: Request): Promise<typeof usersTable.$inferSelect | null> {
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;

  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (cookieHeader) {
    const match = cookieHeader.match(/xmail_session=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token) return null;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.sessionToken, token))
    .limit(1);

  return user ?? null;
}

export function generateSessionToken(): string {
  return crypto.randomUUID() + "-" + Date.now().toString(36);
}
