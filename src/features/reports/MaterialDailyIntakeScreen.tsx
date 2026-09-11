// ============================================================
// Tên file: src/features/reports/MaterialDailyIntakeScreen.tsx
// Tên tiếng Việt: Sổ nhập nguyên liệu theo NGÀY (tồn theo nhập hàng)
// Description: Daily raw-material intake ledger — running stock from imports only
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  CalendarDays,
  ScrollText,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import {
  BangTong,
  BieuDoCot,
  Combobox,
  DateField,
  DateRangeField,
  EmptyState,
  ThongKe,
  homNay,
  type CotBieuDo,
  type CotTong,
  type MucChon,
  type TheThongTin,
} from "@/design-system";
import { useMaterialImports, useMaterialOpeningStock } from "@/lib/catalogRepo";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { hoNguyenLieu } from "@/lib/balancingGrid";
import { num, viDate } from "@/lib/format";
import type { Workshop } from "@/types";

const XUONG_OPT: MucChon[] = [
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
  { value: "Tất cả", label: "Tất cả xưởng" },
];

const THU = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
/** Thứ trong tuần (nhãn) — an toàn timezone: ghép giờ trưa để khỏi lệch ngày. */
function thuCuaNgay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : THU[d.getDay()];
}

interface DongNgay {
  date: string;
  soChuyen: number;
  nhapKg: number;
  luyKe: number; // Σ nhập từ đầu kỳ tới ngày này
  tonCuoi: number; // tồn đầu + lũy kế nhập (CHƯA trừ lấy ra SX)
}

interface DongHo {
  hoNL: string;
  tonDau: number;
  nhapKy: number;
  ton: number; // tồn đầu + nhập kỳ
}

/**
 * Sổ NHẬP nguyên liệu theo NGÀY — dựng thẳng từ `material_imports` (sổ nhập hàng),
 * cho cả 3 phân xưởng, KHÔNG cần kỳ Cân đối. Mỗi ngày: nhập bao nhiêu kg + tồn
 * cộng dồn (tồn đầu + lũy kế nhập).
 *
 * ⚠️ PHẠM VI v1: mới có vế NHẬP. "NL lấy ra đi sản xuất" chưa được ghi ở đâu (quyết
 * định giản lược màn Sản xuất 2026-08-25) nên tồn ở đây là **tồn theo nhập, CHƯA trừ
 * phần đưa vào chế biến**. Khi có capture NL-xuất sẽ thêm cột "Xuất SX" để ra tồn thật.
 * Khác màn "Tồn kho NL" (/nxt-nl) — cái đó là kho ĐÔNG DỰ TRỮ theo kỳ (đông gửi/xả đông).
 */
export default function MaterialDailyIntakeScreen() {
  const [imports] = useMaterialImports();
  const [opening] = useMaterialOpeningStock();

  const [ky, setKy] = useState<KyXem>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [xuong, setXuong] = useState<string>("Tất cả");
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  const data = useMemo(() => {
    const workshop = xuong === "Tất cả" ? undefined : (xuong as Workshop);

    // Nhập trong khoảng ngày + xưởng.
    const loc = imports.filter(
      (r) =>
        r.deliveryDate >= tu &&
        r.deliveryDate <= den &&
        (!workshop || r.workshop === workshop),
    );

    // Tồn đầu kỳ = tồn đầu khai tay (material_opening_stock) có mốc TRƯỚC ngày bắt đầu.
    const tonDauHo = new Map<string, number>();
    let tonDau = 0;
    for (const o of opening) {
      if (workshop && o.workshop !== workshop) continue;
      if (o.asOfDate && o.asOfDate >= tu) continue; // chỉ tính phần trước kỳ
      const ho = hoNguyenLieu(o.materialTypeName) || "(chưa rõ loại)";
      tonDauHo.set(ho, (tonDauHo.get(ho) ?? 0) + (o.quantityKg || 0));
      tonDau += o.quantityKg || 0;
    }

    // Gom theo NGÀY (kèm số chuyến + phân rã theo họ NL cho thẻ hover).
    interface CtNgay {
      kg: number;
      chuyen: Set<string>;
      loai: Map<string, number>;
    }
    const mapNgay = new Map<string, CtNgay>();
    const nhapHo = new Map<string, number>();
    for (const r of loc) {
      let d = mapNgay.get(r.deliveryDate);
      if (!d) {
        d = { kg: 0, chuyen: new Set(), loai: new Map() };
        mapNgay.set(r.deliveryDate, d);
      }
      d.kg += r.quantityKg || 0;
      if (r.shipmentId) d.chuyen.add(r.shipmentId);
      const ho = hoNguyenLieu(r.materialTypeName) || "(chưa rõ loại)";
      d.loai.set(ho, (d.loai.get(ho) ?? 0) + (r.quantityKg || 0));
      nhapHo.set(ho, (nhapHo.get(ho) ?? 0) + (r.quantityKg || 0));
    }

    const ngaySap = [...mapNgay.keys()].sort();
    // Lũy kế nhập = tồn cuối ngày trước + nhập hôm nay (không mutate biến closure).
    const theoNgay: DongNgay[] = ngaySap.reduce<DongNgay[]>((acc, date) => {
      const d = mapNgay.get(date)!;
      const luy = (acc[acc.length - 1]?.luyKe ?? 0) + d.kg;
      acc.push({
        date,
        soChuyen: d.chuyen.size,
        nhapKg: d.kg,
        luyKe: luy,
        tonCuoi: tonDau + luy,
      });
      return acc;
    }, []);

    // Bảng theo họ NL: tồn đầu + nhập kỳ.
    const hoTatCa = new Set<string>([...tonDauHo.keys(), ...nhapHo.keys()]);
    const theoHo: DongHo[] = [...hoTatCa]
      .map((ho) => {
        const td = tonDauHo.get(ho) ?? 0;
        const nk = nhapHo.get(ho) ?? 0;
        return { hoNL: ho, tonDau: td, nhapKy: nk, ton: td + nk };
      })
      .sort((a, b) => b.ton - a.ton);

    // Biểu đồ nhập theo ngày (thẻ hover phân rã theo họ NL).
    const chart: CotBieuDo[] = theoNgay.map((dn) => {
      const loaiArr = [...mapNgay.get(dn.date)!.loai.entries()].sort(
        (a, b) => b[1] - a[1],
      );
      const chiTiet: ReactNode = (
        <div className="space-y-2">
          <div className="border-b border-border pb-1.5">
            <div className="font-semibold text-foreground">
              {viDate(dn.date)}
              {thuCuaNgay(dn.date) ? ` · ${thuCuaNgay(dn.date)}` : ""}
            </div>
            <div className="text-muted-foreground">
              {dn.soChuyen} chuyến ·{" "}
              <span className="tnum font-semibold text-foreground">
                {num(dn.nhapKg)} kg
              </span>
            </div>
          </div>
          <ul className="space-y-1">
            {loaiArr.slice(0, 16).map(([ten, kgv]) => (
              <li
                key={ten}
                className="flex items-baseline justify-between gap-4"
              >
                <span className="min-w-0 break-words text-muted-foreground">
                  {ten}
                </span>
                <span className="tnum shrink-0 font-medium text-foreground">
                  {num(kgv)} kg
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
      return { nhan: viDate(dn.date), giaTri: dn.nhapKg, chiTiet };
    });

    const tongNhap = theoNgay.reduce((s, d) => s + d.nhapKg, 0);
    return { theoNgay, theoHo, tonDau, tongNhap, chart, soNgay: theoNgay.length };
  }, [imports, opening, tu, den, xuong]);

  const the: TheThongTin[] = [
    {
      nhan: "Tồn đầu kỳ",
      giaTri: `${num(data.tonDau)} kg`,
      so: true,
      icon: Warehouse,
      mau: "trung-tinh",
    },
    {
      nhan: "Nhập trong kỳ",
      giaTri: `${num(data.tongNhap)} kg`,
      so: true,
      icon: ArrowDownToLine,
      mau: "brand",
    },
    {
      nhan: "Tồn cuối (chưa trừ SX)",
      giaTri: `${num(data.tonDau + data.tongNhap)} kg`,
      so: true,
      icon: ScrollText,
      mau: "success",
    },
    {
      nhan: "Số ngày có nhập",
      giaTri: `${data.soNgay}`,
      so: true,
      icon: CalendarDays,
      mau: "trung-tinh",
    },
  ];

  const cotNgay: CotTong<DongNgay>[] = [
    {
      key: "date",
      header: "Ngày",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{viDate(r.date)}</div>
          {thuCuaNgay(r.date) && (
            <div className="text-sm text-muted-foreground">
              {thuCuaNgay(r.date)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "soChuyen",
      header: "Số chuyến",
      so: true,
      render: (r) => num(r.soChuyen),
      tong: () => num(data.theoNgay.reduce((s, d) => s + d.soChuyen, 0)),
    },
    {
      key: "nhapKg",
      header: "Nhập (kg)",
      so: true,
      render: (r) => (
        <span className="font-semibold text-primary">+{num(r.nhapKg)}</span>
      ),
      tong: () => num(data.tongNhap),
    },
    {
      key: "luyKe",
      header: "Lũy kế nhập (kg)",
      so: true,
      render: (r) => (
        <span className="text-muted-foreground">{num(r.luyKe)}</span>
      ),
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối ngày (kg)",
      so: true,
      render: (r) => (
        <span className="tnum font-bold text-foreground">{num(r.tonCuoi)}</span>
      ),
    },
  ];

  const cotHo: CotTong<DongHo>[] = [
    {
      key: "hoNL",
      header: "Loại nguyên liệu",
      render: (r) => (
        <span className="font-semibold text-foreground">{r.hoNL}</span>
      ),
    },
    {
      key: "tonDau",
      header: "Tồn đầu (kg)",
      so: true,
      render: (r) => num(r.tonDau),
      tong: () => num(data.tonDau),
    },
    {
      key: "nhapKy",
      header: "Nhập kỳ (kg)",
      so: true,
      render: (r) => (
        <span className="font-semibold text-primary">+{num(r.nhapKy)}</span>
      ),
      tong: () => num(data.tongNhap),
    },
    {
      key: "ton",
      header: "Tồn (kg)",
      so: true,
      render: (r) => (
        <span className="tnum font-bold text-foreground">{num(r.ton)}</span>
      ),
      tong: () => num(data.tonDau + data.tongNhap),
    },
  ];

  return (
    // overflow-x-clip: thẻ hover biểu đồ (absolute) không đẩy trang cuộn ngang ở mobile.
    <div className="space-y-6 overflow-x-clip">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <ScrollText className="h-8 w-8 text-primary" />
          Nhập nguyên liệu theo ngày
        </h1>
        <p className="mt-1 text-muted-foreground">
          Sổ nhập NL dựng thẳng từ sổ Nhập hàng — mỗi ngày nhập bao nhiêu, tồn
          cộng dồn theo ngày, cho cả 3 phân xưởng. Không cần tạo kỳ Cân đối.
        </p>
      </div>

      {/* Bộ chọn kỳ + phân xưởng (mẫu giống các báo cáo khác) */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem]">
          <Combobox
            label="Kỳ xem"
            anNhanBatBuoc
            choPhepXoa={false}
            value={ky}
            onChange={(v) => setKy(v as KyXem)}
            options={KY_OPT}
          />
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[16rem]">
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

      {/* Chú thích phạm vi — trung thực với người xem (nhất là BGĐ) */}
      <div className="flex flex-wrap items-start gap-3 rounded-xl border-2 border-warning bg-warning/10 p-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <span className="text-base text-warning-foreground">
          Tồn ở đây = <b>tồn đầu + nhập lũy kế</b>, <b>CHƯA trừ nguyên liệu lấy ra
          đi sản xuất</b> (phần đó chưa được ghi ở màn Sản xuất — sẽ bổ sung sau).
          Đây là sổ theo dõi NL <b>vào kho theo ngày</b>, chưa phải tồn cuối cùng.
        </span>
      </div>

      {data.soNgay === 0 ? (
        <EmptyState
          icon={CalendarDays}
          tieuDe="Chưa có chuyến nhập nào trong khoảng ngày này"
          moTa="Đổi lại Kỳ xem / phân xưởng, hoặc ghi chuyến nhập ở màn Nhập hàng trước."
        />
      ) : (
        <>
          {/* Biểu đồ nhập theo ngày */}
          <section className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                Nguyên liệu nhập theo ngày
              </h3>
              <span className="text-sm text-muted-foreground">
                {data.soNgay} ngày có nhập · tổng {num(data.tongNhap)} kg
              </span>
            </div>
            <BieuDoCot data={data.chart} donVi="kg" giuThuTu soDongToiDa={62} />
          </section>

          {/* Sổ theo NGÀY */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Sổ theo ngày</h3>
            <BangTong
              rows={data.theoNgay}
              cot={cotNgay}
              getKey={(r) => r.date}
              emptyText="Không có ngày nào có nhập."
            />
          </section>

          {/* Tồn theo loại NL */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              Tồn theo loại nguyên liệu
            </h3>
            <BangTong
              rows={data.theoHo}
              cot={cotHo}
              getKey={(r) => r.hoNL}
              emptyText="Chưa có loại nguyên liệu nào."
            />
          </section>
        </>
      )}
    </div>
  );
}
