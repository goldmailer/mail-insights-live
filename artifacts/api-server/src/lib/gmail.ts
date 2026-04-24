import { google } from "googleapis";

export function createOAuth2Client(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const fallbackUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }

  const resolvedRedirectUri = redirectUri ?? fallbackUri ?? "";
  return new google.auth.OAuth2(clientId, clientSecret, resolvedRedirectUri);
}

export function getAuthUrl(oauth2Client: ReturnType<typeof createOAuth2Client>): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "consent",
  });
}

export interface GmailMessageHeader {
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

export function parseHeaders(headers: Array<{ name?: string | null; value?: string | null }>): GmailMessageHeader {
  const result: GmailMessageHeader = {};
  for (const h of headers) {
    const name = h.name?.toLowerCase();
    switch (name) {
      case "from": result.from = h.value ?? undefined; break;
      case "to": result.to = h.value ?? undefined; break;
      case "subject": result.subject = h.value ?? undefined; break;
      case "date": result.date = h.value ?? undefined; break;
      case "message-id": result.messageId = h.value ?? undefined; break;
      case "in-reply-to": result.inReplyTo = h.value ?? undefined; break;
      case "references": result.references = h.value ?? undefined; break;
    }
  }
  return result;
}

export function extractEmailAddress(fromHeader: string): { email: string; name: string } {
  const match = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, "").trim(), email: match[2].trim() };
  }
  return { name: fromHeader.trim(), email: fromHeader.trim() };
}

export async function fetchGmailMessages(
  accessToken: string,
  query: string,
  maxResults: number = 100
): Promise<Array<{ id: string; headers: GmailMessageHeader; snippet?: string; internalDate?: string }>> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messages = listRes.data.messages ?? [];
  const results = [];

  for (const msg of messages.slice(0, maxResults)) {
    if (!msg.id) continue;
    try {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date", "Message-ID", "In-Reply-To", "References"],
      });
      const headers = parseHeaders(detail.data.payload?.headers ?? []);
      results.push({
        id: msg.id,
        headers,
        snippet: detail.data.snippet ?? undefined,
        internalDate: detail.data.internalDate ?? undefined,
      });
    } catch {
      // skip individual message errors
    }
  }

  return results;
}
