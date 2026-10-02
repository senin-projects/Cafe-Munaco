import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateReservationBody,
  CreateReservationResponse,
  ListReservationsResponse,
  UpdateReservationBody,
  UpdateReservationParams,
  UpdateReservationResponse,
} from "@workspace/api-zod";
import { db, reservationsTable } from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();

router.get(
  "/reservations",
  requireStaff("admin", "cashier", "waiter"),
  async (_req, res): Promise<void> => {
    const bookings = await db
      .select()
      .from(reservationsTable)
      .orderBy(asc(reservationsTable.startsAt));
    res.json(ListReservationsResponse.parse(bookings));
  },
);

router.post(
  "/reservations",
  requireStaff("admin", "cashier", "waiter"),
  async (req, res): Promise<void> => {
    const parsed = CreateReservationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [booking] = await db
      .insert(reservationsTable)
      .values({
        ...parsed.data,
        startsAt: new Date(parsed.data.startsAt),
        status: parsed.data.status ?? "confirmed",
      })
      .returning();
    res.status(201).json(CreateReservationResponse.parse(booking));
  },
);

router.patch(
  "/reservations/:id",
  requireStaff("admin", "cashier", "waiter"),
  async (req, res): Promise<void> => {
    const params = UpdateReservationParams.safeParse(req.params);
    const parsed = UpdateReservationBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [booking] = await db
      .update(reservationsTable)
      .set({
        ...parsed.data,
        startsAt: parsed.data.startsAt
          ? new Date(parsed.data.startsAt)
          : undefined,
      })
      .where(eq(reservationsTable.id, params.data.id))
      .returning();
    if (!booking) {
      res.status(404).json({ error: "Reservation or event booking not found." });
      return;
    }
    res.json(UpdateReservationResponse.parse(booking));
  },
);

export default router;