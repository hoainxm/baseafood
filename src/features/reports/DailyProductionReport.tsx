// ============================================================
// Tên file: src/features/reports/DailyProductionReport.tsx
// Tên tiếng Việt: Báo cáo tổng hợp Thành phẩm sản xuất hàng ngày
// Description: Daily finished-product (WIP) production summary report
// ============================================================
import { Fragment, useMemo, useState } from "react";
import type { Workshop } from "@/types";
import { useProducts, useWipProductions } from "@/lib/catalogRepo";
import {
  BieuDoCotDoc,
  Button,
  Combobox,
  DateField,
  DateRangeField,
  EmptyState,
  PhieuIn,
  SkeletonBang,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TdIn,
  ThIn,
  ThongKe,
  homNay,
  notify,
  type CotBieuDoDoc,
  type TheThongTin,
} from "@/design-system";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { num, viDate } from "@/lib/format";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import {
  CalendarRange,
  Factory,
  FileSpreadsheet,
  Layers,
  Package,
  Printer,
  Scale,
} from "lucide-react";

const PHAN_XUONG: Workshop[] = ["Đông", "Cá", "Khô"];
const XUONG_OPT = [
  { value: "Tất cả", label: "Tất cả xưởng" },
  ...PHAN_XUONG.map((p) => ({ value: p, label: p })),
];

/** Một dòng lưới: mặt hàng × quy cách của một phân xưởng, phân bổ theo ngày. */
interface DongPivot {
  workshop: Workshop;
  productId: string;
  productName: string;
  spec: string;
  theoNgay: Record<string, number>;
  tongKg: number;
  tongBlock: number;
}

interface NhomXuong {
  workshop: Workshop;
  rows: DongPivot[];
  theoNgay: Record<string, number>;
  tongKg: number;
  tongBlock: number;
}

/**
 * Báo cáo tổng hợp thành phẩm sản xuất hàng ngày — lưới MẶT HÀNG × NGÀY, gom theo
 * phân xưởng, cộng ngang (Tổng kg/block) và cộng dọc (mỗi ngày). Đọc thẳng sổ Sản
 * xuất BTP (mọi trạng thái — đây là sản lượng LÀM RA, không phải tồn kho). Chỉ đọc,
 * xuất được Excel để kế toán đối chiếu.
 */
export default function DailyProductionReport() {
  const [rows, , { trangThai }] = useWipProductions();
  const [matHang] = useProducts();
  const dangTai = trangThai === "dang-tai" && rows.length === 0;

  const [ky, setKy] = useState<KyXem>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [xuong, setXuong] = useState("Tất cả");
  const [inPrint, setInPrint] = useState(false);
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  const { days, groups, tongNgayTong, tongKgTong, tongBlockTong, soMatHang } =
    useMemo(() => {
      const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
      const loc = rows.filter(
        (r) =>
          r.productionDate >= tu &&
          r.productionDate <= den &&
          (xuong === "Tất cả" || r.workshop === xuong)
      );

      const daySet = new Set<string>();
      const map = new Map<string, DongPivot>();
      for (const r of loc) {
        daySet.add(r.productionDate);
        const key = `${r.workshop}|||${r.productId}|||${r.spec}`;
        let d = map.get(key);
        if (!d) {
          d = {
            workshop: r.workshop,
            productId: r.productId,
            productName: tenMH(r.productId),
            spec: r.spec,
            theoNgay: {},
            tongKg: 0,
            tongBlock: 0,
          };
          map.set(key, d);
        }
        d.theoNgay[r.productionDate] =
          (d.theoNgay[r.productionDate] ?? 0) + (r.quantityKg || 0);
        d.tongKg += r.quantityKg || 0;
        d.tongBlock += r.blocksCount || 0;
      }

      const days = [...daySet].sort();
      const allRows = [...map.values()].sort(
        (a, b) =>
          PHAN_XUONG.indexOf(a.workshop) - PHAN_XUONG.indexOf(b.workshop) ||
          a.productName.localeCompare(b.productName, "vi") ||
          a.spec.localeCompare(b.spec, "vi")
      );

      const groups: NhomXuong[] = [];
      for (const w of PHAN_XUONG) {
        const wr = allRows.filter((r) => r.workshop === w);
        if (!wr.length) continue;
        const theoNgay: Record<string, number> = {};
        let tongKg = 0;
        let tongBlock = 0;
        for (const r of wr) {
          tongKg += r.tongKg;
          tongBlock += r.tongBlock;
          for (const d of days)
            theoNgay[d] = (theoNgay[d] ?? 0) + (r.theoNgay[d] ?? 0);
        }
        groups.push({ workshop: w, rows: wr, theoNgay, tongKg, tongBlock });
      }

      const tongNgayTong: Record<string, number> = {};
      for (const d of days)
        tongNgayTong[d] = groups.reduce((s, g) => s + (g.theoNgay[d] ?? 0), 0);

      return {
        days,
        groups,
        tongNgayTong,
        tongKgTong: groups.reduce((s, g) => s + g.tongKg, 0),
        tongBlockTong: groups.reduce((s, g) => s + g.tongBlock, 0),
        soMatHang: allRows.length,
      };
    }, [rows, matHang, tu, den, xuong]);

  const chart: CotBieuDoDoc[] = days.map((d) => ({
    nhan: viDate(d).slice(0, 5),
    giaTri: tongNgayTong[d] ?? 0,
    phu: viDate(d),
  }));

  const the: TheThongTin[] = [
    { nhan: "Kỳ báo cáo", giaTri: `${viDate(tu)} – ${viDate(den)}`, icon: CalendarRange, mau: "trung-tinh" },
    { nhan: "Tổng sản lượng", giaTri: `${num(tongKgTong)} kg`, so: true, icon: Scale, mau: "brand" },
    { nhan: "Tổng block", giaTri: num(tongBlockTong), so: true, icon: Layers, mau: "trung-tinh" },
    { nhan: "Số mặt hàng", giaTri: num(soMatHang), so: true, icon: Package, mau: "success" },
  ];

  const xuatExcel = () => {
    if (!groups.length) {
      notify.canhBao("Không có số liệu để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Báo cáo tổng hợp thành phẩm sản xuất hàng ngày"]);
    aoa.push([`Kỳ: ${viDate(tu)} – ${viDate(den)} · Phân xưởng: ${xuong}`]);
    aoa.push([]);
    aoa.push(["Phân xưởng", "Mặt hàng", "Quy cách", ...days.map((d) => viDate(d)), "Tổng kg", "Tổng block"]);
    for (const g of groups) {
      for (const r of g.rows)
        aoa.push([g.workshop, r.productName, r.spec, ...days.map((d) => r.theoNgay[d] ?? 0), r.tongKg, r.tongBlock]);
      aoa.push([`Cộng xưởng ${g.workshop}`, "", "", ...days.map((d) => g.theoNgay[d] ?? 0), g.tongKg, g.tongBlock]);
    }
    aoa.push(["TỔNG CỘNG", "", "", ...days.map((d) => tongNgayTong[d] ?? 0), tongKgTong, tongBlockTong]);
    exportAoaToXlsx({
      sheetName: "Thành phẩm ngày",
      aoa,
      colWidths: [12, 30, 12, ...days.map(() => 11), 12, 10],
      fileName: `bao-cao-thanh-pham-ngay_${tu}_${den}.xlsx`,
    });
    notify.daLuu("Đã xuất Excel báo cáo thành phẩm ngày");
  };

  const soCot = days.length + 4;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          Báo cáo thành phẩm hàng ngày
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="outline" onClick={() => setInPrint(true)} disabled={!groups.length}>
            <Printer />
            In A4
          </Button>
          <Button size="lg" variant="outline" onClick={xuatExcel} disabled={!groups.length}>
            <FileSpreadsheet />
            Xuất Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
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
              label="Khoảng ngày sản xuất"
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

      {dangTai ? (
        <SkeletonBang />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Factory}
          tieuDe={`Chưa có thành phẩm sản xuất trong ${viDate(tu)} – ${viDate(den)}`}
          moTa="Ghi sản lượng ở màn Sản xuất BTP, số liệu sẽ tổng hợp về đây."
        />
      ) : (
        <>
          {chart.length > 1 && (
            <section className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground">
                Sản lượng làm ra theo ngày
              </h3>
              <BieuDoCotDoc data={chart} donVi="kg" />
            </section>
          )}

          <div className="scroll-nice overflow-x-auto rounded-xl border-2 border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mặt hàng</TableHead>
                  <TableHead>Quy cách</TableHead>
                  {days.map((d) => (
                    <TableHead key={d} className="whitespace-nowrap text-right">
                      {viDate(d).slice(0, 5)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Tổng kg</TableHead>
                  <TableHead className="text-right">Block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <Fragment key={g.workshop}>
                    <TableRow>
                      <TableCell colSpan={soCot} className="bg-muted font-semibold">
                        Phân xưởng {g.workshop}
                      </TableCell>
                    </TableRow>
                    {g.rows.map((r) => (
                      <TableRow key={`${r.workshop}|||${r.productId}|||${r.spec}`}>
                        <TableCell className="font-medium">{r.productName}</TableCell>
                        <TableCell>{r.spec || "—"}</TableCell>
                        {days.map((d) => (
                          <TableCell key={d} className="tnum text-right">
                            {r.theoNgay[d] ? num(r.theoNgay[d]) : ""}
                          </TableCell>
                        ))}
                        <TableCell className="tnum text-right font-semibold">{num(r.tongKg)}</TableCell>
                        <TableCell className="tnum text-right">{num(r.tongBlock)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold text-muted-foreground">
                        Cộng xưởng {g.workshop}
                      </TableCell>
                      <TableCell />
                      {days.map((d) => (
                        <TableCell key={d} className="tnum text-right font-semibold">
                          {g.theoNgay[d] ? num(g.theoNgay[d]) : ""}
                        </TableCell>
                      ))}
                      <TableCell className="tnum text-right font-semibold">{num(g.tongKg)}</TableCell>
                      <TableCell className="tnum text-right font-semibold">{num(g.tongBlock)}</TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">TỔNG CỘNG</TableCell>
                  <TableCell />
                  {days.map((d) => (
                    <TableCell key={d} className="tnum text-right font-bold">
                      {tongNgayTong[d] ? num(tongNgayTong[d]) : ""}
                    </TableCell>
                  ))}
                  <TableCell className="tnum text-right font-bold">{num(tongKgTong)}</TableCell>
                  <TableCell className="tnum text-right font-bold">{num(tongBlockTong)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}

      {inPrint && (
        <PhieuIn
          tieuDe="Báo cáo tổng hợp thành phẩm hàng ngày"
          phuDe={`Kỳ: ${viDate(tu)} – ${viDate(den)}${xuong !== "Tất cả" ? ` · Phân xưởng ${xuong}` : ""}`}
          onClose={() => setInPrint(false)}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <ThIn>Mặt hàng</ThIn>
                <ThIn>Quy cách</ThIn>
                {days.map((d) => (
                  <ThIn key={d} right>
                    {viDate(d).slice(0, 5)}
                  </ThIn>
                ))}
                <ThIn right>Tổng kg</ThIn>
                <ThIn right>Block</ThIn>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.workshop}>
                  <tr>
                    <TdIn dam colSpan={soCot}>
                      Phân xưởng {g.workshop}
                    </TdIn>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={`${r.workshop}|||${r.productId}|||${r.spec}`}>
                      <TdIn>{r.productName}</TdIn>
                      <TdIn>{r.spec || "—"}</TdIn>
                      {days.map((d) => (
                        <TdIn key={d} right className="tnum">
                          {r.theoNgay[d] ? num(r.theoNgay[d]) : ""}
                        </TdIn>
                      ))}
                      <TdIn right className="tnum">
                        {num(r.tongKg)}
                      </TdIn>
                      <TdIn right className="tnum">
                        {num(r.tongBlock)}
                      </TdIn>
                    </tr>
                  ))}
                  <tr>
                    <TdIn dam>Cộng xưởng {g.workshop}</TdIn>
                    <TdIn dam />
                    {days.map((d) => (
                      <TdIn key={d} dam right className="tnum">
                        {g.theoNgay[d] ? num(g.theoNgay[d]) : ""}
                      </TdIn>
                    ))}
                    <TdIn dam right className="tnum">
                      {num(g.tongKg)}
                    </TdIn>
                    <TdIn dam right className="tnum">
                      {num(g.tongBlock)}
                    </TdIn>
                  </tr>
                </Fragment>
              ))}
              <tr>
                <TdIn dam>TỔNG CỘNG</TdIn>
                <TdIn dam />
                {days.map((d) => (
                  <TdIn key={d} dam right className="tnum">
                    {tongNgayTong[d] ? num(tongNgayTong[d]) : ""}
                  </TdIn>
                ))}
                <TdIn dam right className="tnum">
                  {num(tongKgTong)}
                </TdIn>
                <TdIn dam right className="tnum">
                  {num(tongBlockTong)}
                </TdIn>
              </tr>
            </tbody>
          </table>
        </PhieuIn>
      )}
    </div>
  );
}
