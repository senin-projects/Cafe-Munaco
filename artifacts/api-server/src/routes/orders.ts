import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateOrderBody,
  CreateOrderResponse,
  ListOrdersResponse,
  UpdateOrderBody,
  UpdateOrderParams,
  UpdateOrderResponse,
} from "@workspace/api-zod";
import { db, menuItemsTable, ordersTable } from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();

router.get(
  "/orders",
  requireStaff("admin", "cashier", "waiter", "kitchen"),
  async (_req, res): Promise<void> => {
    const orders = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt))
      .limit(100);
    res.json(ListOrdersResponse.parse(orders));
  },
);

router.post(
  "/orders",
  requireStaff("admin", "cashier", "waiter"),
  async (req, res): Promise<void> => {
    const parsed = CreateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const itemIds = [...new Set(parsed.data.items.map((item) => item.menuItemId))];
    const menuItems = await db
      .select()
      .from(menuItemsTable)
      .where(inArray(menuItemsTable.id, itemIds));
    const byId = new Map(menuItems.map((item) => [item.id, item]));

    if (
      itemIds.some((id) => !byId.get(id)?.available) ||
      itemIds.length !== byId.size
    ) {
      res.status(400).json({
        error: "One or more selected menu items are unavailable.",
      });
      return;
    }

    const items = parsed.data.items.map((line) => {
      const menuItem = byId.get(line.menuItemId)!;
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: line.quantity,
        unitPrice: menuItem.price,
        notes: line.notes ?? null,
      };
    });
    const total = Number(
      items
        .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        .toFixed(2),
    );
    const orderNumber = `MN-${Date.now().toString(36).toUpperCase()}-${randomUUID()
      .slice(0, 4)
      .toUpperCase()}`;

    const [order] = await db
      .insert(ordersTable)
      .values({
        ...parsed.data,
        orderNumber,
        items,
        total,
        serverName: req.staff!.name,
      })
      .returning();

    res.status(201).json(CreateOrderResponse.parse(order));
  },
);

router.patch(
  "/orders/:id",
  requireStaff("admin", "cashier", "waiter", "kitchen"),
  async (req, res): Promise<void> => {
    const params = UpdateOrderParams.safeParse(req.params);
    const parsed = UpdateOrderBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!parsed.data.status && !parsed.data.paymentStatus) {
      res.status(400).json({ error: "Choose an order status or payment status." });
      return;
    }

    const role = req.staff!.role;
    if (
      (role === "kitchen" &&
        (parsed.data.paymentStatus ||
          (parsed.data.status &&
            !["preparing", "ready"].includes(parsed.data.status)))) ||
      (role === "waiter" && parsed.data.paymentStatus) ||
      (role === "cashier" && parsed.data.status)
    ) {
      res.status(403).json({ error: "Your role cannot make that order change." });
      return;
    }

    const [order] = await db
      .update(ordersTable)
      .set(parsed.data)
      .where(eq(ordersTable.id, params.data.id))
      .returning();
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    res.json(UpdateOrderResponse.parse(order));
  },
);

export default router;