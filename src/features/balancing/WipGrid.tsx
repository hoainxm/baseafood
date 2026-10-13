// ============================================================
// Tên file: src/features/balancing/WipGrid.tsx
// Tên tiếng Việt: Khối 2 — lưới bán thành phẩm sản xuất theo ngày
// Description: Balancing block 2 — WIP output day grid
// ============================================================
import { useMemo, useState } from "react";
import type {
  BalancingOutputItem,
  Customer,
  DailyQuantities,
  Product,
  SalesInvoice,
  SalesItem,
} from "@/types";
import { sumGridRow } from "@/types";
import { uid } from "@/lib/db";
import {
  OTHER_CUSTOMER_ID,
  setRepaidDebt,
  finishedGoodTemplateKey,
  productSpecKey,
  formatDayLabel,
  type FinishedGoodTemplateRow,
  type FinishedGoodGridRow,
} from "@/lib/balancingGrid";
import type { DayCell, PeriodGrid } from "./usePeriodGrid";
import { BackdateReasonDialog, AddProductDialog } from "./gridDialogs";
import {
  Button,
  Combobox,
  EmptyState,
  EditableGrid,
  notify,
  type GridColumn,
  type GridRow,
} from "@/design-system";
import { num, formatDateVN } from "@/lib/format";
import { ChevronsLeftRight, Download, EyeOff, Layers, Plus } from "lucide-react";

export function WipGrid({
  grid,
  matHang: products,
  customers,
  onCreateProduct: onAddProduct,
  onCreateCustomer: onAddCustomer,
  onEditProduct,
  onEditCustomer,
  choHutBan,
  onHutBan,
  daysCollapsed: isDateColumnsCollapsed,
  onToggleDays: onToggleDayColumns,
}: {
  grid: PeriodGrid;
  matHang: Product[];
  customers: Customer[];
  onCreateProduct: (ten: string) => string;
  onCreateCustomer: (ten: string) => string;
  /** Bút chì sửa nhanh bản ghi danh mục (value = id). */
  onEditProduct?: (id: string) => void;
  onEditCustomer?: (id: string) => void;
  /** Seam cũ: dòng sổ BÁN trong khoảng ngày, dùng khi output = hàng đã bán ra. */
  choHutBan: { ban: SalesItem; invoice: SalesInvoice }[];
  onHutBan: (items: { ban: SalesItem; invoice: SalesInvoice }[]) => void;
  /** Dùng chung với khối nguyên liệu — xem ghi chú ở MaterialGrid. */
  daysCollapsed: boolean;
  onToggleDays: () => void;
}) {
  const { date: dates, outputs: finishedGoods, finishedGoodRows, pendingWips, saveOutputs: saveFinishedGoods, pullWips: pullProduction, saveWipDayCells: saveProductionMultiDay, lockedDates, templatePeriod, missingTemplateRows: missingTemplates, goiY } =
    grid;
  const [isAdding, setIsAdding] = useState(false);
  const [reasonPrompt, setReasonPrompt] = useState<{ cells: DayCell[]; date: string } | null>(null);
  /** Ẩn dòng chưa có số (dòng mẫu + dòng 0 kg) — MẶC ĐỊNH ẨN, xem gọn như bản in. */
  const [hideEmptyRows, setHideEmptyRows] = useState(true);
  /** Dòng vừa thêm trong phiên này — vẫn hiện dù chưa có số, kẻo thêm xong là biến mất. */
  const [justAdded, setJustAdded] = useState<Set<string>>(() => new Set());
  const rememberJustAdded = (id: string) => setJustAdded((s) => new Set(s).add(id));

  const theoId = useMemo(() => new Map(finishedGoods.map((r) => [r.id, r])), [finishedGoods]);
  const productName = (id: string) => products.find((m) => m.id === id)?.name || "—";
  /** Khách BẮT BUỘC (không có nút bỏ chọn) — chưa rõ khách thì chọn "Khác". */
  const customerOptions = useMemo(
    () => [...customers.map((k) => ({ value: k.id, label: k.name })), { value: OTHER_CUSTOMER_ID, label: "Khác" }],
    [customers]
  );

  /* ---------- (A) Dòng MẪU: ảo, chưa lưu. Gõ số / chọn khách / gõ giá vào dòng nào
     thì dòng đó mới thành dòng thật (nhập tay, như "Thêm mặt hàng") — kỳ không bị
     rác bởi mấy chục dòng 0 kg, công thức không đụng tới dòng chưa có số. ---------- */
  const templateById = useMemo(() => new Map(missingTemplates.map((m) => [`mau:${m.id}`, m])), [missingTemplates]);
  const createFromTemplate = (m: FinishedGoodTemplateRow, patch: Partial<BalancingOutputItem>): BalancingOutputItem => {
    const r: BalancingOutputItem = {
      id: uid(),
      periodId: grid.kyId,
      productId: m.productId,
      customerId: m.customerId,
      channel: m.channel,
      quantityKg: 0,
      unitPrice: m.unitPrice,
      spec: m.spec,
      salesItemId: "",
      dailyQuantities: {},
      carryOverKg: 0,
      carryOverPeriodId: "",
      autoSource: "",
      ...patch,
    };
    r.quantityKg = sumGridRow(r.dailyQuantities, r.carryOverKg);
    return r;
  };
  const templateRows: FinishedGoodGridRow[] = missingTemplates.map((m) => ({
    id: `mau:${m.id}`,
    matHangId: m.productId,
    khachId: m.customerId,
    quyCach: m.spec,
    kenh: m.channel,
    donGia: m.unitPrice,
    theoNgay: {},
    chuyenKy: 0,
    tra: 0,
    no: 0,
    tong: 0,
    tuSoSanXuat: false,
    nguonIds: [],
  }));
  const hasValues = (h: FinishedGoodGridRow) => h.tong !== 0 || h.tra !== 0 || h.no !== 0 || justAdded.has(h.id);
  /** Thứ tự hiển thị: dòng thật trước, dòng mẫu sau — cùng một mảng cho lưới lẫn dán khối. */
  const hangThat = hideEmptyRows ? finishedGoodRows.filter(hasValues) : finishedGoodRows;
  const visibleRows: FinishedGoodGridRow[] = hideEmptyRows ? hangThat : [...finishedGoodRows, ...templateRows];

  const writeRow = (id: string, patch: Partial<BalancingOutputItem>) => {
    const m = templateById.get(id);
    if (m) {
      saveFinishedGoods([...finishedGoods, createFromTemplate(m, patch)]);
      return;
    }
    saveFinishedGoods(
      finishedGoods.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...patch };
        if (updated.autoSource !== "production") {
          updated.quantityKg = sumGridRow(updated.dailyQuantities, updated.carryOverKg);
        }
        return updated;
      })
    );
  };

  const writeCell = (rowId: string, colKey: string, v: number | null) => {
    const m = templateById.get(rowId);
    if (m) {
      if (colKey === "tra") return writeRow(rowId, setRepaidDebt({}, { tra: v ?? 0 }));
      if (colKey === "no") return writeRow(rowId, setRepaidDebt({}, { no: v ?? 0 }));
      if (colKey === "donGia") return writeRow(rowId, { unitPrice: v });
      if (colKey.startsWith("ngay:") && v) return writeRow(rowId, { dailyQuantities: { [colKey.slice(5)]: v } });
      return;
    }
    const r = theoId.get(rowId);
    if (!r) return;
    /* Trả · Nợ: kế toán gõ số có dấu, Tổng = Σ ngày + Trả + Nợ (quy tắc chuyển kỳ). */
    if (colKey === "tra") return writeRow(rowId, setRepaidDebt(r, { tra: v ?? 0 }));
    if (colKey === "no") return writeRow(rowId, setRepaidDebt(r, { no: v ?? 0 }));
    if (colKey === "donGia") return writeRow(rowId, { unitPrice: v });
    if (!colKey.startsWith("ngay:")) return;

    const iso = colKey.slice(5);
    const kg = v ?? 0;
    if (r.autoSource === "production") {
      const o: DayCell = { rowKey: productSpecKey(r.productId, r.spec ?? ""), date: iso, kg };
      /* Ngày đã chốt sản xuất ⇒ đòi lý do trước khi đụng số đã gửi đi. */
      if (lockedDates.has(iso)) {
        setReasonPrompt({ cells: [o], date: iso });
        return;
      }
      saveProductionMultiDay([o], "");
      return;
    }
    const daily: DailyQuantities = { ...(r.dailyQuantities ?? {}) };
    if (kg === 0) delete daily[iso];
    else daily[iso] = kg;
    writeRow(rowId, { dailyQuantities: daily });
  };

  /**
   * Dán khối. Tách hai đường: dòng hút đi về sổ Sản xuất (một lần gọi cho cả
   * khối), dòng nhập tay ghi vào chính dòng lưới. Ô rơi vào ngày đã chốt bị bỏ
   * qua — sửa ngày đã chốt phải có lý do, không cho lọt qua đường dán.
   */
  const pasteBlock = (rowId: string, colKey: string, block: (number | null)[][]) => {
    if (!colKey.startsWith("ngay:")) return;
    const dateColumns = dates.map((iso) => `ngay:${iso}`);
    const iH = visibleRows.findIndex((h) => h.id === rowId);
    const iC = dateColumns.indexOf(colKey);
    if (iH < 0 || iC < 0) return;

    const productionCells: DayCell[] = [];
    const doiTay = new Map<string, DailyQuantities>();
    /* Dán trùm lên dòng MẪU ⇒ dòng đó thành dòng thật (nhập tay). */
    const fromTemplate = new Map<string, BalancingOutputItem>();
    let skippedLocked = 0;
    block.forEach((dong, i) =>
      dong.forEach((v, j) => {
        if (v == null) return;
        const h = visibleRows[iH + i];
        const column = dateColumns[iC + j];
        if (!h || !column) return;
        const m = templateById.get(h.id);
        if (m && !fromTemplate.has(h.id)) fromTemplate.set(h.id, createFromTemplate(m, {}));
        const original = fromTemplate.get(h.id) ?? theoId.get(h.id);
        if (!original) return;
        const iso = column.slice(5);
        if (original.autoSource === "production") {
          if (lockedDates.has(iso)) {
            skippedLocked++;
            return;
          }
          productionCells.push({
            rowKey: productSpecKey(original.productId, original.spec ?? ""),
            date: iso,
            kg: v,
          });
          return;
        }
        const daily = doiTay.get(h.id) ?? { ...(original.dailyQuantities ?? {}) };
        if (v === 0) delete daily[iso];
        else daily[iso] = v;
        doiTay.set(h.id, daily);
      })
    );

    if (doiTay.size > 0) {
      const createdFromTemplate = [...fromTemplate.entries()]
        .filter(([id]) => doiTay.has(id))
        .map(([id, r]) => {
          const daily = doiTay.get(id)!;
          return { ...r, dailyQuantities: daily, quantityKg: sumGridRow(daily, r.carryOverKg) };
        });
      saveFinishedGoods([
        ...finishedGoods.map((r) => {
          const daily = doiTay.get(r.id);
          if (!daily) return r;
          return { ...r, dailyQuantities: daily, quantityKg: sumGridRow(daily, r.carryOverKg) };
        }),
        ...createdFromTemplate,
      ]
      );
    }
    if (productionCells.length > 0) saveProductionMultiDay(productionCells, "");
    if (skippedLocked > 0) {
      notify.error(`Bỏ qua ${skippedLocked} ô rơi vào ngày đã chốt — sửa từng ô để ghi lý do.`);
    }
  };

  const gridColumns: GridColumn<FinishedGoodGridRow>[] = [
    {
      key: "khach",
      header: "Khách",
      label: "Khách hàng",
      kind: "chu",
      minWidth: 210,
      getValue: () => null,
      /* Chọn trong danh mục, gõ tên lạ thì tạo mới tại chỗ — nhập tự do là
         nguồn sai số liệu lớn nhất ("Hanwa" / "hanwa" / "Han wa" thành 3 khách
         khi tổng hợp cuối kỳ). */
      renderCell: (h) => (
        <Combobox
          label="Khách hàng"
          hideLabel
          value={h.khachId}
          onChange={(v) => writeRow(h.id, { customerId: v })}
          options={customerOptions}
          onCreate={onAddCustomer}
          placeholder="Chọn khách"
          clearable={false}
          onEditItem={onEditCustomer}
          canEdit={(v) => v !== OTHER_CUSTOMER_ID}
          editLabel="Sửa thông tin khách hàng này — lưu thẳng vào Danh mục."
        />
      ),
    },
    /* Thứ tự theo bảng cân đối giấy: XUẤT KHẨU Lượng · Đơn giá · T.tiền đứng ngay sau
       Khách, rồi các ngày + Tổng; Trả · Nợ (thay cột Chuyển kỳ) đứng CUỐI. "Lượng" = Tổng. */
    { key: "luong", header: "Lượng (kg)", label: "Lượng", kind: "tinh", minWidth: 110, getValue: (h) => h.tong || null },
    { key: "donGia", header: "Đơn giá (USD)", label: "Đơn giá", kind: "so", group: "tien", minWidth: 112, getValue: (h) => h.donGia },
    {
      key: "thanhTien",
      header: "T.tiền (USD)",
      label: "Thành tiền",
      kind: "tinh",
      group: "tien",
      minWidth: 148,
      getValue: (h) => h.tong * (h.donGia ?? 0) || null,
    },
    ...dates.map<GridColumn<FinishedGoodGridRow>>((iso) => ({
      key: `ngay:${iso}`,
      header: formatDayLabel(iso),
      label: `Ngày ${formatDateVN(iso)}`,
      kind: "so",
      group: "ngay",
      minWidth: 96,
      getValue: (h) => h.theoNgay[iso] ?? null,
    })),
    /* Tổng cuối hàng (như cột W bảng giấy) — chỉ khi mở cột ngày; thu ngày thì đã có "Lượng". */
    { key: "tong", header: "Tổng (kg)", label: "Tổng", kind: "tinh", group: "ngay", minWidth: 116, getValue: (h) => h.tong || null },
    { key: "tra", header: "Trả", label: "Trả", kind: "so", tint: "chuyen-ky", minWidth: 104, getValue: (h) => h.tra || null },
    { key: "no", header: "Nợ", label: "Nợ", kind: "so", tint: "chuyen-ky", minWidth: 104, getValue: (h) => h.no || null },
  ];

  /* Kỳ đã chốt ⇒ khoá TOÀN BỘ ô + gỡ ô điều khiển. Khoá ở một chỗ thay vì rải
     `disabled` khắp nơi: thêm cột mới về sau tự động được khoá theo. */
  const displayColumns: GridColumn<FinishedGoodGridRow>[] = grid.isLocked
    ? gridColumns.map((c) => ({
        ...c,
        renderCell: undefined,
        isLocked: () => true,
        lockReason: () => "Kỳ đã chốt — mở lại ở cuối màn mới sửa được",
      }))
    : gridColumns;

  const templatePeriodLabel = templatePeriod ? templatePeriod.dateRangeDescription || `${templatePeriod.startDate} – ${templatePeriod.endDate}` : "";
  const hang: GridRow<FinishedGoodGridRow>[] = [
    ...hangThat.map((h) => ({
      id: h.id,
      data: h,
      label: productName(h.matHangId),
      subLabel: h.quyCach || undefined,
    })),
    ...(hideEmptyRows || templateRows.length === 0
      ? []
      : [
          {
            id: "tieu-de-mau",
            data: templateRows[0],
            label: "",
            groupTitle: `Dòng mẫu theo kỳ ${templatePeriodLabel}`,
          } as GridRow<FinishedGoodGridRow>,
          ...templateRows.map((h) => ({
            id: h.id,
            data: h,
            label: <span className="text-muted-foreground">{productName(h.matHangId)}</span>,
            subLabel: h.quyCach || undefined,
          })),
        ]),
  ];

  /* ---------- (D) Thêm nhanh ngay dưới lưới: chọn mặt hàng là xong, khách + giá gợi ý
     theo dòng mẫu / kỳ gần nhất. Cần chọn quy cách, kênh ⇒ vẫn còn nút "Thêm mặt hàng". */
  const quickAdd = (productId: string) => {
    if (!productId) return;
    const g = goiY(productId, "");
    const customerId = g?.customerId ?? "";
    const templateKey = finishedGoodTemplateKey(productId, "", customerId);
    if (finishedGoods.some((r) => finishedGoodTemplateKey(r.productId, r.spec ?? "", r.customerId) === templateKey)) {
      notify.error(`"${productName(productId)}" đã có dòng trong kỳ`);
      return;
    }
    /* Có sẵn ở dòng mẫu (đang ẩn vì chưa có số) ⇒ biến dòng mẫu đó thành dòng thật. */
    const m =
      missingTemplates.find((x) => x.khoa === templateKey) ?? missingTemplates.find((x) => x.productId === productId && !x.spec);
    const updated = createFromTemplate(
      m ?? { id: templateKey, khoa: templateKey, productId, spec: "", customerId, channel: g?.channel ?? "Xuất khẩu", unitPrice: g?.unitPrice ?? null },
      {}
    );
    saveFinishedGoods([...finishedGoods, updated]);
    rememberJustAdded(updated.id);
    notify.saved(
      `Đã thêm "${productName(productId)}"${g ? " — khách + giá theo kỳ gần nhất, soát lại nếu đổi" : ""}`
    );
  };

  const totalKg = finishedGoodRows.reduce((s, h) => s + h.tong, 0);
  const totalAmount = finishedGoodRows.reduce((s, h) => s + h.tong * (h.donGia ?? 0), 0);

  return (
    <section className="border-t-2 border-border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Bán thành phẩm sản xuất</h2>
        <div className="flex flex-wrap gap-2">
          {pendingWips.length > 0 && (
            <Button
              title="Hút mọi dòng sản lượng trong khoảng ngày của kỳ từ sổ sản xuất vào lưới này." onClick={pullProduction}>
              <Download />
              Lấy {pendingWips.length} dòng từ sổ sản xuất
            </Button>
          )}
          {choHutBan.length > 0 && (
            <Button
              title="Hút các dòng bán trong khoảng ngày của kỳ từ sổ bán hàng vào lưới này." variant="outline" onClick={() => onHutBan(choHutBan)}>
              <Download />
              Lấy {choHutBan.length} dòng từ sổ bán
            </Button>
          )}
          <Button
            title="Ẩn / hiện các cột chia theo ngày. Ẩn đi thì bảng gọn, chỉ còn cột tổng." variant="outline" onClick={onToggleDayColumns}>
            <ChevronsLeftRight />
            {isDateColumnsCollapsed ? "Mở cột ngày" : "Thu cột ngày"}
          </Button>
          {(templateRows.length > 0 || finishedGoodRows.some((h) => !hasValues(h))) && (
            <Button
              title="Ẩn / hiện các dòng chưa có số (dòng mẫu và dòng 0 kg) để xem gọn như bản in."
              variant="outline"
              aria-pressed={hideEmptyRows}
              onClick={() => setHideEmptyRows((v) => !v)}
            >
              <EyeOff />
              {hideEmptyRows ? "Hiện dòng trống" : "Ẩn dòng trống"}
            </Button>
          )}
          <Button
            title="Thêm tay một mặt hàng vào lưới thành phẩm của kỳ." variant="outline" onClick={() => setIsAdding(true)}>
            <Plus />
            Thêm mặt hàng
          </Button>
        </div>
      </div>

      {hideEmptyRows && hangThat.length === 0 && finishedGoodRows.length + templateRows.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Chưa dòng nào có số — đang ẩn {finishedGoodRows.length + templateRows.length} dòng trống.
        </p>
      )}

      {finishedGoodRows.length === 0 && templateRows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Kỳ chưa có bán thành phẩm"
          description={
            pendingWips.length > 0
              ? `Có ${pendingWips.length} dòng ở sổ sản xuất — bấm "Lấy từ sổ sản xuất".`
              : "Thêm mặt hàng rồi gõ thẳng vào lưới."
          }
        />
      ) : (
        <EditableGrid
          description="Lưới bán thành phẩm sản xuất theo ngày trong kỳ"
          columns={displayColumns}
          rows={hang}
          rowMarkKey="can-doi-tp"
          collapsedGroups={isDateColumnsCollapsed ? ["ngay"] : []}
          onCellCommit={writeCell}
          onPasteBlock={pasteBlock}
          footer={
            <tr className="bg-muted font-semibold">
              <th
                scope="row"
                className="sticky left-0 z-10 border-t-2 border-r-2 border-border bg-muted px-4 py-3 text-left"
              >
                Tổng cộng
              </th>
              <td className="border-t-2 border-l border-border" />
              <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                {num(totalKg)}
              </td>
              <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                {totalKg > 0 ? num(Math.round((totalAmount / totalKg) * 100) / 100) : "—"}
              </td>
              <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                {num(Math.round(totalAmount * 100) / 100)}
              </td>
              {!isDateColumnsCollapsed &&
                dates.map((iso) => (
                  <td key={iso} className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                    {num(finishedGoodRows.reduce((s, h) => s + (h.theoNgay[iso] ?? 0), 0)) || "—"}
                  </td>
                ))}
              {!isDateColumnsCollapsed && (
                <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                  {num(totalKg)}
                </td>
              )}
              <td className="tnum border-t-2 border-l border-border bg-warning-surface px-3 py-3 text-right">
                {num(finishedGoodRows.reduce((s, h) => s + h.tra, 0)) || "—"}
              </td>
              <td className="tnum border-t-2 border-l border-border bg-warning-surface px-3 py-3 text-right">
                {num(finishedGoodRows.reduce((s, h) => s + h.no, 0)) || "—"}
              </td>
            </tr>
          }
        />
      )}

      {!grid.isLocked && (
        <div className="mt-3 max-w-md">
          <Combobox
            label="Thêm nhanh mặt hàng"
            info="Chọn mặt hàng là thêm ngay một dòng — khách + đơn giá gợi ý theo kỳ gần nhất cùng loại nguyên liệu. Cần chọn quy cách / kênh riêng thì dùng nút “Thêm mặt hàng”."
            value=""
            onChange={quickAdd}
            options={products.map((m) => ({ value: m.id, label: m.name }))}
            onCreate={(ten) => onAddProduct(ten)}
            placeholder="Gõ tên mặt hàng để thêm dòng"
            onEditItem={onEditProduct}
            editLabel="Sửa thông tin mặt hàng này — lưu thẳng vào Danh mục."
          />
        </div>
      )}

      {isAdding && (
        <AddProductDialog
          matHang={products}
          customers={customers}
          onCreateProduct={onAddProduct}
          onCreateCustomer={onAddCustomer}
          onEditProduct={onEditProduct}
          onEditCustomer={onEditCustomer}
          onClose={() => setIsAdding(false)}
          onSave={(productId, customerId, spec, kenh) => {
            const isDuplicate = finishedGoods.some(
              (r) => productSpecKey(r.productId, r.spec ?? "") === productSpecKey(productId, spec)
            );
            if (isDuplicate) {
              notify.error("Mặt hàng + quy cách này đã có dòng trong kỳ");
              return;
            }
            const id = uid();
            saveFinishedGoods([
              ...finishedGoods,
              {
                id,
                periodId: grid.kyId,
                productId,
                customerId,
                channel: kenh,
                quantityKg: 0,
                unitPrice: null,
                spec,
                salesItemId: "",
                dailyQuantities: {},
                carryOverKg: 0,
                carryOverPeriodId: "",
                autoSource: "",
              },
            ]);
            rememberJustAdded(id);
            setIsAdding(false);
          }}
        />
      )}

      {reasonPrompt && (
        <BackdateReasonDialog
          date={reasonPrompt.date}
          onClose={() => setReasonPrompt(null)}
          onSave={(reason) => {
            if (saveProductionMultiDay(reasonPrompt.cells, reason)) setReasonPrompt(null);
          }}
        />
      )}
    </section>
  );
}
