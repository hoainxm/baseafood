// ============================================================
// Tên file: src/features/imports/SupplierInvoicePanel.tsx
// Tên tiếng Việt: Tab "Hóa đơn" của Nhập hàng — nạp sổ chi tiết NL + PDF, gắn hóa đơn vào chuyến
// Description: UI of ba-spec 51 / design-spec 52: load the accounting ledger + VAT-invoice PDFs,
//              map accounting codes, preview matches, attach, then follow up (mismatch → update from
//              invoice / keep workshop figures, invoice without trip → create trip / not a trip).
//              Rules live in lib/supplierInvoice.ts; files in lib/supplierInvoiceFiles.ts.
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Combobox,
  DateRangeField,
  EmptyState,
  ErrorSummary,
  FormSection,
  Input,
  Label,
  StatCardGrid,
  SummaryTable,
  Tag,
  notify,
  type ComboboxOption,
  type FieldError,
  type SummaryTableColumn,
  type TagVariant,
} from "@/design-system";
import type { AccountingCodeMap, DailyLock, ImportShipment, MaterialImportItem, MaterialType, Supplier, SupplierInvoice, SupplierInvoiceLine, Workshop } from "@/types";
import { useSupplierInvoiceStore } from "@/lib/catalogRepo";
import { newId } from "@/lib/store";
import { formatDateVN, num, todayISO } from "@/lib/format";
import {
  IMPORT_CHANGE_LABELS,
  PDF_WARNING_LABELS,
  SUPPLIER_INVOICE_LINE_STATE_LABELS,
  TRIP_INVOICE_STATUS_LABELS,
  accountingCodeMapId,
  applyInvoiceToTripLine,
  applyPdfToInvoice,
  buildCodeMaps,
  buildTripsFromInvoice,
  indexLinesByTripLine,
  isOpenMismatch,
  lineStateNow,
  matchLinesToTrips,
  matchPdfToInvoice,
  normalizePlateKey,
  planLedgerImport,
  suggestSupplierForCode,
  tripInvoiceInfo,
  type ImportChange,
  type InvoiceLineState,
  type LedgerParse,
  type PdfWarning,
} from "@/lib/supplierInvoice";
import {
  SUPPLIER_INVOICE_ACCEPT,
  getSupplierInvoiceFileUrl,
  isLedgerFile,
  isPdfFile,
  readInvoicePdf,
  readLedgerFile,
  supplierInvoiceFilePath,
  uploadSupplierInvoiceFile,
  type PdfRead,
} from "@/lib/supplierInvoiceFiles";
import { useCan } from "@/features/shared/PermissionProvider";
import { DEFAULT_CATEGORY, generateLotCode } from "./importHelpers";
import { CreateTripDialog, ExplainMismatchDialog, type CreateTripTarget, type ExplainTarget } from "./supplierInvoiceParts";

const STATE_TAG: Record<InvoiceLineState, TagVariant> = {
  matched: "done",
  updated: "done",
  "price-mismatch": "warning",
  "quantity-mismatch": "warning",
  "no-trip": "error",
  "not-trip": "muted",
  unmapped: "muted",
  explained: "muted",
};

/** Một dòng của bảng (xem trước hoặc đã gắn). */
interface RowView {
  key: string;
  invoice: SupplierInvoice;
  line: SupplierInvoiceLine;
  state: InvoiceLineState;
  change?: ImportChange;
  trip?: MaterialImportItem;
  materialName: string;
  firstOfInvoice: boolean;
}

type CardFilter = "all" | "awaiting" | "no-file" | "mismatch" | "no-trip";

interface LoadedPdf {
  fileName: string;
  file: File;
  read: PdfRead;
}

/** Bút chì sửa nhanh danh mục (useQuickCatalogEdit của màn Nhập hàng — luật 7). */
interface CatalogEditor {
  openEdit: (value: string) => void;
  canEdit: (value: string) => boolean;
  editLabel?: string;
}

export interface SupplierInvoicePanelProps {
  trips: readonly MaterialImportItem[];
  persistTrips: (next: MaterialImportItem[]) => boolean;
  shipments: readonly ImportShipment[];
  persistShipments: (next: ImportShipment[]) => boolean;
  locks: readonly DailyLock[];
  suppliers: readonly Supplier[];
  materialTypes: readonly MaterialType[];
  supplierOptions: ComboboxOption[];
  materialTypeOptions: ComboboxOption[];
  onCreateSupplier?: (name: string) => string;
  onCreateMaterialType?: (name: string) => string;
  supplierEditor: CatalogEditor;
  materialTypeEditor: CatalogEditor;
  canViewPrice: boolean;
  /** Quyền Nhập hàng: Thêm (tạo chuyến từ HĐ) · Sửa (cập nhật theo HĐ). */
  canCreateTrip: boolean;
  canUpdateTrip: boolean;
  operator: string;
}

const monthStart = (iso: string) => `${iso.slice(0, 8)}01`;
const stampNow = () => new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function SupplierInvoicePanel(p: SupplierInvoicePanelProps) {
  const allowed = useCan("imports.invoices");
  const canWrite = allowed.create || allowed.update;
  const store = useSupplierInvoiceStore();
  const { invoices, lines, codeMaps } = store;

  const [fromDate, setFromDate] = useState(monthStart(todayISO()));
  const [toDate, setToDate] = useState(todayISO());
  const [cardFilter, setCardFilter] = useState<CardFilter>("all");
  const [ledger, setLedger] = useState<{ fileName: string; parse: LedgerParse } | null>(null);
  const [pdfs, setPdfs] = useState<LoadedPdf[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  const [tripTarget, setTripTarget] = useState<CreateTripTarget | null>(null);

  const tripById = useMemo(() => new Map(p.trips.map((t) => [t.id, t])), [p.trips]);
  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);
  const maps = useMemo(() => buildCodeMaps(codeMaps), [codeMaps]);
  const isLocked = (date: string, ws: Workshop) => p.locks.some((l) => l.lockDate === date && l.workshop === ws && l.isLocked);
  const guardWrite = () => {
    if (!store.isAvailable) {
      notify.error("Máy chủ chưa chạy migration 0090 — chưa gắn hóa đơn được. Báo chủ dự án.");
      return false;
    }
    return true;
  };

  /* ---------- Xem trước lần nạp ---------- */
  const plan = useMemo(
    () => (ledger ? planLedgerImport({ ledgerRows: ledger.parse.rows, maps: codeMaps, tripLines: [...p.trips], existingInvoices: invoices, existingLines: lines }) : null),
    [ledger, codeMaps, p.trips, invoices, lines],
  );
  const pdfMatches = useMemo(() => {
    const planInv = plan?.invoices ?? [];
    const planIds = new Set(planInv.map((i) => i.id));
    const allInv = [...planInv, ...invoices.filter((i) => !planIds.has(i.id))];
    const planLineIds = new Set(plan?.lines.map((l) => l.line.id) ?? []);
    const allLines = [...(plan?.lines.map((l) => l.line) ?? []), ...lines.filter((l) => !planLineIds.has(l.id))];
    return pdfs.map((x) => (x.read.ok ? { ...x, match: matchPdfToInvoice(x.read.pdf, allInv, allLines, [...p.suppliers]) } : { ...x, match: null }));
  }, [pdfs, plan, invoices, lines, p.suppliers]);
  const pdfByInvoice = useMemo(() => new Map(pdfMatches.filter((m) => m.match?.invoiceId).map((m) => [m.match!.invoiceId, m])), [pdfMatches]);

  const previewRows: RowView[] = useMemo(() => {
    if (!plan) return [];
    const inv = new Map(plan.invoices.map((i) => [i.id, i]));
    const seen = new Set<string>();
    return plan.lines.map((l) => {
      const first = !seen.has(l.invoiceId);
      seen.add(l.invoiceId);
      return { key: l.line.id, invoice: inv.get(l.invoiceId)!, line: l.line, state: l.state, change: l.change, trip: tripById.get(l.line.tripLineId), materialName: l.materialName, firstOfInvoice: first };
    });
  }, [plan, tripById]);

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsReading(true);
    setErrors([]);
    try {
      const list = [...files];
      const book = list.find((f) => isLedgerFile(f.name));
      if (book) setLedger({ fileName: book.name, parse: await readLedgerFile(book) });
      const readPdfs = await Promise.all(list.filter((f) => isPdfFile(f.name)).map(async (f) => ({ fileName: f.name, file: f, read: await readInvoicePdf(f, f.name) })));
      if (readPdfs.length) setPdfs((prev) => [...prev.filter((x) => !readPdfs.some((r) => r.fileName === x.fileName)), ...readPdfs]);
      const other = list.filter((f) => !isLedgerFile(f.name) && !isPdfFile(f.name));
      if (other.length) notify.warning(`Bỏ qua ${other.length} file không phải Excel / PDF: ${other.map((f) => f.name).join(", ")}`);
    } catch (e) {
      notify.error(`Không đọc được file${e instanceof Error && e.message ? `: ${e.message}` : ""}`);
    } finally {
      setIsReading(false);
    }
  };

  const unmappedSuppliers = plan?.unmapped.suppliers ?? [];
  const unmappedMaterials = plan?.unmapped.materials ?? [];
  const setMapping = (kind: AccountingCodeMap["kind"], code: string, targetName: string) => {
    if (!guardWrite()) return;
    const id = accountingCodeMapId(kind, code);
    store.setCodeMaps([...codeMaps.filter((m) => m.id !== id), { id, kind, code, targetName }]);
    notify.saved(`Đã nhớ mã kế toán ${code} = ${targetName}`);
  };

  const commit = async () => {
    if (!plan && !pdfMatches.some((m) => m.match?.invoiceId)) {
      setErrors([{ field: "File", message: "Chưa chọn file sổ chi tiết NL hoặc PDF hóa đơn nào đọc được." }]);
      return;
    }
    if (!guardWrite() || isSaving) return;
    setIsSaving(true);
    try {
      const nextInv = new Map((plan?.invoices ?? []).map((i) => [i.id, i]));
      const uploadErrors: string[] = [];
      for (const m of pdfMatches) {
        if (!m.read.ok || !m.match?.invoiceId) continue;
        const base = nextInv.get(m.match.invoiceId) ?? invoiceById.get(m.match.invoiceId);
        if (!base) continue;
        const up = await uploadSupplierInvoiceFile(supplierInvoiceFilePath(base.invoiceYear, base.id, m.fileName), m.file);
        if ("error" in up) uploadErrors.push(`${m.fileName}: ${up.error}`);
        nextInv.set(base.id, applyPdfToInvoice(base, m.read.pdf, "error" in up ? { filePath: "", fileName: "" } : { filePath: up.path, fileName: m.fileName }));
      }
      const planLines = plan?.lines.map((l) => l.line) ?? [];
      const planLineIds = new Set(planLines.map((l) => l.id));
      store.setInvoices([...invoices.filter((i) => !nextInv.has(i.id)), ...nextInv.values()]);
      if (planLines.length) store.setLines([...lines.filter((l) => !planLineIds.has(l.id)), ...planLines]);
      const linked = planLines.filter((l) => l.tripLineId).length;
      notify.saved(`Đã gắn ${nextInv.size} hóa đơn${planLines.length ? ` · ${linked}/${planLines.length} dòng có chuyến` : ""}`);
      if (uploadErrors.length) notify.error(`Chưa lưu được ${uploadErrors.length} file PDF (hóa đơn vẫn ghi số): ${uploadErrors.join(" · ")}`);
      setLedger(null);
      setPdfs([]);
      setErrors([]);
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------- Hóa đơn đã gắn ---------- */
  const inRange = (d: string) => (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
  const savedRows: RowView[] = useMemo(() => {
    const ordered = [...invoices].sort((a, b) => a.postingDate.localeCompare(b.postingDate) || Number(a.invoiceNo) - Number(b.invoiceNo));
    const byInv = new Map<string, SupplierInvoiceLine[]>();
    for (const l of lines) byInv.set(l.invoiceId, [...(byInv.get(l.invoiceId) ?? []), l]);
    const out: RowView[] = [];
    for (const inv of ordered) {
      const ls = (byInv.get(inv.id) ?? []).filter((l) => inRange(l.deliveryDate)).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
      ls.forEach((l, i) =>
        out.push({ key: l.id, invoice: inv, line: l, state: lineStateNow(l, inv, tripById), trip: tripById.get(l.tripLineId), materialName: maps.materialByCode.get(l.materialCode) ?? l.materialCode, firstOfInvoice: i === 0 }),
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, lines, tripById, maps, fromDate, toDate]);

  const mappedMaterials = useMemo(() => new Set(maps.materialByCode.values()), [maps]);
  const awaitingTrips = useMemo(() => {
    const byTrip = indexLinesByTripLine(lines);
    const byShipment = new Map<string, MaterialImportItem[]>();
    for (const t of p.trips) if (t.shipmentId && inRange(t.deliveryDate)) byShipment.set(t.shipmentId, [...(byShipment.get(t.shipmentId) ?? []), t]);
    return p.shipments
      .filter((s) => byShipment.has(s.id))
      .map((s) => ({ shipment: s, lines: byShipment.get(s.id)!, info: tripInvoiceInfo(byShipment.get(s.id)!, byTrip, invoiceById, mappedMaterials) }))
      .filter((x) => x.info && (x.info.status === "awaiting" || x.info.status === "partial"))
      .sort((a, b) => a.shipment.deliveryDate.localeCompare(b.shipment.deliveryDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.trips, p.shipments, lines, invoiceById, mappedMaterials, fromDate, toDate]);

  const invoicesNoFile = new Set(savedRows.filter((r) => !r.invoice.filePath && r.invoice.classification === "trip").map((r) => r.invoice.id));
  const mismatchRows = savedRows.filter((r) => isOpenMismatch(r.state));
  const noTripInvoices = new Set(savedRows.filter((r) => r.state === "no-trip").map((r) => r.invoice.id));
  const shownRows = savedRows.filter((r) =>
    cardFilter === "no-file" ? invoicesNoFile.has(r.invoice.id) : cardFilter === "mismatch" ? isOpenMismatch(r.state) : cardFilter === "no-trip" ? noTripInvoices.has(r.invoice.id) : true,
  );
  const toggleCard = (f: CardFilter) => setCardFilter((cur) => (cur === f ? "all" : f));

  /* ---------- Thao tác (NV4, NV5) ---------- */
  const updateFromInvoice = (row: RowView) => {
    if (!guardWrite() || !row.trip) return;
    const trip = row.trip;
    const next = applyInvoiceToTripLine(trip, row.line, { invoiceNo: row.invoice.invoiceNo, stamp: stampNow(), editor: p.operator, dayLocked: isLocked(trip.deliveryDate, trip.workshop) });
    const prevTrips = [...p.trips];
    const prevLines = lines;
    p.persistTrips(p.trips.map((t) => (t.id === trip.id ? next : t)));
    store.setLines(lines.map((l) => (l.id === row.line.id ? { ...l, resolution: "updated", resolutionReason: "", resolvedBy: p.operator, resolvedAt: new Date().toISOString() } : l)));
    notify.saved(`Đã cập nhật chuyến ${formatDateVN(trip.deliveryDate)} theo HĐ ${row.invoice.invoiceNo}`, () => {
      p.persistTrips(prevTrips);
      store.setLines(prevLines);
    });
  };

  const explain = (lineId: string, reason: string) => {
    if (!guardWrite()) return;
    store.setLines(lines.map((l) => (l.id === lineId ? { ...l, resolution: "explained", resolutionReason: reason, resolvedBy: p.operator, resolvedAt: new Date().toISOString() } : l)));
    notify.saved("Đã lưu lý do giữ số xưởng");
  };

  const setClassification = (inv: SupplierInvoice, classification: SupplierInvoice["classification"]) => {
    if (!guardWrite()) return;
    const prevInv = invoices;
    const prevLines = lines;
    store.setInvoices(invoices.map((i) => (i.id === inv.id ? { ...i, classification } : i)));
    if (classification === "not-trip") {
      store.setLines(lines.map((l) => (l.invoiceId === inv.id ? { ...l, tripLineId: "" } : l)));
    } else {
      // Bỏ xếp ⇒ ghép lại ngay các dòng của HĐ này.
      const own = lines.filter((l) => l.invoiceId === inv.id);
      const taken = new Set(lines.filter((l) => l.invoiceId !== inv.id && l.tripLineId).map((l) => l.tripLineId));
      const m = matchLinesToTrips(
        own
          .filter((l) => maps.materialByCode.has(l.materialCode))
          .map((l) => ({ key: l.id, supplierName: inv.supplierName, materialName: maps.materialByCode.get(l.materialCode)!, deliveryDate: l.deliveryDate, quantityKg: l.quantityKg, unitPrice: l.unitPrice, licensePlate: l.licensePlate, driverName: l.driverName })),
        [...p.trips],
        taken,
      );
      store.setLines(lines.map((l) => (m.has(l.id) ? { ...l, tripLineId: m.get(l.id)!.tripLineId } : l)));
    }
    notify.saved(classification === "not-trip" ? `HĐ ${inv.invoiceNo} xếp vào Không thuộc chuyến` : `HĐ ${inv.invoiceNo} bỏ xếp, đã ghép lại`, () => {
      store.setInvoices(prevInv);
      store.setLines(prevLines);
    });
  };

  const openTripDialog = (inv: SupplierInvoice) => {
    const own = lines.filter((l) => l.invoiceId === inv.id && !tripById.has(l.tripLineId) && maps.materialByCode.has(l.materialCode));
    const groups = new Map<string, SupplierInvoiceLine[]>();
    for (const l of own) groups.set(`${l.deliveryDate}|${normalizePlateKey(l.licensePlate)}`, [...(groups.get(`${l.deliveryDate}|${normalizePlateKey(l.licensePlate)}`) ?? []), l]);
    const usual = p.shipments.filter((s) => s.supplierName === inv.supplierName).at(-1)?.workshop ?? "Đông";
    setTripTarget({
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      supplierName: inv.supplierName,
      trips: [...groups.values()].map((ls) => ({ deliveryDate: ls[0].deliveryDate, licensePlate: ls[0].licensePlate, kg: ls.reduce((s, l) => s + l.quantityKg, 0), lines: ls.length })),
      suggestedWorkshop: usual,
    });
  };

  const createTrips = (invoiceId: string, workshop: Workshop) => {
    if (!guardWrite()) return;
    const inv = invoiceById.get(invoiceId);
    if (!inv) return;
    const own = lines.filter((l) => l.invoiceId === inv.id && !tripById.has(l.tripLineId));
    const created: ImportShipment[] = [];
    const made = buildTripsFromInvoice({
      invoice: inv,
      lines: own,
      materialByCode: maps.materialByCode,
      categoryOf: (name) => (p.materialTypes.find((m) => m.name === name)?.category as MaterialImportItem["category"]) || DEFAULT_CATEGORY,
      workshop,
      postingDate: todayISO(),
      operator: p.operator,
      lotCodeFor: (date) => generateLotCode(date, workshop, [...p.shipments, ...created]),
      newId,
    });
    for (const m of made) created.push(m.shipment);
    if (!made.length) return;
    const prev = { shipments: [...p.shipments], trips: [...p.trips], lines };
    p.persistShipments([...p.shipments, ...made.map((m) => m.shipment)]);
    p.persistTrips([...p.trips, ...made.flatMap((m) => m.items)]);
    const links = new Map(made.flatMap((m) => [...m.links.entries()]));
    store.setLines(lines.map((l) => (links.has(l.id) ? { ...l, tripLineId: links.get(l.id)! } : l)));
    notify.saved(`Đã tạo ${made.length} chuyến ghi bù theo HĐ ${inv.invoiceNo}`, () => {
      p.persistShipments(prev.shipments);
      p.persistTrips(prev.trips);
      store.setLines(prev.lines);
    });
  };

  const openFile = async (inv: SupplierInvoice) => {
    const url = await getSupplierInvoiceFileUrl(inv.filePath);
    if (url) window.open(url, "_blank", "noopener");
    else notify.warning(inv.filePath ? "Chưa mở được file (file mẫu của chế độ demo, hoặc chưa nối máy chủ)." : "Hóa đơn này chưa có file PDF.");
  };

  /* ---------- Cột ---------- */
  const tripCell = (r: RowView) =>
    r.trip ? (
      <span className="tnum">
        {num(r.trip.quantityKg)} kg{p.canViewPrice ? ` · ${r.trip.unitPrice == null ? "chưa giá" : num(r.trip.unitPrice)}` : ""}
        <span className="block text-sm text-muted-foreground">{r.trip.workshop} · {r.trip.licensePlate || "—"}</span>
      </span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  const columns = (withActions: boolean): SummaryTableColumn<RowView>[] => [
    {
      key: "invoice",
      header: "Hóa đơn",
      sortValue: (r) => Number(r.invoice.invoiceNo) || 0,
      sortKind: "number",
      render: (r) =>
        r.firstOfInvoice ? (
          <span>
            <b className="tnum">HĐ {r.invoice.invoiceNo}</b>
            {r.invoice.invoiceSymbol ? <span className="text-muted-foreground"> · {r.invoice.invoiceSymbol}</span> : null}
            <span className="block text-sm text-muted-foreground">
              {r.invoice.supplierName || `mã ${r.invoice.accountingCode}`} · hạch toán {formatDateVN(r.invoice.postingDate)}
              {r.invoice.voucherNo ? ` · phiếu ${r.invoice.voucherNo}` : ""}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">〃</span>
        ),
    },
    { key: "date", header: "Ngày hàng về", sortValue: (r) => r.line.deliveryDate, sortKind: "date", render: (r) => <span className="tnum">{formatDateVN(r.line.deliveryDate)}</span> },
    { key: "material", header: "Loại", render: (r) => r.materialName || r.line.materialCode },
    { key: "kg", header: "Kg (HĐ)", numeric: true, sortValue: (r) => r.line.quantityKg, render: (r) => num(r.line.quantityKg), total: (rs) => num(rs.reduce((s, r) => s + r.line.quantityKg, 0)) },
    ...(p.canViewPrice
      ? [
          { key: "price", header: "Đơn giá (HĐ)", numeric: true, sortValue: (r: RowView) => r.line.unitPrice, render: (r: RowView) => num(r.line.unitPrice) },
          { key: "amount", header: "Thành tiền", numeric: true, sortValue: (r: RowView) => r.line.amount, render: (r: RowView) => num(r.line.amount), total: (rs: RowView[]) => num(rs.reduce((s, r) => s + r.line.amount, 0)) },
        ]
      : []),
    { key: "trip", header: "Sổ xưởng", sortValue: (r) => r.trip?.quantityKg ?? null, sortKind: "number", render: tripCell },
    {
      key: "state",
      header: "Kết quả",
      sortValue: (r) => SUPPLIER_INVOICE_LINE_STATE_LABELS[r.state],
      sortKind: "text",
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <Tag variant={STATE_TAG[r.state]}>{SUPPLIER_INVOICE_LINE_STATE_LABELS[r.state]}</Tag>
          {r.change && r.change !== "same" ? <Tag variant={r.change === "missing" ? "warning" : "pending"}>{IMPORT_CHANGE_LABELS[r.change]}</Tag> : null}
          {r.line.missingFromFile && !r.change ? <Tag variant="warning">{IMPORT_CHANGE_LABELS.missing}</Tag> : null}
          {r.state === "explained" && r.line.resolutionReason ? <span className="text-sm text-muted-foreground">{r.line.resolutionReason}</span> : null}
        </span>
      ),
    },
    ...(withActions
      ? [
          {
            key: "actions",
            header: "Thao tác",
            sortable: false,
            render: (r: RowView) => renderActions(r),
          },
        ]
      : []),
  ];

  function renderActions(r: RowView) {
    const out: ReactNode[] = [];
    if (canWrite && isOpenMismatch(r.state)) {
      if (p.canUpdateTrip && r.trip)
        out.push(
          <Button key="u" size="sm" variant="edit" title={`Đổi kg / giá chuyến ${formatDateVN(r.line.deliveryDate)} bằng số của HĐ ${r.invoice.invoiceNo}, để lại dòng vết.`} onClick={() => updateFromInvoice(r)}>
            Cập nhật theo HĐ
          </Button>,
        );
      out.push(
        <Button key="k" size="sm" variant="outline" title="Giữ số của sổ xưởng, ghi lý do." onClick={() => setExplainTarget({ lineId: r.line.id, title: `HĐ ${r.invoice.invoiceNo} · ${r.materialName} · hàng về ${formatDateVN(r.line.deliveryDate)}` })}>
          Giữ số xưởng
        </Button>,
      );
    }
    if (canWrite && r.firstOfInvoice && noTripInvoices.has(r.invoice.id) && r.invoice.classification === "trip") {
      if (p.canCreateTrip && r.invoice.supplierName)
        out.push(
          <Button key="t" size="sm" variant="save" title="Ghi chuyến ghi bù vào sổ Nhập hàng theo số của hóa đơn rồi gắn hóa đơn." onClick={() => openTripDialog(r.invoice)}>
            Tạo chuyến từ HĐ
          </Button>,
        );
      out.push(
        <Button key="n" size="sm" variant="outline" title="Hàng không qua Nhập hàng (hàng đông gửi kho lạnh) — không đòi chuyến nữa." onClick={() => setClassification(r.invoice, "not-trip")}>
          Không thuộc chuyến
        </Button>,
      );
    }
    if (canWrite && r.firstOfInvoice && r.invoice.classification === "not-trip")
      out.push(
        <Button key="b" size="sm" variant="ghost" title="Bỏ xếp Không thuộc chuyến, ghép lại hóa đơn vào chuyến." onClick={() => setClassification(r.invoice, "trip")}>
          Bỏ xếp
        </Button>,
      );
    if (allowed.view && r.firstOfInvoice)
      out.push(
        r.invoice.filePath ? (
          <Button key="f" size="sm" variant="ghost" title={`Mở file ${r.invoice.fileName}`} onClick={() => void openFile(r.invoice)}>
            Mở file
          </Button>
        ) : (
          <span key="f" className="text-sm text-muted-foreground">Chưa có file</span>
        ),
      );
    return <span className="flex flex-wrap gap-1">{out}</span>;
  }

  const groupBy = { key: (r: RowView) => r.invoice.id, label: (_k: string, rs: RowView[]) => `HĐ ${rs[0].invoice.invoiceNo} · ${rs[0].invoice.supplierName || rs[0].invoice.accountingCode} · ${rs.length} dòng`, totalLabel: false as const };

  if (!allowed.view) return null;
  return (
    <div className="space-y-6">
      {!store.isAvailable && (
        <p className="rounded-lg border border-warning/40 bg-warning-surface p-3 text-sm text-foreground">
          Máy chủ chưa chạy migration 0090 — xem được trang này nhưng chưa gắn hóa đơn được. Báo chủ dự án.
        </p>
      )}

      <div data-tour="imports-invoice-cards" className="space-y-3">
        <div className="max-w-md">
          <DateRangeField label="Ngày hàng về" startDate={fromDate} endDate={toDate} onChange={(a, b) => { setFromDate(a); setToDate(b); }} />
        </div>
        <StatCardGrid
          columns={4}
          cards={[
            { label: "Chuyến chờ HĐ", value: num(awaitingTrips.length), numeric: true, color: awaitingTrips.length ? "warning" : "success", onSelect: () => toggleCard("awaiting"), selectHint: "Xem các chuyến chưa có hóa đơn" },
            { label: "HĐ chưa có file", value: num(invoicesNoFile.size), numeric: true, color: invoicesNoFile.size ? "warning" : "success", onSelect: () => toggleCard("no-file"), selectHint: "Lọc hóa đơn chưa nạp PDF" },
            { label: "Lệch chưa xử", value: num(mismatchRows.length), numeric: true, color: mismatchRows.length ? "danger" : "success", onSelect: () => toggleCard("mismatch"), selectHint: "Lọc dòng lệch giá / kg chưa quyết" },
            { label: "HĐ không có chuyến", value: num(noTripInvoices.size), numeric: true, color: noTripInvoices.size ? "danger" : "success", onSelect: () => toggleCard("no-trip"), selectHint: "Lọc hóa đơn chưa tìm thấy chuyến" },
          ]}
        />
      </div>

      {canWrite && (
        <FormSection title="Nạp sổ chi tiết NL + hóa đơn" hint="Chọn file Excel sổ chi tiết NL xuất từ phần mềm kế toán và các file PDF hóa đơn (chọn nhiều file một lần). Có thể nạp riêng PDF sau. File đọc ngay trên máy này.">
          <div data-tour="imports-invoice-upload" className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="supplier-invoice-files">File sổ chi tiết (.xlsx) và hóa đơn (.pdf)</Label>
              <Input id="supplier-invoice-files" type="file" multiple accept={SUPPLIER_INVOICE_ACCEPT} disabled={isReading} onChange={(e) => { void pickFiles(e.target.files); e.target.value = ""; }} />
            </div>
            {isReading && <p className="text-sm text-muted-foreground">Đang đọc file…</p>}
            {(ledger || pdfs.length > 0) && (
              <p className="text-sm text-foreground">
                {ledger ? `Sổ "${ledger.fileName}": ${num(ledger.parse.rows.length)} dòng · ${num(plan?.invoices.length ?? 0)} hóa đơn` : "Chưa có file sổ chi tiết"}
                {pdfs.length ? ` · ${pdfs.length} PDF` : ""}
              </p>
            )}
            {ledger?.parse.warnings.map((w) => (
              <p key={w} className="text-sm text-warning">{w}</p>
            ))}
            {pdfMatches.filter((m) => !m.read.ok || !m.match?.invoiceId || m.match.warnings.length).map((m) => (
              <p key={m.fileName} className="text-sm text-warning">
                {m.fileName}: {m.read.ok ? (m.match?.warnings ?? []).map((w: PdfWarning) => PDF_WARNING_LABELS[w]).join(" · ") : m.read.message}
              </p>
            ))}
          </div>

          {(unmappedSuppliers.length > 0 || unmappedMaterials.length > 0) && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground">Mã kế toán chưa biết — chọn một lần, lần nạp sau tự nhận</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {unmappedSuppliers.map((code) => (
                  <Combobox
                    key={`s-${code}`}
                    label={`Đại lý của mã ${code}`}
                    value=""
                    hint={suggestSupplierForCode(code, [...p.suppliers]) ? `Gợi ý: ${suggestSupplierForCode(code, [...p.suppliers])}` : undefined}
                    onChange={(v) => v && setMapping("supplier", code, v)}
                    options={p.supplierOptions}
                    onCreate={p.onCreateSupplier}
                    onEditItem={p.supplierEditor.openEdit}
                    canEdit={p.supplierEditor.canEdit}
                    editLabel={p.supplierEditor.editLabel}
                  />
                ))}
                {unmappedMaterials.map((code) => (
                  <Combobox
                    key={`m-${code}`}
                    label={`Loại nguyên liệu của mã ${code}`}
                    value=""
                    onChange={(v) => v && setMapping("material", code, v)}
                    options={p.materialTypeOptions}
                    onCreate={p.onCreateMaterialType}
                    onEditItem={p.materialTypeEditor.openEdit}
                    canEdit={p.materialTypeEditor.canEdit}
                    editLabel={p.materialTypeEditor.editLabel}
                  />
                ))}
              </div>
            </div>
          )}

          {previewRows.length > 0 && (
            <div data-tour="imports-invoice-preview">
              <SummaryTable rows={previewRows} columns={columns(false)} getKey={(r) => r.key} groupBy={groupBy} emptyText="Không có dòng nào." />
            </div>
          )}
          <ErrorSummary errors={errors} />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="save" title="Ghi các hóa đơn vừa đọc và liên kết với chuyến vào sổ; PDF được lưu lên kho file." onClick={() => void commit()}>
              {isSaving ? "Đang gắn…" : "Gắn hóa đơn vào chuyến"}
            </Button>
            {(ledger || pdfs.length > 0) && (
              <Button variant="ghost" title="Bỏ các file vừa chọn, chưa ghi gì." onClick={() => { setLedger(null); setPdfs([]); setErrors([]); }}>
                Bỏ file đã chọn
              </Button>
            )}
            {pdfByInvoice.size > 0 && <span className="text-sm text-muted-foreground">{pdfByInvoice.size} PDF đã tìm được hóa đơn</span>}
          </div>
        </FormSection>
      )}

      {cardFilter === "awaiting" ? (
        <FormSection title="Chuyến chờ hóa đơn" hint="Chuyến của khoảng ngày đang xem chưa gắn hóa đơn (hoặc mới gắn một phần). Nạp sổ chi tiết có hóa đơn của chuyến để gắn.">
          <SummaryTable
            rows={awaitingTrips}
            getKey={(x) => x.shipment.id}
            rowMarkKey="supplier-invoice-awaiting"
            emptyText="Không có chuyến nào chờ hóa đơn."
            columns={[
              { key: "date", header: "Ngày hàng về", sortValue: (x) => x.shipment.deliveryDate, sortKind: "date", render: (x) => <span className="tnum">{formatDateVN(x.shipment.deliveryDate)}</span> },
              { key: "supplier", header: "Đại lý", render: (x) => x.shipment.supplierName },
              { key: "ws", header: "Phân xưởng", render: (x) => x.shipment.workshop },
              { key: "plate", header: "Biển số", render: (x) => x.shipment.licensePlate || "—" },
              { key: "kg", header: "Kg", numeric: true, sortValue: (x) => x.lines.reduce((s, l) => s + l.quantityKg, 0), render: (x) => num(x.lines.reduce((s, l) => s + l.quantityKg, 0)), total: (xs) => num(xs.reduce((s, x) => s + x.lines.reduce((a, l) => a + l.quantityKg, 0), 0)) },
              { key: "st", header: "Trạng thái", sortValue: (x) => (x.info ? TRIP_INVOICE_STATUS_LABELS[x.info.status] : ""), sortKind: "text", render: (x) => (x.info ? <Tag variant="pending">{TRIP_INVOICE_STATUS_LABELS[x.info.status]}</Tag> : null) },
            ]}
          />
        </FormSection>
      ) : (
        <FormSection title="Hóa đơn đã gắn" hint={cardFilter === "all" ? "Mọi dòng hóa đơn có ngày hàng về trong khoảng đang xem." : "Đang lọc theo thẻ đã chọn — chọn lại thẻ đó để bỏ lọc."}>
          <div data-tour="imports-invoice-saved">
            {invoices.length === 0 ? (
              <EmptyState title="Chưa có hóa đơn nào" description="Nạp file sổ chi tiết NL ở khối trên để gắn hóa đơn vào chuyến." />
            ) : (
              <SummaryTable rows={shownRows} columns={columns(true)} getKey={(r) => r.key} groupBy={groupBy} rowMarkKey="supplier-invoices" fullHeight emptyText="Không có dòng nào trong khoảng ngày / bộ lọc này." />
            )}
          </div>
        </FormSection>
      )}

      <ExplainMismatchDialog target={explainTarget} onClose={() => setExplainTarget(null)} onSave={explain} />
      <CreateTripDialog target={tripTarget} onClose={() => setTripTarget(null)} onCreate={createTrips} />
    </div>
  );
}
