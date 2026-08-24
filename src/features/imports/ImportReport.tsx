// ============================================================
// Tên file cũ: src/features/imports/BaoCaoNhap.tsx
// Tên tiếng Việt: Báo cáo tổng hợp Nhập Nguyên liệu
// Description: Material Import Summary Report
// ============================================================
import { useMemo, useState } from "react";
import {
  BangTong,
  BieuDoCotDoc,
  Button,
  Combobox,
  DateField,
  DateRangeField,
  ThongKe,
  homNay,
  notify,
  type CotBieuDoDoc,
  type CotTong,
  type TheThongTin,
} from "@/design-system";
import { useMaterialImports, useScraps } from "@/lib/catalogRepo";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { num, viDate } from "@/lib/format";
import { calculateImportAmount } from "@/types";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import { CalendarRange, Coins, FileClock, FileSpreadsheet, Scale } from "lucide-react";

const XUONG_OPT = [
  { value: "Tất cả", label: "Tất cả xưởng" },
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

/** Dòng nguyên liệu MUA — gom theo đại lý × loại. */
interface DongMua {
  supplierName: string;
  materialTypeName: string;
  quantityKg: number;
  quantityChoGiaKg: number; // kg chưa có đơn giá (chờ hóa đơn)
  amount: number; // giá trị theo đơn giá mua
}
/** Dòng phế liệu cân gộp trong kỳ — TÁCH RIÊNG, không cộng vào giá trị nhập mua. */
interface DongPhe {
  name: string;
  quantityKg: number;
  saleValue: number; // theo giá bán phế liệu
}

/**
 * Báo cáo Nhập hàng — tổng nhập MUA theo kỳ, gom theo ĐẠI LÝ × LOẠI NGUYÊN LIỆU.
 * Phế liệu cân trong kỳ để RIÊNG (giá bán ≠ giá mua, không trộn vào "Giá trị nhập").
 * Chỉ đọc sổ nhập; xuất được Excel để kế toán đối chiếu.
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

  const {
    dongMua,
    dongPhe,
    chart,
    tongKg,
    tongTien,
    tongChoGia,
    tongKgPhe,
    tongTienPhe,
  } = useMemo(() => {
    const locImports = rows.filter(
      (r) =>
        r.deliveryDate >= tu &&
        r.deliveryDate <= den &&
        (xuong === "Tất cả" || r.workshop === xuong)
    );
    const locScraps = scraps.filter(
      (r) =>
        r.source === "Nhập hàng" &&
        r.date >= tu &&
        r.date <= den &&
        (xuong === "Tất cả" || r.workshop === xuong)
    );

    // Gom nguyên liệu MUA
    const mua = new Map<string, DongMua>();
    for (const r of locImports) {
      const sup = r.supplierName || "(chưa có đại lý)";
      const mt = r.materialTypeName || "(chưa rõ loại)";
      const k = `${sup}|||${mt}`;
      let d = mua.get(k);
      if (!d) {
        d = { supplierName: sup, materialTypeName: mt, quantityKg: 0, quantityChoGiaKg: 0, amount: 0 };
        mua.set(k, d);
      }
      d.quantityKg += r.quantityKg || 0;
      if (r.unitPrice == null) d.quantityChoGiaKg += r.quantityKg || 0;
      d.amount += calculateImportAmount(r);
    }
    const dongMua = [...mua.values()].sort(
      (a, b) =>
        a.supplierName.localeCompare(b.supplierName, "vi") ||
        a.materialTypeName.localeCompare(b.materialTypeName, "vi")
    );

    // Gom phế liệu RIÊNG
    const phe = new Map<string, DongPhe>();
    for (const r of locScraps) {
      const nm = r.name || "(chưa rõ loại phế liệu)";
      let d = phe.get(nm);
      if (!d) {
        d = { name: nm, quantityKg: 0, saleValue: 0 };
        phe.set(nm, d);
      }
      d.quantityKg += r.quantityKg || 0;
      d.saleValue += (r.quantityKg || 0) * (r.sellingPrice ?? 0);
    }
    const dongPhe = [...phe.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));

    // Biểu đồ: nguyên liệu MUA theo ngày (không trộn phế liệu)
    const theoNgay = new Map<string, number>();
    for (const r of locImports)
      theoNgay.set(r.deliveryDate, (theoNgay.get(r.deliveryDate) ?? 0) + (r.quantityKg || 0));
    const chart: CotBieuDoDoc[] = [...theoNgay.keys()].sort().map((date) => ({
      nhan: viDate(date).slice(0, 5),
      giaTri: theoNgay.get(date) ?? 0,
      phu: viDate(date),
    }));

    return {
      dongMua,
      dongPhe,
      chart,
      tongKg: dongMua.reduce((s, d) => s + d.quantityKg, 0),
      tongTien: dongMua.reduce((s, d) => s + d.amount, 0),
      tongChoGia: dongMua.reduce((s, d) => s + d.quantityChoGiaKg, 0),
      tongKgPhe: dongPhe.reduce((s, d) => s + d.quantityKg, 0),
      tongTienPhe: dongPhe.reduce((s, d) => s + d.saleValue, 0),
    };
  }, [rows, scraps, tu, den, xuong]);

  const the: TheThongTin[] = [
    { nhan: "Kỳ báo cáo", giaTri: `${viDate(tu)} – ${viDate(den)}`, icon: CalendarRange, mau: "trung-tinh" },
    { nhan: "Nhập mua", giaTri: `${num(tongKg)} kg`, so: true, icon: Scale, mau: "brand" },
    { nhan: "Giá trị mua", giaTri: `${num(tongTien)} đ`, so: true, icon: Coins, mau: "success" },
    {
      nhan: "Chờ hóa đơn",
      giaTri: `${num(tongChoGia)} kg`,
      so: true,
      icon: FileClock,
      mau: tongChoGia > 0 ? "warning" : "trung-tinh",
    },
  ];

  const cotMua: CotTong<DongMua>[] = [
    { key: "dl", header: "Đại lý", render: (r) => r.supplierName },
    { key: "loai", header: "Loại nguyên liệu", render: (r) => r.materialTypeName },
    { key: "kg", header: "Số cân (kg)", so: true, render: (r) => num(r.quantityKg), tong: () => num(tongKg) },
    {
      key: "chogia",
      header: "Chờ giá (kg)",
      so: true,
      render: (r) => (r.quantityChoGiaKg ? num(r.quantityChoGiaKg) : ""),
      tong: () => (tongChoGia ? num(tongChoGia) : ""),
    },
    { key: "tien", header: "Giá trị (đ)", so: true, render: (r) => num(r.amount), tong: () => num(tongTien) },
  ];

  const cotPhe: CotTong<DongPhe>[] = [
    { key: "loai", header: "Loại phế liệu", render: (r) => r.name },
    { key: "kg", header: "Số cân (kg)", so: true, render: (r) => num(r.quantityKg), tong: () => num(tongKgPhe) },
    { key: "tien", header: "Giá trị bán (đ)", so: true, render: (r) => num(r.saleValue), tong: () => num(tongTienPhe) },
  ];

  const xuatExcel = () => {
    if (!dongMua.length && !dongPhe.length) {
      notify.canhBao("Không có số liệu để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Báo cáo tổng hợp nhập hàng"]);
    aoa.push([`Kỳ: ${viDate(tu)} – ${viDate(den)} · Phân xưởng: ${xuong}`]);
    aoa.push([]);
    aoa.push(["NGUYÊN LIỆU MUA"]);
    aoa.push(["Đại lý", "Loại nguyên liệu", "Số cân (kg)", "Chờ giá (kg)", "Giá trị (đ)"]);
    for (const r of dongMua)
      aoa.push([r.supplierName, r.materialTypeName, r.quantityKg, r.quantityChoGiaKg, r.amount]);
    aoa.push(["Tổng cộng", "", tongKg, tongChoGia, tongTien]);
    if (dongPhe.length) {
      aoa.push([]);
      aoa.push(["PHẾ LIỆU (giá bán, không tính vào giá trị nhập mua)"]);
      aoa.push(["Loại phế liệu", "Số cân (kg)", "Giá trị bán (đ)"]);
      for (const r of dongPhe) aoa.push([r.name, r.quantityKg, r.saleValue]);
      aoa.push(["Tổng cộng", tongKgPhe, tongTienPhe]);
    }
    exportAoaToXlsx({
      sheetName: "Nhập hàng",
      aoa,
      colWidths: [26, 26, 14, 14, 16],
      fileName: `bao-cao-nhap-hang_${tu}_${den}.xlsx`,
    });
    notify.daLuu("Đã xuất Excel báo cáo nhập hàng");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-end gap-4">
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
        <Button
          size="lg"
          variant="outline"
          onClick={xuatExcel}
          disabled={!dongMua.length && !dongPhe.length}
        >
          <FileSpreadsheet />
          Xuất Excel
        </Button>
      </div>

      <ThongKe the={the} />

      {chart.length > 0 && (
        <section className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Nguyên liệu mua theo ngày
          </h3>
          <BieuDoCotDoc data={chart} donVi="kg" />
        </section>
      )}

      <BangTong
        rows={dongMua}
        cot={cotMua}
        getKey={(r) => `${r.supplierName}|||${r.materialTypeName}`}
        emptyText="Không có nguyên liệu mua trong kỳ này."
      />

      {dongPhe.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h3 className="text-lg font-semibold text-foreground">Phế liệu cân trong kỳ</h3>
            <span className="text-sm text-muted-foreground">
              (giá bán, tách riêng — không cộng vào giá trị nhập mua)
            </span>
          </div>
          <BangTong
            rows={dongPhe}
            cot={cotPhe}
            getKey={(r) => r.name}
            emptyText="Không có phế liệu trong kỳ này."
          />
        </section>
      )}
    </div>
  );
}
