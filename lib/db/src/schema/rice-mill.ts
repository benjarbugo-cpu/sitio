import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["ADMIN", "STAFF", "FARMER", "CUSTOMER"]);
export const customerTypeEnum = pgEnum("customer_type", ["FARMER", "CUSTOMER"]);
export const recordStatusEnum = pgEnum("record_status", ["ACTIVE", "INACTIVE"]);
export const millingStatusEnum = pgEnum("milling_status", [
  "PENDING",
  "RECEIVED",
  "WEIGHING",
  "PROCESSING",
  "QUALITY_CHECK",
  "READY_FOR_RELEASE",
  "COMPLETED",
  "CANCELLED",
]);
export const inventoryCategoryEnum = pgEnum("inventory_category", [
  "RAW_MATERIAL",
  "FINISHED_PRODUCT",
  "BY_PRODUCT",
  "PACKAGING",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "BANK_TRANSFER",
  "GCASH",
  "OTHER",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull().default("CUSTOMER"),
  farmerId: integer("farmer_id"),
  avatar: text("avatar"),
  clerkUserId: text("clerk_user_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const farmersTable = pgTable("farmers", {
  id: serial("id").primaryKey(),
  farmerCode: text("farmer_code").notNull().unique(),
  customerNumber: text("customer_number").notNull().unique(),
  fullName: text("full_name").notNull(),
  gender: text("gender").notNull().default("Prefer not to say"),
  contactNumber: text("contact_number").notNull(),
  address: text("address").notNull().default("Sitio Camarin"),
  barangay: text("barangay").notNull().default("Kaagwasan"),
  sitio: text("sitio").notNull().default("Camarin"),
  customerType: customerTypeEnum("customer_type").notNull().default("FARMER"),
  riceVariety: text("rice_variety").notNull().default("Dinorado"),
  farmArea: numeric("farm_area", { precision: 8, scale: 2 }).notNull().default("0"),
  status: recordStatusEnum("status").notNull().default("ACTIVE"),
  registrationDate: date("registration_date", { mode: "string" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const millingTransactionsTable = pgTable("milling_transactions", {
  id: serial("id").primaryKey(),
  transactionCode: text("transaction_code").notNull().unique(),
  farmerId: integer("farmer_id").notNull(),
  riceVariety: text("rice_variety").notNull(),
  riceType: text("rice_type").notNull().default("Palay"),
  quantityReceived: numeric("quantity_received", { precision: 12, scale: 2 }).notNull(),
  millingType: text("milling_type").notNull().default("Regular Milling"),
  millingRate: numeric("milling_rate", { precision: 12, scale: 2 }).notNull().default("4.5"),
  serviceCharge: numeric("service_charge", { precision: 12, scale: 2 }).notNull().default("0"),
  otherCharges: numeric("other_charges", { precision: 12, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  dateReceived: date("date_received", { mode: "string" }).notNull().defaultNow(),
  millingDate: date("milling_date", { mode: "string" }).notNull().defaultNow(),
  expectedCompletion: date("expected_completion", { mode: "string" }).notNull().defaultNow(),
  operator: text("operator").notNull().default("Ramil Dela Cruz"),
  status: millingStatusEnum("status").notNull().default("RECEIVED"),
  progressStep: integer("progress_step").notNull().default(1),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  itemName: text("item_name").notNull(),
  category: inventoryCategoryEnum("category").notNull(),
  variety: text("variety").notNull().default("—"),
  unit: text("unit").notNull().default("kg"),
  currentStock: numeric("current_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  minimumStock: numeric("minimum_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  maximumStock: numeric("maximum_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull().default("0"),
  supplier: text("supplier").notNull().default("Local supplier"),
  storageLocation: text("storage_location").notNull().default("Main warehouse"),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  paymentCode: text("payment_code").notNull().unique(),
  transactionId: integer("transaction_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  referenceNumber: text("reference_number"),
  receivedBy: text("received_by").notNull().default("Mila Santos"),
  remarks: text("remarks"),
  date: date("date", { mode: "string" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  expenseCode: text("expense_code").notNull().unique(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  payee: text("payee").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("CASH"),
  date: date("date", { mode: "string" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  position: text("position").notNull(),
  contactNumber: text("contact_number").notNull(),
  employmentStatus: text("employment_status").notNull().default("ACTIVE"),
  assignedMachine: text("assigned_machine"),
  accountStatus: recordStatusEnum("account_status").notNull().default("ACTIVE"),
});

export const equipmentTable = pgTable("equipment", {
  id: serial("id").primaryKey(),
  equipmentCode: text("equipment_code").notNull().unique(),
  equipmentName: text("equipment_name").notNull(),
  equipmentType: text("equipment_type").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  currentCondition: text("current_condition").notNull(),
  nextMaintenance: date("next_maintenance", { mode: "string" }).notNull(),
  status: text("status").notNull().default("OPERATIONAL"),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  unread: boolean("unread").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  role: roleEnum("role").notNull(),
  action: text("action").notNull(),
  module: text("module").notNull(),
  recordId: text("record_id"),
  description: text("description").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFarmerSchema = createInsertSchema(farmersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFarmer = z.infer<typeof insertFarmerSchema>;
export type Farmer = typeof farmersTable.$inferSelect;
export type MillingTransaction = typeof millingTransactionsTable.$inferSelect;
export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;