import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { db, connectedAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getUserFromRequest } from "../lib/session";
import { parseHeaders } from "../lib/gmail";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/accounts", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const accounts = await db.select()
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, user.id));

  res.json({
    accounts: accounts.map(a => ({
      id: String(a.id),
      email: a.email,
      name: a.name,
      picture: a.picture,
      connectedAt: a.connectedAt.toISOString(),
      lastSyncAt: a.lastSyncAt?.toISOString(),
    })),
    total: accounts.length,
  });
});

router.delete("/accounts/:accountId", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const rawId = Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId;
  const accountId = parseInt(rawId, 10);

  if (isNaN(accountId)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }

  await db.delete(connectedAccountsTable)
    .where(and(
      eq(connectedAccountsTable.id, accountId),
      eq(connectedAccountsTable.userId, user.id)
    ));

  res.json({ success: true, message: "Account removed." });
});

router.post("/accounts/:accountId/sync", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const rawId = Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId;
  const accountId = parseInt(rawId, 10);

  if (isNaN(accountId)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }

  await db.update(connectedAccountsTable)
    .set({ lastSyncAt: new Date() })
    .where(and(
      eq(connectedAccountsTable.id, accountId),
      eq(connectedAccountsTable.userId, user.id)
    ));

  res.json({ success: true, message: "Sync completed." });
});

router.get("/accounts/:accountId/trash", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const rawId = Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId;
  const accountId = parseInt(rawId, 10);

  if (isNaN(accountId)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }

  const accounts = await db.select()
    .from(connectedAccountsTable)
    .where(and(
      eq(connectedAccountsTable.id, accountId),
      eq(connectedAccountsTable.userId, user.id)
    )).limit(1);

  if (accounts.length === 0) {
    res.status(404).json({ error: "account_not_found" });
    return;
  }

  try {
    const { OAuth2 } = google.auth;
    const oauth2Client = new OAuth2();
    oauth2Client.setCredentials({ access_token: accounts[0].accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const trashRes = await gmail.users.messages.list({
      userId: "me",
      q: "in:trash",
      maxResults: 20,
    });

    const emails = [];
    for (const msg of (trashRes.data.messages ?? []).slice(0, 20)) {
      if (!msg.id) continue;
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = parseHeaders(detail.data.payload?.headers ?? []);
        emails.push({
          id: msg.id,
          from: headers.from ?? "",
          subject: headers.subject ?? "(no subject)",
          date: headers.date ?? new Date().toISOString(),
          snippet: detail.data.snippet ?? "",
        });
      } catch { /* skip */ }
    }

    res.json({ emails, total: trashRes.data.resultSizeEstimate ?? 0 });
  } catch (err) {
    logger.error({ err }, "Failed to fetch trash");
    res.status(500).json({ error: "gmail_error" });
  }
});

router.get("/accounts/:accountId/inbox", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }

  const accountId = parseInt(Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId, 10);
  if (isNaN(accountId)) { res.status(400).json({ error: "invalid_id" }); return; }

  const accounts = await db.select().from(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.id, accountId), eq(connectedAccountsTable.userId, user.id))).limit(1);

  if (accounts.length === 0) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const { OAuth2 } = google.auth;
    const oauth2Client = new OAuth2();
    oauth2Client.setCredentials({ access_token: accounts[0].accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const maxResults = Math.min(parseInt(req.query.maxResults as string ?? "50", 10) || 50, 100);
    const q = (req.query.q as string) ?? "in:inbox";

    const listRes = await gmail.users.messages.list({ userId: "me", q, maxResults });
    const messages = listRes.data.messages ?? [];
    const emails = [];

    for (const msg of messages) {
      if (!msg.id) continue;
      try {
        const detail = await gmail.users.messages.get({
          userId: "me", id: msg.id, format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });
        const headers = parseHeaders(detail.data.payload?.headers ?? []);
        emails.push({
          id: msg.id,
          from: headers.from ?? "",
          to: headers.to ?? "",
          subject: headers.subject ?? "(no subject)",
          date: headers.date ?? new Date().toISOString(),
          snippet: detail.data.snippet ?? "",
          isUnread: (detail.data.labelIds ?? []).includes("UNREAD"),
        });
      } catch { /* skip */ }
    }

    res.json({ emails, total: listRes.data.resultSizeEstimate ?? 0 });
  } catch (err) {
    logger.error({ err }, "Failed to fetch inbox");
    res.status(500).json({ error: "gmail_error" });
  }
});

router.get("/accounts/:accountId/emails/:emailId", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }

  const accountId = parseInt(Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId, 10);
  const emailId = req.params.emailId;

  if (isNaN(accountId) || !emailId) { res.status(400).json({ error: "invalid_params" }); return; }

  const accounts = await db.select().from(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.id, accountId), eq(connectedAccountsTable.userId, user.id))).limit(1);

  if (accounts.length === 0) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const { OAuth2 } = google.auth;
    const oauth2Client = new OAuth2();
    oauth2Client.setCredentials({ access_token: accounts[0].accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const detail = await gmail.users.messages.get({
      userId: "me",
      id: emailId,
      format: "full",
    });

    const headers = parseHeaders(detail.data.payload?.headers ?? []);

    function decodeBase64(data: string): string {
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(base64, 'base64').toString('utf-8');
    }

    function extractParts(payload: typeof detail.data.payload): { html?: string; text?: string } {
      if (!payload) return {};
      const mimeType = payload.mimeType ?? '';
      const body = payload.body;

      if (mimeType === 'text/html' && body?.data) {
        return { html: decodeBase64(body.data) };
      }
      if (mimeType === 'text/plain' && body?.data) {
        return { text: decodeBase64(body.data) };
      }

      if (payload.parts) {
        let html: string | undefined;
        let text: string | undefined;
        for (const part of payload.parts) {
          const extracted = extractParts(part);
          if (extracted.html) html = extracted.html;
          if (extracted.text) text = extracted.text;
        }
        return { html, text };
      }
      return {};
    }

    const { html, text } = extractParts(detail.data.payload);

    res.json({
      id: emailId,
      from: headers.from ?? "",
      to: headers.to ?? "",
      subject: headers.subject ?? "(no subject)",
      date: headers.date ?? new Date().toISOString(),
      snippet: detail.data.snippet ?? "",
      html: html ?? null,
      text: text ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch email detail");
    res.status(500).json({ error: "gmail_error" });
  }
});

router.post("/accounts/:accountId/emails/:emailId/trash", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }

  const accountId = parseInt(Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId, 10);
  const emailId = req.params.emailId;

  if (isNaN(accountId) || !emailId) { res.status(400).json({ error: "invalid_params" }); return; }

  const accounts = await db.select().from(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.id, accountId), eq(connectedAccountsTable.userId, user.id))).limit(1);

  if (accounts.length === 0) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const { OAuth2 } = google.auth;
    const oauth2Client = new OAuth2();
    oauth2Client.setCredentials({ access_token: accounts[0].accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.trash({ userId: "me", id: emailId });
    res.json({ success: true, message: "Email moved to trash." });
  } catch (err) {
    logger.error({ err }, "Failed to trash email");
    res.status(500).json({ error: "gmail_error" });
  }
});

router.delete("/accounts/:accountId/emails/:emailId", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }

  const accountId = parseInt(Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId, 10);
  const emailId = req.params.emailId;

  if (isNaN(accountId) || !emailId) { res.status(400).json({ error: "invalid_params" }); return; }

  const accounts = await db.select().from(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.id, accountId), eq(connectedAccountsTable.userId, user.id))).limit(1);

  if (accounts.length === 0) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const { OAuth2 } = google.auth;
    const oauth2Client = new OAuth2();
    oauth2Client.setCredentials({ access_token: accounts[0].accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.delete({ userId: "me", id: emailId });
    res.json({ success: true, message: "Email permanently deleted." });
  } catch (err) {
    logger.error({ err }, "Failed to delete email");
    res.status(500).json({ error: "gmail_error" });
  }
});

export default router;
