import { pgTable, text, timestamp, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const connectedAccountsTable = pgTable("connected_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  googleId: text("google_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  picture: text("picture"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  lastSyncAt: timestamp("last_sync_at"),
});

export const insertConnectedAccountSchema = createInsertSchema(connectedAccountsTable).omit({ id: true, connectedAt: true });
export type InsertConnectedAccount = z.infer<typeof insertConnectedAccountSchema>;
export type ConnectedAccount = typeof connectedAccountsTable.$inferSelect;
