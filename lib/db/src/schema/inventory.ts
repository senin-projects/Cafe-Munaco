import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" })
    .notNull()
    .default(0),
  parLevel: numeric("par_level", { precision: 12, scale: 3, mode: "number" })
    .notNull()
    .default(0),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  supplier: text("supplier"),
  expiresAt: date("expires_at", { mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  inventoryItemId: integer("inventory_item_id")
    .notNull()
    .references(() => inventoryItemsTable.id, { onDelete: "cascade" }),
  change: numeric("change", { precision: 12, scale: 3, mode: "number" }).notNull(),
  reason: text("reason").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type StockMovement = typeof stockMovementsTable.$inferSelect;