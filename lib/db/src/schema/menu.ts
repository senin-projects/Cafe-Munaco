import {
  boolean,
  numeric,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";

export const menuItemsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  available: boolean("available").notNull().default(true),
});

export type MenuItem = typeof menuItemsTable.$inferSelect;