// ============================================================
// Tên file: src/features/balancing/MaterialGrid.tsx
// Tên tiếng Việt: Khối 1 — lưới nguyên liệu vào theo ngày
// Description: Balancing block 1 — material input day grid
// ============================================================
import { useMemo, useState } from "react";
import type { BalancingInputItem, DailyQuantities, InputGroup, MaterialType } from "@/types";
import { BSF1_WAREHOUSES, INPUT_GROUPS, sumGridRow } from "@/types";
import { uid } from "@/lib/db";
import { nhanNgay, type HangLuoiNL } from "@/lib/balancingGrid";
import type { ONgay, PeriodGrid } from "./usePeriodGrid";
import { HopChonDongNhap, HopThemDongNL } from "./gridDialogs";
import {
  Button,
  Combobox,
  ConfirmDelete,
  EmptyState,
  LuoiNhap,
  notify,
  type CotLuoi,
  type HangLuoi,
} from "@/design-system";
import { num, viDate } from "@/lib/format";
import { ChevronsLeftRight, Download, Layers, ListChecks, Plus, Trash2 } from "lucide-react";

const KHO_XUONG = BSF1_WAREHOUSES.filter((w) => w.type === "phan-xuong");

export function LuoiNguyenLieu({
  luoi,
  loaiNLDanhMuc,
  onThemLoaiNL,
  anNgay,
  onDoiAnNgay,
}: {
  luoi: PeriodGrid;
  loaiNLDanhMuc: MaterialType[];
  onThemLoaiNL: (ten: string) => string;
  /* Trạng thái thu/mở cột ngày do MÀN giữ, không phải từng khối: hai lưới nằm
     chồng nhau trên cùng một tờ, cột ngày lệch nhau thì mắt không dóng được
     dòng nguyên liệu với dòng bán thành phẩm cùng ngày. */
  anNgay: boolean;
  onDoiAnNgay: () => void;
}) {
  const {
    ngay,
    nlVao,
    hangNL,
    nhapChoHut,
    nhapKhacLoai,
    nhapKyKhac,
    chanDoanNhap,
    ghiNL,
    hutNhapHang,
    ghiNhapNhieuNgay,
  } = luoi;
  const [anTien, setAnTien] = useState(false);
  const [themMo, setThemMo] = useState<InputGroup | "giam" | null>(null);
  const [chonNhapMo, setChonNhapMo] = useState(false);

  const theoId = useMemo(() => new Map(nlVao.map((r) => [r.id, r])), [nlVao]);

  /** Sửa một dòng lưới + giữ `quantityKg` khớp tổng (công thức đọc trường này). */
  const ghiDong = (id: string, patch: Partial<BalancingInputItem>) => {
    ghiNL(
      nlVao.map((r) => {
        if (r.id !== id) return r;
        const moi = { ...r, ...patch };
        /* Dòng hút lấy ngày từ sổ nhập → tổng tính ở chỗ khác, đừng đè. */
        if (moi.autoSource !== "imports") {
          moi.quantityKg = sumGridRow(moi.dailyQuantities, moi.carryOverKg);
        }
        return moi;
      })
    );
  };

  /** Gõ vào ô ngày. Dòng hút thì ghi thẳng về sổ Nhập hàng, dòng tay thì ghi tại chỗ. */
  const ghiONgay = (r: BalancingInputItem, iso: string, v: number | null) => {
    const kg = v ?? 0;
    if (r.autoSource === "imports") {
      ghiNhapNhieuNgay([{ khoa: r.name, ngay: iso, kg }]);
      return;
    }
    const daily: DailyQuantities = { ...(r.dailyQuantities ?? {}) };
    if (kg === 0) delete daily[iso];
    /* Dòng Giảm: người dùng gõ số dương, hệ ghi số ÂM — bắt tổ trưởng gõ dấu
       trừ ở xưởng lạnh là cách chắc chắn nhất để có số sai. */
    else daily[iso] = r.isReduction ? -Math.abs(kg) : kg;
    ghiDong(r.id, { dailyQuantities: daily });
  };

  const ghiO = (rowId: string, colKey: string, v: number | null) => {
    const r = theoId.get(rowId);
    if (!r) return;
    if (colKey === "chuyenKy") return ghiDong(rowId, { carryOverKg: v ?? 0 });
    if (colKey === "donGia") return ghiDong(rowId, { unitPrice: v });
    if (colKey === "tyLe") return ghiDong(rowId, { ratioPercentage: v });
    if (colKey.startsWith("ngay:")) ghiONgay(r, colKey.slice(5), v);
  };

  /**
   * Dán một khối số từ Excel. Gộp mọi ô vào MỘT lần ghi cho mỗi đích — dán 5×10
   * ô rồi gọi 50 lần thì 49 lần đầu bị ghi đè, chỉ ô cuối sống.
   */
  const danKhoi = (rowId: string, colKey: string, khoi: (number | null)[][]) => {
    if (!colKey.startsWith("ngay:")) return;
    const cotNgay = ngay.map((iso) => `ngay:${iso}`);
    const iH = hangNL.findIndex((h) => h.id === rowId);
    const iC = cotNgay.indexOf(colKey);
    if (iH < 0 || iC < 0) return;

    const veSoNhap: ONgay[] = [];
    const doiTay = new Map<string, DailyQuantities>();
    khoi.forEach((dong, i) =>
      dong.forEach((v, j) => {
        if (v == null) return;
        const h = hangNL[iH + i];
        const cot = cotNgay[iC + j];
        if (!h || !cot) return;
        const goc = theoId.get(h.id);
        if (!goc) return;
        const iso = cot.slice(5);
        if (goc.autoSource === "imports") {
          veSoNhap.push({ khoa: goc.name, ngay: iso, kg: v });
          return;
        }
        const daily = doiTay.get(h.id) ?? { ...(goc.dailyQuantities ?? {}) };
        if (v === 0) delete daily[iso];
        else daily[iso] = goc.isReduction ? -Math.abs(v) : v;
        doiTay.set(h.id, daily);
      })
    );

    if (doiTay.size > 0) {
      ghiNL(
        nlVao.map((r) => {
          const daily = doiTay.get(r.id);
          if (!daily) return r;
          return { ...r, dailyQuantities: daily, quantityKg: sumGridRow(daily, r.carryOverKg) };
        })
      );
    }
    if (veSoNhap.length > 0) ghiNhapNhieuNgay(veSoNhap);
  };

  const themDong = (nhom: InputGroup | "giam", ten: string) => {
    const laGiam = nhom === "giam";
    ghiNL([
      ...nlVao,
      {
        id: uid(),
        periodId: luoi.kyId,
        groupName: laGiam ? "Thủy sản" : nhom,
        name: ten,
        quantityKg: 0,
        unitPrice: null,
        ratioPercentage: null,
        sourceWarehouse: "",
        dailyQuantities: {},
        carryOverKg: 0,
        isReduction: laGiam,
        reductionWarehouseId: laGiam ? (KHO_XUONG[0]?.id ?? "") : "",
        autoSource: "",
      },
    ]);
    setThemMo(null);
    notify.daLuu(laGiam ? `Đã thêm dòng giảm "${ten}"` : `Đã thêm "${ten}"`);
  };

  const xoaDong = (id: string) => {
    const truoc = nlVao;
    const d = theoId.get(id);
    ghiNL(nlVao.filter((r) => r.id !== id));
    notify.daXoa(`Đã xóa dòng "${d?.name ?? ""}"`, () => ghiNL(truoc));
  };

  const cot: CotLuoi<HangLuoiNL>[] = [
    ...ngay.map<CotLuoi<HangLuoiNL>>((iso) => ({
      key: `ngay:${iso}`,
      header: nhanNgay(iso),
      nhan: `Ngày ${viDate(iso)}`,
      kieu: "so",
      nhom: "ngay",
      rong: 96,
      lay: (h) => h.theoNgay[iso] ?? null,
    })),
    {
      key: "chuyenKy",
      header: "Chuyển kỳ",
      nhan: "Chuyển kỳ",
      kieu: "so",
      toNen: "chuyen-ky",
      rong: 116,
      lay: (h) => h.chuyenKy || null,
    },
    { key: "tong", header: "Tổng (kg)", nhan: "Tổng", kieu: "tinh", rong: 116, lay: (h) => h.tong || null },
    { key: "donGia", header: "Đơn giá", nhan: "Đơn giá", kieu: "so", nhom: "tien", rong: 128, lay: (h) => h.donGia },
    {
      key: "thanhTien",
      header: "Thành tiền",
      nhan: "Thành tiền",
      kieu: "tinh",
      nhom: "tien",
      rong: 160,
      lay: (h) => h.tong * (h.donGia ?? 0) || null,
    },
    {
      key: "tyLe",
      header: "Tỷ lệ %",
      nhan: "Tỷ lệ phần trăm",
      kieu: "so",
      nhom: "tien",
      rong: 96,
      lay: (h) => h.tyLe,
    },
  ];

  /* Xếp dòng theo nhóm, dòng Giảm luôn nằm cuối — đúng thứ tự bảng giấy. */
  const hang: HangLuoi<HangLuoiNL>[] = [];
  for (const nhom of INPUT_GROUPS) {
    const cua = hangNL.filter((h) => h.nhom === nhom && !h.laGiam);
    if (cua.length === 0) continue;
    hang.push({
      id: `nhom-${nhom}`,
      du: cua[0],
      ten: "",
      tieuDeNhom:
        nhom === "Thủy sản"
          ? "Thủy sản — số từ sổ nhập hàng"
          : nhom === "Xả đông"
            ? "Xả đông"
            : "Bột phụ gia",
    });
    for (const h of cua) {
      hang.push({
        id: h.id,
        du: h,
        ten: h.ten,
        phu: h.tuSoNhap ? `${h.nguonIds.length} chuyến · sửa ô ghi thẳng vào sổ nhập` : undefined,
      });
    }
  }
  const dongGiam = hangNL.filter((h) => h.laGiam);
  if (dongGiam.length > 0) {
    hang.push({
      id: "nhom-giam",
      du: dongGiam[0],
      ten: "",
      tieuDeNhom: "Giảm — trừ khỏi kỳ, nhập về kho xưởng",
    });
    for (const h of dongGiam) {
      hang.push({
        id: h.id,
        du: h,
        ten: h.ten,
        kieu: "giam",
        phu: KHO_XUONG.find((k) => k.id === h.khoGiam)?.name ?? "chưa chọn kho",
      });
    }
  }

  /* Dòng lệch tên + dòng đang thuộc kỳ khác đều chọn tay được từ một chỗ. */
  const dongChonDuoc = useMemo(
    () => [...nhapKhacLoai, ...nhapKyKhac],
    [nhapKhacLoai, nhapKyKhac]
  );

  const tongKg = hangNL.reduce((s, h) => s + h.tong, 0);
  const tongTien = hangNL.reduce((s, h) => s + h.tong * (h.donGia ?? 0), 0);

  /** Gợi ý cho hộp thêm dòng: danh mục + tên các dòng đã có trong kỳ. */
  const goiYLoai = useMemo(() => {
    const ten = new Set<string>([
      ...loaiNLDanhMuc.map((l) => l.name),
      ...hangNL.filter((h) => !h.laGiam).map((h) => h.ten),
    ]);
    return [...ten].filter(Boolean).map((t) => ({ value: t, label: t }));
  }, [loaiNLDanhMuc, hangNL]);

  return (
    <section className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Khối 1 — Nguyên liệu vào</h2>
          <p className="text-base text-muted-foreground">
            Hàng là loại nguyên liệu, cột là ngày trong kỳ. Sửa ô của dòng lấy từ sổ nhập sẽ
            ghi thẳng vào sổ Nhập hàng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nhapChoHut.length > 0 && (
            <Button size="lg" onClick={() => hutNhapHang()}>
              <Download />
              Lấy {nhapChoHut.length} dòng từ sổ nhập
            </Button>
          )}
          {dongChonDuoc.length > 0 && (
            <Button variant="outline" size="lg" onClick={() => setChonNhapMo(true)}>
              <ListChecks />
              Chọn dòng nhập ({dongChonDuoc.length})
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={onDoiAnNgay}>
            <ChevronsLeftRight />
            {anNgay ? "Mở cột ngày" : "Thu cột ngày"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => setAnTien((v) => !v)}>
            {anTien ? "Mở cột tiền" : "Thu cột tiền"}
          </Button>
        </div>
      </div>

      {/* Nói thẳng sổ nhập có gì trong khoảng ngày này. Màn trống mà im lặng là
          lỗi nặng nhất của bản trước: ba nguyên nhân (lệch tên loại, dòng đã bị
          kỳ khác giữ, kỳ khai nhầm ngày) nhìn màn không đoán ra được cái nào. */}
      {chanDoanNhap.tongTrongKhoang > 0 && (
        <p className="mb-3 rounded-lg bg-muted px-4 py-3 text-base text-muted-foreground">
          Sổ nhập hàng có <strong>{chanDoanNhap.tongTrongKhoang}</strong> chuyến trong
          khoảng ngày của kỳ: <strong>{chanDoanNhap.chuaGan}</strong> khớp loại nguyên
          liệu của kỳ · <strong>{chanDoanNhap.lechTen}</strong> khác tên loại ·{" "}
          <strong>{chanDoanNhap.kyKhac}</strong> đang thuộc kỳ khác.
          {chanDoanNhap.chuaGan === 0 && " Bấm “Chọn dòng nhập” để tự tick dòng thuộc kỳ này."}
        </p>
      )}
      {chanDoanNhap.tongTrongKhoang === 0 && ngay.length > 0 && hangNL.length === 0 && (
        <p className="mb-3 rounded-lg bg-warning-surface px-4 py-3 text-base text-warning">
          Sổ nhập hàng không có chuyến nào trong khoảng ngày của kỳ. Kỳ lọc theo{" "}
          <strong>ngày hàng về xưởng</strong>, không phải ngày ghi sổ — hàng ghi bù thì
          ngày hàng về mới là ngày tính vào kỳ.
        </p>
      )}

      {hangNL.length === 0 ? (
        <EmptyState
          icon={Layers}
          tieuDe="Kỳ chưa có nguyên liệu"
          moTa={
            nhapChoHut.length > 0
              ? `Có ${nhapChoHut.length} dòng ở sổ nhập hàng khớp kỳ này — bấm "Lấy từ sổ nhập".`
              : dongChonDuoc.length > 0
                ? `Có ${dongChonDuoc.length} chuyến trong khoảng ngày nhưng khác tên loại hoặc đang thuộc kỳ khác — bấm "Chọn dòng nhập" để tick.`
                : "Chưa có chuyến nhập nào trong khoảng ngày của kỳ. Ghi ở màn Nhập hàng, hoặc thêm dòng xả đông / bột bên dưới."
          }
        />
      ) : (
        <LuoiNhap
          moTa="Lưới nguyên liệu vào theo ngày trong kỳ"
          cot={cot}
          hang={hang}
          nhomAn={[...(anNgay ? ["ngay"] : []), ...(anTien ? ["tien"] : [])]}
          onGhiO={ghiO}
          onDanKhoi={danKhoi}
          cuoiBang={
            <tr className="bg-muted font-semibold">
              <th
                scope="row"
                className="sticky left-0 z-10 border-t-2 border-r-2 border-border bg-muted px-4 py-3 text-left"
              >
                T. CỘNG
              </th>
              {!anNgay &&
                ngay.map((iso) => (
                  <td key={iso} className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                    {num(hangNL.reduce((s, h) => s + (h.theoNgay[iso] ?? 0), 0)) || "—"}
                  </td>
                ))}
              <td className="tnum border-t-2 border-l border-border bg-warning-surface px-3 py-3 text-right">
                {num(hangNL.reduce((s, h) => s + h.chuyenKy, 0)) || "—"}
              </td>
              <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                {num(tongKg)}
              </td>
              {!anTien && (
                <>
                  <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                    {tongKg > 0 ? num(Math.round(tongTien / tongKg)) : "—"}
                  </td>
                  <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                    {num(tongTien)}
                  </td>
                  <td className="border-t-2 border-l border-border" />
                </>
              )}
            </tr>
          }
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="lg" onClick={() => setThemMo("Xả đông")}>
          <Plus />
          Thêm dòng xả đông
        </Button>
        <Button variant="outline" size="lg" onClick={() => setThemMo("Bột phụ gia")}>
          <Plus />
          Thêm bột phụ gia
        </Button>
        <Button variant="outline" size="lg" onClick={() => setThemMo("giam")}>
          <Plus />
          Thêm dòng giảm
        </Button>
      </div>

      {hangNL.some((h) => !h.tuSoNhap) && (
        <div className="mt-4 space-y-2">
          <p className="text-base font-medium">Dòng nhập tay</p>
          <div className="flex flex-wrap gap-2">
            {hangNL
              .filter((h) => !h.tuSoNhap)
              .map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-base">{h.ten}</span>
                  {h.laGiam && (
                    <Combobox
                      label="Kho nhận"
                      anNhan
                      value={h.khoGiam}
                      onChange={(v) => ghiDong(h.id, { reductionWarehouseId: v })}
                      options={KHO_XUONG.map((k) => ({ value: k.id, label: k.name }))}
                      choPhepXoa={false}
                    />
                  )}
                  <ConfirmDelete
                    moTaBanGhi={`${h.ten} — ${num(h.tong)} kg`}
                    onConfirm={() => xoaDong(h.id)}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label={`Xóa dòng ${h.ten}`}>
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {themMo && (
        <HopThemDongNL
          laGiam={themMo === "giam"}
          tieuDe={themMo === "giam" ? "Thêm dòng giảm" : `Thêm dòng ${themMo}`}
          goiY={goiYLoai}
          onThemLoaiNL={onThemLoaiNL}
          onClose={() => setThemMo(null)}
          onLuu={(ten) => themDong(themMo, ten)}
        />
      )}

      {chonNhapMo && (
        <HopChonDongNhap
          dong={dongChonDuoc}
          kyDangGiu={new Set(nhapKyKhac.map((r) => r.id))}
          onClose={() => setChonNhapMo(false)}
          onLuu={(ids) => {
            hutNhapHang(ids);
            setChonNhapMo(false);
          }}
        />
      )}
    </section>
  );
}
