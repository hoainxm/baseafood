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
import { khoaMatHang, nhanNgay, type HangLuoiTP } from "@/lib/balancingGrid";
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
import { num, viDate } from "@/lib/format";
import { ChevronsLeftRight, Download, Layers, Plus } from "lucide-react";

export function LuoiBanThanhPham({
  luoi,
  matHang,
  khach,
  onThemMatHang,
  onThemKhach,
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
  /** Seam cũ: dòng sổ BÁN trong khoảng ngày, dùng khi output = hàng đã bán ra. */
  choHutBan: { ban: SalesItem; phieu: SalesInvoice }[];
  onHutBan: (items: { ban: SalesItem; phieu: SalesInvoice }[]) => void;
  /** Dùng chung với khối nguyên liệu — xem ghi chú ở LuoiNguyenLieu. */
  anNgay: boolean;
  onDoiAnNgay: () => void;
}) {
  const { ngay, tp, hangTP, sanXuatChoHut, ghiTP, hutSanXuat, ghiSanXuatNhieuNgay, ngayDaChot } =
    luoi;
  const [themMo, setThemMo] = useState(false);
  const [choLyDo, setChoLyDo] = useState<{ dsO: ONgay[]; ngay: string } | null>(null);

  const theoId = useMemo(() => new Map(tp.map((r) => [r.id, r])), [tp]);
  const tenMatHang = (id: string) => matHang.find((m) => m.id === id)?.name || "—";

  const ghiDong = (id: string, patch: Partial<BalancingOutputItem>) => {
    ghiTP(
      tp.map((r) => {
        if (r.id !== id) return r;
        const moi = { ...r, ...patch };
        if (moi.autoSource !== "production") {
          moi.quantityKg = sumGridRow(moi.dailyQuantities, moi.carryOverKg);
        }
        return moi;
      })
    );
  };

  const ghiO = (rowId: string, colKey: string, v: number | null) => {
    const r = theoId.get(rowId);
    if (!r) return;
    if (colKey === "chuyenKy") return ghiDong(rowId, { carryOverKg: v ?? 0 });
    if (colKey === "donGia") return ghiDong(rowId, { unitPrice: v });
    if (!colKey.startsWith("ngay:")) return;

    const iso = colKey.slice(5);
    const kg = v ?? 0;
    if (r.autoSource === "production") {
      const o: ONgay = { khoa: khoaMatHang(r.productId, r.spec ?? ""), ngay: iso, kg };
      /* Ngày đã chốt sản xuất ⇒ đòi lý do trước khi đụng số đã gửi đi. */
      if (ngayDaChot.has(iso)) {
        setChoLyDo({ dsO: [o], ngay: iso });
        return;
      }
      ghiSanXuatNhieuNgay([o], "");
      return;
    }
    const daily: DailyQuantities = { ...(r.dailyQuantities ?? {}) };
    if (kg === 0) delete daily[iso];
    else daily[iso] = kg;
    ghiDong(rowId, { dailyQuantities: daily });
  };

  /**
   * Dán khối. Tách hai đường: dòng hút đi về sổ Sản xuất (một lần gọi cho cả
   * khối), dòng nhập tay ghi vào chính dòng lưới. Ô rơi vào ngày đã chốt bị bỏ
   * qua — sửa ngày đã chốt phải có lý do, không cho lọt qua đường dán.
   */
  const danKhoi = (rowId: string, colKey: string, khoi: (number | null)[][]) => {
    if (!colKey.startsWith("ngay:")) return;
    const cotNgay = ngay.map((iso) => `ngay:${iso}`);
    const iH = hangTP.findIndex((h) => h.id === rowId);
    const iC = cotNgay.indexOf(colKey);
    if (iH < 0 || iC < 0) return;

    const veSoSanXuat: ONgay[] = [];
    const doiTay = new Map<string, DailyQuantities>();
    let boQuaVichot = 0;
    khoi.forEach((dong, i) =>
      dong.forEach((v, j) => {
        if (v == null) return;
        const h = hangTP[iH + i];
        const cot = cotNgay[iC + j];
        if (!h || !cot) return;
        const goc = theoId.get(h.id);
        if (!goc) return;
        const iso = cot.slice(5);
        if (goc.autoSource === "production") {
          if (ngayDaChot.has(iso)) {
            boQuaVichot++;
            return;
          }
          veSoSanXuat.push({
            khoa: khoaMatHang(goc.productId, goc.spec ?? ""),
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
      ghiTP(
        tp.map((r) => {
          const daily = doiTay.get(r.id);
          if (!daily) return r;
          return { ...r, dailyQuantities: daily, quantityKg: sumGridRow(daily, r.carryOverKg) };
        })
      );
    }
    if (veSoSanXuat.length > 0) ghiSanXuatNhieuNgay(veSoSanXuat, "");
    if (boQuaVichot > 0) {
      notify.loi(`Bỏ qua ${boQuaVichot} ô rơi vào ngày đã chốt — sửa từng ô để ghi lý do.`);
    }
  };

  const cot: CotLuoi<HangLuoiTP>[] = [
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
          onChange={(v) => ghiDong(h.id, { customerId: v })}
          options={khach.map((k) => ({ value: k.id, label: k.name }))}
          onCreate={onThemKhach}
          placeholder="Chọn khách"
        />
      ),
    },
    { key: "donGia", header: "Giá USD", nhan: "Đơn giá", kieu: "so", nhom: "tien", rong: 112, lay: (h) => h.donGia },
    {
      key: "chuyenKy",
      header: "Chuyển kỳ",
      nhan: "Chuyển kỳ",
      kieu: "so",
      toNen: "chuyen-ky",
      rong: 116,
      lay: (h) => h.chuyenKy || null,
    },
    ...ngay.map<CotLuoi<HangLuoiTP>>((iso) => ({
      key: `ngay:${iso}`,
      header: nhanNgay(iso),
      nhan: `Ngày ${viDate(iso)}`,
      kieu: "so",
      nhom: "ngay",
      rong: 96,
      lay: (h) => h.theoNgay[iso] ?? null,
    })),
    { key: "tong", header: "Tổng (kg)", nhan: "Tổng", kieu: "tinh", rong: 116, lay: (h) => h.tong || null },
    {
      key: "thanhTien",
      header: "Thành tiền",
      nhan: "Thành tiền",
      kieu: "tinh",
      nhom: "tien",
      rong: 148,
      lay: (h) => h.tong * (h.donGia ?? 0) || null,
    },
  ];

  const hang: HangLuoi<HangLuoiTP>[] = hangTP.map((h) => ({
    id: h.id,
    du: h,
    ten: tenMatHang(h.matHangId),
    phu: h.quyCach || (h.tuSoSanXuat ? "sổ sản xuất" : undefined),
  }));

  const tongKg = hangTP.reduce((s, h) => s + h.tong, 0);
  const tongTien = hangTP.reduce((s, h) => s + h.tong * (h.donGia ?? 0), 0);

  return (
    <section className="border-t-2 border-border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Khối 2 — Bán thành phẩm sản xuất</h2>
          <p className="text-base text-muted-foreground">
            Sản lượng từng ngày lấy từ sổ Sản xuất. Sửa ô ở đây ghi thẳng về sổ đó.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sanXuatChoHut.length > 0 && (
            <Button size="lg" onClick={hutSanXuat}>
              <Download />
              Lấy {sanXuatChoHut.length} dòng từ sổ sản xuất
            </Button>
          )}
          {choHutBan.length > 0 && (
            <Button variant="outline" size="lg" onClick={() => onHutBan(choHutBan)}>
              <Download />
              Lấy {choHutBan.length} dòng từ sổ bán
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={onDoiAnNgay}>
            <ChevronsLeftRight />
            {anNgay ? "Mở cột ngày" : "Thu cột ngày"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => setThemMo(true)}>
            <Plus />
            Thêm mặt hàng
          </Button>
        </div>
      </div>

      {hangTP.length === 0 ? (
        <EmptyState
          icon={Layers}
          tieuDe="Kỳ chưa có bán thành phẩm"
          moTa={
            sanXuatChoHut.length > 0
              ? `Có ${sanXuatChoHut.length} dòng ở sổ sản xuất trong khoảng ngày của kỳ — bấm "Lấy từ sổ sản xuất".`
              : "Ghi sản lượng ở màn Sản xuất bán thành phẩm, hoặc thêm mặt hàng rồi gõ thẳng vào lưới."
          }
        />
      ) : (
        <LuoiNhap
          moTa="Lưới bán thành phẩm sản xuất theo ngày trong kỳ"
          cot={cot}
          hang={hang}
          nhomAn={anNgay ? ["ngay"] : []}
          onGhiO={ghiO}
          onDanKhoi={danKhoi}
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
                {tongKg > 0 ? num(Math.round((tongTien / tongKg) * 100) / 100) : "—"}
              </td>
              <td className="tnum border-t-2 border-l border-border bg-warning-surface px-3 py-3 text-right">
                {num(hangTP.reduce((s, h) => s + h.chuyenKy, 0)) || "—"}
              </td>
              {!anNgay &&
                ngay.map((iso) => (
                  <td key={iso} className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                    {num(hangTP.reduce((s, h) => s + (h.theoNgay[iso] ?? 0), 0)) || "—"}
                  </td>
                ))}
              <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                {num(tongKg)}
              </td>
              <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                {num(tongTien)}
              </td>
            </tr>
          }
        />
      )}

      {themMo && (
        <HopThemMatHang
          matHang={matHang}
          khach={khach}
          onThemMatHang={onThemMatHang}
          onThemKhach={onThemKhach}
          onClose={() => setThemMo(false)}
          onLuu={(matHangId, khachId, quyCach, kenh) => {
            const trung = tp.some(
              (r) => khoaMatHang(r.productId, r.spec ?? "") === khoaMatHang(matHangId, quyCach)
            );
            if (trung) {
              notify.loi("Mặt hàng + quy cách này đã có dòng trong kỳ");
              return;
            }
            ghiTP([
              ...tp,
              {
                id: uid(),
                periodId: luoi.kyId,
                productId: matHangId,
                customerId: khachId,
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
            setThemMo(false);
          }}
        />
      )}

      {choLyDo && (
        <HopLyDoGhiBu
          ngay={choLyDo.ngay}
          onClose={() => setChoLyDo(null)}
          onLuu={(lyDo) => {
            if (ghiSanXuatNhieuNgay(choLyDo.dsO, lyDo)) setChoLyDo(null);
          }}
        />
      )}
    </section>
  );
}
