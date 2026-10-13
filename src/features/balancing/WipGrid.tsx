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
import type { ONgay, PeriodGrid } from "./usePeriodGrid";
import { HopLyDoGhiBu, HopThemMatHang } from "./gridDialogs";
import {
  Button,
  Combobox,
  EmptyState,
  LuoiNhap,
  notify,
  type CotLuoi,
  type HangLuoi,
} from "@/design-system";
import { num, formatDateVN } from "@/lib/format";
import { ChevronsLeftRight, Download, EyeOff, Layers, Plus } from "lucide-react";

export function LuoiBanThanhPham({
  luoi,
  matHang,
  khach,
  onThemMatHang,
  onThemKhach,
  onSuaMatHang,
  onSuaKhach,
  choHutBan,
  onHutBan,
  anNgay,
  onDoiAnNgay,
}: {
  luoi: PeriodGrid;
  matHang: Product[];
  khach: Customer[];
  onThemMatHang: (ten: string) => string;
  onThemKhach: (ten: string) => string;
  /** Bút chì sửa nhanh bản ghi danh mục (value = id). */
  onSuaMatHang?: (id: string) => void;
  onSuaKhach?: (id: string) => void;
  /** Seam cũ: dòng sổ BÁN trong khoảng ngày, dùng khi output = hàng đã bán ra. */
  choHutBan: { ban: SalesItem; phieu: SalesInvoice }[];
  onHutBan: (items: { ban: SalesItem; phieu: SalesInvoice }[]) => void;
  /** Dùng chung với khối nguyên liệu — xem ghi chú ở LuoiNguyenLieu. */
  anNgay: boolean;
  onDoiAnNgay: () => void;
}) {
  const { ngay, tp, hangTP, sanXuatChoHut, ghiTP, hutSanXuat, ghiSanXuatNhieuNgay, ngayDaChot, kyMau, mauConThieu, goiY } =
    luoi;
  const [isAdding, setIsAdding] = useState(false);
  const [reasonPrompt, setReasonPrompt] = useState<{ dsO: ONgay[]; ngay: string } | null>(null);
  /** Ẩn dòng chưa có số (dòng mẫu + dòng 0 kg) — MẶC ĐỊNH ẨN, xem gọn như bản in. */
  const [hideEmptyRows, setHideEmptyRows] = useState(true);
  /** Dòng vừa thêm trong phiên này — vẫn hiện dù chưa có số, kẻo thêm xong là biến mất. */
  const [justAdded, setJustAdded] = useState<Set<string>>(() => new Set());
  const rememberJustAdded = (id: string) => setJustAdded((s) => new Set(s).add(id));

  const theoId = useMemo(() => new Map(tp.map((r) => [r.id, r])), [tp]);
  const productName = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
  /** Khách BẮT BUỘC (không có nút bỏ chọn) — chưa rõ khách thì chọn "Khác". */
  const customerOptions = useMemo(
    () => [...khach.map((k) => ({ value: k.id, label: k.name })), { value: OTHER_CUSTOMER_ID, label: "Khác" }],
    [khach]
  );

  /* ---------- (A) Dòng MẪU: ảo, chưa lưu. Gõ số / chọn khách / gõ giá vào dòng nào
     thì dòng đó mới thành dòng thật (nhập tay, như "Thêm mặt hàng") — kỳ không bị
     rác bởi mấy chục dòng 0 kg, công thức không đụng tới dòng chưa có số. ---------- */
  const templateById = useMemo(() => new Map(mauConThieu.map((m) => [`mau:${m.id}`, m])), [mauConThieu]);
  const createFromTemplate = (m: FinishedGoodTemplateRow, patch: Partial<BalancingOutputItem>): BalancingOutputItem => {
    const r: BalancingOutputItem = {
      id: uid(),
      periodId: luoi.kyId,
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
  const templateRows: FinishedGoodGridRow[] = mauConThieu.map((m) => ({
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
  const hangThat = hideEmptyRows ? hangTP.filter(hasValues) : hangTP;
  const visibleRows: FinishedGoodGridRow[] = hideEmptyRows ? hangThat : [...hangTP, ...templateRows];

  const writeRow = (id: string, patch: Partial<BalancingOutputItem>) => {
    const m = templateById.get(id);
    if (m) {
      ghiTP([...tp, createFromTemplate(m, patch)]);
      return;
    }
    ghiTP(
      tp.map((r) => {
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
      const o: ONgay = { khoa: productSpecKey(r.productId, r.spec ?? ""), ngay: iso, kg };
      /* Ngày đã chốt sản xuất ⇒ đòi lý do trước khi đụng số đã gửi đi. */
      if (ngayDaChot.has(iso)) {
        setReasonPrompt({ dsO: [o], ngay: iso });
        return;
      }
      ghiSanXuatNhieuNgay([o], "");
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
    const dateColumns = ngay.map((iso) => `ngay:${iso}`);
    const iH = visibleRows.findIndex((h) => h.id === rowId);
    const iC = dateColumns.indexOf(colKey);
    if (iH < 0 || iC < 0) return;

    const productionCells: ONgay[] = [];
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
        const goc = fromTemplate.get(h.id) ?? theoId.get(h.id);
        if (!goc) return;
        const iso = column.slice(5);
        if (goc.autoSource === "production") {
          if (ngayDaChot.has(iso)) {
            skippedLocked++;
            return;
          }
          productionCells.push({
            khoa: productSpecKey(goc.productId, goc.spec ?? ""),
            ngay: iso,
            kg: v,
          });
          return;
        }
        const daily = doiTay.get(h.id) ?? { ...(goc.dailyQuantities ?? {}) };
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
      ghiTP([
        ...tp.map((r) => {
          const daily = doiTay.get(r.id);
          if (!daily) return r;
          return { ...r, dailyQuantities: daily, quantityKg: sumGridRow(daily, r.carryOverKg) };
        }),
        ...createdFromTemplate,
      ]
      );
    }
    if (productionCells.length > 0) ghiSanXuatNhieuNgay(productionCells, "");
    if (skippedLocked > 0) {
      notify.loi(`Bỏ qua ${skippedLocked} ô rơi vào ngày đã chốt — sửa từng ô để ghi lý do.`);
    }
  };

  const gridColumns: CotLuoi<FinishedGoodGridRow>[] = [
    {
      key: "khach",
      header: "Khách",
      nhan: "Khách hàng",
      kieu: "chu",
      rong: 210,
      lay: () => null,
      /* Chọn trong danh mục, gõ tên lạ thì tạo mới tại chỗ — nhập tự do là
         nguồn sai số liệu lớn nhất ("Hanwa" / "hanwa" / "Han wa" thành 3 khách
         khi tổng hợp cuối kỳ). */
      oRieng: (h) => (
        <Combobox
          label="Khách hàng"
          anNhan
          value={h.khachId}
          onChange={(v) => writeRow(h.id, { customerId: v })}
          options={customerOptions}
          onCreate={onThemKhach}
          placeholder="Chọn khách"
          choPhepXoa={false}
          onSuaMuc={onSuaKhach}
          suaDuoc={(v) => v !== OTHER_CUSTOMER_ID}
          nhanSua="Sửa thông tin khách hàng này — lưu thẳng vào Danh mục."
        />
      ),
    },
    /* Thứ tự theo bảng cân đối giấy: XUẤT KHẨU Lượng · Đơn giá · T.tiền đứng ngay sau
       Khách, rồi các ngày + Tổng; Trả · Nợ (thay cột Chuyển kỳ) đứng CUỐI. "Lượng" = Tổng. */
    { key: "luong", header: "Lượng (kg)", nhan: "Lượng", kieu: "tinh", rong: 110, lay: (h) => h.tong || null },
    { key: "donGia", header: "Đơn giá (USD)", nhan: "Đơn giá", kieu: "so", nhom: "tien", rong: 112, lay: (h) => h.donGia },
    {
      key: "thanhTien",
      header: "T.tiền (USD)",
      nhan: "Thành tiền",
      kieu: "tinh",
      nhom: "tien",
      rong: 148,
      lay: (h) => h.tong * (h.donGia ?? 0) || null,
    },
    ...ngay.map<CotLuoi<FinishedGoodGridRow>>((iso) => ({
      key: `ngay:${iso}`,
      header: formatDayLabel(iso),
      nhan: `Ngày ${formatDateVN(iso)}`,
      kieu: "so",
      nhom: "ngay",
      rong: 96,
      lay: (h) => h.theoNgay[iso] ?? null,
    })),
    /* Tổng cuối hàng (như cột W bảng giấy) — chỉ khi mở cột ngày; thu ngày thì đã có "Lượng". */
    { key: "tong", header: "Tổng (kg)", nhan: "Tổng", kieu: "tinh", nhom: "ngay", rong: 116, lay: (h) => h.tong || null },
    { key: "tra", header: "Trả", nhan: "Trả", kieu: "so", toNen: "chuyen-ky", rong: 104, lay: (h) => h.tra || null },
    { key: "no", header: "Nợ", nhan: "Nợ", kieu: "so", toNen: "chuyen-ky", rong: 104, lay: (h) => h.no || null },
  ];

  /* Kỳ đã chốt ⇒ khoá TOÀN BỘ ô + gỡ ô điều khiển. Khoá ở một chỗ thay vì rải
     `disabled` khắp nơi: thêm cột mới về sau tự động được khoá theo. */
  const displayColumns: CotLuoi<FinishedGoodGridRow>[] = luoi.daChot
    ? gridColumns.map((c) => ({
        ...c,
        oRieng: undefined,
        khoa: () => true,
        lyDoKhoa: () => "Kỳ đã chốt — mở lại ở cuối màn mới sửa được",
      }))
    : gridColumns;

  const templatePeriodLabel = kyMau ? kyMau.dateRangeDescription || `${kyMau.startDate} – ${kyMau.endDate}` : "";
  const hang: HangLuoi<FinishedGoodGridRow>[] = [
    ...hangThat.map((h) => ({
      id: h.id,
      du: h,
      ten: productName(h.matHangId),
      phu: h.quyCach || undefined,
    })),
    ...(hideEmptyRows || templateRows.length === 0
      ? []
      : [
          {
            id: "tieu-de-mau",
            du: templateRows[0],
            ten: "",
            tieuDeNhom: `Dòng mẫu theo kỳ ${templatePeriodLabel}`,
          } as HangLuoi<FinishedGoodGridRow>,
          ...templateRows.map((h) => ({
            id: h.id,
            du: h,
            ten: <span className="text-muted-foreground">{productName(h.matHangId)}</span>,
            phu: h.quyCach || undefined,
          })),
        ]),
  ];

  /* ---------- (D) Thêm nhanh ngay dưới lưới: chọn mặt hàng là xong, khách + giá gợi ý
     theo dòng mẫu / kỳ gần nhất. Cần chọn quy cách, kênh ⇒ vẫn còn nút "Thêm mặt hàng". */
  const quickAdd = (productId: string) => {
    if (!productId) return;
    const g = goiY(productId, "");
    const customerId = g?.customerId ?? "";
    const khoa = finishedGoodTemplateKey(productId, "", customerId);
    if (tp.some((r) => finishedGoodTemplateKey(r.productId, r.spec ?? "", r.customerId) === khoa)) {
      notify.loi(`"${productName(productId)}" đã có dòng trong kỳ`);
      return;
    }
    /* Có sẵn ở dòng mẫu (đang ẩn vì chưa có số) ⇒ biến dòng mẫu đó thành dòng thật. */
    const m =
      mauConThieu.find((x) => x.khoa === khoa) ?? mauConThieu.find((x) => x.productId === productId && !x.spec);
    const updated = createFromTemplate(
      m ?? { id: khoa, khoa, productId, spec: "", customerId: customerId, channel: g?.channel ?? "Xuất khẩu", unitPrice: g?.unitPrice ?? null },
      {}
    );
    ghiTP([...tp, updated]);
    rememberJustAdded(updated.id);
    notify.daLuu(
      `Đã thêm "${productName(productId)}"${g ? " — khách + giá theo kỳ gần nhất, soát lại nếu đổi" : ""}`
    );
  };

  const totalKg = hangTP.reduce((s, h) => s + h.tong, 0);
  const totalAmount = hangTP.reduce((s, h) => s + h.tong * (h.donGia ?? 0), 0);

  return (
    <section className="border-t-2 border-border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Bán thành phẩm sản xuất</h2>
        <div className="flex flex-wrap gap-2">
          {sanXuatChoHut.length > 0 && (
            <Button
              title="Hút mọi dòng sản lượng trong khoảng ngày của kỳ từ sổ sản xuất vào lưới này." onClick={hutSanXuat}>
              <Download />
              Lấy {sanXuatChoHut.length} dòng từ sổ sản xuất
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
            title="Ẩn / hiện các cột chia theo ngày. Ẩn đi thì bảng gọn, chỉ còn cột tổng." variant="outline" onClick={onDoiAnNgay}>
            <ChevronsLeftRight />
            {anNgay ? "Mở cột ngày" : "Thu cột ngày"}
          </Button>
          {(templateRows.length > 0 || hangTP.some((h) => !hasValues(h))) && (
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

      {hideEmptyRows && hangThat.length === 0 && hangTP.length + templateRows.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Chưa dòng nào có số — đang ẩn {hangTP.length + templateRows.length} dòng trống.
        </p>
      )}

      {hangTP.length === 0 && templateRows.length === 0 ? (
        <EmptyState
          icon={Layers}
          tieuDe="Kỳ chưa có bán thành phẩm"
          moTa={
            sanXuatChoHut.length > 0
              ? `Có ${sanXuatChoHut.length} dòng ở sổ sản xuất — bấm "Lấy từ sổ sản xuất".`
              : "Thêm mặt hàng rồi gõ thẳng vào lưới."
          }
        />
      ) : (
        <LuoiNhap
          moTa="Lưới bán thành phẩm sản xuất theo ngày trong kỳ"
          cot={displayColumns}
          hang={hang}
          toMau="can-doi-tp"
          nhomAn={anNgay ? ["ngay"] : []}
          onGhiO={writeCell}
          onDanKhoi={pasteBlock}
          cuoiBang={
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
              {!anNgay &&
                ngay.map((iso) => (
                  <td key={iso} className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                    {num(hangTP.reduce((s, h) => s + (h.theoNgay[iso] ?? 0), 0)) || "—"}
                  </td>
                ))}
              {!anNgay && (
                <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                  {num(totalKg)}
                </td>
              )}
              <td className="tnum border-t-2 border-l border-border bg-warning-surface px-3 py-3 text-right">
                {num(hangTP.reduce((s, h) => s + h.tra, 0)) || "—"}
              </td>
              <td className="tnum border-t-2 border-l border-border bg-warning-surface px-3 py-3 text-right">
                {num(hangTP.reduce((s, h) => s + h.no, 0)) || "—"}
              </td>
            </tr>
          }
        />
      )}

      {!luoi.daChot && (
        <div className="mt-3 max-w-md">
          <Combobox
            label="Thêm nhanh mặt hàng"
            info="Chọn mặt hàng là thêm ngay một dòng — khách + đơn giá gợi ý theo kỳ gần nhất cùng loại nguyên liệu. Cần chọn quy cách / kênh riêng thì dùng nút “Thêm mặt hàng”."
            value=""
            onChange={quickAdd}
            options={matHang.map((m) => ({ value: m.id, label: m.name }))}
            onCreate={(ten) => onThemMatHang(ten)}
            placeholder="Gõ tên mặt hàng để thêm dòng"
            onSuaMuc={onSuaMatHang}
            nhanSua="Sửa thông tin mặt hàng này — lưu thẳng vào Danh mục."
          />
        </div>
      )}

      {isAdding && (
        <HopThemMatHang
          matHang={matHang}
          khach={khach}
          onThemMatHang={onThemMatHang}
          onThemKhach={onThemKhach}
          onSuaMatHang={onSuaMatHang}
          onSuaKhach={onSuaKhach}
          onClose={() => setIsAdding(false)}
          onLuu={(productId, customerId, quyCach, kenh) => {
            const trung = tp.some(
              (r) => productSpecKey(r.productId, r.spec ?? "") === productSpecKey(productId, quyCach)
            );
            if (trung) {
              notify.loi("Mặt hàng + quy cách này đã có dòng trong kỳ");
              return;
            }
            const id = uid();
            ghiTP([
              ...tp,
              {
                id,
                periodId: luoi.kyId,
                productId: productId,
                customerId: customerId,
                channel: kenh,
                quantityKg: 0,
                unitPrice: null,
                spec: quyCach,
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
        <HopLyDoGhiBu
          ngay={reasonPrompt.ngay}
          onClose={() => setReasonPrompt(null)}
          onLuu={(reason) => {
            if (ghiSanXuatNhieuNgay(reasonPrompt.dsO, reason)) setReasonPrompt(null);
          }}
        />
      )}
    </section>
  );
}
