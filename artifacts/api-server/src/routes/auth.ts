import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { db, usersTable, connectedAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createOAuth2Client, getAuthUrl } from "../lib/gmail";
import { getUserFromRequest, generateSessionToken } from "../lib/session";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getBaseUrl(req: import("express").Request): string {
  const forwardedHost = req.headers["x-forwarded-host"] as string | undefined;
  const host = forwardedHost ?? req.headers.host ?? "";
  const proto = req.headers["x-forwarded-proto"] ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

router.get("/auth/google/url", async (req, res): Promise<void> => {
  try {
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const oauth2Client = createOAuth2Client(redirectUri);
    const url = getAuthUrl(oauth2Client);
    res.json({ url });
  } catch (err) {
    logger.error({ err }, "Failed to generate Google auth URL");
    res.status(500).json({ error: "OAuth not configured", message: "Google OAuth credentials are not set up." });
  }
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code } = req.query as { code?: string };

  if (!code) {
    res.status(400).json({ error: "missing_code", message: "No authorization code provided." });
    return;
  }

  try {
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const oauth2Client = createOAuth2Client(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const googleId = userInfo.data.id;
    const email = userInfo.data.email;
    const name = userInfo.data.name;
    const picture = userInfo.data.picture;

    if (!googleId || !email || !name) {
      res.status(400).json({ error: "invalid_user", message: "Could not get user info from Google." });
      return;
    }

    const sessionToken = generateSessionToken();

    // Upsert user
    const existingUsers = await db.select().from(usersTable).where(eq(usersTable.googleId, googleId)).limit(1);

    let userId: number;
    if (existingUsers.length > 0) {
      await db.update(usersTable)
        .set({ name, picture, sessionToken, updatedAt: new Date() })
        .where(eq(usersTable.googleId, googleId));
      userId = existingUsers[0].id;
    } else {
      const [newUser] = await db.insert(usersTable).values({
        googleId,
        email,
        name,
        picture,
        sessionToken,
      }).returning();
      userId = newUser.id;
    }

    // Upsert connected account
    const existingAccounts = await db.select()
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.googleId, googleId))
      .limit(1);

    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    if (existingAccounts.length > 0) {
      await db.update(connectedAccountsTable)
        .set({
          name,
          picture,
          accessToken: tokens.access_token ?? existingAccounts[0].accessToken,
          refreshToken: tokens.refresh_token ?? existingAccounts[0].refreshToken,
          tokenExpiry,
          lastSyncAt: new Date(),
        })
        .where(eq(connectedAccountsTable.googleId, googleId));
    } else {
      await db.insert(connectedAccountsTable).values({
        userId,
        googleId,
        email,
        name,
        picture,
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiry,
        lastSyncAt: new Date(),
      });
    }

    const baseUrl = getBaseUrl(req);

    res.setHeader("Set-Cookie", `xmail_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    res.redirect(`${baseUrl}/auth/callback?success=true`);
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    const baseUrl = getBaseUrl(req);
    res.redirect(`${baseUrl}/?error=auth_failed`);
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);

  if (!user) {
    res.json({
      id: "",
      email: "",
      name: "",
      isAuthenticated: false,
    });
    return;
  }

  res.json({
    id: String(user.id),
    email: user.email,
    name: user.name,
    picture: user.picture,
    isAuthenticated: true,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);

  if (user) {
    await db.update(usersTable)
      .set({ sessionToken: null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
  }

  res.setHeader("Set-Cookie", "xmail_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ success: true, message: "Logged out" });
});

export default router;
