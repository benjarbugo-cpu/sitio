import {
  db,
  pool,
  millingTransactionsTable,
  paymentsTable,
  expensesTable,
  inventoryItemsTable,
  farmersTable,
  notificationsTable,
  auditLogsTable,
  employeesTable,
  equipmentTable,
  usersTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking current table rows before deletion...");
  const counts = {
    millingTransactions: (await db.select({ count: sql<number>`count(*)` }).from(millingTransactionsTable))[0]?.count,
    payments: (await db.select({ count: sql<number>`count(*)` }).from(paymentsTable))[0]?.count,
    expenses: (await db.select({ count: sql<number>`count(*)` }).from(expensesTable))[0]?.count,
    inventoryItems: (await db.select({ count: sql<number>`count(*)` }).from(inventoryItemsTable))[0]?.count,
    farmers: (await db.select({ count: sql<number>`count(*)` }).from(farmersTable))[0]?.count,
    notifications: (await db.select({ count: sql<number>`count(*)` }).from(notificationsTable))[0]?.count,
    auditLogs: (await db.select({ count: sql<number>`count(*)` }).from(auditLogsTable))[0]?.count,
    employees: (await db.select({ count: sql<number>`count(*)` }).from(employeesTable))[0]?.count,
    equipment: (await db.select({ count: sql<number>`count(*)` }).from(equipmentTable))[0]?.count,
    users: (await db.select({ count: sql<number>`count(*)` }).from(usersTable))[0]?.count,
  };
  console.log("Current counts:", counts);

  console.log("Deleting all operational data (transactions, payments, expenses, inventory, farmers, notifications, logs)...");
  await db.delete(paymentsTable);
  await db.delete(millingTransactionsTable);
  await db.delete(expensesTable);
  await db.delete(inventoryItemsTable);
  await db.delete(farmersTable);
  await db.delete(notificationsTable);
  await db.delete(auditLogsTable);
  await db.delete(employeesTable);
  await db.delete(equipmentTable);
  
  // Clean up users table (keep only admin & staff)
  await db.delete(usersTable);
  await db.insert(usersTable).values([
    { id: 1, name: "Mill Administrator", email: "admin@camarinricemill.local", role: "ADMIN" },
    { id: 2, name: "Mila Santos", email: "staff@camarinricemill.local", role: "STAFF" },
  ]);

  console.log("Data deleted successfully and cleaned!");
  await pool.end();
}

main().catch((err) => {
  console.error("Error clearing data:", err);
  process.exit(1);
});
