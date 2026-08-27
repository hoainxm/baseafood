// ============================================================
// Tên file cũ: src/features/imports/BaoCaoNhap.tsx
// Tên tiếng Việt: Báo cáo tổng hợp Nhập Nguyên liệu
// Description: Material Import Summary Report
// ============================================================
import { useMemo, useState } from "react";
import {
  BangTong,
  BieuDoCot,
  Button,
  Combobox,
  DateField,
  DateRangeField,
  ThongKe,
  homNay,
  notify,
  type CotBieuDo,
  type CotTong,
  type TheThongTin,
} from "@/design-system";
import { useMaterialImports, useScraps } from "@/lib/catalogRepo";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { num, viDate } from "@/lib/format";
import { calculateImportAmount } from "@/types";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import { CalendarRange, Coins, FileClock, FileSpreadsheet, Scale } from "lucide-react";

const THU = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
/** Thứ trong tuần từ ngày ISO (yyyy-mm-dd) — tính theo UTC để không lệch múi giờ. */
function thuTrongTuan(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return THU[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
}

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

    // Biểu đồ: nguyên liệu MUA theo ngày (không trộn phế liệu) + tóm tắt hover
    interface CtNgay {
      tongKg: number;
      tongTien: number;
      chuyen: Set<string>;
      loai: Map<string, number>;
    }
    const ct = new Map<string, CtNgay>();
    for (const r of locImports) {
      let d = ct.get(r.deliveryDate);
      if (!d) {
        d = { tongKg: 0, tongTien: 0, chuyen: new Set(), loai: new Map() };
        ct.set(r.deliveryDate, d);
      }
      d.tongKg += r.quantityKg || 0;
      d.tongTien += calculateImportAmount(r);
      if (r.shipmentId) d.chuyen.add(r.shipmentId);
      const nhomKey = `${r.supplierName || "(chưa có đại lý)"} · ${r.materialTypeName || "(chưa rõ loại)"}`;
      d.loai.set(nhomKey, (d.loai.get(nhomKey) ?? 0) + (r.quantityKg || 0));
    }
    const chart: CotBieuDo[] = [...ct.keys()].sort().map((date) => {
      const d = ct.get(date)!;
      const loaiArr = [...d.loai.entries()].sort((a, b) => b[1] - a[1]);
      return {
        nhan: viDate(date),
        giaTri: d.tongKg,
        chiTiet: (
          <div className="space-y-2">
            <div className="border-b border-border pb-1.5">
              <div className="font-semibold text-foreground">
                {viDate(date)}
                {thuTrongTuan(date) ? ` · ${thuTrongTuan(date)}` : ""}
              </div>
              <div className="text-muted-foreground">
                {d.chuyen.size} chuyến ·{" "}
                <span className="tnum font-semibold text-foreground">{num(d.tongKg)} kg</span>
                {d.tongTien > 0 ? ` · ${num(d.tongTien)} đ` : ""}
              </div>
            </div>
            <ul className="space-y-1">
              {loaiArr.slice(0, 5).map(([ten, kg]) => (
                <li key={ten} className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-muted-foreground">{ten}</span>
                  <span className="tnum shrink-0 font-medium text-foreground">{num(kg)} kg</span>
                </li>
              ))}
              {loaiArr.length > 5 && (
                <li className="text-muted-foreground">… +{loaiArr.length - 5} loại khác</li>
              )}
            </ul>
          </div>
        ),
      };
    });

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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              Nguyên liệu mua theo ngày
            </h3>
            <span className="text-sm text-muted-foreground">
              {chart.length} ngày có nhập · tổng {num(tongKg)} kg
            </span>
          </div>
          <BieuDoCot data={chart} donVi="kg" giuThuTu soDongToiDa={62} />
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
