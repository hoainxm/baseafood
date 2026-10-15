// ============================================================
// Tên file: src/features/reports/MaterialNxtScreen.tsx
// Tên tiếng Việt: Báo cáo Nhập–Xuất–Tồn kho nguyên liệu
// Description: Raw-material inventory (Nhập–Xuất–Tồn) report screen
// ============================================================
import { useMemo, useState } from "react";
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
import {
  useBalancingInputs,
  useBalancingPeriods,
  useDomesticSales,
  useMaterialImports,
  useMaterialOpeningStock,
  useMaterialTypes,
  useProductionLocks,
} from "@/lib/catalogRepo";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import {
  computeMaterialTotalStock,
  sumUnmatchedLeftover,
  type MaterialTotalStockFamily,
  type MaterialTotalStockDay,
} from "@/lib/inventoryMaterial";
import { num, formatDateVN } from "@/lib/format";
import { uid } from "@/lib/db";
import type { MaterialOpeningStock, Workshop } from "@/types";
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarDays,
  PackagePlus,
  Scale,
  Snowflake,
  Store,
  Truck,
} from "lucide-react";

const WORKSHOP_OPTIONS: ComboboxOption[] = [
  { value: "Tất cả", label: "Tất cả xưởng" },
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

interface OpeningForm {
  workshop: Workshop;
  materialTypeName: string;
  asOfDate: string;
  quantityKg: number | null;
  note: string;
}

/**
 * Báo cáo Nhập–Xuất–Tồn nguyên liệu. Tồn suy THẲNG từ sổ Nhập hàng (material_imports):
 *
 *   Tồn cuối = Tồn đầu + Nhập hàng − Xuất SX − Bán nội địa
 *
 * Bán nội địa (NL bán thẳng, sổ domestic_sales mig 0054 — ghi ở /wip) là khoản XUẤT thật.
 *
 * Xuất SX ("NL lấy ra sản xuất") CHƯA được ghi ở màn Sản xuất nên = 0 (cột chờ) —
 * tồn hiện là "chưa trừ xuất". Đông gửi / xả đông (vòng gối đầu ở Cân đối) chỉ hiện
 * làm CỘT THÔNG TIN, KHÔNG cộng vào tồn (tránh đếm đôi — PA-a, chốt 2026-09-11).
 * Ô nhập tay duy nhất là "Tồn đầu". Xem lib/inventoryMaterial.ts#computeMaterialTotalStock.
 */
export default function MaterialNxtScreen() {
  // Phân quyền lớp 2: thêm/xóa tồn đầu khai tay theo `create` / `delete`.
  const allowed = useCan("nxt-material");
  const isReadOnly = !allowed.create && !allowed.update;
  const [periods] = useBalancingPeriods();
  const [inputs] = useBalancingInputs();
  const [imports] = useMaterialImports();
  const [opening, writeOpening] = useMaterialOpeningStock();
  const [materialTypes, setMaterialTypes] = useMaterialTypes();
  /** Bút chì sửa nhanh danh mục ngay trong ô chọn. */
  const materialTypeEditor = useQuickCatalogEdit("materialType", materialTypes, setMaterialTypes, { matchBy: "name" });
  const [locks] = useProductionLocks();
  /** Sổ bán nội địa (mig 0054) — NL bán thẳng ghi ở /wip, là khoản XUẤT trừ tồn. */
  const [domesticSales] = useDomesticSales();

  const [period, setPeriod] = useState<ViewPeriod>("month");
  const [anchor, setAnchor] = useState(todayIso());
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [workshopFilter, setWorkshopFilter] = useState<string>("Tất cả");
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);

  // Dialog tồn đầu
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [form, setForm] = useState<OpeningForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);

  const workshop = workshopFilter === "Tất cả" ? undefined : (workshopFilter as Workshop);

  const data = useMemo(
    () =>
      computeMaterialTotalStock(
        periods,
        inputs,
        imports,
        opening,
        locks,
        { fromDate, toDate, workshop },
        domesticSales,
      ),
    [periods, inputs, imports, opening, locks, fromDate, toDate, workshop, domesticSales],
  );

  const hasFreezeOrThaw = data.totalFreezeDepositKg > 0 || data.totalThawKg > 0;
  // Còn dở SX ghi ở ngày KHÔNG có kỳ cân đối nào phủ → không lọt vào cột "Đông gửi"
  // (info) nào. Gọi tên thay vì để số biến mất (luật "màn tự giải thích").
  const unmatchedLeftover = useMemo(
    () => sumUnmatchedLeftover(periods, locks, { fromDate, toDate, workshop }),
    [periods, locks, fromDate, toDate, workshop],
  );

  const cards: StatCardData[] = [
    { label: "Tồn đầu kỳ", value: `${num(data.totalOpeningKg)} kg`, numeric: true, icon: Snowflake, color: "neutral" },
    { label: "Nhập trong kỳ", value: `${num(data.totalInKg)} kg`, numeric: true, icon: ArrowDownToLine, color: "brand" },
    { label: "Xuất SX (chờ)", value: "0 kg", numeric: true, icon: Truck, color: "neutral" },
    { label: "Bán nội địa", value: `${num(data.totalDomesticSaleKg)} kg`, numeric: true, icon: Store, color: "warning" },
    { label: "Tồn cuối (chưa trừ SX)", value: `${num(data.totalClosingKg)} kg`, numeric: true, icon: Scale, color: "success" },
  ];

  // Bảng tồn theo NGÀY (mọi họ gộp) — trục "theo ngày" cho BGĐ.
  const dateColumns: SummaryTableColumn<MaterialTotalStockDay>[] = [
    {
      key: "date",
      header: "Ngày",
      render: (r) => <span className="font-semibold text-foreground">{formatDateVN(r.date)}</span>,
    },
    {
      key: "nhap",
      header: "Nhập (kg)",
      numeric: true,
      render: (r) => <span className="font-semibold text-primary">+{num(r.inKg)}</span>,
      total: () => num(data.totalInKg),
    },
    {
      key: "xuatSX",
      header: "Xuất SX (kg)",
      numeric: true,
      render: () => <span className="text-muted-foreground">—</span>,
      total: () => "—",
    },
    {
      key: "banNoiDia",
      header: "Bán nội địa (kg)",
      numeric: true,
      render: (r) =>
        r.domesticSaleKg > 0 ? (
          <span className="font-semibold text-warning">−{num(r.domesticSaleKg)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      total: () => (data.totalDomesticSaleKg > 0 ? `−${num(data.totalDomesticSaleKg)}` : "—"),
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối ngày (kg)",
      numeric: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.closingKg)}</span>,
    },
  ];

  // Bảng tồn theo LOẠI (họ) NL.
  const materialFamilyColumns: SummaryTableColumn<MaterialTotalStockFamily>[] = [
    {
      key: "hoNL",
      header: "Loại nguyên liệu",
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{r.materialFamily}</span>
          {r.hasManualOpening && <Tag variant="source">Tồn đầu khai tay</Tag>}
          {r.isNegative && (
            <Tag variant="error" icon={AlertTriangle}>
              Tồn âm
            </Tag>
          )}
        </div>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", numeric: true, render: (r) => num(r.openingKg), total: () => num(data.totalOpeningKg) },
    {
      key: "nhapKy",
      header: "Nhập (kg)",
      numeric: true,
      render: (r) => <span className="font-semibold text-primary">+{num(r.inPeriodKg)}</span>,
      total: () => num(data.totalInKg),
    },
    {
      key: "xuatSX",
      header: "Xuất SX (kg)",
      numeric: true,
      render: () => <span className="text-muted-foreground">—</span>,
      total: () => "—",
    },
    {
      key: "banNoiDia",
      header: "Bán nội địa (kg)",
      numeric: true,
      render: (r) =>
        r.domesticSaleKg > 0 ? (
          <span className="font-semibold text-warning">−{num(r.domesticSaleKg)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      total: () => (data.totalDomesticSaleKg > 0 ? `−${num(data.totalDomesticSaleKg)}` : "—"),
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
      total: () => num(data.totalClosingKg),
    },
    // Cột THÔNG TIN (kho đông dự trữ) — không vào tồn.
    {
      key: "dongGui",
      header: "Đông gửi (kho đông)",
      numeric: true,
      render: (r) => <span className="text-muted-foreground">{r.freezeDepositKg > 0 ? num(r.freezeDepositKg) : "—"}</span>,
      total: () => (data.totalFreezeDepositKg > 0 ? num(data.totalFreezeDepositKg) : "—"),
    },
    {
      key: "xaDong",
      header: "Xả đông (kho đông)",
      numeric: true,
      render: (r) => <span className="text-muted-foreground">{r.thawKg > 0 ? num(r.thawKg) : "—"}</span>,
      total: () => (data.totalThawKg > 0 ? num(data.totalThawKg) : "—"),
    },
  ];

  // ----- Tồn đầu: thêm / xóa -----
  const materialTypeOptions: ComboboxOption[] = materialTypes.map((m) => ({ value: m.name, label: m.name }));

  const openAddOpening = () => {
    setForm({
      workshop: (workshop ?? "Đông") as Workshop,
      materialTypeName: "",
      asOfDate: todayIso(),
      quantityKg: null,
      note: "",
    });
    setErrors([]);
  };

  const saveOpening = () => {
    if (!form) return;
    const ls: FieldError[] = [];
    if (!form.materialTypeName.trim())
      ls.push({ field: "Loại nguyên liệu", message: "Chưa chọn loại nguyên liệu" });
    if (!form.asOfDate) ls.push({ field: "Ngày mốc", message: "Chưa chọn ngày tồn đầu" });
    if (!(Number(form.quantityKg) > 0))
      ls.push({ field: "Khối lượng", message: "Phải lớn hơn 0 kg" });
    setErrors(ls);
    if (ls.length > 0) return;
    const newOpening: MaterialOpeningStock = {
      id: uid(),
      workshop: form.workshop,
      materialTypeName: form.materialTypeName.trim(),
      asOfDate: form.asOfDate,
      quantityKg: Number(form.quantityKg),
      note: form.note.trim(),
    };
    writeOpening([...opening, newOpening]);
    notify.saved(`Đã lưu tồn đầu ${num(newOpening.quantityKg)} kg — ${newOpening.materialTypeName}`);
    setForm(null);
  };

  const deleteOpening = (id: string) => {
    writeOpening(opening.filter((o) => o.id !== id));
    notify.deleted("Đã xóa dòng tồn đầu");
  };

  const filteredOpening = useMemo(
    () => (workshop ? opening.filter((o) => o.workshop === workshop) : opening),
    [opening, workshop],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Snowflake className="h-8 w-8 text-primary" />
            Tồn kho nguyên liệu (Nhập – Xuất – Tồn)
            {isReadOnly && <ReadOnlyBadge />}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Tồn suy thẳng từ sổ Nhập hàng: <b>Tồn cuối = Tồn đầu + Nhập − Xuất SX − Bán nội địa</b>. Cả 3 phân
            xưởng, xem theo ngày.
          </p>
        </div>
        <Button
          title="Khai tồn đầu kho nguyên liệu cho các loại chưa có kỳ trước để kế thừa — không có số này thì kỳ đầu tiên tính thiếu." variant="outline" onClick={() => setIsOpeningOpen(true)}>
          <PackagePlus className="mr-2 h-4 w-4" />
          Tồn đầu ({filteredOpening.length})
        </Button>
      </div>

      {/* Bộ chọn kỳ + phân xưởng */}
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
        <div className="min-w-[10rem]">
          <Combobox
            label="Phân xưởng"
            hideRequiredMark
            clearable={false}
            value={workshopFilter}
            onChange={setWorkshopFilter}
            options={WORKSHOP_OPTIONS}
          />
        </div>
      </div>

      <StatCardGrid cards={cards} />

      {/* Chú thích phạm vi — trung thực (nhất là với BGĐ) */}
      <div className="flex flex-wrap items-start gap-3 rounded-xl border-2 border-warning bg-warning/10 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <span className="text-base text-warning">
          <b>Xuất SX chưa được ghi</b> (màn Sản xuất chưa có ô "NL lấy ra sản xuất") nên tạm = 0 —
          tồn hiện là <b>tồn theo nhập, CHƯA trừ phần đưa vào chế biến</b>. Cột "Đông gửi / Xả đông"
          là thông tin kho đông dự trữ (vòng gối đầu ở Cân đối), <b>không cộng vào tồn</b>.
        </span>
      </div>

      {/* Còn dở SX ghi ở ngày không có kỳ cân đối phủ → không hiện ở cột đông gửi
          info nào. Gọi tên thay vì để số biến mất. */}
      {unmatchedLeftover > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-warning bg-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-hidden />
          <span className="text-base font-semibold text-warning">
            {num(unmatchedLeftover)} kg còn dở SX chưa hiện ở đâu — ghi ở ngày CHƯA có kỳ cân đối nào (cùng
            họ NL) phủ. Tạo kỳ cân đối phủ ngày đó ở màn Cân đối để phần còn dở vào cột "Đông gửi".
          </span>
        </div>
      )}

      {/* Cảnh báo tồn âm — bộ dò lỗi ghi chép */}
      {data.warningCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <span className="text-base font-semibold text-destructive">
            {data.warningCount} loại có tồn cuối ÂM — kiểm lại tồn đầu / nhập hàng đã ghi đúng chưa.
          </span>
        </div>
      )}

      {data.familyCount === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Chưa có nhập hàng nào trong khoảng ngày này"
          description="Đổi lại Kỳ báo cáo / phân xưởng, hoặc ghi chuyến nhập ở màn Nhập hàng trước. Có thể khai Tồn đầu để cộng vào tồn."
        />
      ) : (
        <>
          {/* Tồn theo NGÀY */}
          {data.days.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Tồn theo ngày</h3>
              <SummaryTable
                rows={data.days}
                columns={dateColumns}
                getKey={(r) => r.date}
                rowMarkKey={`ton-nl-ngay|${workshopFilter}`}
                emptyText="Không có ngày nào có nhập."
              />
            </section>
          )}

          {/* Tồn theo loại NL */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Tồn theo loại nguyên liệu</h3>
            <SummaryTable
              rows={data.families}
              columns={materialFamilyColumns}
              getKey={(r) => r.materialFamily}
              rowMarkKey={`ton-nl-ho|${fromDate}|${toDate}|${workshopFilter}`}
              emptyText="Chưa có loại nguyên liệu nào."
            />
          </section>
        </>
      )}

      {/* Dialog quản lý Tồn đầu */}
      <Dialog open={isOpeningOpen} onOpenChange={setIsOpeningOpen}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tồn đầu kho nguyên liệu</DialogTitle>
            <DialogDescription className="text-base">
              Số dư nguyên liệu có sẵn TRƯỚC khi dùng app (baseline một lần). Đặt "tính từ ngày" =
              ngày ĐẦU TIÊN app bắt đầu tính nhập (VD 01/07 cho tồn cuối 30/06) — chuyến nhập trước
              ngày đó coi như đã nằm trong số này, nhập từ ngày đó trở đi cộng thêm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Danh sách đang có */}
            {filteredOpening.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border-2 border-border">
                {filteredOpening.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span className="min-w-0 flex-1 text-base">
                      <span className="font-semibold">{o.materialTypeName}</span>
                      {" — "}
                      <span className="tnum font-semibold">{num(o.quantityKg)}</span> kg
                      <span className="text-muted-foreground">
                        {" "}
                        · từ {formatDateVN(o.asOfDate)} · xưởng {o.workshop}
                        {o.note ? ` · ${o.note}` : ""}
                      </span>
                    </span>
                    {allowed.delete && (
                      <ConfirmDelete
                        recordDescription={`${o.materialTypeName} — ${num(o.quantityKg)} kg (từ ${formatDateVN(o.asOfDate)})`}
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
                Chưa khai tồn đầu nào cho xưởng này.
              </p>
            )}

            {/* Form thêm */}
            {form ? (
              <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/30 p-4">
                <ErrorSummary errors={errors} />
                <RequiredLegend />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Combobox
                    label="Phân xưởng"
                    required
                    clearable={false}
                    value={form.workshop}
                    onChange={(v) => setForm((f) => (f ? { ...f, workshop: v as Workshop } : f))}
                    options={WORKSHOP_OPTIONS.filter((o) => o.value !== "Tất cả")}
                  />
                  <Combobox
                    label="Loại nguyên liệu"
                    required
                    value={form.materialTypeName}
                    onChange={(v) => setForm((f) => (f ? { ...f, materialTypeName: v } : f))}
                    onCreate={(t) => t}
                    options={materialTypeOptions}
                    onEditItem={materialTypeEditor.openEdit}
                    editLabel={materialTypeEditor.editLabel}
                    canEdit={materialTypeEditor.canEdit}
                    hint="Chọn hoặc gõ tên loại; gõ đúng tên trong sổ Nhập hàng để khớp họ."
                  />
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
                </div>
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
                  title="Khai thêm tồn đầu cho một loại nguyên liệu nữa." variant="outline" onClick={openAddOpening}>
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

      {/* Chú thích đơn vị + cách đọc */}
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Truck className="size-icon-sm" aria-hidden />
        "Nhập" lấy từ sổ Nhập hàng (mọi chuyến nhập trong kỳ).{" "}
        {hasFreezeOrThaw
          ? "Đông gửi / Xả đông là số kho đông dự trữ (Cân đối) — chỉ để tham khảo, không vào tồn."
          : "Chưa có đông gửi / xả đông nào trong kỳ."}
      </p>
      {materialTypeEditor.dialog}
    </div>
  );
}
