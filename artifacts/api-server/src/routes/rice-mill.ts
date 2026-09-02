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

// ----------------------------------------------------------------
// Notifications Routes
// ----------------------------------------------------------------

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const user = getRequestUser(req);
  const rows = await db.select().from(notificationsTable)
    .where(
      user?.farmerId
        ? sql`${notificationsTable.userId} = ${user.id} OR ${notificationsTable.userId} IS NULL`
        : undefined
    )
    .orderBy(desc(notificationsTable.createdAt));
  res.json(rows.map(r => ({
    id: r.id,
    title: r.title,
    message: r.message,
    type: r.type,
    unread: r.unread,
    userId: r.userId,
    timestamp: r.createdAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/notifications", adminRoles, async (req, res): Promise<void> => {
  const { title, message, type = "SYSTEM", userId } = req.body ?? {};
  if (!title || !message) { res.status(400).json({ error: "title and message are required" }); return; }
  const [notif] = await db.insert(notificationsTable).values({
    title,
    message,
    type,
    userId: userId ?? null,
    unread: true,
  }).returning();
  res.status(201).json({ ...notif, timestamp: notif.createdAt.toISOString() });
});

router.patch("/notifications/mark-all-read", requireAuth, async (_req, res): Promise<void> => {
  await db.update(notificationsTable).set({ unread: false });
  res.json({ success: true });
});

router.patch("/notifications/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { unread } = req.body ?? {};
  const [notif] = await db.update(notificationsTable)
    .set({ unread: unread === undefined ? false : Boolean(unread) })
    .where(eq(notificationsTable.id, id))
    .returning();
  if (!notif) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json({ ...notif, timestamp: notif.createdAt.toISOString() });
});

router.delete("/notifications/:id", adminRoles, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(notificationsTable).where(eq(notificationsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Notification not found" }); return; }
  res.sendStatus(204);
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
  const body = {
    ...req.body,
    riceType: req.body?.riceType || "Palay",
    millingType: req.body?.millingType || "Regular Milling",
  };
  const parsed = CreateMillingTransactionBody.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const farmer = await db.select().from(farmersTable).where(eq(farmersTable.id, parsed.data.farmerId));
  if (!farmer[0]) { res.status(404).json({ error: "Farmer not found" }); return; }
  
  const quantity = parsed.data.quantityReceived;
  const rate = req.body?.millingRate ? Number(req.body.millingRate) : 4.5;
  const serviceCharge = req.body?.serviceCharge ? Number(req.body.serviceCharge) : (quantity * rate);
  const otherCharges = req.body?.otherCharges ? Number(req.body.otherCharges) : 0;
  const discount = req.body?.discount ? Number(req.body.discount) : 0;
  const totalAmount = req.body?.totalAmount ? Number(req.body.totalAmount) : (serviceCharge + otherCharges - discount);

  const [transaction] = await db.insert(millingTransactionsTable).values({
    transactionCode: `MT-${Date.now().toString().slice(-7)}`,
    farmerId: parsed.data.farmerId,
    riceVariety: parsed.data.riceVariety,
    riceType: parsed.data.riceType || "Palay",
    quantityReceived: String(quantity),
    millingType: parsed.data.millingType || "Regular Milling",
    millingRate: String(rate),
    serviceCharge: String(serviceCharge),
    otherCharges: String(otherCharges),
    discount: String(discount),
    totalAmount: String(totalAmount),
    amountPaid: "0",
    dateReceived: new Date().toISOString().slice(0, 10),
    millingDate: new Date().toISOString().slice(0, 10),
    expectedCompletion: req.body?.expectedCompletion || new Date(Date.now() + 172800000).toISOString().slice(0, 10),
    remarks: parsed.data.remarks ?? req.body?.remarks ?? null,
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
  const body = req.body ?? {};
  const progressMap: Record<string, number> = { PENDING: 0, RECEIVED: 1, WEIGHING: 2, PROCESSING: 3, QUALITY_CHECK: 4, READY_FOR_RELEASE: 5, COMPLETED: 6, CANCELLED: 0 };
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.status !== undefined) {
    updateData.status = body.status;
    updateData.progressStep = progressMap[body.status] ?? 1;
  }
  if (body.quantityReceived !== undefined) {
    const qty = Number(body.quantityReceived);
    const rate = body.millingRate !== undefined ? Number(body.millingRate) : 4.5;
    updateData.quantityReceived = String(qty);
    updateData.millingRate = String(rate);
    const serviceCharge = qty * rate;
    updateData.serviceCharge = String(serviceCharge);
    const otherCharges = body.otherCharges !== undefined ? Number(body.otherCharges) : 0;
    const discount = body.discount !== undefined ? Number(body.discount) : 0;
    updateData.totalAmount = String(Math.max(0, serviceCharge + otherCharges - discount));
  }
  if (body.millingRate !== undefined && body.quantityReceived === undefined) updateData.millingRate = String(body.millingRate);
  if (body.serviceCharge !== undefined) updateData.serviceCharge = String(body.serviceCharge);
  if (body.otherCharges !== undefined) updateData.otherCharges = String(body.otherCharges);
  if (body.discount !== undefined) updateData.discount = String(body.discount);
  if (body.totalAmount !== undefined) updateData.totalAmount = String(body.totalAmount);
  if (body.riceVariety !== undefined) updateData.riceVariety = body.riceVariety;
  if (body.riceType !== undefined) updateData.riceType = body.riceType;
  if (body.millingType !== undefined) updateData.millingType = body.millingType;
  if (body.operator !== undefined) updateData.operator = body.operator;
  if (body.remarks !== undefined) updateData.remarks = body.remarks;
  if (body.expectedCompletion !== undefined) updateData.expectedCompletion = body.expectedCompletion;
  if (body.amountPaid !== undefined) updateData.amountPaid = String(body.amountPaid);

  const [transaction] = await db.update(millingTransactionsTable).set(updateData).where(eq(millingTransactionsTable.id, Number(req.params.id))).returning();
  if (!transaction) { res.status(404).json({ error: "Transaction not found" }); return; }
  const [farmer] = await db.select().from(farmersTable).where(eq(farmersTable.id, transaction.farmerId));

  // Create notification when status changes to COMPLETED or READY_FOR_RELEASE
  if (body.status === "COMPLETED" || body.status === "READY_FOR_RELEASE") {
    const statusLabel = body.status === "COMPLETED" ? "completed" : "ready for release";
    await db.insert(notificationsTable).values({
      title: body.status === "COMPLETED" ? "Milling Batch Completed" : "Batch Ready for Release",
      message: `${transaction.transactionCode} (${farmer?.fullName ?? "Unknown"} — ${transaction.riceVariety} ${asNumber(transaction.quantityReceived).toLocaleString()} kg) is now ${statusLabel}.`,
      type: "MILLING",
      unread: true,
    }).catch(() => {/* non-critical */});
  }

  res.json(mapTransaction(transaction, farmer?.fullName ?? "Unknown customer"));
});

router.delete("/milling-transactions/:id", adminRoles, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(paymentsTable).where(eq(paymentsTable.transactionId, id));
  const [deleted] = await db.delete(millingTransactionsTable).where(eq(millingTransactionsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.sendStatus(204);
});

router.get("/inventory", adminRoles, async (req, res): Promise<void> => {
  const parsed = ListInventoryQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const filters = [];
  if (parsed.data.search) filters.push(ilike(inventoryItemsTable.itemName, `%${parsed.data.search}%`));
  if (parsed.data.category) filters.push(eq(inventoryItemsTable.category, parsed.data.category as any));
  const rows = await db.select().from(inventoryItemsTable).where(filters.length ? and(...filters) : undefined).orderBy(asc(inventoryItemsTable.itemName));
  const items = rows.map((item) => ({ ...item, currentStock: asNumber(item.currentStock), minimumStock: asNumber(item.minimumStock), maximumStock: asNumber(item.maximumStock), unitCost: asNumber(item.unitCost), sellingPrice: asNumber(item.sellingPrice), lastUpdated: item.lastUpdated.toISOString(), stockStatus: asNumber(item.currentStock) === 0 ? "OUT_OF_STOCK" : asNumber(item.currentStock) <= asNumber(item.minimumStock) ? "LOW_STOCK" : "HEALTHY" }));
  res.json({ items, total: items.length, lowStockCount: items.filter((item) => item.stockStatus === "LOW_STOCK").length });
});

router.post("/inventory", adminRoles, async (req, res): Promise<void> => {
  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(inventoryItemsTable).values({ ...parsed.data, itemCode: `INV-${Date.now().toString().slice(-4)}`, variety: parsed.data.variety ?? "—", unit: parsed.data.unit, currentStock: String(parsed.data.currentStock), minimumStock: String(parsed.data.minimumStock), maximumStock: String(parsed.data.maximumStock), unitCost: String(parsed.data.unitCost), sellingPrice: String(parsed.data.sellingPrice ?? 0), supplier: parsed.data.supplier ?? "Local supplier", storageLocation: parsed.data.storageLocation ?? "Main warehouse" }).returning();
  // Alert if stock is below minimum on creation
  if (asNumber(item.currentStock) <= asNumber(item.minimumStock) && asNumber(item.minimumStock) > 0) {
    await db.insert(notificationsTable).values({ title: "Low Stock Alert", message: `${item.itemName} stock (${asNumber(item.currentStock)} ${item.unit}) is at or below minimum threshold of ${asNumber(item.minimumStock)} ${item.unit}.`, type: "INVENTORY", unread: true }).catch(() => {});
  }
  res.status(201).json({ ...item, currentStock: asNumber(item.currentStock), minimumStock: asNumber(item.minimumStock), maximumStock: asNumber(item.maximumStock), unitCost: asNumber(item.unitCost), sellingPrice: asNumber(item.sellingPrice), lastUpdated: item.lastUpdated.toISOString(), stockStatus: "HEALTHY" });
});

router.patch("/inventory/:id", adminRoles, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Inventory item not found" }); return; }
  const body = req.body ?? {};
  let newStock = body.currentStock !== undefined ? Number(body.currentStock) : asNumber(existing.currentStock);
  if (body.adjustment !== undefined) {
    newStock = Math.max(0, newStock + Number(body.adjustment));
  }
  const updateData: Record<string, unknown> = {
    lastUpdated: new Date(),
    currentStock: String(newStock),
  };
  if (body.itemName !== undefined) updateData.itemName = body.itemName;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.variety !== undefined) updateData.variety = body.variety;
  if (body.unit !== undefined) updateData.unit = body.unit;
  if (body.minimumStock !== undefined) updateData.minimumStock = String(body.minimumStock);
  if (body.maximumStock !== undefined) updateData.maximumStock = String(body.maximumStock);
  if (body.unitCost !== undefined) updateData.unitCost = String(body.unitCost);
  if (body.sellingPrice !== undefined) updateData.sellingPrice = String(body.sellingPrice);
  if (body.supplier !== undefined) updateData.supplier = body.supplier;
  if (body.storageLocation !== undefined) updateData.storageLocation = body.storageLocation;
  
  const [item] = await db.update(inventoryItemsTable).set(updateData).where(eq(inventoryItemsTable.id, id)).returning();
  const currentStock = asNumber(item.currentStock);
  const minStock = asNumber(item.minimumStock);

  // Trigger low-stock notification if stock drops to or below minimum
  if (currentStock <= minStock && minStock > 0 && currentStock < asNumber(existing.currentStock)) {
    await db.insert(notificationsTable).values({
      title: currentStock === 0 ? "Out of Stock Alert" : "Low Stock Alert",
      message: `${item.itemName} stock is now at ${currentStock} ${item.unit}${currentStock === 0 ? " — OUT OF STOCK" : ` (minimum: ${minStock} ${item.unit})`}. Restock recommended.`,
      type: "INVENTORY",
      unread: true,
    }).catch(() => {});
  }

  res.json({ ...item, currentStock, minimumStock: minStock, maximumStock: asNumber(item.maximumStock), unitCost: asNumber(item.unitCost), sellingPrice: asNumber(item.sellingPrice), lastUpdated: item.lastUpdated.toISOString(), stockStatus: currentStock === 0 ? "OUT_OF_STOCK" : currentStock <= minStock ? "LOW_STOCK" : "HEALTHY" });
});

router.delete("/inventory/:id", adminRoles, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Item not found" }); return; }
  res.sendStatus(204);
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
  const receivedBy = req.body?.receivedBy || "Mila Santos (Cashier)";
  const [payment] = await db.insert(paymentsTable).values({
    paymentCode: `PAY-${Date.now().toString().slice(-7)}`,
    transactionId: parsed.data.transactionId,
    amount: String(parsed.data.amount),
    paymentMethod: parsed.data.paymentMethod,
    receivedBy,
    referenceNumber: parsed.data.referenceNumber ?? null,
    remarks: parsed.data.remarks ?? null,
  }).returning();
  const newAmountPaid = transaction.amountPaid + parsed.data.amount;
  await db.update(millingTransactionsTable).set({ amountPaid: String(newAmountPaid), updatedAt: new Date() }).where(eq(millingTransactionsTable.id, parsed.data.transactionId));
  const [transactionRow] = await db.select({ transactionCode: millingTransactionsTable.transactionCode, customerName: farmersTable.fullName, totalAmount: millingTransactionsTable.totalAmount }).from(millingTransactionsTable).leftJoin(farmersTable, eq(farmersTable.id, millingTransactionsTable.farmerId)).where(eq(millingTransactionsTable.id, parsed.data.transactionId));

  // Create payment notification
  const isFullyPaid = newAmountPaid >= asNumber(transactionRow?.totalAmount ?? 0);
  await db.insert(notificationsTable).values({
    title: isFullyPaid ? "Invoice Fully Paid" : "Partial Payment Received",
    message: `${isFullyPaid ? "Full" : "Partial"} cash payment of ₱${parsed.data.amount.toLocaleString()} received from ${transactionRow?.customerName ?? "customer"} for ${transactionRow?.transactionCode ?? "invoice"}.`,
    type: "PAYMENT",
    unread: true,
  }).catch(() => {});

  res.status(201).json({ ...payment, amount: asNumber(payment.amount), transactionCode: transactionRow?.transactionCode ?? "—", customerName: transactionRow?.customerName ?? "Unknown customer", date: payment.date });
});


router.patch("/payments/:id", adminRoles, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const body = req.body ?? {};
  const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }
  const updateData: Record<string, unknown> = {};
  if (body.amount !== undefined) updateData.amount = String(body.amount);
  if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
  if (body.referenceNumber !== undefined) updateData.referenceNumber = body.referenceNumber;
  if (body.remarks !== undefined) updateData.remarks = body.remarks;
  
  const [payment] = await db.update(paymentsTable).set(updateData).where(eq(paymentsTable.id, id)).returning();
  if (body.amount !== undefined) {
    const diff = Number(body.amount) - asNumber(existing.amount);
    const [trx] = await db.select().from(millingTransactionsTable).where(eq(millingTransactionsTable.id, existing.transactionId));
    if (trx) {
      await db.update(millingTransactionsTable).set({
        amountPaid: String(Math.max(0, asNumber(trx.amountPaid) + diff)),
        updatedAt: new Date(),
      }).where(eq(millingTransactionsTable.id, existing.transactionId));
    }
  }
  const [trxRow] = await db.select({ transactionCode: millingTransactionsTable.transactionCode, customerName: farmersTable.fullName }).from(millingTransactionsTable).leftJoin(farmersTable, eq(farmersTable.id, millingTransactionsTable.farmerId)).where(eq(millingTransactionsTable.id, payment.transactionId));
  res.json({ ...payment, amount: asNumber(payment.amount), transactionCode: trxRow?.transactionCode ?? "—", customerName: trxRow?.customerName ?? "Unknown customer", date: payment.date });
});

router.delete("/payments/:id", adminRoles, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }
  await db.delete(paymentsTable).where(eq(paymentsTable.id, id));
  const [trx] = await db.select().from(millingTransactionsTable).where(eq(millingTransactionsTable.id, existing.transactionId));
  if (trx) {
    await db.update(millingTransactionsTable).set({
      amountPaid: String(Math.max(0, asNumber(trx.amountPaid) - asNumber(existing.amount))),
      updatedAt: new Date(),
    }).where(eq(millingTransactionsTable.id, existing.transactionId));
  }
  res.sendStatus(204);
});

router.get("/expenses", adminRoles, async (_req, res): Promise<void> => {
  const rows = await db.select().from(expensesTable).orderBy(desc(expensesTable.date));
  res.json(rows.map((exp) => ({ ...exp, amount: asNumber(exp.amount) })));
});

router.post("/expenses", adminRoles, async (req, res): Promise<void> => {
  const { category, description, amount, payee, paymentMethod = "CASH" } = req.body ?? {};
  if (!category || !description || !amount || !payee) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  const [expense] = await db.insert(expensesTable).values({
    expenseCode: `EXP-${Date.now().toString().slice(-6)}`,
    category,
    description,
    amount: String(amount),
    payee,
    paymentMethod,
    date: new Date().toISOString().slice(0, 10),
  }).returning();
  res.status(201).json({ ...expense, amount: asNumber(expense.amount) });
});

router.delete("/expenses/:id", adminRoles, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(expensesTable).where(eq(expensesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Expense not found" }); return; }
  res.sendStatus(204);
});

router.get("/reports/summary", adminRoles, async (req, res): Promise<void> => {
  const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
  const allTransactions = await listTransactions();
  const expenses = await db.select().from(expensesTable);
  const payments = await db.select().from(paymentsTable).orderBy(asc(paymentsTable.date));

  // Apply date filtering
  const filteredTransactions = allTransactions.filter(t => {
    if (dateFrom && t.dateReceived < dateFrom) return false;
    if (dateTo && t.dateReceived > dateTo) return false;
    return true;
  });
  const filteredExpenses = expenses.filter(e => {
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });
  const filteredPayments = payments.filter(p => {
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo && p.date > dateTo) return false;
    return true;
  });

  const revenue = filteredTransactions.reduce((sum, item) => sum + item.totalAmount, 0);
  const collected = filteredTransactions.reduce((sum, item) => sum + item.amountPaid, 0);
  const expensesTotal = filteredExpenses.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const input = filteredTransactions.reduce((sum, item) => sum + item.quantityReceived, 0);
  const milled = input * 0.68;

  // Weekly revenue trend (last 7 data points)
  const revenueByDate: Record<string, number> = {};
  filteredPayments.forEach(p => {
    const day = p.date;
    revenueByDate[day] = (revenueByDate[day] ?? 0) + asNumber(p.amount);
  });
  const revenueTrend = Object.entries(revenueByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([label, value]) => ({ label: label.slice(5), value }));

  // Volume trend
  const volumeByDate: Record<string, number> = {};
  filteredTransactions.forEach(t => {
    const day = t.dateReceived;
    volumeByDate[day] = (volumeByDate[day] ?? 0) + t.quantityReceived;
  });
  const volumeTrend = Object.entries(volumeByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([label, volume]) => ({ label: label.slice(5), volume }));

  // Top farmers by volume
  const farmerVolume: Record<number, { name: string; volume: number; revenue: number }> = {};
  filteredTransactions.forEach(t => {
    if (!farmerVolume[t.farmerId]) farmerVolume[t.farmerId] = { name: t.farmerName, volume: 0, revenue: 0 };
    farmerVolume[t.farmerId].volume += t.quantityReceived;
    farmerVolume[t.farmerId].revenue += t.totalAmount;
  });
  const topFarmers = Object.values(farmerVolume)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);

  // Status breakdown
  const statusCounts = ["PENDING","RECEIVED","WEIGHING","PROCESSING","QUALITY_CHECK","READY_FOR_RELEASE","COMPLETED","CANCELLED"]
    .map(status => ({ status, count: filteredTransactions.filter(t => t.status === status).length }));

  res.json({
    revenue,
    payments: collected,
    expenses: expensesTotal,
    netIncome: collected - expensesTotal,
    outstandingBalance: filteredTransactions.reduce((sum, item) => sum + item.balance, 0),
    production: { input, milled: Math.round(milled), recoveryRate: 68 },
    revenueTrend,
    volumeTrend,
    topFarmers,
    statusCounts,
    transactionCount: filteredTransactions.length,
    completedCount: filteredTransactions.filter(t => t.status === "COMPLETED").length,
  });
});


router.post("/admin/clear-all-data", adminRoles, async (_req, res): Promise<void> => {
  await db.delete(paymentsTable);
  await db.delete(millingTransactionsTable);
  await db.delete(inventoryItemsTable);
  await db.delete(expensesTable);
  await db.delete(notificationsTable);
  await db.delete(farmersTable);
  res.json({ success: true, message: "All records cleared successfully." });
});

export default router;