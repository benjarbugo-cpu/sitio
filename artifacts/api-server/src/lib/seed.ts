import { db } from "@workspace/db";
import {
  auditLogsTable,
  employeesTable,
  equipmentTable,
  expensesTable,
  farmersTable,
  inventoryItemsTable,
  millingTransactionsTable,
  notificationsTable,
  paymentsTable,
  usersTable,
} from "@workspace/db";
import { count } from "drizzle-orm";

const farmerNames = [
  "Juan Dela Cruz", "Pedro Santos", "Maria Bautista", "Roberto Garcia", "Ana Flores",
  "Lourdes Mendoza", "Rogelio Ramos", "Nestor Villanueva", "Elena Castillo", "Felix Navarro",
];
const varieties = ["Dinorado", "Jasmine", "NSIC Rc222", "Inbred"];

export async function ensureSeedData(): Promise<void> {
  const [{ value: farmerCount }] = await db.select({ value: count() }).from(farmersTable);
  if (farmerCount > 0) return;

  const farmers = await db.insert(farmersTable).values(
    farmerNames.map((fullName, index) => ({
      farmerCode: `FM-${String(index + 1).padStart(4, "0")}`,
      customerNumber: `CUS-${String(index + 1).padStart(4, "0")}`,
      fullName,
      contactNumber: `09${String(170000000 + index * 13791).slice(0, 9)}`,
      address: `${index + 2} Camarin Road`,
      riceVariety: varieties[index % varieties.length],
      farmArea: String((1.8 + index * 0.65).toFixed(2)),
      registrationDate: `2025-${String((index % 9) + 1).padStart(2, "0")}-12`,
      customerType: index > 6 ? "CUSTOMER" : "FARMER",
    })),
  ).returning();

  await db.insert(usersTable).values([
    { id: 1, name: "Carmela Camarin", email: "admin@camarinricemill.local", role: "ADMIN" },
    { id: 2, name: "Mila Santos", email: "staff@camarinricemill.local", role: "STAFF" },
    { id: 3, name: "Juan Dela Cruz", email: "farmer@camarinricemill.local", role: "FARMER", farmerId: farmers[0].id },
    { id: 4, name: "Ana Flores", email: "customer@camarinricemill.local", role: "CUSTOMER", farmerId: farmers[4].id },
  ]).onConflictDoNothing();

  const transactionRows = Array.from({ length: 12 }, (_, index) => {
    const quantity = 420 + index * 63;
    const rate = index % 3 === 0 ? 5 : 4.5;
    const serviceCharge = quantity * rate / 100;
    const total = serviceCharge + (index % 4 === 0 ? 150 : 0);
    return {
      transactionCode: `MT-${String(2026001 + index).slice(0, 7)}`,
      farmerId: farmers[index % farmers.length].id,
      riceVariety: varieties[index % varieties.length],
      riceType: "Palay",
      quantityReceived: String(quantity),
      millingType: index % 3 === 0 ? "Custom Milling" : "Regular Milling",
      millingRate: String(rate),
      serviceCharge: String(serviceCharge.toFixed(2)),
      otherCharges: index % 4 === 0 ? "150" : "0",
      discount: "0",
      totalAmount: String(total.toFixed(2)),
      amountPaid: String((index % 3 === 0 ? total : total * 0.55).toFixed(2)),
      dateReceived: `2026-08-${String((index % 9) + 10).padStart(2, "0")}`,
      millingDate: `2026-08-${String((index % 9) + 10).padStart(2, "0")}`,
      expectedCompletion: `2026-08-${String((index % 9) + 12).padStart(2, "0")}`,
      operator: index % 2 ? "Ramil Dela Cruz" : "Joel Manalo",
      status: (["COMPLETED", "PROCESSING", "READY_FOR_RELEASE", "QUALITY_CHECK", "RECEIVED"] as const)[index % 5],
      progressStep: [6, 3, 5, 4, 1][index % 5],
      remarks: index % 2 ? "Keep sacks dry before release." : null,
    };
  });
  const transactions = await db.insert(millingTransactionsTable).values(transactionRows).returning();

  await db.insert(inventoryItemsTable).values([
    { itemCode: "INV-001", itemName: "Palay · Dinorado", category: "RAW_MATERIAL", variety: "Dinorado", unit: "kg", currentStock: "18420", minimumStock: "5000", maximumStock: "30000", unitCost: "24.50", sellingPrice: "0", supplier: "Local farmers", storageLocation: "Shed A" },
    { itemCode: "INV-002", itemName: "Premium milled rice", category: "FINISHED_PRODUCT", variety: "Dinorado", unit: "kg", currentStock: "6450", minimumStock: "2500", maximumStock: "12000", unitCost: "38.00", sellingPrice: "52.00", supplier: "Camarin Mill", storageLocation: "Warehouse 1" },
    { itemCode: "INV-003", itemName: "Regular milled rice", category: "FINISHED_PRODUCT", variety: "NSIC Rc222", unit: "kg", currentStock: "3920", minimumStock: "4000", maximumStock: "10000", unitCost: "31.50", sellingPrice: "45.00", supplier: "Camarin Mill", storageLocation: "Warehouse 1" },
    { itemCode: "INV-004", itemName: "Rice bran", category: "BY_PRODUCT", variety: "Mixed", unit: "kg", currentStock: "2180", minimumStock: "1000", maximumStock: "5000", unitCost: "8.00", sellingPrice: "12.00", supplier: "Camarin Mill", storageLocation: "By-product bay" },
    { itemCode: "INV-005", itemName: "50kg woven sacks", category: "PACKAGING", variety: "Standard", unit: "pcs", currentStock: "780", minimumStock: "800", maximumStock: "2000", unitCost: "22.00", sellingPrice: "0", supplier: "Zamboanga Packaging", storageLocation: "Supply room" },
  ]);

  await db.insert(paymentsTable).values(transactions.slice(0, 8).map((transaction, index) => ({
    paymentCode: `PAY-${String(2026001 + index).slice(0, 7)}`,
    transactionId: transaction.id,
    amount: String(Number(transaction.amountPaid)),
    paymentMethod: (["CASH", "GCASH", "BANK_TRANSFER"] as const)[index % 3],
    referenceNumber: index % 3 === 0 ? null : `REF-${89210 + index}`,
    receivedBy: "Mila Santos",
    date: transaction.dateReceived,
  })));

  await db.insert(expensesTable).values([
    { expenseCode: "EXP-001", category: "Electricity", description: "August milling operations", amount: "18650", payee: "ZAMSURECO II" },
    { expenseCode: "EXP-002", category: "Fuel", description: "Generator diesel refill", amount: "7250", payee: "Camarin Fuel Depot" },
    { expenseCode: "EXP-003", category: "Machine Maintenance", description: "Rubber roll replacement", amount: "9400", payee: "Mindanao Mill Supply" },
    { expenseCode: "EXP-004", category: "Labor", description: "Weekly operator payroll", amount: "28000", payee: "Mill Operations Team" },
  ]);

  await db.insert(employeesTable).values([
    { employeeCode: "EMP-001", fullName: "Ramil Dela Cruz", position: "Rice Mill Operator", contactNumber: "09171234567", assignedMachine: "Satake RM-01" },
    { employeeCode: "EMP-002", fullName: "Mila Santos", position: "Cashier", contactNumber: "09189876543" },
    { employeeCode: "EMP-003", fullName: "Joel Manalo", position: "Weighing Staff", contactNumber: "09201234567", assignedMachine: "Digital Scale 02" },
  ]);

  await db.insert(equipmentTable).values([
    { equipmentCode: "EQ-001", equipmentName: "Rice Mill Machine", equipmentType: "Milling Machine", brand: "Satake", model: "SB10", currentCondition: "Good", nextMaintenance: "2026-09-15" },
    { equipmentCode: "EQ-002", equipmentName: "Digital Weighing Scale", equipmentType: "Weighing", brand: "A&D", model: "FG-60KAL", currentCondition: "Good", nextMaintenance: "2026-10-05" },
    { equipmentCode: "EQ-003", equipmentName: "Rice Dryer", equipmentType: "Drying", brand: "FAO", model: "RD-200", currentCondition: "Needs inspection", nextMaintenance: "2026-09-02", status: "UNDER MAINTENANCE" },
  ]);

  await db.insert(notificationsTable).values([
    { title: "New rice receiving", message: "Juan Dela Cruz submitted 1,250 kg of Dinorado palay.", type: "RECEIVING", unread: true },
    { title: "Low inventory alert", message: "50kg woven sacks are below the minimum stock level.", type: "INVENTORY", unread: true },
    { title: "Ready for release", message: "MT-2026007 is ready for customer pickup.", type: "MILLING", unread: true },
    { title: "Maintenance reminder", message: "Rice dryer inspection is due on September 2.", type: "EQUIPMENT", unread: false },
  ]);

  await db.insert(auditLogsTable).values([
    { userId: 1, role: "ADMIN", action: "LOGIN", module: "Authentication", description: "Admin signed in" },
    { userId: 2, role: "STAFF", action: "CREATE", module: "Milling", recordId: transactions[0].transactionCode, description: "Milling transaction received" },
    { userId: 2, role: "STAFF", action: "PAYMENT", module: "Payments", recordId: "PAY-2026001", description: "Payment recorded via cash" },
  ]);
}