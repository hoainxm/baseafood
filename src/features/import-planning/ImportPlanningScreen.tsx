// ============================================================
// Tên file: src/features/import-planning/ImportPlanningScreen.tsx
// Tên tiếng Việt: Màn Phòng Kế hoạch · Nhập khẩu — lô nhập theo tháng, hợp đồng, hồ sơ
// Description: Import planning screen (/planning-import): month view of receipts, contract list,
//              contract dossier, warehouse-keeper view; every write has Undo.
// ============================================================
// Oracle hành vi: docs/app-map/45-import-planning.ba-spec.md · giao diện: 46-import-planning-ui.design-spec.md.
// Khác Nhập hàng (`/imports`, mua NL trong nước) — không chung bảng.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, ConfirmDelete, EmptyState, TableSkeleton, Tabs, TabsList, TabsTrigger, formatNumber, notify, todayIso } from "@/design-system";
import { useImportSupplierStore, useProducts } from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/features/shared/PermissionProvider";
import { usePageTour, usePageTourControl } from "@/features/shared/PageTourProvider";
import { ReasonDialog, type ReasonTarget } from "@/features/export-planning/RecordDialogs";
import { newId } from "@/lib/store";
import { closeGate, contractProgress, documentLabel, requiredDocumentStubs, type ImportData } from "@/lib/importPlanning";
import { hasImportStorage } from "@/lib/importFileStorage";
import type { ImportContract, ImportDocument, ImportFile, ImportReceipt, ImportReceiptLine, ImportSampleCheck } from "@/types";
import { mergeSamples } from "@/lib/importSampleChecks";
import { SampleCheckDialog, type SampleDialogTarget, type SampleSavePayload } from "./SampleChecks";
import { FilePlus2, FileText, FolderLock, Route, Ship } from "lucide-react";
import { ImportDossier } from "./ImportDossier";
import {
  CloseContractDialog,
  ContractFormDialog,
  DocumentDialog,
  QuantityDialog,
  ReceiptFormDialog,
  type CloseTarget,
  type ContractFormTarget,
  type ContractSavePayload,
  type DocumentTarget,
  type QuantityTarget,
  type ReceiptFormTarget,
} from "./ImportDialogs";
import { ImportContractList, ImportMonthView, ReceivingView } from "./ImportViews";
import { ImportFilePreview, type ImportPreviewTarget } from "./parts";
import { buildImportTour, pickTourContract } from "./importTour";
import { useImportData } from "./useImportData";

/** Hai tab luôn nằm cạnh nhau, chữ được xuống dòng (khuôn Xuất khẩu, design-spec 42). */
const TAB_TRIGGER = "h-auto min-h-9 whitespace-normal px-3 max-sm:[&>svg]:hidden sm:whitespace-nowrap sm:px-4";

export default function ImportPlanningScreen() {
  const today = todayIso();
  const { profile } = useAuth();
  const recordedBy = profile?.fullName || profile?.username || "Máy này";
  const can = useCan("import-plans");
  const receivingCan = useCan("import-plans.receiving");
  const store = useImportData();
  // Dòng hàng nối mặt hàng danh mục (ba-spec 45 v3 R20) — danh mục đi kèm dữ liệu để luật thuần đọc.
  const [products, setProducts] = useProducts();
  const d = useMemo(() => ({ ...store.data, products }), [store.data, products]);
  // Đối tác = danh mục NCC nhập khẩu RIÊNG (ba-spec 45 v2 R15), không phải Đại lý của Nhập hàng.
  const supplierStore = useImportSupplierStore();
  const [params, setParams] = useSearchParams();

  const view = params.get("view") === "contracts" ? "contracts" : "month";
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? (params.get("month") as string) : today.slice(0, 7);
  const contractId = params.get("contract") ?? "";
  const focusReceiptId = params.get("receipt") ?? "";
  const setParam = (patch: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace });
  };
  const setParamRef = useRef(setParam);
  useEffect(() => {
    setParamRef.current = setParam;
  });

  const [contractForm, setContractForm] = useState<ContractFormTarget | null>(null);
  const [receiptForm, setReceiptForm] = useState<ReceiptFormTarget | null>(null);
  const [docTarget, setDocTarget] = useState<DocumentTarget | null>(null);
  const [qtyTarget, setQtyTarget] = useState<QuantityTarget | null>(null);
  const [closeTarget, setCloseTarget] = useState<CloseTarget | null>(null);
  const [reason, setReason] = useState<ReasonTarget | null>(null);
  const [deletingContract, setDeletingContract] = useState<ImportContract | null>(null);
  const [deletingReceipt, setDeletingReceipt] = useState<ImportReceipt | null>(null);
  const [sampleTarget, setSampleTarget] = useState<SampleDialogTarget | null>(null);
  const [deletingSample, setDeletingSample] = useState<ImportSampleCheck | null>(null);
  const [preview, setPreview] = useState<ImportPreviewTarget | null>(null);

  const contract = contractId ? d.contracts.find((c) => c.id === contractId) : undefined;

  // Ref giữ bản MỚI NHẤT — Hoàn tác chạy từ toast cũ, hai lượt ghi cùng lúc không đè nhau.
  const dataRef = useRef<ImportData>(d);
  useEffect(() => {
    dataRef.current = d;
  }, [d]);
  const upsert = <T extends { id: string }>(rows: readonly T[], row: T) => (rows.some((x) => x.id === row.id) ? rows.map((x) => (x.id === row.id ? row : x)) : [...rows, row]);

  /* ---------- Ghi (mọi lượt ghi có Hoàn tác — luật 6 / 13) ---------- */

  const saveContract = (p: ContractSavePayload): boolean => {
    const prev = dataRef.current;
    if (!store.saveContracts(upsert(prev.contracts, p.contract))) return false;
    store.saveLines([...prev.lines.filter((l) => l.contractId !== p.contract.id), ...p.lines]);
    // Bỏ thực nhập của dòng đã bỏ (chỉ còn ở lần nhập đã hủy — validateContract chặn dòng còn số).
    const keep = new Set(p.lines.map((l) => l.id));
    const removedLineIds = new Set(prev.lines.filter((l) => l.contractId === p.contract.id && !keep.has(l.id)).map((l) => l.id));
    if (removedLineIds.size) store.saveReceiptLines(prev.receiptLines.filter((x) => !removedLineIds.has(x.contractLineId)));
    if (p.files.length) store.saveFiles([...prev.files, ...p.files]);
    // Đổi tên đối tác / số HĐ ⇒ chép lại vào lần nhập (thủ kho đọc bản chép).
    const stale = prev.receipts.filter((r) => r.contractId === p.contract.id && (r.contractNo !== p.contract.contractNo || r.supplierName !== p.contract.supplierName));
    if (stale.length) store.saveReceipts(prev.receipts.map((r) => (r.contractId === p.contract.id ? { ...r, contractNo: p.contract.contractNo, supplierName: p.contract.supplierName } : r)));
    notify.saved(p.isNew ? `Đã lập HĐ nhập ${p.contract.contractNo} — việc tiếp: Ghi lần nhập khi hàng sắp về` : `Đã lưu HĐ nhập ${p.contract.contractNo}`, () => {
      store.saveContracts(prev.contracts);
      store.saveLines(prev.lines);
      store.saveReceiptLines(prev.receiptLines);
      store.saveFiles(prev.files);
      store.saveReceipts(prev.receipts);
    });
    setContractForm(null);
    if (p.isNew) setParam({ contract: p.contract.id, receipt: "" });
    return true;
  };

  const saveReceipt = (r: ImportReceipt, isNew: boolean): boolean => {
    const prev = dataRef.current;
    if (!store.saveReceipts(upsert(prev.receipts, r))) return false;
    const c = prev.contracts.find((x) => x.id === r.contractId);
    if (isNew) store.saveDocuments([...prev.documents, ...requiredDocumentStubs(r.id, c?.importType ?? "", newId, new Date().toISOString())]);
    notify.saved(isNew ? `Đã ghi lần nhập — việc tiếp: đính Invoice, Packing List, tờ khai` : "Đã lưu lần nhập", () => {
      store.saveReceipts(prev.receipts);
      if (isNew) store.saveDocuments(prev.documents);
    });
    setReceiptForm(null);
    return true;
  };

  const saveDocument = (doc: ImportDocument, files: ImportFile[]): boolean => {
    const prev = dataRef.current;
    if (!store.saveDocuments(upsert(prev.documents, doc))) return false;
    if (files.length) store.saveFiles([...prev.files, ...files]);
    notify.saved(`Đã lưu ${documentLabel(doc)}${files.length ? ` · ${files.length} file` : ""}`, () => {
      store.saveDocuments(prev.documents);
      if (files.length) store.saveFiles(prev.files);
    });
    setDocTarget(null);
    return true;
  };

  const deleteDocument = (doc: ImportDocument) => {
    const prev = dataRef.current;
    if (!store.saveDocuments(prev.documents.filter((x) => x.id !== doc.id))) return;
    store.saveFiles(prev.files.filter((f) => f.documentId !== doc.id));
    notify.deleted(`Đã xóa ${documentLabel(doc)}`, () => {
      store.saveDocuments(prev.documents);
      store.saveFiles(prev.files);
    });
  };

  const removeFile = (f: ImportFile) => {
    const prev = dataRef.current;
    if (!store.saveFiles(prev.files.filter((x) => x.id !== f.id))) return;
    notify.deleted(`Đã gỡ file ${f.fileName}`, () => store.saveFiles(prev.files));
  };

  /* ---------- Kiểm mẫu của kho (v4, NI11) ---------- */

  const saveSamples = (p: SampleSavePayload): boolean => {
    if (!store.sampleChecksAvailable) {
      notify.error("Máy chủ chưa chạy migration 0085 — chưa lưu kiểm mẫu được. Báo chủ dự án.");
      return false;
    }
    const prev = dataRef.current;
    const rows = prev.sampleChecks ?? [];
    const next = p.editId
      ? rows.map((x) => (x.id === p.editId ? (p.samples[0] ?? x) : x))
      : mergeSamples(rows, p.receiptId, p.samples, p.replace);
    if (!store.saveSampleChecks(next)) return false;
    if (p.files.length) store.saveFiles([...prev.files, ...p.files]);
    const msg = p.editId ? "Đã lưu mẫu kiểm" : `Đã lưu ${p.samples.length} mẫu kiểm của kho`;
    notify.saved(msg, () => {
      store.saveSampleChecks(rows);
      if (p.files.length) store.saveFiles(prev.files);
    });
    setSampleTarget(null);
    return true;
  };

  const doDeleteSample = (s: ImportSampleCheck) => {
    const prev = dataRef.current;
    const rows = prev.sampleChecks ?? [];
    if (!store.saveSampleChecks(rows.filter((x) => x.id !== s.id))) return;
    notify.deleted(`Đã xóa mẫu ${s.sampleNo || ""}${s.size ? ` · ${s.size}` : ""}`.trim(), () => store.saveSampleChecks(rows));
  };

  const saveQuantity = (receiptId: string, rows: ImportReceiptLine[]): boolean => {
    const prev = dataRef.current;
    if (!store.saveReceiptLines([...prev.receiptLines.filter((x) => x.receiptId !== receiptId), ...rows])) return false;
    const kg = rows.reduce((s, x) => s + (x.kg ?? 0), 0);
    notify.saved(`Đã ghi thực nhập ${formatNumber(kg)} kg`, () => store.saveReceiptLines(prev.receiptLines));
    setQtyTarget(null);
    return true;
  };

  const setReceiptStatus = (r: ImportReceipt, status: ImportReceipt["status"], cancelReason: string) => {
    const prev = dataRef.current;
    if (!store.saveReceipts(prev.receipts.map((x) => (x.id === r.id ? { ...x, status, cancelReason } : x)))) return;
    notify.saved(status === "cancelled" ? "Đã hủy lần nhập" : "Đã khôi phục lần nhập", () => store.saveReceipts(prev.receipts));
  };

  const doDeleteReceipt = (r: ImportReceipt) => {
    const prev = dataRef.current;
    if (!store.saveReceipts(prev.receipts.filter((x) => x.id !== r.id))) return;
    store.saveDocuments(prev.documents.filter((x) => x.receiptId !== r.id));
    store.saveReceiptLines(prev.receiptLines.filter((x) => x.receiptId !== r.id));
    notify.deleted("Đã xóa lần nhập", () => {
      store.saveReceipts(prev.receipts);
      store.saveDocuments(prev.documents);
      store.saveReceiptLines(prev.receiptLines);
    });
  };

  const setContractStatus = (c: ImportContract, patch: Partial<ImportContract>, message: string, cascadeCancel = false) => {
    const prev = dataRef.current;
    if (!store.saveContracts(prev.contracts.map((x) => (x.id === c.id ? { ...x, ...patch } : x)))) return;
    if (cascadeCancel)
      store.saveReceipts(prev.receipts.map((r) => (r.contractId === c.id && r.status !== "cancelled" ? { ...r, status: "cancelled" as const, cancelReason: patch.cancelReason ?? "" } : r)));
    notify.saved(message, () => {
      store.saveContracts(prev.contracts);
      if (cascadeCancel) store.saveReceipts(prev.receipts);
    });
  };

  const doDeleteContract = (c: ImportContract) => {
    const prev = dataRef.current;
    if (!store.saveContracts(prev.contracts.filter((x) => x.id !== c.id))) return;
    store.saveLines(prev.lines.filter((l) => l.contractId !== c.id));
    store.saveFiles(prev.files.filter((f) => f.contractId !== c.id));
    setParam({ contract: "", receipt: "" });
    notify.deleted(`Đã xóa HĐ nhập ${c.contractNo}`, () => {
      store.saveContracts(prev.contracts);
      store.saveLines(prev.lines);
      store.saveFiles(prev.files);
    });
  };

  const openClose = (c: ImportContract) => {
    const g = closeGate(d, c.id);
    if (!g.ok) {
      notify.error(
        g.reason === "no-receipts"
          ? "Hợp đồng chưa có lần nhập nào — chưa đóng được"
          : g.reason === "unlinked-lines"
            ? `Còn ${g.unlinkedLines?.length ?? 0} dòng hàng chưa nối mặt hàng danh mục (${(g.unlinkedLines ?? []).map((l) => l.productName).join("; ")}) — vào Sửa hợp đồng để nối rồi đóng`
            : "Hợp đồng không còn mở",
      );
      return;
    }
    const shortLines = contractProgress(d, c.id)
      .lines.filter((x) => x.remainingKg > 0)
      .map((x) => `${x.line.productName}: còn ${formatNumber(x.remainingKg)} kg`);
    setCloseTarget({
      contract: c,
      needsReason: g.needsReason,
      shortLines,
      onConfirm: (why) => setContractStatus(c, { status: "closed", closeReason: why }, `Đã đóng HĐ nhập ${c.contractNo}`),
    });
  };

  /* ---------- Hướng dẫn thao tác ---------- */

  const tourPick = useMemo(() => pickTourContract(d), [d]);
  const tour = useMemo(
    () =>
      buildImportTour({
        pick: tourPick,
        can: { create: can.create, update: can.update, receiving: receivingCan.create || receivingCan.update },
        openDossier: (cid, rid) => setParamRef.current({ view: "", contract: cid, receipt: rid }, true),
        backToList: () => setParamRef.current({ view: "", contract: "", receipt: "" }, true),
      }),
    [tourPick, can.create, can.update, receivingCan.create, receivingCan.update],
  );
  usePageTour(can.view && !store.isLoading ? tour : null);
  const pageTour = usePageTourControl();

  /* ---------- Vẽ ---------- */

  const quantityDialog = (
    <QuantityDialog target={qtyTarget} data={d} recordedBy={recordedBy} onClose={() => setQtyTarget(null)} onSave={(rid, rows) => saveQuantity(rid, rows)} />
  );
  const notAvailable = !store.isAvailable && (
    <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
      Máy chủ chưa có bảng Nhập khẩu (chưa chạy migration 0082) — chưa ghi được. Báo quản trị.
    </p>
  );

  if (!can.view && receivingCan.view) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
        {notAvailable}
        <ReceivingView
          data={d}
          month={month}
          today={today}
          canRecord={(receivingCan.create || receivingCan.update) && store.isAvailable}
          onMonthChange={(m) => setParam({ month: m === today.slice(0, 7) ? "" : m }, true)}
          onRecord={(r) => setQtyTarget({ receipt: r })}
        />
        {quantityDialog}
      </div>
    );
  }

  if (!can.view) {
    return <EmptyState icon={FolderLock} title="Chưa được cấp quyền Nhập khẩu" description="Hỏi quản trị viên cấp quyền Kế hoạch · Nhập khẩu (Nhân viên / Trưởng / Phó phòng Kế hoạch)." />;
  }

  const canWrite = store.isAvailable;
  const dossierCan = {
    create: can.create && canWrite,
    update: can.update && canWrite,
    delete: can.delete && canWrite,
    viewPrice: can["view-price"],
    receiving: (receivingCan.create || receivingCan.update) && canWrite,
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      {notAvailable}
      {!hasImportStorage && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
          Đang chạy không nối máy chủ: chưa đính được file chứng từ — số chứng từ hoặc ghi chú được tính thay file.
        </p>
      )}
      {contract ? (
        <ImportDossier
          data={d}
          contract={contract}
          focusReceiptId={focusReceiptId}
          can={dossierCan}
          actions={{
            onBack: () => setParam({ contract: "", receipt: "" }),
            onEditContract: () => setContractForm({ mode: "edit", contract }),
            onAddReceipt: () => setReceiptForm({ contract }),
            onEditReceipt: (r) => setReceiptForm({ contract, existing: r }),
            onCancelReceipt: (r) =>
              setReason({
                title: "Hủy lần nhập này?",
                description: "Lần nhập đã hủy không tính vào tháng và số đã về. Khôi phục được khi hợp đồng còn mở.",
                confirmLabel: "Hủy lần nhập",
                destructive: true,
                onConfirm: (why) => setReceiptStatus(r, "cancelled", why),
              }),
            onRestoreReceipt: (r) => setReceiptStatus(r, "open", ""),
            onDeleteReceipt: setDeletingReceipt,
            onEditDocument: (r, doc) => setDocTarget({ receipt: r, contract, existing: doc }),
            onDeleteDocument: deleteDocument,
            onRemoveFile: removeFile,
            onRecordQuantity: (r) => setQtyTarget({ receipt: r }),
            onClose: () => openClose(contract),
            onReopen: () => setContractStatus(contract, { status: "open", closeReason: "" }, `Đã mở lại HĐ nhập ${contract.contractNo}`),
            onCancelContract: () =>
              setReason({
                title: `Hủy HĐ nhập ${contract.contractNo}?`,
                description: "Mọi lần nhập của hợp đồng hủy theo, cùng lý do. Dữ liệu vẫn giữ để tra.",
                confirmLabel: "Hủy hợp đồng",
                destructive: true,
                onConfirm: (why) => setContractStatus(contract, { status: "cancelled", cancelReason: why }, `Đã hủy HĐ nhập ${contract.contractNo}`, true),
              }),
            onDeleteContract: () => setDeletingContract(contract),
            onPreview: setPreview,
            onImportSamples: (r) => setSampleTarget({ receipt: r }),
            onEditSample: (r, s) => setSampleTarget({ receipt: r, edit: s }),
            onDeleteSample: setDeletingSample,
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid min-w-0 flex-1 basis-64 grid-cols-[minmax(0,1fr)] gap-3">
              <p className="max-w-3xl text-muted-foreground">Hợp đồng nhập, chứng từ từng lô hàng về và số lượng thực nhập. Khác Nhập hàng nguyên liệu trong nước.</p>
              <Tabs value={view} onValueChange={(v) => setParam({ view: v === "contracts" ? v : "" }, true)}>
                <TabsList data-tour="import-tabs" className="grid w-full grid-cols-2 items-stretch group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit">
                  <TabsTrigger value="month" className={TAB_TRIGGER} title="Lô nhập của tháng, gom theo đối tác, kèm chứng từ còn thiếu.">
                    <Ship className="mr-2 h-4 w-4" aria-hidden />
                    Lô nhập
                  </TabsTrigger>
                  <TabsTrigger value="contracts" className={TAB_TRIGGER} title="Danh sách mọi hợp đồng nhập, lọc theo trạng thái.">
                    <FileText className="mr-2 h-4 w-4" aria-hidden />
                    Hợp đồng
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pageTour.available && (
                <Button variant="outline" data-tour-start onClick={pageTour.start} title="Mở hướng dẫn thao tác: lần lượt chỉ từng khu vực trên trang theo thứ tự công việc. Hướng dẫn không thay đổi dữ liệu.">
                  <Route className="mr-2 h-4 w-4" aria-hidden />
                  Hướng dẫn thao tác
                </Button>
              )}
              {can.create && canWrite && (
                <Button data-tour="create-import-contract" onClick={() => setContractForm({ mode: "create" })} title="Lập hợp đồng nhập mới: đối tác, số HĐ, loại hình, dòng hàng (tên, kg, đơn giá).">
                  <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
                  Lập hợp đồng nhập
                </Button>
              )}
            </div>
          </div>
          {store.isLoading ? (
            <TableSkeleton />
          ) : store.loadError ? (
            <EmptyState icon={Ship} title="Chưa đọc được số Nhập khẩu" description={`Lỗi đồng bộ với máy chủ: ${store.loadError}. Kiểm đèn kết nối rồi tải lại trang.`} />
          ) : view === "contracts" ? (
            <ImportContractList data={d} canSeePrice={can["view-price"]} onOpen={(cid) => setParam({ contract: cid, receipt: "" })} />
          ) : (
            <ImportMonthView
              data={d}
              month={month}
              today={today}
              onMonthChange={(m) => setParam({ month: m === today.slice(0, 7) ? "" : m }, true)}
              onOpen={(cid, rid) => setParam({ contract: cid, receipt: rid ?? "" })}
            />
          )}
        </>
      )}

      <ContractFormDialog
        target={contractForm}
        data={d}
        suppliers={supplierStore.suppliers}
        setSuppliers={(rows) => {
          if (!supplierStore.isAvailable) {
            notify.error("Máy chủ chưa chạy migration 0083 — chưa thêm / sửa NCC nhập khẩu được. Báo chủ dự án.");
            return;
          }
          supplierStore.setSuppliers(rows);
        }}
        products={products}
        setProducts={setProducts}
        recordedBy={recordedBy}
        onClose={() => setContractForm(null)}
        onSave={saveContract}
      />
      <ReceiptFormDialog target={receiptForm} contracts={d.contracts} onClose={() => setReceiptForm(null)} onSave={saveReceipt} />
      <DocumentDialog
        target={docTarget}
        existingFileCount={docTarget?.existing ? d.files.filter((f) => f.documentId === docTarget.existing?.id).length : 0}
        recordedBy={recordedBy}
        onClose={() => setDocTarget(null)}
        onSave={saveDocument}
      />
      {quantityDialog}
      <CloseContractDialog target={closeTarget} onClose={() => setCloseTarget(null)} />
      <ReasonDialog target={reason} onClose={() => setReason(null)} />
      <ImportFilePreview file={preview} onClose={() => setPreview(null)} />
      <SampleCheckDialog
        target={sampleTarget}
        data={d}
        supplierNames={(cid) => {
          const c = d.contracts.find((x) => x.id === cid);
          const s = supplierStore.suppliers.find((x) => x.id === c?.supplierId);
          return [c?.supplierName ?? "", s?.shortName ?? "", s?.fullName ?? ""].filter(Boolean);
        }}
        recordedBy={recordedBy}
        onClose={() => setSampleTarget(null)}
        onSave={saveSamples}
      />
      <ConfirmDelete
        open={!!deletingSample}
        onOpenChange={(o) => !o && setDeletingSample(null)}
        title="Xóa mẫu kiểm này?"
        confirmLabel="Xóa mẫu"
        recordDescription={deletingSample ? [`Mẫu ${deletingSample.sampleNo}`, deletingSample.size, deletingSample.exporterName].filter(Boolean).join(" · ") : ""}
        onConfirm={() => {
          if (deletingSample) doDeleteSample(deletingSample);
          setDeletingSample(null);
        }}
      />
      <ConfirmDelete
        open={!!deletingContract}
        onOpenChange={(o) => !o && setDeletingContract(null)}
        title="Xóa hợp đồng nhập này?"
        confirmLabel="Xóa hợp đồng"
        recordDescription={deletingContract ? `HĐ ${deletingContract.contractNo} — ${deletingContract.supplierName}` : ""}
        onConfirm={() => {
          if (deletingContract) doDeleteContract(deletingContract);
          setDeletingContract(null);
        }}
      />
      <ConfirmDelete
        open={!!deletingReceipt}
        onOpenChange={(o) => !o && setDeletingReceipt(null)}
        title="Xóa lần nhập này?"
        confirmLabel="Xóa lần nhập"
        recordDescription={deletingReceipt ? [deletingReceipt.containerNo && `Cont ${deletingReceipt.containerNo}`, `HĐ ${deletingReceipt.contractNo}`].filter(Boolean).join(" · ") : ""}
        onConfirm={() => {
          if (deletingReceipt) doDeleteReceipt(deletingReceipt);
          setDeletingReceipt(null);
        }}
      />
    </div>
  );
}
