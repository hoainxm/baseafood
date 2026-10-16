// ============================================================
// Tên file cũ: src/features/reports/BaoCaoNhapXuatTon.tsx
// Tên tiếng Việt: Màn hình Báo cáo Nhập Xuất Tồn thành phẩm
// Description: Finished-goods Import-Export-Inventory (NXT) report screen
// ============================================================
import { useMemo, useState } from "react";
import type { FinishedGoodsOpeningStock } from "@/types";
import {
  useWipProductions,
  useExportItems,
  useExportOrders,
  useSalesItems,
  usePackagings,
  useProducts,
  useFinishedGoodsOpeningStock,
} from "@/lib/catalogRepo";
import {
  computeFinishedGoodNxt,
  sumFinishedGoodNxt,
  type FinishedGoodNxtRow,
} from "@/lib/inventoryFinished";
import { exportNxtToExcel, inferCategory, type NxtExcelRow } from "@/lib/nxtExcel";
import {
  Tag,
  SummaryTable,
  Button,
  RequiredLegend,
  Combobox,
  ConfirmDelete,
  DateField,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  Field,
  Input,
  NumberField,
  StatCardGrid,
  ReadOnlyBadge,
  todayIso,
  notify,
  type SummaryTableColumn,
  type FieldError,
  type ComboboxOption,
  type StatCardData,
} from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useCan } from "@/features/shared/PermissionProvider";
import { PERIOD_OPTIONS, getViewPeriodRange, startOfMonth, type ViewPeriod } from "@/lib/periodUtils";
import { num, formatDateVN } from "@/lib/format";
import { uid } from "@/lib/db";
import {
  AlertTriangle,
  ArrowDownToLine,
  Download,
  PackagePlus,
  Scale,
  Ship,
  Snowflake,
  Store,
} from "lucide-react";
import { useDraftAccount, useFormDraft } from "@/lib/formDraft";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";

interface OpeningForm {
  productId: string;
  spec: string;
  asOfDate: string;
  quantityKg: number | null;
  blocksCount: number | null;
  warehouse: string;
  note: string;
}

/**
 * Báo cáo NXT thành phẩm — kho bán thành phẩm cấp đông dự trữ. Số suy thẳng từ
 * lịch sử: Nhập = BTP duyệt vào kho; Xuất = đơn đặt (dòng lệnh) + bán hàng ngày;
 * Tồn đầu = khai tay + lịch sử trước kỳ. Xem lib/inventoryFinished.ts.
 * Chỉ đọc; ô nhập tay duy nhất là "Tồn đầu" (số dư trước khi số hoá).
 */
export default function NxtReportScreen() {
  // Phân quyền lớp 2: thêm/xóa tồn đầu khai tay + xuất Excel theo quyền `nxt`.
  const allowed = useCan("nxt");
  const isReadOnly = !allowed.create && !allowed.update;
  const [wips] = useWipProductions();
  const [exportItems] = useExportItems();
  const [exportOrders] = useExportOrders();
  const [salesItems] = useSalesItems();
  const [packagings] = usePackagings();
  const [products, setProducts] = useProducts();
  /** Bút chì sửa nhanh danh mục ngay trong ô chọn. */
  const productEditor = useQuickCatalogEdit("product", products, setProducts);
  const [opening, writeOpening] = useFinishedGoodsOpeningStock();

  const [period, setPeriod] = useState<ViewPeriod>("month");
  const [anchor, setAnchor] = useState(todayIso());
  const [customFrom, setCustomFrom] = useState(startOfMonth(todayIso()));
  const [customTo, setCustomTo] = useState(todayIso());
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);

  // Dialog tồn đầu
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [form, setForm] = useState<OpeningForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  /* Tự lưu NHÁP dòng tồn đầu đang khai (quy tắc 17, lib/formDraft.ts) — quay lại trang là hộp
     khai tồn đầu tự mở lại đúng số đang gõ. Lưu / Hủy ⇒ nháp tự xoá. */
  const draftAccount = useDraftAccount();
  const openingDraft = useFormDraft({
    form: "finished-opening-stock",
    ...draftAccount,
    value: form,
    isEmpty: (f) => !f || (!f.productId && !f.spec.trim() && f.quantityKg == null && f.blocksCount == null && !f.warehouse.trim() && !f.note.trim()),
    onRestore: (f) => {
      if (!f) return;
      setForm(f);
      setIsOpeningOpen(true);
    },
  });

  const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";

  const rows = useMemo(
    () =>
      computeFinishedGoodNxt({
        wips,
        exportOrders,
        exportItems,
        salesItems,
        packagings,
        opening,
        products,
        fromDate,
        toDate,
      }),
    [wips, exportOrders, exportItems, salesItems, packagings, opening, products, fromDate, toDate]
  );
  const total = useMemo(() => sumFinishedGoodNxt(rows), [rows]);

  const cards: StatCardData[] = [
    { label: "Tồn đầu kho", value: `${num(total.openingKg)} kg`, numeric: true, icon: Snowflake, color: "neutral" },
    { label: "Nhập kho", value: `${num(total.inKg)} kg`, numeric: true, icon: ArrowDownToLine, color: "brand" },
    {
      label: "Xuất (đơn+bán+gói)",
      value: `${num(total.orderOutKg)} + ${num(total.retailOutKg)} + ${num(total.packagingOutKg)} kg`,
      icon: Ship,
      color: "warning",
    },
    { label: "Tồn cuối kho", value: `${num(total.closingKg)} kg`, numeric: true, icon: Scale, color: "success" },
  ];

  const columns: SummaryTableColumn<FinishedGoodNxtRow>[] = [
    {
      key: "mh",
      header: "Mặt hàng · quy cách",
      render: (r) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{r.productName}</span>
            {r.spec && <Tag variant="muted">{r.spec}</Tag>}
            {r.hasManualOpening && <Tag variant="source">Tồn đầu khai tay</Tag>}
            {r.isNegative && (
              <Tag variant="error" icon={AlertTriangle}>
                Tồn âm
              </Tag>
            )}
          </div>
          {r.productCode && (
            <div className="font-mono text-sm text-muted-foreground">{r.productCode}</div>
          )}
        </div>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", numeric: true, render: (r) => num(r.openingKg), total: () => num(total.openingKg) },
    {
      key: "nhap",
      header: "Nhập (kg)",
      numeric: true,
      render: (r) => (
        <span className={r.inKg > 0 ? "font-semibold text-success" : ""}>{r.inKg ? `+${num(r.inKg)}` : "—"}</span>
      ),
      total: () => num(total.inKg),
    },
    {
      key: "xuatDon",
      header: "Xuất đơn (kg)",
      numeric: true,
      render: (r) => (r.orderOutKg ? `−${num(r.orderOutKg)}` : "—"),
      total: () => num(total.orderOutKg),
    },
    {
      key: "xuatBan",
      header: "Xuất bán (kg)",
      numeric: true,
      render: (r) => (r.retailOutKg ? `−${num(r.retailOutKg)}` : "—"),
      total: () => num(total.retailOutKg),
    },
    {
      key: "xuatDongGoi",
      header: "Đóng gói (kg)",
      numeric: true,
      render: (r) => (r.packagingOutKg ? `−${num(r.packagingOutKg)}` : "—"),
      total: () => num(total.packagingOutKg),
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối (kg)",
      numeric: true,
      render: (r) => (
        <span className={`tnum font-bold ${r.isNegative ? "text-destructive" : "text-foreground"}`}>
          {num(r.closingKg)}
        </span>
      ),
      total: () => num(total.closingKg),
    },
  ];

  // ----- Xuất Excel (mẫu 10 cột) -----
  const exportExcel = () => {
    if (!rows.length) {
      notify.warning("Không có số liệu để xuất");
      return;
    }
    const items: NxtExcelRow[] = rows.map((r) => ({
      code: r.productCode || r.productId,
      name: `${r.productName}${r.spec ? ` (${r.spec})` : ""}`,
      category: inferCategory(r.productCode, r.productName),
      openingKg: r.openingKg,
      openingValue: 0,
      inKg: r.inKg,
      inValue: 0,
      outKg: r.outKg,
      outValue: 0,
      closingKg: r.closingKg,
      closingValue: 0,
    }));
    exportNxtToExcel(
      {
        createdDateText: `Ngày lập: ${formatDateVN(todayIso())}`,
        title: "Báo cáo xuất nhập tồn thành phẩm",
        dateRangeText: `Từ ngày ${formatDateVN(fromDate)} đến ngày ${formatDateVN(toDate)}`,
        warehouseText: "Chi nhánh: Kho thành phẩm BSF1",
        items,
        totalItemCount: items.length,
        totalOpeningKg: total.openingKg,
        totalOpeningValue: 0,
        totalInKg: total.inKg,
        totalInValue: 0,
        totalOutKg: total.outKg,
        totalOutValue: 0,
        totalClosingKg: total.closingKg,
        totalClosingValue: 0,
      },
      `Bao-Cao-NXT-Thanh-Pham-${fromDate}-${toDate}.xlsx`
    );
    // Không toast: trình duyệt đã tự báo tải file xong (README luật 8 — xuất file là thao tác không đổi số).
  };

  // ----- Tồn đầu: thêm / xóa -----
  const productOptions: ComboboxOption[] = products.map((m) => ({ value: m.id, label: m.name, subLabel: m.code || undefined }));
  /** Thêm mặt hàng tại chỗ — lưu ngay vào danh mục; trùng tên (không phân hoa thường) ⇒ dùng lại. */
  const addProduct = (name: string) => {
    const trimmedName = name.trim();
    const existing = products.find((m) => m.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existing) return existing.id;
    const m = { id: uid(), code: "", name: trimmedName, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${trimmedName}" vào danh mục`);
    return m.id;
  };

  const openAddOpening = () => {
    setForm({
      productId: "",
      spec: "",
      asOfDate: todayIso(),
      quantityKg: null,
      blocksCount: null,
      warehouse: "",
      note: "",
    });
    setErrors([]);
  };

  const saveOpening = () => {
    if (!form) return;
    const ls: FieldError[] = [];
    if (!form.productId) ls.push({ field: "Mặt hàng", message: "Chưa chọn mặt hàng" });
    if (!form.asOfDate) ls.push({ field: "Ngày mốc", message: "Chưa chọn ngày tồn đầu" });
    if (!(Number(form.quantityKg) > 0)) ls.push({ field: "Khối lượng", message: "Phải lớn hơn 0 kg" });
    setErrors(ls);
    if (ls.length > 0) return;
    const newOpening: FinishedGoodsOpeningStock = {
      id: uid(),
      productId: form.productId,
      spec: form.spec.trim(),
      asOfDate: form.asOfDate,
      quantityKg: Number(form.quantityKg),
      blocksCount: Number(form.blocksCount) || 0,
      warehouse: form.warehouse.trim(),
      note: form.note.trim(),
    };
    writeOpening([...opening, newOpening]);
    notify.saved(`Đã lưu tồn đầu ${num(newOpening.quantityKg)} kg — ${productNameOf(newOpening.productId)}`);
    setForm(null);
  };

  const deleteOpening = (id: string) => {
    writeOpening(opening.filter((o) => o.id !== id));
    notify.deleted("Đã xóa dòng tồn đầu");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Snowflake className="h-8 w-8 text-primary" />
            Báo cáo Nhập – Xuất – Tồn thành phẩm
            {isReadOnly && <ReadOnlyBadge />}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Kho bán thành phẩm cấp đông dự trữ. Số suy từ sổ Sản xuất, Đơn đặt và Bán hàng — không nhập
            tay lần hai.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            title="Khai tồn đầu kho thành phẩm cho các mã chưa có lịch sử giao dịch — không có số này thì kỳ đầu tiên tính thiếu." variant="outline" onClick={() => setIsOpeningOpen(true)}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Tồn đầu ({opening.length})
          </Button>
          {allowed.export && (
            <Button
              title="Tải báo cáo đang xem ra file Excel." onClick={exportExcel} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" />
              Xuất Excel
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem]">
          <Combobox
            label="Kỳ báo cáo"
            hideRequiredMark
            clearable={false}
            value={period}
            onChange={(v) => setPeriod(v as ViewPeriod)}
            options={PERIOD_OPTIONS}
          />
        </div>
        <div className="min-w-[min(12rem,100%)] flex-1 sm:min-w-[16rem]">
          {period === "custom" ? (
            <DateRangeField
              label="Khoảng ngày"
              hideRequiredMark
              presets={false}
              startDate={customFrom}
              endDate={customTo}
              onChange={(a, b) => {
                setCustomFrom(a);
                setCustomTo(b);
              }}
            />
          ) : (
            <DateField
              label={period === "day" ? "Ngày" : "Ngày bất kỳ trong kỳ"}
              hideRequiredMark
              hint={period === "day" ? undefined : `Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`}
              value={anchor}
              onChange={setAnchor}
            />
          )}
        </div>
      </div>

      <StatCardGrid cards={cards} />

      {total.warningCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <span className="text-base font-semibold text-destructive">
            {total.warningCount} mặt hàng có tồn cuối ÂM — xuất nhiều hơn số đang trữ. Kiểm lại sản xuất /
            đơn đặt / bán hàng (số ghi tay có thể sai, hoặc thiếu khai tồn đầu).
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Snowflake}
          title="Chưa có số liệu thành phẩm trong khoảng ngày này"
          description="Ghi sản lượng ở Sản xuất BTP, duyệt vào Kho dự trữ, rồi xuất theo Đơn đặt / Bán hàng — số sẽ tổng hợp về đây. Có số dư đông trước khi số hoá thì khai ở nút Tồn đầu."
        />
      ) : (
        <SummaryTable rows={rows} columns={columns} getKey={(r) => `${r.productId}|||${r.spec}`} rowMarkKey={`nxt-tp|${fromDate}|${toDate}`} />
      )}

      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Store className="size-icon-sm" aria-hidden />
        "Xuất đơn" = lệnh xuất container theo Đơn đặt; "Xuất bán" = phiếu Bán hàng ngày (không tính
        hai lần phần đã xuất qua đơn). Tồn cuối khớp với Tổng tồn ở màn Kho dự trữ.
      </p>

      {/* Dialog quản lý Tồn đầu thành phẩm */}
      <Dialog open={isOpeningOpen} onOpenChange={setIsOpeningOpen}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tồn đầu kho thành phẩm</DialogTitle>
            <DialogDescription className="text-base">
              Số dư bán thành phẩm cấp đông có sẵn TRƯỚC khi dùng app, theo (mặt hàng × quy cách). Chỉ
              cần khai một lần — các kỳ sau tự kế thừa từ lịch sử nhập/xuất.
            </DialogDescription>
          </DialogHeader>
          <DraftRestoredNotice savedAt={openingDraft.restoredAt} onDiscard={() => { openingDraft.discard(); setForm(null); }} />

          <div className="space-y-4 py-2">
            {opening.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border-2 border-border">
                {opening.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span className="min-w-0 flex-1 text-base">
                      <span className="font-semibold">{productNameOf(o.productId)}</span>
                      {o.spec ? <span className="text-muted-foreground"> · {o.spec}</span> : null}
                      {" — "}
                      <span className="tnum font-semibold">{num(o.quantityKg)}</span> kg
                      <span className="text-muted-foreground">
                        {" "}
                        · từ {formatDateVN(o.asOfDate)}
                        {o.warehouse ? ` · ${o.warehouse}` : ""}
                        {o.note ? ` · ${o.note}` : ""}
                      </span>
                    </span>
                    {allowed.delete && (
                      <ConfirmDelete
                        recordDescription={`${productNameOf(o.productId)}${o.spec ? ` · ${o.spec}` : ""} — ${num(o.quantityKg)} kg`}
                        onConfirm={() => deleteOpening(o.id)}
                        trigger={
                          <Button
                            title="Xóa dòng tồn đầu này." size="sm" variant="danger">
                            Xóa
                          </Button>
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border-2 border-dashed border-border p-4 text-center text-base text-muted-foreground">
                Chưa khai tồn đầu thành phẩm nào.
              </p>
            )}

            {form ? (
              <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/30 p-4">
                <ErrorSummary errors={errors} />
                <RequiredLegend />
                <Combobox
                  label="Mặt hàng"
                  required
                  value={form.productId}
                  onChange={(v) => setForm((f) => (f ? { ...f, productId: v } : f))}
                  options={productOptions}
                  onCreate={productEditor.canCreate ? addProduct : undefined}
                  onEditItem={productEditor.openEdit}
                  canEdit={productEditor.canEdit}
                  editLabel={productEditor.editLabel}
                  emptyText="Chưa có mặt hàng — gõ tên rồi bấm Thêm mới."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Quy cách" hint="Khớp size hàng trong kho (để trống nếu không tách).">
                    <Input
                      value={form.spec}
                      onChange={(e) => setForm((f) => (f ? { ...f, spec: e.target.value } : f))}
                      placeholder="VD 18-20"
                    />
                  </Field>
                  <DateField
                    label="Tồn đầu tính từ ngày"
                    required
                    value={form.asOfDate}
                    onChange={(v) => setForm((f) => (f ? { ...f, asOfDate: v } : f))}
                  />
                  <NumberField
                    label="Khối lượng tồn"
                    required
                    unit="kg"
                    value={form.quantityKg}
                    onChange={(v) => setForm((f) => (f ? { ...f, quantityKg: v } : f))}
                  />
                  <NumberField
                    label="Số block"
                    unit="block"
                    value={form.blocksCount}
                    onChange={(v) => setForm((f) => (f ? { ...f, blocksCount: v } : f))}
                  />
                </div>
                <Field label="Kho (tùy chọn)">
                  <Input
                    value={form.warehouse}
                    onChange={(e) => setForm((f) => (f ? { ...f, warehouse: e.target.value } : f))}
                    placeholder="VD: Kho 1000 tấn"
                  />
                </Field>
                <Field label="Ghi chú">
                  <Input
                    value={form.note}
                    onChange={(e) => setForm((f) => (f ? { ...f, note: e.target.value } : f))}
                    placeholder="VD: số kiểm kê đầu năm"
                  />
                </Field>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button variant="outline" onClick={() => setForm(null)}>
                    Hủy
                  </Button>
                  <Button variant="save"
                    title="Ghi số tồn đầu vừa khai vào sổ." onClick={saveOpening}>
                    <PackagePlus className="mr-1 h-4 w-4" />
                    Lưu tồn đầu
                  </Button>
                </div>
              </div>
            ) : (
              allowed.create && (
                <Button
                  title="Khai thêm tồn đầu cho một mã thành phẩm nữa." variant="outline" onClick={openAddOpening}>
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Thêm tồn đầu
                </Button>
              )
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setIsOpeningOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {productEditor.dialog}
    </div>
  );
}
