// ============================================================
// Tên file cũ: src/features/balancing/CanDoi.tsx
// Tên tiếng Việt: Màn hình Cân đối kỳ sản xuất 5 ngày
// Description: Balancing Period Management Screen
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type {
  BalancingPeriod,
  SalesItem,
  Product,
  Customer,
  SalesInvoice,
} from "@/types";
import { uid } from "@/lib/db";
import {
  useSalesItems,
  useCustomers,
  useBalancingPeriods,
  useMaterialTypes,
  useProducts,
  useBalancingInputs,
  useScraps,
  useSalesInvoices,
  useBalancingOutputs,
  useMaterialImports,
  useMonthlyStock,
  useWipProductions,
  isServerConnected,
} from "@/lib/catalogRepo";
import { useFormDraft } from "@/lib/formDraft";
import { useAuth } from "@/lib/auth";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { syncMonthlyStockLedger } from "@/lib/balancingStockLines";
import { readDevicePref, writeDevicePref } from "@/lib/devicePrefs";
import { usePeriodGrid } from "./usePeriodGrid";
import { MaterialGrid } from "./MaterialGrid";
import { findUnpricedMaterialRows, getMaterialFamily, isEmptyPulledSalesOutput, salesItemToOutput } from "@/lib/balancingGrid";
import type { BalancingResult } from "@/lib/balancingCalc";
import { WipGrid } from "./WipGrid";
import {
  RequiredLegend,
  Button,
  Card,
  Combobox,
  ConfirmDelete,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  NumberField,
  RecordTable,
  TableSkeleton,
  dateToIso,
  notify,
  type RecordTableColumn,
  type FieldError,
  ReadOnlyBadge,
} from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useCan } from "@/features/shared/PermissionProvider";
import { num, formatDateVN } from "@/lib/format";
import {
  ChevronLeft,
  Columns2,
  FileText,
  Pencil,
  Plus,
  Redo2,
  Rows3,
  Scale,
  Lock,
  LockOpen,
  ArrowRightLeft,
  ArrowDownToLine,
  Undo2,
} from "lucide-react";
import { PeriodLockDialog } from "./gridDialogs";
import BalancingTable from "./BalancingTable";
import { usePageTour } from "@/features/shared/PageTourProvider";
import { buildBalancingTour, pickTourPeriod } from "./balancingTour";
import { recordName } from "@/lib/personName";

/** Chuỗi ngày để in trên bảng, sinh từ khoảng ngày đã chọn. */
function describeRange(fromDate?: string, toDate?: string): string {
  if (!fromDate) return "";
  if (!toDate || toDate === fromDate) return formatDateVN(fromDate);
  return `${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`;
}

export default function BalancingScreen() {
  /* Phân quyền lớp 2 (spec role-permissions §5): ẩn nút không có quyền, không làm mờ. */
  const allowed = useCan("balancing");
  const [periods, persistPeriods, { status: periodStatus }] = useBalancingPeriods();
  const isLoadingPeriods = periodStatus === "loading" && periods.length === 0;
  const { periodId } = useParams<{ periodId?: string }>();
  const navigate = useNavigate();
  const selId = periodId || null;
  const setSelId = (id: string | null) => {
    if (id) {
      navigate(`/balancing/${id}`);
    } else {
      navigate("/balancing");
    }
  };
  const [catalogMaterialTypes, setCatalogMaterialTypes] = useMaterialTypes();

  /* Hướng dẫn thao tác (ba-spec 43): kỳ minh họa chọn từ kỳ đang có; bước chỉ đổi đường dẫn
     (replace, đường dẫn tuyệt đối) giữa danh sách ⇄ một kỳ — không ghi gì (R1). Thoát thì
     PageTourProvider trả về chỗ cũ (R5). */
  const tourPick = useMemo(() => pickTourPeriod(periods, selId), [periods, selId]);
  const tour = useMemo(
    () =>
      buildBalancingTour({
        pick: tourPick,
        can: { create: allowed.create, update: allowed.update, lock: allowed.lock || allowed.unlock },
        toList: () => navigate("/balancing", { replace: true }),
        openPeriod: (id) => navigate(`/balancing/${id}`, { replace: true }),
      }),
    [tourPick, allowed.create, allowed.update, allowed.lock, allowed.unlock, navigate],
  );
  usePageTour(isLoadingPeriods ? null : tour);

  /* Xóa kỳ phải xóa luôn dòng con của nó (NL vào / phế liệu / TP ra), nếu không
     các dòng này mồ côi trong kho — chiếm chỗ, sai tổng khi thống kê sau này. */
  const [allMaterialRows, writeMaterials] = useBalancingInputs();
  const [allScraps, writeScraps] = useScraps();
  const [allOutputs, writeFinishedGoods] = useBalancingOutputs();
  /* Hai sổ nguồn: kỳ chỉ MƯỢN dòng của chúng bằng `balancingPeriodId`. */
  const [allImports, writeImports] = useMaterialImports();
  const [allWips, writeProductions] = useWipProductions();
  /* Sổ kho tháng: dòng Lấy xả đông / Gửi đông của kỳ đã ghi thẳng vào đây. */
  const [monthlyStock, writeStockLedger] = useMonthlyStock();

  /** Gõ loại mới trong ô chọn → LƯU LUÔN vào danh mục (rule 7), không để mồ côi. */
  const addMaterialType = (name: string) => {
    setCatalogMaterialTypes([...catalogMaterialTypes, { id: uid(), name, category: "", note: "" }]);
    notify.saved(`Đã thêm loại nguyên liệu "${name}" vào danh mục`);
    return name;
  };
  /** Bút chì sửa nhanh loại NL (value là TÊN; mục gộp họ không trùng tên danh mục thì không có bút chì). */
  const materialTypeEditor = useQuickCatalogEdit("materialType", catalogMaterialTypes, setCatalogMaterialTypes, { matchBy: "name" });

  /* Chọn loại NL cho kỳ: GỘP biến thể size về HỌ — "Bạch tuộc 2 da lớn (80↑)" +
     "… nhỏ (80↓)" chỉ hiện MỘT mục "Bạch tuộc 2 da" (cân đối không tách size, chốt
     với chủ dự án). Tên không có mốc 80↑/↓ giữ nguyên. Value = tên họ nên chọn xong
     ô hiển thị đúng và lưu thẳng tên họ. Danh mục gốc (sổ nhập) vẫn giữ đủ size. */
  const materialTypeOptions = useMemo(() => {
    const existing = new Set<string>();
    const result: { value: string; label: string; subLabel?: string }[] = [];
    for (const l of catalogMaterialTypes) {
      const family = getMaterialFamily(l.name) || l.name;
      const key = family.toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      result.push({ value: family, label: family, subLabel: l.category || undefined });
    }
    return result;
  }, [catalogMaterialTypes]);

  const [editing, setEditing] = useState<BalancingPeriod | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  /** Hộp kỳ bị đóng ngang (bấm ra ngoài / Esc) ⇒ giữ số đang gõ làm nháp (quy tắc 17). */
  const [keptEditing, setKeptEditing] = useState<{ editing: BalancingPeriod; isAdding: boolean } | null>(null);

  /* Tự lưu NHÁP hộp Tạo / Sửa kỳ (quy tắc 17, lib/formDraft.ts). Lưới số của kỳ vốn ghi
     thẳng vào sổ theo từng phím nên không cần nháp; ô Ghi chú tự lưu khi rời trang. */
  const { profile } = useAuth();
  const draftValue = editing ? { editing, isAdding } : keptEditing;
  const periodDraft = useFormDraft({
    form: "balancing-period",
    account: profile?.username ?? "",
    accountReady: profile !== null || !isServerConnected,
    value: draftValue,
    isEmpty: (d) => {
      if (!d) return true;
      if (d.isAdding)
        return !d.editing.materialTypeName.trim() && d.editing.totalInputKg == null && d.editing.processingCostPerKg == null;
      const stored = periods.find((k) => k.id === d.editing.id);
      return !stored || JSON.stringify(stored) === JSON.stringify(d.editing);
    },
    onRestore: (d) => {
      if (!d) return;
      setEditing(d.editing);
      setIsAdding(d.isAdding);
      setErrors([]);
    },
  });
  const cancelPeriodDialog = () => {
    setEditing(null);
    setKeptEditing(null);
    periodDraft.discard();
  };

  const openAdd = () => {
    if (keptEditing?.isAdding) {
      setEditing(keptEditing.editing);
      setIsAdding(true);
      setKeptEditing(null);
      setErrors([]);
      return;
    }
    const today = dateToIso(new Date());
    setEditing({
      id: uid(),
      materialTypeName: "",
      dateRangeDescription: "",
      startDate: today,
      endDate: today,
      totalInputKg: null,
      exchangeRate: 26000,
      processingCostPerKg: null,
      createdAt: new Date().toISOString(),
    });
    setIsAdding(true);
    setErrors([]);
  };

  const savePeriod = () => {
    if (!editing) return;
    const ls: FieldError[] = [];
    if (!editing.materialTypeName.trim())
      ls.push({ field: "Loại nguyên liệu", message: "Chưa chọn loại" });
    if (!editing.startDate)
      ls.push({ field: "Ngày tiếp nhận", message: "Chưa chọn ngày" });
    setErrors(ls);
    if (ls.length > 0) return;

    const draft: BalancingPeriod = {
      ...editing,
      // QUY TẮC: kỳ dùng tên HỌ nguyên liệu — "Bạch tuộc 2 da lớn (80↑)" và
      // "… nhỏ (80↓)" đều là "Bạch tuộc 2 da", một kỳ gộp cả hai size. Chuẩn hoá
      // ở đây để dù chọn biến thể size nào, tên kỳ vẫn là họ (khớp cách hút theo
      // họ ở filterEligibleImports/findPreviousPeriod). Tên khác (không có mốc 80↑/↓) giữ nguyên.
      materialTypeName: getMaterialFamily(editing.materialTypeName.trim()),
      dateRangeDescription: describeRange(editing.startDate, editing.endDate),
    };
    if (isAdding) {
      persistPeriods([draft, ...periods]);
      notify.saved(`Đã tạo kỳ cân đối "${draft.materialTypeName}"`);
      setSelId(draft.id);
    } else {
      persistPeriods(periods.map((k) => (k.id === draft.id ? draft : k)));
      notify.saved("Đã lưu thay đổi");
    }
    setEditing(null);
    setKeptEditing(null);
  };

  const deletePeriod = (k: BalancingPeriod) => {
    const prevPeriods = periods;
    const prevMaterials = allMaterialRows;
    const prevScrap = allScraps;
    const prevFinishedGoods = allOutputs;
    const prevImports = allImports;
    const prevProduction = allWips;
    const prevStock = monthlyStock;
    /* Trả lại Sổ kho tháng phần kỳ này đã lấy xả đông (cột xuất của lô) / gửi đông (lô
       gửi theo ngày) — xoá kỳ mà để nguyên thì tồn kho lệch vĩnh viễn. */
    const stockSyncResult = syncMonthlyStockLedger(
      monthlyStock,
      allMaterialRows.filter((r) => r.periodId === k.id),
      [],
      {
        periodLabel: `${k.materialTypeName} ${k.dateRangeDescription ?? ""}`.trim(),
        materialFamily: getMaterialFamily(k.materialTypeName),
      }
    );
    if (stockSyncResult.changed) writeStockLedger(stockSyncResult.lines);
    persistPeriods(periods.filter((x) => x.id !== k.id));
    writeMaterials(allMaterialRows.filter((r) => r.periodId !== k.id));
    /* Phế liệu cân ở màn Nhập hàng chỉ MƯỢN kỳ này — xóa kỳ thì gỡ liên kết,
       tuyệt đối không xóa theo, vì bản gốc là số cân của sổ nhập hàng. */
    writeScraps(
      allScraps
        .filter((r) => r.periodId !== k.id || r.source === "Nhập hàng")
        .map((r) =>
          r.periodId === k.id && r.source === "Nhập hàng" ? { ...r, periodId: "" } : r
        )
    );
    writeFinishedGoods(allOutputs.filter((r) => r.periodId !== k.id));
    /* Sổ nhập hàng và sổ sản xuất cũng chỉ MƯỢN kỳ này: xóa kỳ phải NHẢ dòng
       ra, không thì chúng còn ghim vào một kỳ đã chết — mọi kỳ sau lọc theo
       "chưa gắn kỳ nào" sẽ không thấy chúng nữa và số liệu biến mất khỏi cân
       đối vĩnh viễn (dù sổ gốc vẫn còn nguyên). */
    writeImports(
      allImports.map((r) =>
        r.balancingPeriodId === k.id ? { ...r, balancingPeriodId: "" } : r
      )
    );
    writeProductions(
      allWips.map((r) =>
        r.balancingPeriodId === k.id ? { ...r, balancingPeriodId: "" } : r
      )
    );
    notify.deleted(
      `Đã xóa kỳ "${k.materialTypeName}" — số ở sổ nhập hàng và sổ sản xuất vẫn còn`,
      () => {
        persistPeriods(prevPeriods);
        writeMaterials(prevMaterials);
        writeScraps(prevScrap);
        writeFinishedGoods(prevFinishedGoods);
        writeImports(prevImports);
        writeProductions(prevProduction);
        if (stockSyncResult.changed) writeStockLedger(prevStock);
      }
    );
  };

  const sel = periods.find((k) => k.id === selId) || null;

  if (sel) {
    return (
      <PeriodDetail
        period={sel}
        editorName={recordName(profile)}
        onBack={() => setSelId(null)}
        onChangePeriod={(patch) =>
          persistPeriods(periods.map((k) => (k.id === sel.id ? { ...k, ...patch } : k)))
        }
      />
    );
  }

  const cols: RecordTableColumn<BalancingPeriod>[] = [
    {
      key: "loaiNL",
      header: "Loại nguyên liệu",
      primary: true,
      render: (r) => r.materialTypeName,
      getSortValue: (r) => r.materialTypeName,
    },
    {
      key: "ngay",
      header: "Ngày tiếp nhận",
      render: (r) =>
        r.dateRangeDescription || <span className="text-muted-foreground">Chưa ghi</span>,
      getSortValue: (r) => r.startDate ?? "",
    },
    {
      key: "tongNLNhan",
      header: "Tổng NL nhận (kg)",
      numeric: true,
      hideOnMobile: true,
      render: (r) =>
        r.totalInputKg != null ? (
          num(r.totalInputKg)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      getSortValue: (r) => r.totalInputKg ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">
            Cân đối nguyên liệu
          </h1>
          {!allowed.create && !allowed.update && <ReadOnlyBadge />}
        </div>
        {allowed.create && (
          <Button
            data-tour="balancing-create-period"
            title="Mở một kỳ cân đối mới (thường ~5 ngày một lô): khai khoảng ngày rồi hút số liệu nhập · sản xuất · bán vào." size="lg" onClick={openAdd}>
            <Plus />
            Tạo kỳ cân đối
          </Button>
        )}
      </div>

      {isLoadingPeriods ? (
        <TableSkeleton />
      ) : periods.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Chưa có kỳ cân đối nào"
          description="Tạo kỳ đầu tiên: chọn loại nguyên liệu và khoảng ngày tiếp nhận."
          action={
            allowed.create ? (
              <Button
                title="Mở kỳ cân đối đầu tiên." size="lg" onClick={openAdd}>
                <Plus />
                Tạo kỳ cân đối
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div data-tour="balancing-period-list">
        <RecordTable
          columns={cols}
          rows={periods}
          getKey={(r) => r.id}
          rowMarkKey="can-doi-ky"
          getSearchText={(r) => `${r.materialTypeName} ${r.dateRangeDescription}`}
          searchLabel="Tìm kỳ theo loại nguyên liệu…"
          actions={(r) => (
            <>
              <Button
                data-tour="balancing-open-period"
                title="Mở lưới cân đối của kỳ này để nhập số và xem định mức, lãi lỗ." size="sm" onClick={() => setSelId(r.id)}>
                Mở kỳ
              </Button>
              {allowed.update && (
                <Button
                  title="Sửa thông tin kỳ (tên kỳ, khoảng ngày, loại nguyên liệu)."
                  variant="edit"
                  size="sm"
                  onClick={() => {
                    setEditing({ ...r });
                    setIsAdding(false);
                    setErrors([]);
                  }}
                >
                  <Pencil />
                  Sửa
                </Button>
              )}
              {allowed.delete && (
                <ConfirmDelete
                  recordDescription={`Kỳ "${r.materialTypeName}" — ${r.dateRangeDescription || "chưa ghi ngày"}`}
                  onConfirm={() => deletePeriod(r)}
                  title="Xóa kỳ cân đối này?"
                  confirmLabel="Xóa kỳ"
                />
              )}
            </>
          )}
        />
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          // Đóng ngang ⇒ giữ số đang gõ làm nháp; chỉ Hủy / Lưu mới bỏ.
          if (!o) {
            if (editing) setKeptEditing({ editing, isAdding });
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto w-full sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {isAdding ? "Tạo kỳ cân đối" : "Sửa kỳ cân đối"}
            </DialogTitle>
          </DialogHeader>
          <DraftRestoredNotice savedAt={periodDraft.restoredAt} onDiscard={cancelPeriodDialog} />

          {editing && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={errors} />
              <RequiredLegend />

              <Combobox
                label="Loại nguyên liệu"
                required
                hint="Lô đem cân đối. Lớn/nhỏ (80↑/80↓) gộp chung — kỳ tự dùng tên họ, VD: Bạch tuộc 2 da."
                value={editing.materialTypeName}
                onChange={(v) =>
                  setEditing((d) => {
                    if (!d) return d;
                    // optLoaiNL đã gộp về HỌ nên `v` là tên họ (VD "Bạch tuộc 2 da")
                    // — vừa hiển thị đúng, vừa lưu thẳng. luuKy vẫn chuẩn hoá lần nữa
                    // (phòng khi gõ tay tên có size).
                    const next = { ...d, materialTypeName: v };
                    // Prefill chi phí chế biến + tỉ giá từ kỳ gần nhất CÙNG HỌ
                    // NL, chỉ khi chi phí còn trống (chưa gõ) — khỏi gõ lại mỗi
                    // kỳ, vẫn sửa được. kyList mới-nhất-trước nên find lấy kỳ gần.
                    if (d.processingCostPerKg == null) {
                      const family = getMaterialFamily(v);
                      const prevRows = periods.find(
                        (k) => getMaterialFamily(k.materialTypeName) === family
                      );
                      if (prevRows) {
                        next.processingCostPerKg = prevRows.processingCostPerKg;
                        if (prevRows.exchangeRate) next.exchangeRate = prevRows.exchangeRate;
                      }
                    }
                    return next;
                  })
                }
                options={materialTypeOptions}
                onCreate={materialTypeEditor.canCreate ? addMaterialType : undefined}
                onEditItem={materialTypeEditor.openEdit}
                editLabel={materialTypeEditor.editLabel}
                canEdit={materialTypeEditor.canEdit}
              />

              <DateRangeField
                label="Ngày tiếp nhận"
                required
                hint="Kỳ xưởng Đông thường 5 ngày — có nút chọn nhanh bên dưới."
                startDate={editing.startDate ?? ""}
                endDate={editing.endDate ?? ""}
                onChange={(fromDate, toDate) =>
                  setEditing((d) => (d ? { ...d, startDate: fromDate, endDate: toDate } : d))
                }
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Tổng NL nhận cả kỳ"
                  unit="kg"
                  value={editing.totalInputKg}
                  onChange={(v) =>
                    setEditing((d) => (d ? { ...d, totalInputKg: v } : d))
                  }
                  hint="Lấy từ bảng phụ — để tính tỉ lệ thu hồi."
                />
                {/* Chi phí chế biến + tỉ giá là số tiền ⇒ ẩn khi không có quyền xem giá. */}
                {allowed["view-price"] && (
                  <NumberField
                    label="Chi phí chế biến / kg TP"
                    unit="đ"
                    value={editing.processingCostPerKg}
                    onChange={(v) =>
                      setEditing((d) => (d ? { ...d, processingCostPerKg: v } : d))
                    }
                  />
                )}
                {allowed["view-price"] && (
                  <NumberField
                    label="Tỉ giá"
                    unit="đ/USD"
                    value={editing.exchangeRate}
                    onChange={(v) => setEditing((d) => (d ? { ...d, exchangeRate: v } : d))}
                  />
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={cancelPeriodDialog}>
              Hủy
            </Button>
            <Button variant="save"
              title="Ghi kỳ cân đối này vào sổ." size="lg" onClick={savePeriod}>
              {isAdding ? "Tạo kỳ" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {materialTypeEditor.dialog}
    </div>
  );
}

/* ---------- Chi tiết một kỳ ---------- */

/**
 * Một kỳ cân đối = MỘT tờ: thông số kỳ · lưới nguyên liệu · lưới bán thành phẩm
 * · kết quả. Toàn bộ dữ liệu và thao tác nằm ở `usePeriodGrid`; chỗ này chỉ xếp
 * chỗ và nối danh mục.
 */
function PeriodDetail({
  period,
  editorName,
  onBack,
  onChangePeriod,
}: {
  period: BalancingPeriod;
  /** Tên người đang dùng — ghi vào dòng vết khi sửa chuyến nhập từ Cân đối. */
  editorName: string;
  onBack: () => void;
  onChangePeriod: (patch: Partial<BalancingPeriod>) => void;
}) {
  const grid = usePeriodGrid(period);
  const allowed = useCan("balancing");
  const [products, setProducts] = useProducts();
  const [customers, setCustomers] = useCustomers();
  /** Bút chì sửa nhanh mặt hàng / khách trong lưới bán thành phẩm (nối theo id). */
  const productEditor = useQuickCatalogEdit("product", products, setProducts);
  const customerEditor = useQuickCatalogEdit("customer", customers, setCustomers);
  const [catalogMaterialTypes, setCatalogMaterialTypes] = useMaterialTypes();
  /** Bút chì loại NL ở hộp thêm dòng khối 1 (theo TÊN) — instance danh mục của KyDetail. */
  const periodMaterialTypeEditor = useQuickCatalogEdit("materialType", catalogMaterialTypes, setCatalogMaterialTypes, { matchBy: "name" });
  const [showBang, setShowBang] = useState(false);
  /* Công tắc cột ngày RIÊNG từng khối — cả hai MẶC ĐỊNH MỞ (chốt 2026-10-06: kế
     toán đối chiếu theo ngày). Thu lại thì khối NL gõ thẳng Số lượng như bảng giấy. */
  const [hideMaterialDays, setHideMaterialDays] = useState(false);
  const [hideFinishedGoodDays, setHideFinishedGoodDays] = useState(false);
  /* Bố cục theo file cân đối của kế toán (2026-10-19): bảng chính A–L (Nguyên liệu ·
     Xuất khẩu · Ghi chú) LUÔN đứng cạnh nhau; nút Xếp ngang / Xếp dọc chỉ đổi chỗ phần GHI
     TỪNG NGÀY: bên phải (như cột M–W) hay bên dưới. MẶC ĐỊNH XẾP DỌC (người dùng chốt
     2026-10-19); nhớ lựa chọn theo máy. */
  const [isHorizontal, setIsHorizontal] = useState(() => readDevicePref(LAYOUT_PREF_KEY) === "horizontal");
  const toggleLayout = () => {
    writeDevicePref(LAYOUT_PREF_KEY, isHorizontal ? "vertical" : "horizontal");
    setIsHorizontal(!isHorizontal);
  };
  /* Chỗ hai lưới vẽ bảng "theo ngày" vào (createPortal) — cùng một lưới, chỉ khác chỗ đặt. */
  const [materialDaysSlot, setMaterialDaysSlot] = useState<HTMLDivElement | null>(null);
  const [finishedGoodDaysSlot, setFinishedGoodDaysSlot] = useState<HTMLDivElement | null>(null);
  const [isLockOpen, setIsLockOpen] = useState(false);

  /* Ctrl+Z / Ctrl+Y — nghe ở cấp màn, bỏ qua khi con trỏ đang trong hộp thoại. */
  useEffect(() => {
    const nghe = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        grid.undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        grid.redo();
      }
    };
    window.addEventListener("keydown", nghe);
    return () => window.removeEventListener("keydown", nghe);
  }, [grid]);

  /* Sổ bán — seam cũ cho tình huống output = hàng đã bán ra. */
  const [allSalesItems] = useSalesItems();
  const [salesInvoices] = useSalesInvoices();
  const banChoHut = useMemo(() => {
    const salesInvoiceById = new Map(salesInvoices.map((p) => [p.id, p]));
    // Dòng hút hỏng (không có kg — lỗi cũ trước 2026-10-16) KHÔNG tính là đã hút ⇒ hút lại được.
    const daHut = new Set(grid.outputs.filter((t) => !isEmptyPulledSalesOutput(t)).map((t) => t.salesItemId).filter(Boolean));
    return allSalesItems
      .filter((b) => {
        const p = salesInvoiceById.get(b.invoiceId);
        if (!p || daHut.has(b.id)) return false;
        return (
          !period.startDate ||
          !period.endDate ||
          (p.deliveryDate >= period.startDate && p.deliveryDate <= period.endDate)
        );
      })
      .map((b) => ({ salesItem: b, invoice: salesInvoiceById.get(b.invoiceId)! }));
  }, [allSalesItems, salesInvoices, grid.outputs, period.startDate, period.endDate]);

  const pullSalesIntoPeriod = (items: { salesItem: SalesItem; invoice: SalesInvoice }[]) => {
    const repulled = new Set(items.map(({ salesItem }) => salesItem.id));
    grid.saveOutputs([
      // Bỏ dòng hút hỏng của chính các dòng bán đang hút lại — kẻo một dòng bán hai dòng kỳ.
      ...grid.outputs.filter((t) => !(isEmptyPulledSalesOutput(t) && repulled.has(t.salesItemId ?? ""))),
      ...items.map(({ salesItem, invoice }) => salesItemToOutput(salesItem, invoice, period, uid())),
    ]);
    notify.saved(`Đã hút ${items.length} dòng bán vào kỳ này`);
  };

  const { result } = grid;
  /** Chưa có bán thành phẩm → định mức + lãi/lỗ chưa có nghĩa. */
  const hasNoFinishedGood = result.totalOutputKg <= 0;
  /** Lệch giữa Tổng NL nhận (thông số kỳ) và Tổng NL vào lưới (khối 1) — hiện
   *  sẵn để khỏi nhẩm tay khi đối chiếu. */
  const materialDiff = period.totalInputKg != null ? period.totalInputKg - result.totalInputKg : null;
  /** Số dòng sổ SẢN XUẤT còn chờ hút vào kỳ (sổ nhập tự lấy theo khoảng ngày, 2026-10-20). */
  const pendingSourceCount = grid.pendingWips.length;

  return (
    <div className="space-y-6">
      <Button
        title="Quay về danh sách các kỳ cân đối." variant="ghost" size="lg" onClick={onBack}>
        <ChevronLeft />
        Danh sách kỳ
      </Button>

      <div data-tour="balancing-period-header" className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">Bảng cân đối {period.materialTypeName}</h1>
            {grid.isReadOnly && <ReadOnlyBadge />}
          </div>
          <p className="mt-1 text-base text-muted-foreground">
            {period.dateRangeDescription || "Chưa ghi ngày tiếp nhận"}
            {period.isLocked && " · đã chốt"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Một chạm kéo cả hai sổ nguồn tự động (nhập + sản xuất) vào kỳ. Không gộp sổ bán. */}
          {!grid.isLocked && pendingSourceCount > 0 && (
            <Button
              title={`Hút ${grid.pendingWips.length} dòng sổ sản xuất trong khoảng ngày của kỳ vào lưới bán thành phẩm (nguyên liệu sổ nhập đã tự vào).`}
              size="lg"
              onClick={grid.pullAllSources}
            >
              <ArrowDownToLine />
              Lấy {pendingSourceCount} dòng từ sổ
            </Button>
          )}
          {/* Chỉ xem ⇒ không có gì để hoàn tác: ẩn hẳn hai nút. */}
          {!grid.isReadOnly && (
            <Button
              variant="outline"
              size="lg"
              onClick={grid.undo}
              disabled={!grid.canUndo}
              title="Ctrl+Z"
            >
              <Undo2 />
              Hoàn tác
            </Button>
          )}
          {!grid.isReadOnly && (
            <Button
              variant="outline"
              size="lg"
              onClick={grid.redo}
              disabled={!grid.canRedo}
              title="Ctrl+Y"
            >
              <Redo2 />
              Làm lại
            </Button>
          )}
          <Button
            title="Đặt phần ghi từng ngày bên phải bảng chính (Xếp ngang, như file Excel) hay bên dưới (Xếp dọc) — chỉ đổi cách nhìn, không đụng số." variant="outline" size="lg" onClick={toggleLayout}>
            {isHorizontal ? <Rows3 /> : <Columns2 />}
            {isHorizontal ? "Xếp dọc" : "Xếp ngang"}
          </Button>
          {allowed.export && (
            <Button
              data-tour="balancing-print"
              title="Xem bảng cân đối đúng khổ in A4 rồi in giấy hoặc lưu PDF." variant="outline" size="lg" onClick={() => setShowBang(true)}>
              <FileText />
              Xem / in bảng
            </Button>
          )}
        </div>
      </div>

      {/* Bố cục theo file cân đối Excel của kế toán (2026-10-19): MỘT hàng ngang bảng chính
          A–E Nguyên liệu · F–J Xuất khẩu · K–L Ghi chú (mỗi khối co theo bảng của nó) — chụp
          một màn là đủ để gửi; phần GHI TỪNG NGÀY (như cột M–W) bên phải (Xếp ngang) hoặc
          bên dưới (Xếp dọc). KHÔNG bọc khung cuộn ngang chung: khung cuộn làm hàng tên cột
          nổi của lưới hết bám — màn hẹp thì khối tự XUỐNG DÒNG, bảng dài cuộn trong khung
          riêng. Dưới xl: các khối chồng dọc, rộng hết màn. */}
      {/* items-stretch: khối trong cùng hàng cao bằng nhau ⇒ đường kẻ dọc giữa các khối chạy
          hết chiều cao (co theo nội dung thì đường kẻ dừng giữa chừng — lỗi 2026-10-19). */}
      <Card className="flex flex-row flex-wrap items-stretch gap-0 overflow-clip p-0">
        {/* Nguyên liệu vào (A–E) | Bán thành phẩm (F–J): HAI CỘT BẰNG NHAU (người dùng chốt
            2026-10-19: rộng bằng nhau cho trực quan) — lưới 2 cột `minmax(0,1fr)`, cả cặp nhận
            phần bề ngang còn dư của hàng, Ghi chú cố định bên phải. Hai khối cao bằng nhau
            (`auto-rows-fr`) ⇒ đường kẻ dọc giữa chạy hết. */}
        <div className="w-full min-w-0 xl:grid xl:w-auto xl:max-w-full xl:grow xl:basis-auto xl:auto-rows-fr xl:grid-cols-2">
        <div className="min-w-0">
          <MaterialGrid
            grid={grid}
            materialTypeCatalog={catalogMaterialTypes}
            materialTypeEdit={periodMaterialTypeEditor}
            daysCollapsed={hideMaterialDays}
            onToggleDays={() => setHideMaterialDays((v) => !v)}
            daysSlot={materialDaysSlot}
            editorName={editorName}
            onCreateMaterialType={
              periodMaterialTypeEditor.canCreate
                ? (name) => {
                    setCatalogMaterialTypes([
                      ...catalogMaterialTypes,
                      { id: uid(), name, category: "", note: "" },
                    ]);
                    notify.saved(`Đã thêm loại nguyên liệu "${name}" vào danh mục`);
                    return name;
                  }
                : undefined
            }
          />
        </div>
        <div className="min-w-0 border-t-2 border-border xl:border-t-0 xl:border-l-2">
          <WipGrid
            grid={grid}
            products={products}
            customers={customers}
            onEditProduct={productEditor.openEdit}
            onEditCustomer={customerEditor.openEdit}
            canEditProduct={productEditor.canEdit}
            canEditCustomer={customerEditor.canEdit}
            pendingSales={banChoHut}
            onPullSales={pullSalesIntoPeriod}
            daysCollapsed={hideFinishedGoodDays}
            onToggleDays={() => setHideFinishedGoodDays((v) => !v)}
            daysSlot={finishedGoodDaysSlot}
            onCreateProduct={
              productEditor.canCreate
                ? (name) => {
                    const m: Product = { id: uid(), code: "", name, finishedGoodCode: "" };
                    setProducts([...products, m]);
                    notify.saved(`Đã thêm mặt hàng "${name}" vào danh mục`);
                    return m.id;
                  }
                : undefined
            }
            onCreateCustomer={
              customerEditor.canCreate
                ? (name) => {
                    const k: Customer = { id: uid(), code: "", name, market: "" };
                    setCustomers([...customers, k]);
                    notify.saved(`Đã thêm khách hàng "${name}" vào danh mục`);
                    return k.id;
                  }
                : undefined
            }
          />
        </div>
        </div>
        {/* Ghi chú (K–L): MỘT cột dọc nhãn · số như bảng giấy, rộng cố định (người dùng chốt
            2026-10-19: không tách hai cột) — phần bề ngang dư dồn cho hai khối nhập. */}
        <div className="w-full border-t-2 border-border xl:w-56 xl:flex-none xl:border-t-0 xl:border-l-2">
          <ResultNote
            unpricedRowCount={findUnpricedMaterialRows(grid.materialRows).length}
            period={period}
            previousPeriod={grid.previousPeriod}
            result={result}
            hasNoFinishedGood={hasNoFinishedGood}
            materialDiff={materialDiff}
            isLocked={grid.isLocked}
            canViewPrice={allowed["view-price"]}
            onChangePeriod={onChangePeriod}
          />
        </div>
        {/* Phần GHI TỪNG NGÀY: hai lưới vẽ vào đây (createPortal). Xếp ngang: đứng bên phải
            khi còn ≥ 28rem, không thì tự xuống dòng; Xếp dọc: luôn một hàng riêng bên dưới. */}
        <div
          data-tour="balancing-days"
          className={`w-full min-w-0 border-t-2 border-border ${
            isHorizontal ? "xl:w-auto xl:min-w-[28rem] xl:flex-1 xl:basis-0 xl:border-t-0 xl:border-l-2" : ""
          } ${hideMaterialDays && hideFinishedGoodDays ? "hidden" : ""}`}
        >
          <div ref={setMaterialDaysSlot} />
          <div ref={setFinishedGoodDaysSlot} className="border-t-2 border-border empty:hidden" />
        </div>
      </Card>

      {/* Vòng gối đầu: phần kỳ trước đẩy sang được kéo vào đây bằng một nút, thay
          cho việc mở file kỳ cũ ra chép tay. */}
      {grid.carryOverRowCount > 0 && !grid.isLocked && (
        <Card data-tour="balancing-carry-over" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-base">
            Kỳ trước ({grid.previousPeriod?.dateRangeDescription || "…"}) có{" "}
            <strong>{grid.carryOverRowCount}</strong> dòng chuyển sang chưa nhận.
          </p>
          <Button
            title="Nhận phần tồn chuyển từ kỳ trước sang làm số đầu kỳ này." size="lg" onClick={grid.applyCarryOver}>
            <ArrowRightLeft />
            Nhận {grid.carryOverRowCount} dòng chuyển kỳ
          </Button>
        </Card>
      )}

      {/* Chốt kỳ đặt CUỐI màn — xem hết số rồi mới chốt, đúng chỗ của thanh chốt
          ngày ở sổ nhập hàng. */}
      <Card data-tour="balancing-lock" className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-lg font-semibold">
            {period.isLocked ? "Kỳ đã chốt" : "Kỳ đang mở"}
          </p>
          {period.isLocked && (
            <p className="text-base text-muted-foreground">
              Khoá lúc {period.lockedAt ? new Date(period.lockedAt).toLocaleString("vi-VN") : "—"}
              {period.lockNote ? ` · ${period.lockNote}` : ""}
            </p>
          )}
          {period.reopenReason && (
            <p className="text-base text-warning">Lần mở lại gần nhất: {period.reopenReason}</p>
          )}
        </div>
        {(period.isLocked ? allowed.unlock : allowed.lock) && (
          <Button
            data-tour="balancing-lock-action"
            title="Chốt khi đã đối chiếu xong và gửi kế toán — mọi ô trong lưới khoá lại. Kỳ đã chốt thì bấm để mở lại (phải ghi lý do)."
            variant={period.isLocked ? "edit" : "lock"}
            size="lg"
            onClick={() => setIsLockOpen(true)}
          >
            {period.isLocked ? <LockOpen /> : <Lock />}
            {period.isLocked ? "Mở lại kỳ" : "Chốt kỳ"}
          </Button>
        )}
      </Card>

      {isLockOpen && (
        <PeriodLockDialog
          isLocked={Boolean(period.isLocked)}
          periodName={`${period.materialTypeName} · ${period.dateRangeDescription}`}
          outputTotal={`${num(result.totalOutputKg)} kg bán thành phẩm`}
          onClose={() => setIsLockOpen(false)}
          onSave={(note) => {
            /* Mở lại KHÔNG xoá dấu đã chốt — chỉ hạ cờ và ghi lý do, giữ vết. */
            onChangePeriod(
              period.isLocked
                ? { isLocked: false, reopenReason: note }
                : { isLocked: true, lockedAt: new Date().toISOString(), lockNote: note }
            );
            notify.saved(period.isLocked ? "Đã mở lại kỳ" : "Đã chốt kỳ");
            setIsLockOpen(false);
          }}
        />
      )}

      {showBang && (
        <BalancingTable
          period={period}
          inputs={grid.inputs}
          outputs={grid.outputs}
          products={products}
          customers={customers}
          result={result}
          assignedImports={grid.assignedImports}
          assignedWips={grid.assignedWips}
          describeStockLine={grid.describeStockLine}
          onClose={() => setShowBang(false)}
        />
      )}
      {productEditor.dialog}
      {customerEditor.dialog}
      {periodMaterialTypeEditor.dialog}
    </div>
  );
}

/**
 * Ô "GHI CHÚ" của file cân đối kế toán (cột K–L): đúng thứ tự kế toán đọc — Tổng thành
 * phẩm · Định mức chế biến · Chi phí CB/kg TP · Giá thành · Giá trị xuất · Lãi/Lỗ ·
 * Bình quân/kg NL · tỉ giá; phần phụ: NL vào · giá trị NL · NL nhận · thu hồi.
 *
 * Số ĐẦU VÀO của kỳ (chi phí CB, tỉ giá, NL nhận) sửa NGAY TẠI CHỖ hiển thị — bỏ thẻ
 * "Thông số kỳ" riêng (trước đây một chỗ sửa, một chỗ xem). Ô sửa được trông như ô
 * nhập; khác kỳ trước cùng họ NL thì ghi "kỳ trước …" để biết số đã đổi.
 */
/** Cài đặt theo máy: phần ghi từng ngày của Cân đối bên phải ("horizontal") hay bên dưới ("vertical"). */
const LAYOUT_PREF_KEY = "bsf.balancing-layout.v1";

function ResultNote({
  unpricedRowCount,
  period,
  previousPeriod,
  result,
  hasNoFinishedGood,
  materialDiff,
  isLocked,
  canViewPrice,
  onChangePeriod,
}: {
  /** Số dòng NL có kg mà chưa có đơn giá ⇒ giá thành / lãi lỗ đang tính thiếu. */
  unpricedRowCount: number;
  period: BalancingPeriod;
  previousPeriod: BalancingPeriod | null;
  result: BalancingResult;
  hasNoFinishedGood: boolean;
  materialDiff: number | null;
  isLocked: boolean;
  /** Quyền `balancing.view-price` — không có ⇒ ẩn mọi dòng tiền (kg + định mức vẫn hiện). */
  canViewPrice: boolean;
  onChangePeriod: (patch: Partial<BalancingPeriod>) => void;
}) {
  const isProfit = result.profitOrLoss >= 0;
  return (
    <section
      data-tour="balancing-result"
      className="p-5 xl:p-3"
      aria-label="Ghi chú — kết quả cân đối"
    >
      <h2 className="mb-2 text-xl font-semibold">Ghi chú</h2>
      {/* MỘT cột dọc ở mọi cỡ màn (người dùng chốt 2026-10-19) — đúng cột K–L bảng giấy: nhãn
          sát số, đọc một mạch từ Tổng thành phẩm xuống tỉ giá. */}
      <div className="grid grid-cols-1">
        <div>
          <KV k="Tổng thành phẩm" v={`${num(result.totalOutputKg)} kg`} />
          <KV k="Định mức chế biến" v={hasNoFinishedGood ? "—" : num(result.norm)} strong />
          {canViewPrice && (
            <>
              <KeyValueInput
                k="Chi phí CB / kg TP"
                unit="đ"
                value={period.processingCostPerKg}
                previous={previousPeriod?.processingCostPerKg}
                isLocked={isLocked}
                onChange={(v) => onChangePeriod({ processingCostPerKg: v })}
              />
              <KV k="Giá thành" v={`${num(result.costOfGoods)} đ`} />
              <KV k="Giá trị xuất" v={`${num(result.exportValue)} đ`} />
              <KV
                k={hasNoFinishedGood ? "Lãi / Lỗ" : isProfit ? "Lãi" : "Lỗ"}
                v={hasNoFinishedGood ? "—" : `${num(Math.abs(result.profitOrLoss))} đ`}
                tone={hasNoFinishedGood ? undefined : isProfit ? "profit" : "loss"}
                strong
              />
              <KV k="Bình quân / kg NL" v={hasNoFinishedGood ? "—" : `${num(result.avgProfitPerKgMaterial)} đ`} />
              {unpricedRowCount > 0 && (
                <p role="status" className="my-1 rounded-md bg-warning-surface px-3 py-1.5 text-sm font-medium text-destructive">
                  ⚠ {unpricedRowCount} dòng nguyên liệu chưa có đơn giá — giá thành và lãi/lỗ đang tính THIẾU. Điền giá ở
                  lưới Nguyên liệu vào.
                </p>
              )}
              <KeyValueInput
                k="Tỉ giá"
                unit="đ/USD"
                value={period.exchangeRate}
                previous={previousPeriod?.exchangeRate}
                isLocked={isLocked}
                onChange={(v) => onChangePeriod({ exchangeRate: v })}
              />
            </>
          )}
        </div>
        <div>
          <KV k="Tổng NL vào" v={`${num(result.totalInputKg)} kg`} />
          {canViewPrice && <KV k="Giá trị NL" v={`${num(result.materialValue)} đ`} />}
          <KeyValueInput
            k="Tổng NL nhận cả kỳ"
            unit="kg"
            value={period.totalInputKg}
            isLocked={isLocked}
            onChange={(v) => onChangePeriod({ totalInputKg: v })}
            note={
              /* Đối chiếu NL nhận (bảng phụ) với NL vào lưới — bắt chỗ vênh khỏi nhẩm tay. */
              materialDiff == null ? undefined : materialDiff === 0 ? (
                <span className="text-success">✓ khớp NL vào</span>
              ) : (
                <span className="text-destructive">⚠ lệch NL vào {num(materialDiff)} kg</span>
              )
            }
          />
          <KV k="Tỉ lệ thu hồi" v={result.yieldRate == null ? "—" : num(result.yieldRate)} />
        </div>
      </div>
      {/* Khối "Lãi/lỗ đến từ đâu" (2 thanh + tỷ lệ giá thành) ĐÃ GỠ 2026-10-20: không có trong
          file cân đối mẫu của kế toán, chỉ vẽ lại Giá thành · Giá trị xuất · Lãi đã có ở trên, cột
          Ghi chú hẹp làm chữ đè thanh và "chi phí chế biến 100%" gây hiểu nhầm khi tiền NL âm. */}
    </section>
  );
}

function KV({
  k,
  v,
  strong,
  tone,
}: {
  k: string;
  v: string;
  strong?: boolean;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
      <span className="min-w-0 text-sm text-muted-foreground">{k}</span>
      <span
        className={`tnum shrink-0 whitespace-nowrap text-right text-base ${
          strong ? "font-semibold" : "font-medium"
        } ${tone === "profit" ? "text-success" : tone === "loss" ? "text-destructive" : strong ? "text-primary" : ""}`}
      >
        {v}
      </span>
    </div>
  );
}

/**
 * Dòng GHI CHÚ là số ĐẦU VÀO: nhãn nhìn thấy (gắn với ô) + ô nhập ngay bên phải, sửa
 * là kết quả tính lại tức thì. Kỳ đã chốt ⇒ chỉ hiện số.
 */
function KeyValueInput({
  k,
  unit,
  value,
  previous: previousValue,
  isLocked,
  onChange,
  note,
}: {
  k: string;
  unit: string;
  value: number | null;
  /** Giá trị kỳ trước cùng họ NL — khác thì báo để người dùng biết số đã đổi. */
  previous?: number | null;
  isLocked: boolean;
  onChange: (v: number | null) => void;
  note?: React.ReactNode;
}) {
  const changed = previousValue != null && value != null && previousValue !== value;
  return (
    <div className="border-b border-border py-1.5">
      {isLocked ? (
        <KeyValueFrame k={k} v={value == null ? "—" : `${num(value)} ${unit}`} />
      ) : (
        <NumberField
          label={k}
          hideRequiredMark
          unit={unit}
          value={value}
          onChange={onChange}
          className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 [&>div:last-child]:w-44"
        />
      )}
      {(changed || note) && (
        <p className="mt-0.5 flex flex-wrap justify-end gap-x-3 text-right text-sm text-muted-foreground">
          {changed && <span>kỳ trước {num(previousValue)} {unit}</span>}
          {note}
        </p>
      )}
    </div>
  );
}

function KeyValueFrame({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0 text-sm text-muted-foreground">{k}</span>
      <span className="tnum shrink-0 whitespace-nowrap text-right text-base font-medium">{v}</span>
    </div>
  );
}

/* ---------- Mảnh dùng chung cho 3 khối ---------- */

