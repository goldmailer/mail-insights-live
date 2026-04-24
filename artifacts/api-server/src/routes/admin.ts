import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { db, connectedAccountsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserFromRequest } from "../lib/session";
import { parseHeaders } from "../lib/gmail";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function requireAuth(handler: Parameters<typeof router.get>[1]): Parameters<typeof router.get>[1] {
  return async (req, res, next) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as any).adminUser = user;
    return (handler as Function)(req, res, next);
  };
}

function parseAccountId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

async function getAccountForAdmin(accountId: number) {
  const accounts = await db.select()
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.id, accountId))
    .limit(1);
  return accounts[0] ?? null;
}

function makeGmailClient(accessToken: string) {
  const { OAuth2 } = google.auth;
  const oauth2Client = new OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

router.get("/admin/accounts", requireAuth(async (_req, res) => {
  const accounts = await db.select({
    id: connectedAccountsTable.id,
    email: connectedAccountsTable.email,
    name: connectedAccountsTable.name,
    picture: connectedAccountsTable.picture,
    connectedAt: connectedAccountsTable.connectedAt,
    lastSyncAt: connectedAccountsTable.lastSyncAt,
    userId: connectedAccountsTable.userId,
  }).from(connectedAccountsTable);

  res.json({
    accounts: accounts.map(a => ({
      id: String(a.id),
      email: a.email,
      name: a.name,
      picture: a.picture,
      connectedAt: a.connectedAt.toISOString(),
      lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
      userId: String(a.userId),
    })),
    total: accounts.length,
  });
}));

router.get("/admin/accounts/:accountId/inbox", requireAuth(async (req, res) => {
  const accountId = parseAccountId(req.params.accountId);
  if (isNaN(accountId)) { res.status(400).json({ error: "invalid_id" }); return; }

  const account = await getAccountForAdmin(accountId);
  if (!account) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const gmail = makeGmailClient(account.accessToken);
    const maxResults = Math.min(parseInt((req.query.maxResults as string) ?? "50", 10) || 50, 100);
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
    logger.error({ err }, "Admin: failed to fetch inbox");
    res.status(500).json({ error: "gmail_error" });
  }
}));

router.get("/admin/accounts/:accountId/trash", requireAuth(async (req, res) => {
  const accountId = parseAccountId(req.params.accountId);
  if (isNaN(accountId)) { res.status(400).json({ error: "invalid_id" }); return; }

  const account = await getAccountForAdmin(accountId);
  if (!account) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const gmail = makeGmailClient(account.accessToken);
    const trashRes = await gmail.users.messages.list({ userId: "me", q: "in:trash", maxResults: 50 });
    const emails = [];
    for (const msg of (trashRes.data.messages ?? []).slice(0, 50)) {
      if (!msg.id) continue;
      try {
        const detail = await gmail.users.messages.get({
          userId: "me", id: msg.id, format: "metadata",
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
    logger.error({ err }, "Admin: failed to fetch trash");
    res.status(500).json({ error: "gmail_error" });
  }
}));

router.get("/admin/accounts/:accountId/emails/:emailId", requireAuth(async (req, res) => {
  const accountId = parseAccountId(req.params.accountId);
  const emailId = req.params.emailId;
  if (isNaN(accountId) || !emailId) { res.status(400).json({ error: "invalid_params" }); return; }

  const account = await getAccountForAdmin(accountId);
  if (!account) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const gmail = makeGmailClient(account.accessToken);
    const detail = await gmail.users.messages.get({ userId: "me", id: emailId, format: "full" });
    const headers = parseHeaders(detail.data.payload?.headers ?? []);

    function decodeBase64(data: string): string {
      return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    }

    function extractParts(payload: typeof detail.data.payload): { html?: string; text?: string } {
      if (!payload) return {};
      const mimeType = payload.mimeType ?? '';
      const body = payload.body;
      if (mimeType === 'text/html' && body?.data) return { html: decodeBase64(body.data) };
      if (mimeType === 'text/plain' && body?.data) return { text: decodeBase64(body.data) };
      if (payload.parts) {
        let html: string | undefined, text: string | undefined;
        for (const part of payload.parts) {
          const ex = extractParts(part);
          if (ex.html) html = ex.html;
          if (ex.text) text = ex.text;
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
    logger.error({ err }, "Admin: failed to fetch email detail");
    res.status(500).json({ error: "gmail_error" });
  }
}));

router.post("/admin/accounts/:accountId/emails/:emailId/trash", requireAuth(async (req, res) => {
  const accountId = parseAccountId(req.params.accountId);
  const emailId = req.params.emailId;
  if (isNaN(accountId) || !emailId) { res.status(400).json({ error: "invalid_params" }); return; }

  const account = await getAccountForAdmin(accountId);
  if (!account) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const gmail = makeGmailClient(account.accessToken);
    await gmail.users.messages.trash({ userId: "me", id: emailId });
    res.json({ success: true, message: "Email moved to trash." });
  } catch (err) {
    logger.error({ err }, "Admin: failed to trash email");
    res.status(500).json({ error: "gmail_error" });
  }
}));

router.delete("/admin/accounts/:accountId/emails/:emailId", requireAuth(async (req, res) => {
  const accountId = parseAccountId(req.params.accountId);
  const emailId = req.params.emailId;
  if (isNaN(accountId) || !emailId) { res.status(400).json({ error: "invalid_params" }); return; }

  const account = await getAccountForAdmin(accountId);
  if (!account) { res.status(404).json({ error: "account_not_found" }); return; }

  try {
    const gmail = makeGmailClient(account.accessToken);
    await gmail.users.messages.delete({ userId: "me", id: emailId });
    res.json({ success: true, message: "Email permanently deleted." });
  } catch (err) {
    logger.error({ err }, "Admin: failed to delete email");
    res.status(500).json({ error: "gmail_error" });
  }
}));

router.delete("/admin/accounts/:accountId", requireAuth(async (req, res) => {
  const accountId = parseAccountId(req.params.accountId);
  if (isNaN(accountId)) { res.status(400).json({ error: "invalid_id" }); return; }

  await db.delete(connectedAccountsTable).where(eq(connectedAccountsTable.id, accountId));
  res.json({ success: true, message: "Account removed." });
}));

router.post("/admin/accounts/:accountId/sync", requireAuth(async (req, res) => {
  const accountId = parseAccountId(req.params.accountId);
  if (isNaN(accountId)) { res.status(400).json({ error: "invalid_id" }); return; }

  await db.update(connectedAccountsTable)
    .set({ lastSyncAt: new Date() })
    .where(eq(connectedAccountsTable.id, accountId));
  res.json({ success: true, message: "Sync completed." });
}));

export default router;
