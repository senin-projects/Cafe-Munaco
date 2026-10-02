import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  CreateMenuItemBody,
  CreateMenuItemResponse,
  ListMenuItemsResponse,
  UpdateMenuItemBody,
  UpdateMenuItemParams,
  UpdateMenuItemResponse,
} from "@workspace/api-zod";
import { db, menuItemsTable } from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();

router.get("/menu", requireStaff(), async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(menuItemsTable)
    .orderBy(asc(menuItemsTable.category), asc(menuItemsTable.name));
  res.json(ListMenuItemsResponse.parse(items));
});

router.post(
  "/menu",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateMenuItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [item] = await db
      .insert(menuItemsTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(CreateMenuItemResponse.parse(item));
  },
);

router.patch(
  "/menu/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateMenuItemParams.safeParse(req.params);
    const parsed = UpdateMenuItemBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [item] = await db
      .update(menuItemsTable)
      .set(parsed.data)
      .where(eq(menuItemsTable.id, params.data.id))
      .returning();
    if (!item) {
      res.status(404).json({ error: "Menu item not found." });
      return;
    }
    res.json(UpdateMenuItemResponse.parse(item));
  },
);

export default router;