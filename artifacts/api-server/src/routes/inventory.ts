import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AdjustInventoryBody,
  AdjustInventoryParams,
  AdjustInventoryResponse,
  CreateInventoryItemBody,
  CreateInventoryItemResponse,
  ListInventoryResponse,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
  UpdateInventoryItemResponse,
} from "@workspace/api-zod";
import {
  db,
  inventoryItemsTable,
  stockMovementsTable,
} from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();

function presentInventory(item: typeof inventoryItemsTable.$inferSelect) {
  return {
    ...item,
    lowStock: item.quantity <= item.parLevel,
  };
}

function dateOnly(value: Date | string | null | undefined) {
  if (value == null || typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

router.get(
  "/inventory",
  requireStaff("admin", "inventory", "kitchen"),
  async (_req, res): Promise<void> => {
    const items = await db
      .select()
      .from(inventoryItemsTable)
      .orderBy(asc(inventoryItemsTable.category), asc(inventoryItemsTable.name));
    res.json(ListInventoryResponse.parse(items.map(presentInventory)));
  },
);

router.post(
  "/inventory",
  requireStaff("admin", "inventory"),
  async (req, res): Promise<void> => {
    const parsed = CreateInventoryItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { expiresAt, ...data } = parsed.data;
    const [item] = await db
      .insert(inventoryItemsTable)
      .values({ ...data, expiresAt: dateOnly(expiresAt) })
      .returning();
    res.status(201).json(CreateInventoryItemResponse.parse(presentInventory(item)));
  },
);

router.patch(
  "/inventory/:id",
  requireStaff("admin", "inventory"),
  async (req, res): Promise<void> => {
    const params = UpdateInventoryItemParams.safeParse(req.params);
    const parsed = UpdateInventoryItemBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { expiresAt, ...data } = parsed.data;
    const [item] = await db
      .update(inventoryItemsTable)
      .set({ ...data, expiresAt: dateOnly(expiresAt) })
      .where(eq(inventoryItemsTable.id, params.data.id))
      .returning();
    if (!item) {
      res.status(404).json({ error: "Inventory item not found." });
      return;
    }
    res.json(UpdateInventoryItemResponse.parse(presentInventory(item)));
  },
);

router.post(
  "/inventory/:id/adjust",
  requireStaff("admin", "inventory", "kitchen"),
  async (req, res): Promise<void> => {
    const params = AdjustInventoryParams.safeParse(req.params);
    const parsed = AdjustInventoryBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(inventoryItemsTable)
        .where(eq(inventoryItemsTable.id, params.data.id))
        .for("update");
      if (!item) return null;
      const quantity = Number((item.quantity + parsed.data.change).toFixed(3));
      if (quantity < 0) return { insufficient: true as const };
      const [updated] = await tx
        .update(inventoryItemsTable)
        .set({ quantity, updatedAt: new Date() })
        .where(eq(inventoryItemsTable.id, item.id))
        .returning();
      await tx.insert(stockMovementsTable).values({
        inventoryItemId: item.id,
        change: parsed.data.change,
        reason: parsed.data.reason,
      });
      return { item: updated, insufficient: false as const };
    });

    if (!result) {
      res.status(404).json({ error: "Inventory item not found." });
      return;
    }
    if (result.insufficient) {
      res.status(400).json({ error: "Stock cannot be reduced below zero." });
      return;
    }
    res.json(
      AdjustInventoryResponse.parse(presentInventory(result.item)),
    );
  },
);

export default router;