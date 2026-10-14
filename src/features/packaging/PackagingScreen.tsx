// ============================================================
// Tên file: src/features/packaging/PackagingScreen.tsx
// Tên tiếng Việt: Màn hình Đóng gói Bán thành phẩm → Thành phẩm
// Description: Packaging Screen — BTP consumed → packaged finished goods (G3)
// ============================================================
import { useMemo, useState } from "react";
import type { Packaging, Product, Workshop } from "@/types";
import { computePackagingLoss, BSF1_WAREHOUSES } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  usePackagings,
  useWipProductions,
  useExportItems,
  useSalesItems,
  useProducts,
  useLotInputs,
  useLotDispatches,
} from "@/lib/catalogRepo";
import { LotInputPicker, LotQrLabels } from "@/features/shared";
import { formatFinishedGoodLotLabel, buildLotNode } from "@/lib/lotTraceability";
import {
  computeWipStock,
  getAvailableKg,
  filterRetailSales,
  collectWipDeductions,
  computeFinishedGoodStock,
  FG_WAREHOUSE,
} from "@/lib/inventory";
import {
  Button,
  RequiredLegend,
  Combobox,
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
  Tag,
  NumberField,
  RecordTable,
  TableSkeleton,
  StatCardGrid,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { kg, num, todayISO, formatDateVN } from "@/lib/format";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import { Boxes, CalendarRange, Link2, Package, PackageCheck, Plus, QrCode, Scale } from "lucide-react";

const WORKSHOPS: Workshop[] = ["Đông", "Cá", "Khô"];
const FG_WAREHOUSE_NAMES = BSF1_WAREHOUSES.map((w) => w.name);

interface FormDG {
  date: string;
  workshop: Workshop;
  fromProductId: string;
  fromSpec: string;
  inputKg: number;
  inputBlocks: number;
  toProductId: string;
  toSpec: string;
  outputKg: number;
  outputUnits: number;
  warehouse: string;
  note: string;
}

export default function PackagingScreen() {
  const [rows, persist, { status }] = usePackagings();
  const isLoading = status === "loading" && rows.length === 0;
  const [wips] = useWipProductions();
  const [exportItems] = useExportItems();
  const [salesItems] = useSalesItems();
  const [products, setProducts] = useProducts();
  /** Bút chì sửa nhanh danh mục ngay trong ô chọn. */
  const productEditor = useQuickCatalogEdit("product", products, setProducts);

  const [period, setPeriod] = useState<ViewPeriod>("day");
  const [date, setDate] = useState(todayISO());
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [workshop, setWorkshop] = useState<Workshop | "Tất cả">("Đông");

  const [form, setForm] = useState<FormDG | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  // Truy xuất lô (docs/spec/qr-truy-xuat-lo.md): gắn lô BTP cho phiếu + in tem lô TP.
  const [lotInputs] = useLotInputs();
  const [lotDispatches] = useLotDispatches();
  const [lotTarget, setLotTarget] = useState<Packaging | null>(null);
  const [lotLabel, setLotLabel] = useState<Packaging | null>(null);
  const countLotInputs = (id: string) => lotInputs.filter((l) => l.outputKind === "P" && l.outputId === id).length;

  const [effectiveFrom, effectiveTo] = getViewPeriodRange(period, date, fromDate, toDate);
  const isSingleDay = effectiveFrom === effectiveTo;
  const rangeDescription = isSingleDay
    ? formatDateVN(effectiveFrom)
    : `${formatDateVN(effectiveFrom)} – ${formatDateVN(effectiveTo)}`;

  const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";
  const productOptions: ComboboxOption[] = products.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    subLabel: m.code || undefined,
  }));

  /* Tồn BTP khả dụng: sản xuất − xuất − bán lẻ block thô − ĐÃ đóng gói. */
  const wipDeductions = useMemo(
    () => collectWipDeductions(salesItems, rows, lotInputs, lotDispatches),
    [salesItems, rows, lotInputs, lotDispatches]
  );
  const wipStock = useMemo(
    () => computeWipStock(wips, exportItems, wipDeductions),
    [wips, exportItems, wipDeductions]
  );
  /* Tồn TP đóng gói (chưa trừ bán TP ở đây — chỉ để xem đã đóng gói bao nhiêu còn kho). */
  const finishedGoodStock = useMemo(() => computeFinishedGoodStock(rows, filterRetailSales(salesItems, FG_WAREHOUSE)), [rows, salesItems]);

  const view = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.date >= effectiveFrom &&
            r.date <= effectiveTo &&
            (workshop === "Tất cả" || r.workshop === workshop)
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    [rows, effectiveFrom, effectiveTo, workshop]
  );

  const totalIn = view.reduce((s, r) => s + (r.inputKg || 0), 0);
  const totalOut = view.reduce((s, r) => s + (r.outputKg || 0), 0);
  const totalLoss = totalIn - totalOut;
  const totalFinishedGoodStock = finishedGoodStock.reduce((s, t) => s + Math.max(0, t.remainingKg), 0);

  const postingDate = isSingleDay ? effectiveFrom : effectiveTo;
  const recordWorkshop: Workshop = workshop === "Tất cả" ? "Đông" : workshop;

  const addProduct = (name: string): string => {
    // Nhãn có mã số nên ô chọn không tự nhận ra tên trùng ⇒ trùng tên (không phân
    // hoa thường) thì dùng lại bản có sẵn.
    const existing = products.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const m: Product = { id: uid(), code: "", name, finishedGoodCode: "", category: "", materialTypeId: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${name}"`);
    return m.id;
  };

  const openAdd = () => {
    setForm({
      date: postingDate,
      workshop: recordWorkshop,
      fromProductId: "",
      fromSpec: "",
      inputKg: 0,
      inputBlocks: 0,
      toProductId: "",
      toSpec: "",
      outputKg: 0,
      outputUnits: 0,
      warehouse: FG_WAREHOUSE_NAMES[0] ?? "",
      note: "",
    });
    setErrors([]);
  };
  const setField = <K extends keyof FormDG>(k: K, v: FormDG[K]) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  const wipAvailable = form?.fromProductId
    ? getAvailableKg(wipStock, form.fromProductId, form.fromSpec.trim())
    : null;
  const exceedsWipStock = wipAvailable != null && form != null && form.inputKg > wipAvailable;
  const haoAm = form != null && form.outputKg > form.inputKg;

  const save = () => {
    if (!form) return;
    const ls: FieldError[] = [];
    if (!form.fromProductId) ls.push({ field: "BTP tiêu hao", message: "Chưa chọn mặt hàng BTP" });
    if (!(form.inputKg > 0)) ls.push({ field: "BTP vào (kg)", message: "Phải lớn hơn 0" });
    if (!form.toProductId) ls.push({ field: "Thành phẩm ra", message: "Chưa chọn mặt hàng TP" });
    if (!(form.outputKg > 0)) ls.push({ field: "TP ra (kg)", message: "Phải lớn hơn 0" });
    setErrors(ls);
    if (ls.length > 0) return;

    const p: Packaging = {
      id: newId(),
      date: form.date,
      workshop: form.workshop,
      fromProductId: form.fromProductId,
      fromSpec: form.fromSpec.trim(),
      inputKg: form.inputKg,
      inputBlocks: form.inputBlocks,
      toProductId: form.toProductId,
      toSpec: form.toSpec.trim(),
      outputKg: form.outputKg,
      outputUnits: form.outputUnits,
      warehouse: form.warehouse,
      note: form.note,
    };
    persist([...rows, p]);
    notify.saved(
      `Đã đóng gói: ${productNameOf(p.fromProductId)} ${kg(p.inputKg)} → ${productNameOf(p.toProductId)} ${kg(p.outputKg)}`,
      undefined,
      { label: "In tem", onClick: () => setLotLabel(p) }
    );
    setForm(null);
  };

  const remove = (r: Packaging) => {
    const prevRows = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.deleted(`Đã xóa phiếu đóng gói ${productNameOf(r.toProductId)}`, () => persist(prevRows));
  };

  const columns: RecordTableColumn<Packaging>[] = [
    { key: "date", header: "Ngày", primary: true, render: (r) => formatDateVN(r.date), getSortValue: (r) => r.date },
    { key: "workshop", header: "Xưởng", render: (r) => r.workshop },
    {
      key: "from",
      header: "BTP tiêu hao",
      render: (r) => (
        <span>
          {productNameOf(r.fromProductId)}
          {r.fromSpec ? <span className="text-muted-foreground"> · {r.fromSpec}</span> : null}
          <span className="tnum"> — {num(r.inputKg)} kg</span>
          {r.inputBlocks ? <span className="text-muted-foreground"> · {num(r.inputBlocks)} block</span> : null}
        </span>
      ),
    },
    {
      key: "to",
      header: "Thành phẩm ra",
      render: (r) => (
        <span>
          {productNameOf(r.toProductId)}
          {r.toSpec ? <span className="text-muted-foreground"> · {r.toSpec}</span> : null}
          <span className="tnum"> — {num(r.outputKg)} kg</span>
          {r.outputUnits ? <span className="text-muted-foreground"> · {num(r.outputUnits)} thùng</span> : null}
        </span>
      ),
    },
    {
      key: "hao",
      header: "Hao hụt (kg)",
      numeric: true,
      render: (r) => {
        const h = computePackagingLoss(r);
        return <span className={h < 0 ? "tnum text-warning" : "tnum"}>{num(h)}</span>;
      },
      getSortValue: (r) => computePackagingLoss(r),
    },
    { key: "kho", header: "Kho TP", render: (r) => r.warehouse || "—" },
    {
      key: "xoa",
      header: "",
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button
            title="Ghi phiếu này đã đóng từ lô bán thành phẩm nào (quét tem, gõ mã, hoặc chọn). Có lô thì mới truy được nguồn của thành phẩm."
            variant={countLotInputs(r.id) ? "outline" : "default"}
            size="sm"
            onClick={() => setLotTarget(r)}
          >
            <Link2 />
            {countLotInputs(r.id) ? `Lô BTP (${countLotInputs(r.id)})` : "Gắn lô BTP"}
          </Button>
          <Button
            title="In tem QR lô thành phẩm của phiếu này để dán lên thùng. Quét tem là ra nguồn gốc."
            variant="outline"
            size="sm"
            onClick={() => setLotLabel(r)}
          >
            <QrCode />
            Tem
          </Button>
          <Button
            title="Xóa phiếu đóng gói này. Tồn bán thành phẩm và tồn thành phẩm sẽ được tính lại." variant="danger" size="sm" onClick={() => remove(r)}>
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Đóng gói thành phẩm</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bán thành phẩm (còn khuôn đá) → đóng gói thành thành phẩm sẵn bán. Đóng gói trừ tồn dự trữ, cộng tồn thành phẩm.
          </p>
        </div>
        <Button
          title="Ghi một phiếu đóng gói: trừ bán thành phẩm đem đóng, cộng thành phẩm ra, phần chênh là hao hụt." size="lg" onClick={openAdd}>
          <Plus />
          Ghi phiếu đóng gói
        </Button>
      </div>

      <StatCardGrid
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        cards={[
          { label: "Đang xem", value: rangeDescription, icon: CalendarRange, color: "neutral" },
          { label: "Số phiếu", value: view.length, numeric: true, icon: Package, color: "brand" },
          { label: "BTP vào", value: kg(totalIn), numeric: true, icon: Scale, color: "neutral" },
          { label: "TP ra", value: kg(totalOut), numeric: true, icon: PackageCheck, color: "success" },
          { label: "Hao hụt", value: kg(totalLoss), numeric: true, icon: Scale, color: totalLoss < 0 ? "warning" : "neutral" },
        ]}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
        <Combobox
          label="Kỳ xem"
          hideRequiredMark
          clearable={false}
          value={period}
          onChange={(v) => setPeriod(v as ViewPeriod)}
          options={PERIOD_OPTIONS}
          className="min-w-[13rem]"
        />
        <div className="min-w-[220px] flex-1">
          {period === "custom" ? (
            <DateRangeField
              label="Khoảng ngày"
              hideRequiredMark
              presets={false}
              startDate={fromDate}
              endDate={toDate}
              onChange={(fromDate, toDate) => {
                setFromDate(fromDate);
                setToDate(toDate);
              }}
            />
          ) : (
            <DateField label="Ngày" hideRequiredMark value={date} onChange={setDate} />
          )}
        </div>
        <Combobox
          label="Phân xưởng"
          clearable={false}
          value={workshop}
          onChange={(v) => setWorkshop(v as Workshop | "Tất cả")}
          options={[{ value: "Tất cả", label: "Tất cả" }, ...WORKSHOPS.map((p) => ({ value: p, label: p }))]}
          className="min-w-[12rem]"
        />
      </div>

      {/* Tồn thành phẩm đóng gói còn kho */}
      {finishedGoodStock.some((t) => t.remainingKg > 0) && (
        <section className="grid gap-3 rounded-xl border-2 border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Tồn thành phẩm đóng gói</h2>
            <Tag variant="muted" icon={Boxes}>
              {kg(totalFinishedGoodStock)}
            </Tag>
          </div>
          <div className="flex flex-wrap gap-2">
            {finishedGoodStock
              .filter((t) => t.remainingKg > 0)
              .map((t) => (
                <span
                  key={`${t.productId}|${t.spec}`}
                  className="rounded-lg border-2 border-border px-3 py-1.5 text-sm"
                >
                  {productNameOf(t.productId)}
                  {t.spec ? <span className="text-muted-foreground"> · {t.spec}</span> : null}:{" "}
                  <span className="tnum font-semibold text-foreground">{kg(t.remainingKg)}</span>
                </span>
              ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : view.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Chưa có phiếu đóng gói"
          description="Bấm “Ghi phiếu đóng gói” để chuyển bán thành phẩm thành thành phẩm đóng gói."
        />
      ) : (
        <RecordTable columns={columns} rows={view} getKey={(r) => r.id} rowMarkKey="dong-goi" />
      )}

      {/* Dialog ghi phiếu */}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Ghi phiếu đóng gói</DialogTitle>
            <DialogDescription className="text-base">
              BTP tiêu hao (trừ tồn dự trữ) → thành phẩm đóng gói ra (cộng tồn thành phẩm). Chênh lệch là hao hụt.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={errors} />
              <RequiredLegend />

              <div className="grid gap-6 sm:grid-cols-2">
                <DateField label="Ngày đóng gói" required value={form.date} onChange={(v) => setField("date", v)} />
                <Combobox
                  label="Phân xưởng"
                  required
                  clearable={false}
                  value={form.workshop}
                  onChange={(v) => setField("workshop", v as Workshop)}
                  options={WORKSHOPS.map((p) => ({ value: p, label: p }))}
                />
              </div>

              <div className="space-y-5 rounded-xl border-2 border-border p-4">
                <p className="text-base font-semibold">Bán thành phẩm tiêu hao</p>
                <Combobox
                  label="Mặt hàng BTP"
                  required
                  value={form.fromProductId}
                  onChange={(v) => setField("fromProductId", v)}
                  options={productOptions}
                  onEditItem={productEditor.openEdit}
                  editLabel={productEditor.editLabel}
                  onCreate={addProduct}
                  emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                />
                <Field label="Quy cách BTP" hint="Size/grade của lô BTP. VD: 230-250.">
                  <Input value={form.fromSpec} onChange={(e) => setField("fromSpec", e.target.value)} placeholder="VD: 230-250" />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField label="BTP vào" required unit="kg" value={form.inputKg || null} onChange={(v) => setField("inputKg", v ?? 0)} />
                  <NumberField label="Số block" unit="block" value={form.inputBlocks || null} onChange={(v) => setField("inputBlocks", v ?? 0)} />
                </div>
                {wipAvailable != null ? (
                  <div
                    className={
                      exceedsWipStock
                        ? "rounded-lg bg-warning-surface px-4 py-3 text-base text-warning"
                        : "rounded-lg bg-muted px-4 py-3 text-base text-muted-foreground"
                    }
                  >
                    Tồn BTP khả dụng: <span className="tnum font-semibold">{kg(wipAvailable)}</span>
                    {exceedsWipStock ? " — đóng gói vượt tồn, kiểm lại (vẫn ghi được, tồn báo âm)." : ""}
                  </div>
                ) : null}
              </div>

              <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                <p className="text-base font-semibold">Thành phẩm đóng gói ra</p>
                <Combobox
                  label="Mặt hàng TP"
                  required
                  hint="Thành phẩm đã đóng gói (có thể khác mã BTP)."
                  value={form.toProductId}
                  onChange={(v) => setField("toProductId", v)}
                  options={productOptions}
                  onEditItem={productEditor.openEdit}
                  editLabel={productEditor.editLabel}
                  onCreate={addProduct}
                  emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                />
                <Field label="Quy cách đóng gói" hint="VD: thùng 10 kg, hộp 1 kg.">
                  <Input value={form.toSpec} onChange={(e) => setField("toSpec", e.target.value)} placeholder="VD: hộp 1 kg" />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField label="TP ra" required unit="kg" value={form.outputKg || null} onChange={(v) => setField("outputKg", v ?? 0)} />
                  <NumberField label="Số thùng" unit="thùng" value={form.outputUnits || null} onChange={(v) => setField("outputUnits", v ?? 0)} />
                </div>
                <Combobox
                  label="Kho chứa TP"
                  clearable={false}
                  value={form.warehouse}
                  onChange={(v) => setField("warehouse", v)}
                  options={FG_WAREHOUSE_NAMES.map((k) => ({ value: k, label: k }))}
                />
                {haoAm ? (
                  <div className="rounded-lg bg-warning-surface px-4 py-3 text-base text-warning">
                    TP ra ({kg(form.outputKg)}) lớn hơn BTP vào ({kg(form.inputKg)}) — hao hụt âm, kiểm lại số.
                  </div>
                ) : form.inputKg > 0 && form.outputKg > 0 ? (
                  <div className="rounded-lg bg-muted px-4 py-3 text-base text-muted-foreground">
                    Hao hụt: <span className="tnum font-semibold">{kg(form.inputKg - form.outputKg)}</span>
                  </div>
                ) : null}
              </div>

              <Field label="Ghi chú">
                <Input value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Ghi chú (nếu có)" />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setForm(null)}>
              Hủy
            </Button>
            <Button variant="save"
              title="Ghi phiếu này vào sổ — trừ tồn bán thành phẩm và cộng tồn thành phẩm ngay." size="lg" onClick={save}>
              <PackageCheck />
              Ghi đóng gói
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {lotTarget && (
        <LotInputPicker
          outputKind="P"
          outputId={lotTarget.id}
          outputLabel={`phiếu ${formatFinishedGoodLotLabel(lotTarget)} · ${productNameOf(lotTarget.toProductId)}`}
          workshop={lotTarget.workshop}
          date={lotTarget.date}
          productId={lotTarget.fromProductId}
          onClose={() => setLotTarget(null)}
        />
      )}
      {lotLabel && (
        <LotQrLabels
          node={buildLotNode("P", lotLabel.id, {
            shipments: [], imports: [], wips,
            packagings: rows.some((r) => r.id === lotLabel.id) ? rows : [...rows, lotLabel], lotInputs,
            exportItems: [], exportOrders: [], salesOrders: [], products, customers: [],
          })}
          onClose={() => setLotLabel(null)}
        />
      )}
      {productEditor.dialog}
    </div>
  );
}
