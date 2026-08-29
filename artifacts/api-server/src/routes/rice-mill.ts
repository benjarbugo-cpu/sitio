import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  CreateFarmerBody,
  CreateInventoryItemBody,
  CreateMillingTransactionBody,
  CreatePaymentBody,
  GetDashboardSummaryQueryParams,
  GetReportsSummaryQueryParams,
  ListFarmersQueryParams,
  ListInventoryQueryParams,
  ListMillingTransactionsQueryParams,
  ListPaymentsQueryParams,
  UpdateFarmerBody,
  UpdateInventoryItemBody,
  UpdateMillingTransactionBody,
} from "@workspace/api-zod";
import {
  db,
  expensesTable,
  farmersTable,
  inventoryItemsTable,
  millingTransactionsTable,
  notificationsTable,
  paymentsTable,
} from "@workspace/db";
import {
  getRequestUser,
  requireAuth,
  requireRole,
} from "../lib/auth";

const router: IRouter = Router();
const adminRoles = requireRole("ADMIN", "STAFF");

const asNumber = (value: unknown): number => Number(value ?? 0);
const asDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value);

function mapFarmer(row: typeof farmersTable.$inferSelect, transactionCount = 0, balance = 0) {
  return {
    id: row.id,
    farmerCode: row.farmerCode,
    customerNumber: row.customerNumber,
    fullName: row.fullName,
    gender: row.gender,
    contactNumber: row.contactNumber,
    address: row.address,
    barangay: row.barangay,
    sitio: row.sitio,
    customerType: row.customerType,
    riceVariety: row.riceVariety,
    farmArea: asNumber(row.farmArea),
    status: row.status,
    registrationDate: row.registrationDate,
    transactionCount,
    balance,
  };
}

async function transactionBalance(transactionId: number): Promise<{ amountPaid: number; balance: number }> {
  const [transaction] = await db.select({
    totalAmount: millingTransactionsTable.totalAmount,
    amountPaid: millingTransactionsTable.amountPaid,
  }).from(millingTransactionsTable).where(eq(millingTransactionsTable.id, transactionId));
  const amountPaid = asNumber(transaction?.amountPaid);
  return { amountPaid, balance: asNumber(transaction?.totalAmount) - amountPaid };
}

function mapTransaction(row: typeof millingTransactionsTable.$inferSelect, farmerName: string) {
  return {
    id: row.id,
    transactionCode: row.transactionCode,
    farmerId: row.farmerId,
    farmerName,
    riceVariety: row.riceVariety,
    riceType: row.riceType,
    quantityReceived: asNumber(row.quantityReceived),
    millingType: row.millingType,
    millingRate: asNumber(row.millingRate),
    serviceCharge: asNumber(row.serviceCharge),
    otherCharges: asNumber(row.otherCharges),
    discount: asNumber(row.discount),
    totalAmount: asNumber(row.totalAmount),
    amountPaid: asNumber(row.amountPaid),
    balance: asNumber(row.totalAmount) - asNumber(row.amountPaid),
    dateReceived: row.dateReceived,
    millingDate: row.millingDate,
    expectedCompletion: row.expectedCompletion,
    operator: row.operator,
    status: row.status,
    progressStep: row.progressStep,
    remarks: row.remarks,
  };
}

async function listTransactions(userId?: number) {
  const conditions = userId ? [eq(millingTransactionsTable.farmerId, userId)] : [];
  const rows = await db.select({
    transaction: millingTransactionsTable,
    farmerName: farmersTable.fullName,
  }).from(millingTransactionsTable)
    .leftJoin(farmersTable, eq(farmersTable.id, millingTransactionsTable.farmerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(millingTransactionsTable.dateReceived));
  return rows.map(({ transaction, farmerName }) => mapTransaction(transaction, farmerName ?? "Unknown customer"));
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  GetDashboardSummaryQueryParams.safeParse(req.query);
  const user = getRequestUser(req);
  const transactions = await listTransactions(user?.farmerId ?? undefined);
  const [farmersResult] = await db.select({ value: count() }).from(farmersTable);
  const inventory = await db.select().from(inventoryItemsTable);
  const revenue = transactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0);
  const paid = transactions.reduce((sum, transaction) => sum + transaction.amountPaid, 0);
  const processing = transactions.filter((transaction) => ["PROCESSING", "QUALITY_CHECK", "READY_FOR_RELEASE"].includes(transaction.status)).length;
  const completed = transactions.filter((transaction) => transaction.status === "COMPLETED").length;
  const statusOrder = ["PENDING", "RECEIVED", "WEIGHING", "PROCESSING", "QUALITY_CHECK", "READY_FOR_RELEASE", "COMPLETED", "CANCELLED"];
  const statusCounts = statusOrder.map((status) => ({ status, count: transactions.filter((transaction) => transaction.status === status).length }));
  const inventoryBreakdown = [
    { label: "Palay", value: inventory.filter((item) => item.category === "RAW_MATERIAL").reduce((sum, item) => sum + asNumber(item.currentStock), 0) },
    { label: "Milled rice", value: inventory.filter((item) => item.category === "FINISHED_PRODUCT").reduce((sum, item) => sum + asNumber(item.currentStock), 0) },
    { label: "Bran & by-products", value: inventory.filter((item) => item.category === "BY_PRODUCT").reduce((sum, item) => sum + asNumber(item.currentStock), 0) },
    { label: "Packaging", value: inventory.filter((item) => item.category === "PACKAGING").reduce((sum, item) => sum + asNumber(item.currentStock), 0) },
  ];
  const volume = transactions.slice(0, 7).reverse().map((transaction) => ({ label: transaction.dateReceived.slice(5), volume: transaction.quantityReceived }));
  res.json({
    role: user?.role ?? "CUSTOMER",
    kpis: user?.farmerId
      ? { totalTransactions: transactions.length, riceSubmitted: transactions.reduce((sum, item) => sum + item.quantityReceived, 0), processing, completedTransactions: completed, totalPaid: paid, outstandingBalance: revenue - paid }
      : { totalFarmers: Number(farmersResult?.value ?? 0), riceReceivedToday: transactions.slice(0, 2).reduce((sum, item) => sum + item.quantityReceived, 0), riceProcessing: transactions.filter((item) => item.status === "PROCESSING").reduce((sum, item) => sum + item.quantityReceived, 0), completedMilling: completed, totalInventory: inventoryBreakdown.reduce((sum, item) => sum + item.value, 0), totalRevenue: revenue, outstandingBalances: revenue - paid },
    millingVolume: volume,
    inventoryBreakdown,
    revenue: volume.map((item) => ({ label: item.label, value: Math.round(revenue / Math.max(volume.length, 1)) })),
    millingStatus: statusCounts,
  });
});

router.get("/dashboard/activity", requireAuth, async (_req, res): Promise<void> => {
  const notifications = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(6);
  res.json(notifications.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.message,
    timestamp: item.createdAt.toISOString(),
    tone: item.type === "INVENTORY" ? "warning" : item.type === "PAYMENT" ? "success" : "info",
  })));
});

router.get("/farmers", requireRole("ADMIN", "STAFF"), async (req, res): Promise<void> => {
  const parsed = ListFarmersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, status, page = 1, pageSize = 20 } = parsed.data;
  const filters = [];
  if (search) filters.push(or(ilike(farmersTable.fullName, `%${search}%`), ilike(farmersTable.farmerCode, `%${search}%`), ilike(farmersTable.customerNumber, `%${search}%`)));
  if (status === "ACTIVE" || status === "INACTIVE") filters.push(eq(farmersTable.status, status));
  const rows = await db.select().from(farmersTable).where(filters.length ? and(...filters) : undefined).orderBy(asc(farmersTable.fullName)).limit(pageSize).offset((page - 1) * pageSize);
  const totalRows = await db.select({ value: count() }).from(farmersTable).where(filters.length ? and(...filters) : undefined);
  const items = await Promise.all(rows.map(async (farmer) => {
    const transactions = await db.select().from(millingTransactionsTable).where(eq(millingTransactionsTable.farmerId, farmer.id));
    return mapFarmer(farmer, transactions.length, transactions.reduce((sum, item) => sum + asNumber(item.totalAmount) - asNumber(item.amountPaid), 0));
  }));
  res.json({ items, total: Number(totalRows[0]?.value ?? 0), page, pageSize });
});

router.post("/farmers", adminRoles, async (req, res): Promise<void> => {
  const parsed = CreateFarmerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const [farmer] = await db.insert(farmersTable).values({
    ...data,
    farmerCode: `FM-${Date.now().toString().slice(-4)}`,
    customerNumber: `CUS-${Date.now().toString().slice(-4)}`,
    contactNumber: data.contactNumber ?? "",
    address: data.address ?? "Sitio Camarin",
    barangay: data.barangay ?? "Kaagwasan",
    sitio: data.sitio ?? "Camarin",
    riceVariety: data.riceVariety ?? "Dinorado",
    farmArea: String(data.farmArea ?? 0),
  }).returning();
  res.status(201).json(mapFarmer(farmer));
});

router.get("/farmers/:id", requireRole("ADMIN", "STAFF"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [farmer] = await db.select().from(farmersTable).where(eq(farmersTable.id, id));
  if (!farmer) { res.status(404).json({ error: "Farmer not found" }); return; }
  res.json(mapFarmer(farmer));
});

router.patch("/farmers/:id", adminRoles, async (req, res): Promise<void> => {
  const parsed = UpdateFarmerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [farmer] = await db.update(farmersTable).set({ ...parsed.data, farmArea: parsed.data.farmArea === undefined ? undefined : String(parsed.data.farmArea), updatedAt: new Date() }).where(eq(farmersTable.id, Number(req.params.id))).returning();
  if (!farmer) { res.status(404).json({ error: "Farmer not found" }); return; }
  res.json(mapFarmer(farmer));
});

router.delete("/farmers/:id", requireRole("ADMIN"), async (req, res): Promise<void> => {
  const [farmer] = await db.update(farmersTable).set({ status: "INACTIVE", updatedAt: new Date() }).where(eq(farmersTable.id, Number(req.params.id))).returning();
  if (!farmer) { res.status(404).json({ error: "Farmer not found" }); return; }
  res.sendStatus(204);
});

router.get("/milling-transactions", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListMillingTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = getRequestUser(req);
  const transactions = await listTransactions(user?.farmerId ?? undefined);
  const filtered = parsed.data.status ? transactions.filter((item) => item.status === parsed.data.status) : transactions;
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 20;
  res.json({ items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize });
});

router.post("/milling-transactions", adminRoles, async (req, res): Promise<void> => {
  const parsed = CreateMillingTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const farmer = await db.select().from(farmersTable).where(eq(farmersTable.id, parsed.data.farmerId));
  if (!farmer[0]) { res.status(404).json({ error: "Farmer not found" }); return; }
  const quantity = parsed.data.quantityReceived;
  const rate = 4.5;
  const serviceCharge = quantity * rate / 100;
  const [transaction] = await db.insert(millingTransactionsTable).values({
    transactionCode: `MT-${Date.now().toString().slice(-7)}`,
    farmerId: parsed.data.farmerId,
    riceVariety: parsed.data.riceVariety,
    riceType: parsed.data.riceType,
    quantityReceived: String(quantity),
    millingType: parsed.data.millingType,
    millingRate: String(rate),
    serviceCharge: String(serviceCharge),
    totalAmount: String(serviceCharge),
    amountPaid: "0",
    dateReceived: new Date().toISOString().slice(0, 10),
    millingDate: new Date().toISOString().slice(0, 10),
    expectedCompletion: new Date(Date.now() + 172800000).toISOString().slice(0, 10),
    remarks: parsed.data.remarks ?? null,
  }).returning();
  res.status(201).json(mapTransaction(transaction, farmer[0].fullName));
});

router.get("/milling-transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const [row] = await db.select({ transaction: millingTransactionsTable, farmerName: farmersTable.fullName }).from(millingTransactionsTable).leftJoin(farmersTable, eq(farmersTable.id, millingTransactionsTable.farmerId)).where(eq(millingTransactionsTable.id, Number(req.params.id)));
  const user = getRequestUser(req);
  if (!row) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (user?.farmerId && user.farmerId !== row.transaction.farmerId) { res.status(403).json({ error: "Access denied" }); return; }
  res.json(mapTransaction(row.transaction, row.farmerName ?? "Unknown customer"));
});

router.patch("/milling-transactions/:id", adminRoles, async (req, res): Promise<void> => {
  const parsed = UpdateMillingTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const progressMap = { PENDING: 0, RECEIVED: 1, WEIGHING: 2, PROCESSING: 3, QUALITY_CHECK: 4, READY_FOR_RELEASE: 5, COMPLETED: 6, CANCELLED: 0 } as const;
  const [transaction] = await db.update(millingTransactionsTable).set({ ...parsed.data, progressStep: parsed.data.status ? progressMap[parsed.data.status] : undefined, amountPaid: parsed.data.amountPaid === undefined ? undefined : String(parsed.data.amountPaid), updatedAt: new Date() }).where(eq(millingTransactionsTable.id, Number(req.params.id))).returning();
  if (!transaction) { res.status(404).json({ error: "Transaction not found" }); return; }
  const [farmer] = await db.select().from(farmersTable).where(eq(farmersTable.id, transaction.farmerId));
  res.json(mapTransaction(transaction, farmer?.fullName ?? "Unknown customer"));
});

router.get("/inventory", adminRoles, async (req, res): Promise<void> => {
  const parsed = ListInventoryQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const filters = [];
  if (parsed.data.search) filters.push(ilike(inventoryItemsTable.itemName, `%${parsed.data.search}%`));
  if (parsed.data.category) filters.push(eq(inventoryItemsTable.category, parsed.data.category));
  const rows = await db.select().from(inventoryItemsTable).where(filters.length ? and(...filters) : undefined).orderBy(asc(inventoryItemsTable.itemName));
  const items = rows.map((item) => ({ ...item, currentStock: asNumber(item.currentStock), minimumStock: asNumber(item.minimumStock), maximumStock: asNumber(item.maximumStock), unitCost: asNumber(item.unitCost), sellingPrice: asNumber(item.sellingPrice), lastUpdated: item.lastUpdated.toISOString(), stockStatus: asNumber(item.currentStock) === 0 ? "OUT_OF_STOCK" : asNumber(item.currentStock) <= asNumber(item.minimumStock) ? "LOW_STOCK" : "HEALTHY" }));
  res.json({ items, total: items.length, lowStockCount: items.filter((item) => item.stockStatus === "LOW_STOCK").length });
});

router.post("/inventory", adminRoles, async (req, res): Promise<void> => {
  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(inventoryItemsTable).values({ ...parsed.data, itemCode: `INV-${Date.now().toString().slice(-4)}`, variety: parsed.data.variety ?? "—", unit: parsed.data.unit, currentStock: String(parsed.data.currentStock), minimumStock: String(parsed.data.minimumStock), maximumStock: String(parsed.data.maximumStock), unitCost: String(parsed.data.unitCost), sellingPrice: String(parsed.data.sellingPrice ?? 0), supplier: parsed.data.supplier ?? "Local supplier", storageLocation: parsed.data.storageLocation ?? "Main warehouse" }).returning();
  res.status(201).json({ ...item, currentStock: asNumber(item.currentStock), minimumStock: asNumber(item.minimumStock), maximumStock: asNumber(item.maximumStock), unitCost: asNumber(item.unitCost), sellingPrice: asNumber(item.sellingPrice), lastUpdated: item.lastUpdated.toISOString(), stockStatus: "HEALTHY" });
});

router.patch("/inventory/:id", adminRoles, async (req, res): Promise<void> => {
  const parsed = UpdateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(inventoryItemsTable).set({ currentStock: parsed.data.currentStock === undefined ? undefined : String(parsed.data.currentStock), lastUpdated: new Date() }).where(eq(inventoryItemsTable.id, Number(req.params.id))).returning();
  if (!item) { res.status(404).json({ error: "Inventory item not found" }); return; }
  const currentStock = asNumber(item.currentStock);
  res.json({ ...item, currentStock, minimumStock: asNumber(item.minimumStock), maximumStock: asNumber(item.maximumStock), unitCost: asNumber(item.unitCost), sellingPrice: asNumber(item.sellingPrice), lastUpdated: item.lastUpdated.toISOString(), stockStatus: currentStock === 0 ? "OUT_OF_STOCK" : currentStock <= asNumber(item.minimumStock) ? "LOW_STOCK" : "HEALTHY" });
});

router.get("/payments", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListPaymentsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = getRequestUser(req);
  const conditions = user?.farmerId ? [eq(millingTransactionsTable.farmerId, user.farmerId)] : [];
  const rows = await db.select({ payment: paymentsTable, transactionCode: millingTransactionsTable.transactionCode, customerName: farmersTable.fullName }).from(paymentsTable).leftJoin(millingTransactionsTable, eq(millingTransactionsTable.id, paymentsTable.transactionId)).leftJoin(farmersTable, eq(farmersTable.id, millingTransactionsTable.farmerId)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(paymentsTable.date));
  const items = rows.map(({ payment, transactionCode, customerName }) => ({ ...payment, customerName: customerName ?? "Unknown customer", transactionCode: transactionCode ?? "—", amount: asNumber(payment.amount), date: payment.date, referenceNumber: payment.referenceNumber, remarks: payment.remarks }));
  res.json({ items, total: items.length, totalPaid: items.reduce((sum, item) => sum + item.amount, 0), outstanding: (await listTransactions(user?.farmerId ?? undefined)).reduce((sum, item) => sum + item.balance, 0) });
});

router.post("/payments", adminRoles, async (req, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const transaction = await transactionBalance(parsed.data.transactionId);
  const [payment] = await db.insert(paymentsTable).values({ paymentCode: `PAY-${Date.now().toString().slice(-7)}`, transactionId: parsed.data.transactionId, amount: String(parsed.data.amount), paymentMethod: parsed.data.paymentMethod, referenceNumber: parsed.data.referenceNumber ?? null, remarks: parsed.data.remarks ?? null }).returning();
  await db.update(millingTransactionsTable).set({ amountPaid: String(transaction.amountPaid + parsed.data.amount), updatedAt: new Date() }).where(eq(millingTransactionsTable.id, parsed.data.transactionId));
  const [transactionRow] = await db.select({ transactionCode: millingTransactionsTable.transactionCode, customerName: farmersTable.fullName }).from(millingTransactionsTable).leftJoin(farmersTable, eq(farmersTable.id, millingTransactionsTable.farmerId)).where(eq(millingTransactionsTable.id, parsed.data.transactionId));
  res.status(201).json({ ...payment, amount: asNumber(payment.amount), transactionCode: transactionRow?.transactionCode ?? "—", customerName: transactionRow?.customerName ?? "Unknown customer", date: payment.date });
});

router.get("/reports/summary", adminRoles, async (req, res): Promise<void> => {
  GetReportsSummaryQueryParams.safeParse(req.query);
  const transactions = await listTransactions();
  const expenses = await db.select().from(expensesTable);
  const revenue = transactions.reduce((sum, item) => sum + item.totalAmount, 0);
  const payments = transactions.reduce((sum, item) => sum + item.amountPaid, 0);
  const input = transactions.reduce((sum, item) => sum + item.quantityReceived, 0);
  res.json({ revenue, payments, expenses: expenses.reduce((sum, item) => sum + asNumber(item.amount), 0), netIncome: payments - expenses.reduce((sum, item) => sum + asNumber(item.amount), 0), outstandingBalance: transactions.reduce((sum, item) => sum + item.balance, 0), production: { input, milled: input * 0.68, recoveryRate: 68 } });
});

router.get("/notifications", requireAuth, async (_req, res): Promise<void> => {
  const notifications = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt));
  res.json(notifications.map((item) => ({ id: item.id, title: item.title, message: item.message, createdAt: item.createdAt.toISOString(), unread: item.unread, type: item.type })));
});

export default router;