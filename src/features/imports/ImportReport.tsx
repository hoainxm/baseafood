// ============================================================
// Tên file cũ: src/features/imports/BaoCaoNhap.tsx
// Tên tiếng Việt: Báo cáo tổng hợp Nhập Nguyên liệu
// Description: Material Import Summary Report
// ============================================================
import { useMemo, useState } from "react";
import {
  BangTong,
  BieuDoCotDoc,
  Combobox,
  DateField,
  DateRangeField,
  ThongKe,
  homNay,
  type CotBieuDoDoc,
  type CotTong,
  type TheThongTin,
} from "@/design-system";
import { useMaterialImports, useScraps } from "@/lib/catalogRepo";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { num, viDate } from "@/lib/format";
import { calculateImportAmount } from "@/types";
import { CalendarRange, Coins, Scale, Truck } from "lucide-react";

const XUONG_OPT = [
  { value: "Tất cả", label: "Tất cả xưởng" },
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

interface DongTong {
  supplierName: string;
  materialTypeName: string;
  quantityKg: number;
  amount: number;
}

/**
 * Báo cáo Nhập hàng — tổng nhập theo kỳ, gom theo ĐẠI LÝ × LOẠI NGUYÊN LIỆU.
 * Chỉ đọc dữ liệu đã ghi (sổ nhập), không tạo/sửa bản ghi.
 */
export default function BaoCaoNhap() {
  const [rows] = useMaterialImports();
  const [scraps] = useScraps();

  const [ky, setKy] = useState<KyXem>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [xuong, setXuong] = useState("Tất cả");
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  const { dong, chart, soDaiLy, tongKg, tongTien } = useMemo(() => {
    // Lọc nguyên liệu nhập khẩu
    const locImports = rows.filter(
      (r) =>
        r.deliveryDate >= tu &&
        r.deliveryDate <= den &&
        (xuong === "Tất cả" || r.workshop === xuong)
    );

    // Lọc phế liệu cân gộp trong khoảng ngày
    const locScraps = scraps.filter(
      (r) =>
        r.source === "Nhập hàng" &&
        r.date >= tu &&
        r.date <= den &&
        (xuong === "Tất cả" || r.workshop === xuong)
    );

    const map = new Map<string, DongTong>();

    // Gom nguyên liệu
    for (const r of locImports) {
      const sup = r.supplierName || "(chưa có đại lý)";
      const mt = r.materialTypeName || "(chưa rõ loại)";
      const k = `${sup}|||${mt}`;
      let d = map.get(k);
      if (!d) {
        d = { supplierName: sup, materialTypeName: mt, quantityKg: 0, amount: 0 };
        map.set(k, d);
      }
      d.quantityKg += r.quantityKg || 0;
      d.amount += calculateImportAmount(r);
    }

    // Gom phế liệu nhập
    for (const r of locScraps) {
      const sup = "(Phế liệu nội bộ)";
      const mt = r.name || "(chưa rõ loại phế liệu)";
      const k = `${sup}|||${mt}`;
      let d = map.get(k);
      if (!d) {
        d = { supplierName: sup, materialTypeName: mt, quantityKg: 0, amount: 0 };
        map.set(k, d);
      }
      d.quantityKg += r.quantityKg || 0;
      d.amount += r.quantityKg * (r.sellingPrice ?? 0);
    }

    const dong = [...map.values()].sort(
      (a, b) =>
        a.supplierName.localeCompare(b.supplierName, "vi") ||
        a.materialTypeName.localeCompare(b.materialTypeName, "vi")
    );

    // Gom theo ngày để vẽ biểu đồ (thứ tự thời gian)
    const theoNgay = new Map<string, number>();
    for (const r of locImports) {
      const d = r.deliveryDate;
      theoNgay.set(d, (theoNgay.get(d) ?? 0) + (r.quantityKg || 0));
    }
    for (const r of locScraps) {
      const d = r.date;
      theoNgay.set(d, (theoNgay.get(d) ?? 0) + (r.quantityKg || 0));
    }

    const datesSorted = [...theoNgay.keys()].sort();
    const chart: CotBieuDoDoc[] = datesSorted.map((date) => ({
      nhan: viDate(date).slice(0, 5), // Lấy dạng dd/mm
      giaTri: theoNgay.get(date) ?? 0,
      phu: viDate(date),
    }));

    // Đếm số đại lý thực tế (không tính phế liệu nội bộ)
    const theoDL = new Map<string, number>();
    for (const d of dong) {
      if (d.supplierName !== "(Phế liệu nội bộ)") {
        theoDL.set(d.supplierName, (theoDL.get(d.supplierName) ?? 0) + d.quantityKg);
      }
    }

    return {
      dong,
      chart,
      soDaiLy: theoDL.size,
      tongKg: dong.reduce((s, d) => s + d.quantityKg, 0),
      tongTien: dong.reduce((s, d) => s + d.amount, 0),
    };
  }, [rows, scraps, tu, den, xuong]);

  const the: TheThongTin[] = [
    { nhan: "Kỳ báo cáo", giaTri: `${viDate(tu)} – ${viDate(den)}`, icon: CalendarRange, mau: "trung-tinh" },
    { nhan: "Tổng nhập", giaTri: `${num(tongKg)} kg`, so: true, icon: Scale, mau: "brand" },
    { nhan: "Giá trị", giaTri: `${num(tongTien)} đ`, so: true, icon: Coins, mau: "success" },
    { nhan: "Số đại lý", giaTri: num(soDaiLy), so: true, icon: Truck, mau: "trung-tinh" },
  ];

  const cot: CotTong<DongTong>[] = [
    { key: "dl", header: "Đại lý", render: (r) => r.supplierName },
    { key: "loai", header: "Loại nguyên liệu", render: (r) => r.materialTypeName },
    {
      key: "kg",
      header: "Số cân (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
      tong: () => num(tongKg),
    },
    {
      key: "tien",
      header: "Giá trị (đ)",
      so: true,
      render: (r) => num(r.amount),
      tong: () => num(tongTien),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem]">
          <Combobox
            label="Kỳ báo cáo"
            anNhanBatBuoc
            choPhepXoa={false}
            value={ky}
            onChange={(v) => setKy(v as KyXem)}
            options={KY_OPT}
          />
        </div>
        <div className="min-w-[16rem] flex-1">
          {ky === "tuy-chon" ? (
            <DateRangeField
              label="Khoảng ngày"
              anNhanBatBuoc
              presets={false}
              startDate={tuTC}
              endDate={denTC}
              onChange={(a, b) => {
                setTuTC(a);
                setDenTC(b);
              }}
            />
          ) : (
            <DateField
              label={ky === "ngay" ? "Ngày" : "Ngày bất kỳ trong kỳ"}
              anNhanBatBuoc
              hint={ky === "ngay" ? undefined : `Kỳ: ${viDate(tu)} – ${viDate(den)}`}
              value={moc}
              onChange={setMoc}
            />
          )}
        </div>
        <div className="min-w-[10rem]">
          <Combobox
            label="Phân xưởng"
            anNhanBatBuoc
            choPhepXoa={false}
            value={xuong}
            onChange={setXuong}
            options={XUONG_OPT}
          />
        </div>
      </div>

      <ThongKe the={the} />

      {chart.length > 0 && (
        <section className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Sản lượng nhập theo ngày (kèm trung bình chu kỳ)
          </h3>
          <BieuDoCotDoc data={chart} donVi="kg" />
        </section>
      )}

      <BangTong
        rows={dong}
        cot={cot}
        getKey={(r) => `${r.supplierName}|||${r.materialTypeName}`}
        emptyText="Không có nguyên liệu nhập trong kỳ này."
      />
    </div>
  );
}
