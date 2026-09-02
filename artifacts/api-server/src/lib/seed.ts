import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";

export async function ensureSeedData(): Promise<void> {
  // Ensure system admin accounts exist (upsert, never overwrite data)
  await db.insert(usersTable).values([
    { id: 1, name: "Mill Administrator", email: "admin@camarinricemill.local", role: "ADMIN" },
    { id: 2, name: "Mila Santos", email: "staff@camarinricemill.local", role: "STAFF" },
  ]).onConflictDoNothing();

  // All other data (farmers, transactions, inventory, payments, expenses, notifications)
  // is managed exclusively through the application UI. No sample data is auto-seeded.
}