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
} from "@/lib/catalogRepo";
import { syncMonthlyStockLedger } from "@/lib/balancingStockLines";
import { usePeriodGrid } from "./usePeriodGrid";
import { MaterialGrid } from "./MaterialGrid";
import { getMaterialFamily } from "@/lib/balancingGrid";
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
  BarChart,
  ProportionBar,
} from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
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

/** Chuỗi ngày để in trên bảng, sinh từ khoảng ngày đã chọn. */
function describeRange(tu?: string, den?: string): string {
  if (!tu) return "";
  if (!den || den === tu) return formatDateVN(tu);
  return `${formatDateVN(tu)} – ${formatDateVN(den)}`;
}

export default function BalancingScreen() {
  const [kyList, persistKy, { trangThai: ttKy }] = useBalancingPeriods();
  const isLoadingPeriods = ttKy === "dang-tai" && kyList.length === 0;
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
  const addMaterialType = (ten: string) => {
    setCatalogMaterialTypes([...catalogMaterialTypes, { id: uid(), name: ten, category: "", note: "" }]);
    notify.saved(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };
  /** Bút chì sửa nhanh loại NL (value là TÊN; mục gộp họ không trùng tên danh mục thì không có bút chì). */
  const materialTypeEditor = useQuickCatalogEdit("loaiNL", catalogMaterialTypes, setCatalogMaterialTypes, { theo: "ten" });

  /* Chọn loại NL cho kỳ: GỘP biến thể size về HỌ — "Bạch tuộc 2 da lớn (80↑)" +
     "… nhỏ (80↓)" chỉ hiện MỘT mục "Bạch tuộc 2 da" (cân đối không tách size, chốt
     với chủ dự án). Tên không có mốc 80↑/↓ giữ nguyên. Value = tên họ nên chọn xong
     ô hiển thị đúng và lưu thẳng tên họ. Danh mục gốc (sổ nhập) vẫn giữ đủ size. */
  const materialTypeOptions = useMemo(() => {
    const existing = new Set<string>();
    const ra: { value: string; label: string; phu?: string }[] = [];
    for (const l of catalogMaterialTypes) {
      const ho = getMaterialFamily(l.name) || l.name;
      const key = ho.toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      ra.push({ value: ho, label: ho, phu: l.category || undefined });
    }
    return ra;
  }, [catalogMaterialTypes]);

  const [editing, setEditing] = useState<BalancingPeriod | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loi, setLoi] = useState<FieldError[]>([]);

  const openAdd = () => {
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
    setLoi([]);
  };

  const savePeriod = () => {
    if (!editing) return;
    const ls: FieldError[] = [];
    if (!editing.materialTypeName.trim())
      ls.push({ field: "Loại nguyên liệu", message: "Chưa chọn loại" });
    if (!editing.startDate)
      ls.push({ field: "Ngày tiếp nhận", message: "Chưa chọn ngày" });
    setLoi(ls);
    if (ls.length > 0) return;

    const ban: BalancingPeriod = {
      ...editing,
      // QUY TẮC: kỳ dùng tên HỌ nguyên liệu — "Bạch tuộc 2 da lớn (80↑)" và
      // "… nhỏ (80↓)" đều là "Bạch tuộc 2 da", một kỳ gộp cả hai size. Chuẩn hoá
      // ở đây để dù chọn biến thể size nào, tên kỳ vẫn là họ (khớp cách hút theo
      // họ ở filterEligibleImports/findPreviousPeriod). Tên khác (không có mốc 80↑/↓) giữ nguyên.
      materialTypeName: getMaterialFamily(editing.materialTypeName.trim()),
      dateRangeDescription: describeRange(editing.startDate, editing.endDate),
    };
    if (isAdding) {
      persistKy([ban, ...kyList]);
      notify.saved(`Đã tạo kỳ cân đối "${ban.materialTypeName}"`);
      setSelId(ban.id);
    } else {
      persistKy(kyList.map((k) => (k.id === ban.id ? ban : k)));
      notify.saved("Đã lưu thay đổi");
    }
    setEditing(null);
  };

  const deletePeriod = (k: BalancingPeriod) => {
    const prevPeriods = kyList;
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
    persistKy(kyList.filter((x) => x.id !== k.id));
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
        persistKy(prevPeriods);
        writeMaterials(prevMaterials);
        writeScraps(prevScrap);
        writeFinishedGoods(prevFinishedGoods);
        writeImports(prevImports);
        writeProductions(prevProduction);
        if (stockSyncResult.changed) writeStockLedger(prevStock);
      }
    );
  };

  const sel = kyList.find((k) => k.id === selId) || null;

  if (sel) {
    return (
      <KyDetail
        period={sel}
        onBack={() => setSelId(null)}
        onChangePeriod={(patch) =>
          persistKy(kyList.map((k) => (k.id === sel.id ? { ...k, ...patch } : k)))
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
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Cân đối nguyên liệu
          </h1>
        </div>
        <Button
          title="Mở một kỳ cân đối mới (thường ~5 ngày một lô): khai khoảng ngày rồi hút số liệu nhập · sản xuất · bán vào." size="lg" onClick={openAdd}>
          <Plus />
          Tạo kỳ cân đối
        </Button>
      </div>

      {isLoadingPeriods ? (
        <TableSkeleton />
      ) : kyList.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Chưa có kỳ cân đối nào"
          description="Tạo kỳ đầu tiên: chọn loại nguyên liệu và khoảng ngày tiếp nhận."
          action={
            <Button
              title="Mở kỳ cân đối đầu tiên." size="lg" onClick={openAdd}>
              <Plus />
              Tạo kỳ cân đối
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={kyList}
          getKey={(r) => r.id}
          rowMarkKey="can-doi-ky"
          getSearchText={(r) => `${r.materialTypeName} ${r.dateRangeDescription}`}
          searchLabel="Tìm kỳ theo loại nguyên liệu…"
          actions={(r) => (
            <>
              <Button
                title="Mở lưới cân đối của kỳ này để nhập số và xem định mức, lãi lỗ." size="sm" onClick={() => setSelId(r.id)}>
                Mở kỳ
              </Button>
              <Button
                title="Sửa thông tin kỳ (tên kỳ, khoảng ngày, loại nguyên liệu)."
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing({ ...r });
                  setIsAdding(false);
                  setLoi([]);
                }}
              >
                <Pencil />
                Sửa
              </Button>
              <ConfirmDelete
                recordDescription={`Kỳ "${r.materialTypeName}" — ${r.dateRangeDescription || "chưa ghi ngày"}`}
                onConfirm={() => deletePeriod(r)}
                title="Xóa kỳ cân đối này?"
                confirmLabel="Xóa kỳ"
              />
            </>
          )}
        />
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto w-full sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {isAdding ? "Tạo kỳ cân đối" : "Sửa kỳ cân đối"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={loi} />
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
                      const ho = getMaterialFamily(v);
                      const prevRows = kyList.find(
                        (k) => getMaterialFamily(k.materialTypeName) === ho
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
                onCreate={addMaterialType}
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
                onChange={(tu, den) =>
                  setEditing((d) => (d ? { ...d, startDate: tu, endDate: den } : d))
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
                <NumberField
                  label="Chi phí chế biến / kg TP"
                  unit="đ"
                  value={editing.processingCostPerKg}
                  onChange={(v) =>
                    setEditing((d) => (d ? { ...d, processingCostPerKg: v } : d))
                  }
                />
                <NumberField
                  label="Tỉ giá"
                  unit="đ/USD"
                  value={editing.exchangeRate}
                  onChange={(v) => setEditing((d) => (d ? { ...d, exchangeRate: v } : d))}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button
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
function KyDetail({
  period,
  onBack,
  onChangePeriod,
}: {
  period: BalancingPeriod;
  onBack: () => void;
  onChangePeriod: (patch: Partial<BalancingPeriod>) => void;
}) {
  const grid = usePeriodGrid(period);
  const [products, setProducts] = useProducts();
  const [customers, setCustomers] = useCustomers();
  /** Bút chì sửa nhanh mặt hàng / khách trong lưới bán thành phẩm (nối theo id). */
  const productEditor = useQuickCatalogEdit("matHang", products, setProducts);
  const customerEditor = useQuickCatalogEdit("khachHang", customers, setCustomers);
  const [catalogMaterialTypes, setCatalogMaterialTypes] = useMaterialTypes();
  /** Bút chì loại NL ở hộp thêm dòng khối 1 (theo TÊN) — instance danh mục của KyDetail. */
  const periodMaterialTypeEditor = useQuickCatalogEdit("loaiNL", catalogMaterialTypes, setCatalogMaterialTypes, { theo: "ten" });
  const [showBang, setShowBang] = useState(false);
  /* Công tắc cột ngày RIÊNG từng khối — cả hai MẶC ĐỊNH MỞ (chốt 2026-10-06: kế
     toán đối chiếu theo ngày). Thu lại thì khối NL gõ thẳng Số lượng như bảng giấy. */
  const [hideMaterialDays, setHideMaterialDays] = useState(false);
  const [hideFinishedGoodDays, setHideFinishedGoodDays] = useState(false);
  /* Mặc định xếp NGANG như bảng giấy (NL + ô GHI CHÚ bên trái, BTP bên phải — từ màn
     2xl). Người dùng vẫn đổi tay được; không tự nhảy theo bề rộng. */
  const [isHorizontal, setIsHorizontal] = useState(true);
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
    const daHut = new Set(grid.outputs.map((t) => t.salesItemId).filter(Boolean));
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
    grid.saveOutputs([
      ...grid.outputs,
      ...items.map(({ salesItem, invoice: salesInvoice }) => ({
        id: uid(),
        periodId: period.id,
        productId: salesItem.productId,
        customerId: salesInvoice.customerId,
        channel: salesInvoice.channel,
        quantityKg: salesItem.quantityKg,
        unitPrice: salesItem.unitPrice,
        spec: salesItem.spec,
        salesItemId: salesItem.id,
      })),
    ]);
    notify.saved(`Đã hút ${items.length} dòng bán vào kỳ này`);
  };

  const { result } = grid;
  /** Chưa có bán thành phẩm → định mức + lãi/lỗ chưa có nghĩa. */
  const hasNoFinishedGood = result.totalOutputKg <= 0;
  /** Lệch giữa Tổng NL nhận (thông số kỳ) và Tổng NL vào lưới (khối 1) — hiện
   *  sẵn để khỏi nhẩm tay khi đối chiếu. */
  const materialDiff = period.totalInputKg != null ? period.totalInputKg - result.totalInputKg : null;
  /** Số dòng ở hai sổ nguồn tự động còn chờ hút vào kỳ. */
  const pendingSourceCount = grid.pendingImports.length + grid.pendingWips.length;

  return (
    <div className="space-y-6">
      <Button
        title="Quay về danh sách các kỳ cân đối." variant="ghost" size="lg" onClick={onBack}>
        <ChevronLeft />
        Danh sách kỳ
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bảng cân đối {period.materialTypeName}</h1>
          <p className="mt-1 text-base text-muted-foreground">
            {period.dateRangeDescription || "Chưa ghi ngày tiếp nhận"}
            {period.isLocked && " · đã chốt"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Một chạm kéo cả hai sổ nguồn tự động (nhập + sản xuất) vào kỳ. Không gộp sổ bán. */}
          {!grid.isLocked && pendingSourceCount > 0 && (
            <Button
              title={`Hút ${grid.pendingImports.length} dòng sổ nhập hàng và ${grid.pendingWips.length} dòng sổ sản xuất trong khoảng ngày của kỳ vào lưới.`}
              size="lg"
              onClick={grid.pullAllSources}
            >
              <ArrowDownToLine />
              Lấy {pendingSourceCount} dòng từ sổ
            </Button>
          )}
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
          <Button
            title="Xoay bảng ngang / dọc cho vừa màn hình — chỉ đổi cách nhìn, không đụng số." variant="outline" size="lg" onClick={() => setIsHorizontal((v) => !v)}>
            {isHorizontal ? <Rows3 /> : <Columns2 />}
            {isHorizontal ? "Xếp dọc" : "Xếp ngang"}
          </Button>
          <Button
            title="Xem bảng cân đối đúng khổ in A4 rồi in giấy hoặc lưu PDF." variant="outline" size="lg" onClick={() => setShowBang(true)}>
            <FileText />
            Xem / in bảng
          </Button>
        </div>
      </div>

      {/* Hai khối trong MỘT tờ: cùng khung, cùng công tắc cột ngày, chỉ ngăn nhau
          bằng một đường kẻ — đọc như một bảng cân đối liền mạch. */}
      {/* Xếp ngang (mặc định, từ 2xl) theo file cân đối của kế toán: hàng trên = khối NL
          (cột A–E) cạnh ô GHI CHÚ (cột K–L) — hai khối hẹp, đứng chung thì THẤY HẾT,
          không cắt cột tiền như khi NL chia đôi hàng với khối BTP; hàng dưới = khối BTP
          trải hết bề ngang (nhiều cột: khách, giá, ngày, Trả, Nợ). Màn hẹp: NL → GHI CHÚ → BTP. */}
      <Card
        className={
          isHorizontal
            ? "grid grid-cols-1 overflow-hidden p-0 2xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]"
            : "overflow-hidden p-0"
        }
      >
        <MaterialGrid
          grid={grid}
          materialTypeCatalog={catalogMaterialTypes}
          materialTypeEdit={periodMaterialTypeEditor}
          daysCollapsed={hideMaterialDays}
          onToggleDays={() => setHideMaterialDays((v) => !v)}
          onCreateMaterialType={(ten) => {
            setCatalogMaterialTypes([
              ...catalogMaterialTypes,
              { id: uid(), name: ten, category: "", note: "" },
            ]);
            notify.saved(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
            return ten;
          }}
        />
        <ResultNote
          period={period}
          previousPeriod={grid.previousPeriod}
          result={result}
          hasNoFinishedGood={hasNoFinishedGood}
          materialDiff={materialDiff}
          sideBySide={isHorizontal}
          isLocked={grid.isLocked}
          onChangePeriod={onChangePeriod}
        />
        <div className={isHorizontal ? "2xl:col-span-2" : undefined}>
          <WipGrid
            grid={grid}
            products={products}
            customers={customers}
            onEditProduct={productEditor.openEdit}
            onEditCustomer={customerEditor.openEdit}
            pendingSales={banChoHut}
            onPullSales={pullSalesIntoPeriod}
            daysCollapsed={hideFinishedGoodDays}
            onToggleDays={() => setHideFinishedGoodDays((v) => !v)}
            onCreateProduct={(ten) => {
              const m: Product = { id: uid(), code: "", name: ten, finishedGoodCode: "" };
              setProducts([...products, m]);
              notify.saved(`Đã thêm mặt hàng "${ten}" vào danh mục`);
              return m.id;
            }}
            onCreateCustomer={(ten) => {
              const k: Customer = { id: uid(), code: "", name: ten, market: "" };
              setCustomers([...customers, k]);
              notify.saved(`Đã thêm khách hàng "${ten}" vào danh mục`);
              return k.id;
            }}
          />
        </div>
      </Card>

      {/* Vòng gối đầu: phần kỳ trước đẩy sang được kéo vào đây bằng một nút, thay
          cho việc mở file kỳ cũ ra chép tay. */}
      {grid.carryOverRowCount > 0 && !grid.isLocked && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
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
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
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
        <Button
          title="Chốt khi đã đối chiếu xong và gửi kế toán — mọi ô trong lưới khoá lại. Kỳ đã chốt thì bấm để mở lại (phải ghi lý do)."
          variant={period.isLocked ? "outline" : "default"}
          size="lg"
          onClick={() => setIsLockOpen(true)}
        >
          {period.isLocked ? <LockOpen /> : <Lock />}
          {period.isLocked ? "Mở lại kỳ" : "Chốt kỳ"}
        </Button>
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
function ResultNote({
  period,
  previousPeriod,
  result,
  hasNoFinishedGood,
  materialDiff,
  sideBySide: isHorizontal,
  isLocked,
  onChangePeriod,
}: {
  period: BalancingPeriod;
  previousPeriod: BalancingPeriod | null;
  result: BalancingResult;
  hasNoFinishedGood: boolean;
  materialDiff: number | null;
  sideBySide: boolean;
  isLocked: boolean;
  onChangePeriod: (patch: Partial<BalancingPeriod>) => void;
}) {
  const lai = result.profitOrLoss >= 0;
  return (
    <section
      className={`border-t-2 border-border p-5 ${isHorizontal ? "2xl:border-t-0 2xl:border-l-2" : ""}`}
      aria-label="Ghi chú — kết quả cân đối"
    >
      <h2 className="mb-2 text-xl font-semibold">Ghi chú</h2>
      {/* Xếp ngang (2xl) ô này là cột phải hẹp (20–24rem) ⇒ về MỘT cột, không thì nhãn +
          số gãy dòng và số tiền dài tràn khung ở chữ 130%. */}
      <div className={`grid gap-x-8 sm:grid-cols-2 ${isHorizontal ? "2xl:grid-cols-1" : ""}`}>
        <div>
          <KV k="Tổng thành phẩm" v={`${num(result.totalOutputKg)} kg`} />
          <KV k="Định mức chế biến" v={hasNoFinishedGood ? "—" : num(result.norm)} strong />
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
            k={hasNoFinishedGood ? "Lãi / Lỗ" : lai ? "Lãi" : "Lỗ"}
            v={hasNoFinishedGood ? "—" : `${num(Math.abs(result.profitOrLoss))} đ`}
            tone={hasNoFinishedGood ? undefined : lai ? "lai" : "lo"}
            strong
          />
          <KV k="Bình quân / kg NL" v={hasNoFinishedGood ? "—" : `${num(result.avgProfitPerKgMaterial)} đ`} />
          <KeyValueInput
            k="Tỉ giá"
            unit="đ/USD"
            value={period.exchangeRate}
            previous={previousPeriod?.exchangeRate}
            isLocked={isLocked}
            onChange={(v) => onChangePeriod({ exchangeRate: v })}
          />
        </div>
        <div>
          <KV k="Tổng NL vào" v={`${num(result.totalInputKg)} kg`} />
          <KV k="Giá trị NL" v={`${num(result.materialValue)} đ`} />
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
      {/* Lãi/lỗ đến từ đâu — hai thanh dễ đọc: tiền bán được vs tiền bỏ ra, và tiền bỏ
          ra chia NL / chế biến. Cùng số calculateBalancing ở trên, không tính lại. */}
      {!hasNoFinishedGood && result.costOfGoods > 0 && (
        <div className="mt-5 grid gap-3 border-t-2 border-border pt-4">
          <h3 className="text-base font-semibold text-foreground">
            Lãi/lỗ đến từ đâu:{" "}
            <span className={lai ? "text-success" : "text-destructive"}>
              {lai ? "bán được nhiều hơn tiền bỏ ra" : "tiền bỏ ra nhiều hơn bán được"} {num(Math.abs(result.profitOrLoss))} đ
            </span>
          </h3>
          <BarChart
            data={[
              { label: "Tiền bán được", subLabel: "giá trị xuất", value: result.exportValue },
              { label: "Tiền bỏ ra", subLabel: "nguyên liệu + chế biến", value: result.costOfGoods },
            ]}
            preserveOrder
            showAverageLine={false}
            unit="đ"
          />
          <p className="text-sm font-semibold text-foreground">Tiền bỏ ra gồm:</p>
          <ProportionBar
            unit="đ"
            description="Giá thành chia theo tiền nguyên liệu và chi phí chế biến"
            segments={[
              { id: "nl", label: "Tiền nguyên liệu", value: result.materialValue, tone: "bien" },
              { id: "cb", label: "Chi phí chế biến", value: result.costOfGoods - result.materialValue, tone: "tim" },
            ]}
          />
        </div>
      )}
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
  tone?: "lai" | "lo";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
      <span className="min-w-0 text-sm text-muted-foreground">{k}</span>
      <span
        className={`tnum shrink-0 whitespace-nowrap text-right text-base ${
          strong ? "font-semibold" : "font-medium"
        } ${tone === "lai" ? "text-success" : tone === "lo" ? "text-destructive" : strong ? "text-primary" : ""}`}
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
  const doi = previousValue != null && value != null && previousValue !== value;
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
      {(doi || note) && (
        <p className="mt-0.5 flex flex-wrap justify-end gap-x-3 text-right text-sm text-muted-foreground">
          {doi && <span>kỳ trước {num(previousValue)} {unit}</span>}
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

