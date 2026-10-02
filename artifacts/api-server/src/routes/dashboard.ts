import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetDashboardResponse } from "@workspace/api-zod";
import {
  db,
  inventoryItemsTable,
  ordersTable,
  reservationsTable,
  stockMovementsTable,
} from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();

function manilaDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const start = new Date(
    `${values.year}-${values.month}-${values.day}T00:00:00+08:00`,
  );
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

router.get(
  "/dashboard",
  requireStaff(),
  async (_req, res): Promise<void> => {
    const { start, end } = manilaDayBounds();
    const [activeOrders, waitingOrders, reservationsToday, lowStock, revenue, recentOrders, recentBookings, recentStock] =
      await Promise.all([
        db
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(inArray(ordersTable.status, ["queued", "preparing", "ready"])),
        db
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(eq(ordersTable.status, "queued")),
        db
          .select({ id: reservationsTable.id })
          .from(reservationsTable)
          .where(
            and(
              gte(reservationsTable.startsAt, start),
              lt(reservationsTable.startsAt, end),
              inArray(reservationsTable.status, [
                "pending",
                "confirmed",
                "arrived",
              ]),
            ),
          ),
        db
          .select({ id: inventoryItemsTable.id })
          .from(inventoryItemsTable)
          .where(lte(inventoryItemsTable.quantity, inventoryItemsTable.parLevel)),
        db
          .select({
            total: sql<number>`coalesce(sum(${ordersTable.total}), 0)::float8`,
          })
          .from(ordersTable)
          .where(
            and(
              gte(ordersTable.createdAt, start),
              lt(ordersTable.createdAt, end),
              eq(ordersTable.paymentStatus, "paid"),
            ),
          ),
        db
          .select()
          .from(ordersTable)
          .orderBy(desc(ordersTable.createdAt))
          .limit(4),
        db
          .select()
          .from(reservationsTable)
          .orderBy(desc(reservationsTable.createdAt))
          .limit(4),
        db
          .select({
            id: stockMovementsTable.id,
            change: stockMovementsTable.change,
            reason: stockMovementsTable.reason,
            occurredAt: stockMovementsTable.occurredAt,
            itemName: inventoryItemsTable.name,
          })
          .from(stockMovementsTable)
          .innerJoin(
            inventoryItemsTable,
            eq(stockMovementsTable.inventoryItemId, inventoryItemsTable.id),
          )
          .orderBy(desc(stockMovementsTable.occurredAt))
          .limit(4),
      ]);

    const recentActivity = [
      ...recentOrders.map((order) => ({
        id: `order-${order.id}`,
        label: `Order ${order.orderNumber}`,
        detail: `${order.items.length} items · ${order.status}`,
        occurredAt: order.createdAt,
        kind: "order" as const,
      })),
      ...recentBookings.map((booking) => ({
        id: `booking-${booking.id}`,
        label: `${booking.bookingType} · ${booking.customerName}`,
        detail: `${booking.guests} guests · ${booking.status}`,
        occurredAt: booking.createdAt,
        kind: "booking" as const,
      })),
      ...recentStock.map((movement) => ({
        id: `stock-${movement.id}`,
        label: `${movement.itemName} stock updated`,
        detail: `${movement.change > 0 ? "+" : ""}${movement.change} · ${movement.reason}`,
        occurredAt: movement.occurredAt,
        kind: "stock" as const,
      })),
    ]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      )
      .slice(0, 8);

    res.json(
      GetDashboardResponse.parse({
        activeOrders: activeOrders.length,
        waitingOrders: waitingOrders.length,
        reservationsToday: reservationsToday.length,
        lowStockItems: lowStock.length,
        revenueToday: Number(revenue[0]?.total ?? 0),
        recentActivity,
      }),
    );
  },
);

export default router;