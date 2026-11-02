// ============================================================
// Tên file: src/features/export-planning/invoiceDocument.ts
// Tên tiếng Việt: Dựng + tải bộ Invoice · Packing list của một chuyến
// Description: Builds the invoice document of a shipment from ExportData and downloads it (ba-spec 63)
// ============================================================
import { notify } from "@/design-system";
import { EMPTY_COMPOSITION, bankAccountsOf, bankBlockLines, buildInvoiceDocument, defaultTradeTerms, invoiceUnitPrice, shipmentLinesOf } from "@/lib/exportInvoice";
import { documentItems, termsOf, workingRevision, type ExportData } from "@/lib/exportPlanning";
import type { Customer, ExportContract, ExportShipment, ExportStepItem } from "@/types";

/** Dựng bộ chứng từ của một chuyến từ mục Commercial Invoice (đang sửa hoặc đã lưu). Dùng cả ở bước 5. */
export function invoiceDocumentFor(data: ExportData, shipment: ExportShipment, contract: ExportContract, customer: Customer | undefined, item: ExportStepItem | undefined, bankOptions: Parameters<typeof bankAccountsOf>[0]) {
  const comp = item?.invoiceComposition ?? EMPTY_COMPOSITION;
  const terms = termsOf(data, contract.id);
  const contractLines = workingRevision(data, contract.id)?.lines ?? [];
  const lines = shipmentLinesOf(data.shipmentLines ?? [], shipment.id);
  const banks = bankAccountsOf(bankOptions);
  const bank = banks.find((b) => b.id === comp.bankOptionId) ?? banks[0];
  const pod = shipment.portOfDischarge || terms.portOfDischarge;
  const bl = documentItems(data, shipment.id).find((d) => d.docKind === "bill-of-lading");
  return buildInvoiceDocument({
    invoiceNo: item?.number ?? "",
    issuedOn: item?.issuedOn || new Date().toISOString().slice(0, 10),
    customer: { name: customer?.name ?? "", address: customer?.address ?? "" },
    shipment,
    blNo: bl?.number ?? "",
    portOfLoading: terms.portOfLoading,
    portOfDischarge: pod,
    currency: terms.currency || "USD",
    tradeTerms: comp.tradeTerms.trim() || defaultTradeTerms(terms.incoterm, pod),
    originNote: comp.originNote,
    lines,
    unitPrice: (l) => invoiceUnitPrice(l, comp, contractLines),
    bankLines: bankBlockLines(bank),
    specialNotes: comp.specialNotes,
  });
}

/** Tải bộ chứng từ (exceljs nạp động — không kéo vào bundle chính). Lỗi ⇒ báo (luật 13: lỗi luôn báo). */
export async function downloadInvoiceDocument(doc: ReturnType<typeof buildInvoiceDocument>): Promise<void> {
  try {
    const { downloadInvoiceWorkbook } = await import("@/lib/exportInvoiceExcel");
    await downloadInvoiceWorkbook(doc);
  } catch (e) {
    notify.error(e instanceof Error ? `Không tạo được file Excel: ${e.message}` : "Không tạo được file Excel");
  }
}
