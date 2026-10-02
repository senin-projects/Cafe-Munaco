import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const reservationsTable = pgTable("reservations", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  guests: integer("guests").notNull(),
  bookingType: text("booking_type").notNull().default("reservation"),
  status: text("status").notNull().default("confirmed"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Reservation = typeof reservationsTable.$inferSelect;