// ============================================================
// Tên file: src/lib/supplierInvoiceDemo.ts
// Tên tiếng Việt: Bộ demo hóa đơn đại lý — dựng từ chuyến demo, đủ các ca của ba-spec 51
// Description: Builds demo supplier invoices from the demo import trips: matched, one invoice
//              covering two trips, a price mismatch, an invoice without a trip, trips awaiting invoice.
//              Files are demo placeholders (no real PDF). Pure — demoGenerator.ts calls it.
// ============================================================
import type { AccountingCodeMap, MaterialImportItem, SupplierInvoice, SupplierInvoiceLine } from "@/types";
import { DEMO_PLACEHOLDER_PREFIX } from "./exportPlanning";
import { accountingCodeMapId, planLedgerImport, type LedgerRow } from "./supplierInvoice";

export interface SupplierInvoiceDemo {
  invoices: SupplierInvoice[];
  lines: SupplierInvoiceLine[];
  codeMaps: AccountingCodeMap[];
}

const codeOf = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Lấy chuyến của 2 đại lý giao nhiều nhất trong 10 ngày gần nhất có số: chuyến cũ nhất mỗi đại lý để
 * "Chờ HĐ", các chuyến còn lại có HĐ (đại lý đầu: HĐ gộp 2 chuyến liền nhau, một dòng lệch giá 2.000 đ).
 * Thêm một HĐ không có chuyến (hàng gửi kho lạnh) để trình diễn "Không có chuyến" / "Không thuộc chuyến".
 */
export function buildSupplierInvoiceDemo(imports: readonly MaterialImportItem[], today: string): SupplierInvoiceDemo {
  const recent = imports.filter((r) => r.shipmentId && r.deliveryDate <= today && r.deliveryDate > addDays(today, -10) && r.unitPrice != null);
  const bySupplier = new Map<string, MaterialImportItem[]>();
  for (const r of recent) bySupplier.set(r.supplierName, [...(bySupplier.get(r.supplierName) ?? []), r]);
  const top = [...bySupplier.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 2);
  if (!top.length) return { invoices: [], lines: [], codeMaps: [] };

  const materials = [...new Set(top.flatMap(([, rs]) => rs.map((r) => r.materialTypeName)))];
  const codeMaps: AccountingCodeMap[] = [
    ...top.map(([name]) => ({ id: accountingCodeMapId("supplier", codeOf(name)), kind: "supplier" as const, code: codeOf(name), targetName: name })),
    ...materials.map((m, i) => ({ id: accountingCodeMapId("material", `NL-${i + 1}`), kind: "material" as const, code: `NL-${i + 1}`, targetName: m })),
  ];
  const matCode = new Map(materials.map((m, i) => [m, `NL-${i + 1}`]));

  const rows: LedgerRow[] = [];
  let invoiceNo = 900;
  top.forEach(([name, rs], si) => {
    const trips = [...new Map(rs.map((r) => [r.shipmentId, r.deliveryDate])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const billed = trips.slice(1); // chuyến cũ nhất ⇒ Chờ HĐ
    for (let i = 0; i < billed.length; i++) {
      // Đại lý đầu: hai chuyến đầu gộp một HĐ (HĐ lập sau ngày chuyến thứ hai).
      const group = si === 0 && i === 0 && billed.length > 1 ? [billed[0], billed[1]] : [billed[i]];
      if (si === 0 && i === 1 && billed.length > 1) continue;
      invoiceNo += 1;
      const posting = addDays(group[group.length - 1][1], 1);
      group.forEach(([shipmentId], gi) => {
        for (const r of rs.filter((x) => x.shipmentId === shipmentId)) {
          const price = (r.unitPrice ?? 0) - (si === 0 && i === 0 && gi === 0 && r === rs.find((x) => x.shipmentId === shipmentId) ? 2000 : 0);
          rows.push({
            sheet: r.materialTypeName,
            rowNo: rows.length + 2,
            postingDate: posting > today ? today : posting,
            voucherNo: `${String(rows.length + 1).padStart(2, "0")}/008/${posting.slice(5, 7)}`,
            content: `Nhập kho NL : ${r.quantityKg}kg ${r.materialTypeName} ; HĐ ${invoiceNo}`,
            supplierCode: codeOf(name),
            materialCode: matCode.get(r.materialTypeName)!,
            quantityKg: r.quantityKg,
            unitPrice: price,
            amount: r.quantityKg * price,
            invoiceNo: String(invoiceNo),
            deliveryDate: r.deliveryDate,
            driverName: r.driverName,
            licensePlate: r.licensePlate,
          });
        }
      });
    }
  });
  // HĐ không có chuyến: hàng gửi kho lạnh của đại lý đầu.
  const [firstName, firstRows] = top[0];
  rows.push({
    sheet: firstRows[0].materialTypeName,
    rowNo: rows.length + 2,
    postingDate: today,
    voucherNo: `${String(rows.length + 1).padStart(2, "0")}/008/${today.slice(5, 7)}`,
    content: "Nhập kho NL hàng gửi kho lạnh",
    supplierCode: codeOf(firstName),
    materialCode: matCode.get(firstRows[0].materialTypeName)!,
    quantityKg: 20500,
    unitPrice: firstRows[0].unitPrice ?? 0,
    amount: 20500 * (firstRows[0].unitPrice ?? 0),
    invoiceNo: String(++invoiceNo),
    deliveryDate: today,
    driverName: "",
    licensePlate: "",
  });

  const plan = planLedgerImport({ ledgerRows: rows, maps: codeMaps, tripLines: imports, existingInvoices: [], existingLines: [] });
  // HĐ đầu có file giữ chỗ; các HĐ khác "chưa có file".
  const invoices = plan.invoices.map((inv, i) =>
    i === 0 ? { ...inv, filePath: `${DEMO_PLACEHOLDER_PREFIX}${inv.invoiceNo}.pdf`, fileName: `${inv.invoiceNo}_1C26DEMO_0000000000.pdf`, invoiceSymbol: "1C26DEMO", issueDate: inv.postingDate } : inv,
  );
  return { invoices, lines: plan.lines.map((l) => l.line), codeMaps };
}
