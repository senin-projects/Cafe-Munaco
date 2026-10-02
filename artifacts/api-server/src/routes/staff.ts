import { Router, type IRouter } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  CreateStaffBody,
  CreateStaffResponse,
  GetMyStaffProfileResponse,
  ListStaffResponse,
  UpdateStaffBody,
  UpdateStaffParams,
  UpdateStaffResponse,
} from "@workspace/api-zod";
import { db, staffMembersTable } from "@workspace/db";
import { requireStaff } from "../middlewares/requireStaff";

const router: IRouter = Router();

function presentStaff(staff: typeof staffMembersTable.$inferSelect) {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    linked: staff.clerkUserId !== null,
    createdAt: staff.createdAt,
  };
}

router.get("/staff/me", requireStaff(), async (req, res): Promise<void> => {
  res.json(GetMyStaffProfileResponse.parse(presentStaff(req.staff!)));
});

router.get(
  "/staff",
  requireStaff("admin"),
  async (_req, res): Promise<void> => {
    const staff = await db
      .select()
      .from(staffMembersTable)
      .orderBy(asc(staffMembersTable.name));
    res.json(ListStaffResponse.parse(staff.map(presentStaff)));
  },
);

router.post(
  "/staff",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateStaffBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const [existing] = await db
      .select({ id: staffMembersTable.id })
      .from(staffMembersTable)
      .where(eq(staffMembersTable.email, email))
      .limit(1);
    if (existing) {
      res.status(400).json({ error: "An employee with that email already exists." });
      return;
    }

    const [staff] = await db
      .insert(staffMembersTable)
      .values({ ...parsed.data, email })
      .returning();

    res.status(201).json(CreateStaffResponse.parse(presentStaff(staff)));
  },
);

router.patch(
  "/staff/:id",
  requireStaff("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateStaffParams.safeParse(req.params);
    const parsed = UpdateStaffBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [staff] = await db
      .update(staffMembersTable)
      .set(parsed.data)
      .where(
        and(
          eq(staffMembersTable.id, params.data.id),
          isNull(staffMembersTable.clerkUserId),
        ),
      )
      .returning();

    if (!staff) {
      const [found] = await db
        .select()
        .from(staffMembersTable)
        .where(eq(staffMembersTable.id, params.data.id))
        .limit(1);
      if (!found) {
        res.status(404).json({ error: "Employee not found." });
        return;
      }
      const [updated] = await db
        .update(staffMembersTable)
        .set(parsed.data)
        .where(eq(staffMembersTable.id, params.data.id))
        .returning();
      res.json(UpdateStaffResponse.parse(presentStaff(updated)));
      return;
    }

    res.json(UpdateStaffResponse.parse(presentStaff(staff)));
  },
);

export default router;