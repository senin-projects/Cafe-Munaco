import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const staffMembersTable = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("waiter"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StaffMember = typeof staffMembersTable.$inferSelect;