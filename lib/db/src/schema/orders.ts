import { jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type OrderLineData = {
  menuItemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
};

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  tableName: text("table_name"),
  customerName: text("customer_name"),
  orderType: text("order_type").notNull(),
  status: text("status").notNull().default("queued"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  total: numeric("total", { precision: 12, scale: 2, mode: "number" }).notNull(),
  items: jsonb("items").$type<OrderLineData[]>().notNull(),
  serverName: text("server_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;