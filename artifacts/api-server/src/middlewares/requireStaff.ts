import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/express";
import { db, staffMembersTable, type StaffMember } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

export type StaffRole = "admin" | "cashier" | "waiter" | "kitchen" | "inventory";

declare global {
  namespace Express {
    interface Request {
      staff?: StaffMember;
    }
  }
}

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY ?? "",
});

async function findOrLinkStaff(
  userId: string,
): Promise<StaffMember | null> {
  const [linked] = await db
    .select()
    .from(staffMembersTable)
    .where(eq(staffMembersTable.clerkUserId, userId))
    .limit(1);

  if (linked) return linked;

  const clerkUser = await clerk.users.getUser(userId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) =>
      email.id === clerkUser.primaryEmailAddressId &&
      email.verification?.status === "verified",
  )?.emailAddress;

  if (!primaryEmail) return null;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(8042026)`);

    const [existing] = await tx
      .select()
      .from(staffMembersTable)
      .where(eq(staffMembersTable.email, primaryEmail.toLowerCase()))
      .limit(1);

    if (existing) {
      if (existing.clerkUserId) return null;
      const [updated] = await tx
        .update(staffMembersTable)
        .set({ clerkUserId: userId })
        .where(
          and(
            eq(staffMembersTable.id, existing.id),
            isNull(staffMembersTable.clerkUserId),
          ),
        )
        .returning();
      return updated ?? null;
    }

    const [firstStaffMember] = await tx
      .select({ id: staffMembersTable.id })
      .from(staffMembersTable)
      .limit(1);

    if (firstStaffMember) return null;

    const [admin] = await tx
      .insert(staffMembersTable)
      .values({
        clerkUserId: userId,
        email: primaryEmail.toLowerCase(),
        name:
          clerkUser.fullName ||
          clerkUser.firstName ||
          primaryEmail.split("@")[0] ||
          "Cafe Munaco Admin",
        role: "admin",
      })
      .returning();

    return admin ?? null;
  });
}

export function requireStaff(...allowedRoles: StaffRole[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to access Cafe Munaco." });
      return;
    }

    try {
      const staff = await findOrLinkStaff(userId);
      if (!staff) {
        res.status(403).json({
          error:
            "This verified account is not on the employee roster. Ask an admin to add your email.",
        });
        return;
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(staff.role as StaffRole)) {
        res.status(403).json({ error: "Your role cannot access this feature." });
        return;
      }

      req.staff = staff;
      next();
    } catch (error) {
      req.log.error({ err: error }, "Unable to verify Cafe Munaco staff account");
      res.status(503).json({ error: "Employee access could not be verified." });
    }
  };
}