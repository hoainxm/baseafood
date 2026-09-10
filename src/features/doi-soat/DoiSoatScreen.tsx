// ============================================================
// Tên file: src/features/doi-soat/DoiSoatScreen.tsx
// Tên tiếng Việt tương đương: Màn Đối soát Hóa đơn điện tử ⇄ Phần mềm kế toán
// Description: Upload an invoice workbook, reconcile e-invoices vs accounting
//   software rows, show a color-coded table + export the annotated .xlsx.
// ============================================================
import { useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  NumberField,
  RecordTable,
  StatusChip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThongKe,
  notify,
  type Cot,
  type TheThongTin,
} from "@/design-system";
import {
  docVaDoiSoat,
  xuatExcelDoiSoat,
  type DongHoaDon,
  type DongPhanMem,
  type KetQuaDoiSoat,
  type SheetHoaDon,
  type SheetPhanMem,
  type TrangThaiHoaDon,
} from "@/lib/doiSoatHddt";
import { num } from "@/lib/format";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  ScanSearch,
} from "lucide-react";

// Nhãn + chip trạng thái (màu bám token design-system, luôn kèm chữ).
function chipHoaDon(t: TrangThaiHoaDon) {
  if (t === "KHOP") return <StatusChip trangThai="running" nhan="Khớp" />;
  if (t === "LECH") return <StatusChip trangThai="idle" nhan="Lệch tiền" />;
  return <StatusChip trangThai="stopped" nhan="Chưa có ở PM" />;
}

const LOC_HD: { id: TrangThaiHoaDon | "all"; nhan: string }[] = [
  { id: "all", nhan: "Tất cả" },
  { id: "KHOP", nhan: "Khớp" },
  { id: "LECH", nhan: "Lệch tiền" },
  { id: "THIEU", nhan: "Chưa có ở PM" },
];

function BangHoaDon({ sheet }: { sheet: SheetHoaDon }) {
  const [loc, setLoc] = useState<TrangThaiHoaDon | "all">("all");
  const dem = useMemo(() => {
    const d = { KHOP: 0, LECH: 0, THIEU: 0 } as Record<TrangThaiHoaDon, number>;
    for (const r of sheet.dong) d[r.trangThai]++;
    return d;
  }, [sheet]);
  const rows = useMemo(
    () => (loc === "all" ? sheet.dong : sheet.dong.filter((r) => r.trangThai === loc)),
    [sheet, loc]
  );

  const cot: Cot<DongHoaDon>[] = [
    { key: "kq", header: "Kết quả", chinh: true, render: (r) => chipHoaDon(r.trangThai) },
    { key: "kh", header: "Ký hiệu", render: (r) => r.kyHieu, sapXep: (r) => r.kyHieu },
    { key: "so", header: "Số HĐ", render: (r) => r.soHoaDon, sapXep: (r) => r.soChuan },
    { key: "ngay", header: "Ngày lập", render: (r) => r.ngayLap, sapXep: (r) => r.ngayLap },
    { key: "ban", header: "Người bán", render: (r) => r.tenBan },
    {
      key: "tt",
      header: "Tổng TT (VND)",
      so: true,
      render: (r) => num(r.tongTtVnd),
      sapXep: (r) => r.tongTtVnd,
    },
    {
      key: "pm",
      header: "Tổng bên PM",
      so: true,
      render: (r) => (r.trangThai === "THIEU" ? "—" : num(r.tongTtPm)),
    },
    {
      key: "chenh",
      header: "Chênh",
      so: true,
      render: (r) => (r.chenh == null ? "—" : num(r.chenh)),
      sapXep: (r) => (r.chenh == null ? 0 : Math.abs(r.chenh)),
    },
    { key: "bc", header: "Bằng chứng đối chiếu", render: (r) => r.bangChung },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LOC_HD.map((l) => (
          <Button
            key={l.id}
            variant={loc === l.id ? "default" : "outline"}
            size="sm"
            onClick={() => setLoc(l.id)}
          >
            {l.nhan}
            {l.id !== "all" && (
              <span className="tnum ml-1">({num(dem[l.id as TrangThaiHoaDon])})</span>
            )}
          </Button>
        ))}
      </div>
      <RecordTable
        columns={cot}
        rows={rows}
        getKey={(r) => `${r.sheet}#${r.soDong}`}
        timKiem={(r) => `${r.kyHieu} ${r.soHoaDon} ${r.tenBan} ${r.bangChung}`}
        nhanTimKiem="Tìm ký hiệu / số HĐ / người bán…"
        emptyText="Không có dòng nào ở trạng thái này."
      />
    </div>
  );
}

function BangPhanMem({ sheet }: { sheet: SheetPhanMem }) {
  const [chiThieu, setChiThieu] = useState(false);
  const dem = useMemo(() => {
    let thieu = 0;
    for (const r of sheet.dong) if (r.trangThai === "THIEU") thieu++;
    return { thieu, co: sheet.dong.length - thieu };
  }, [sheet]);
  const rows = useMemo(
    () => (chiThieu ? sheet.dong.filter((r) => r.trangThai === "THIEU") : sheet.dong),
    [sheet, chiThieu]
  );

  const cot: Cot<DongPhanMem>[] = [
    {
      key: "kq",
      header: "Kết quả",
      chinh: true,
      render: (r) =>
        r.trangThai === "CO" ? (
          <StatusChip trangThai="running" nhan="Đã có HĐĐT" />
        ) : (
          <StatusChip trangThai="stopped" nhan="Chưa có HĐĐT" />
        ),
    },
    { key: "phieu", header: "Phiếu", render: (r) => r.phieu },
    { key: "ctgs", header: "CTGS", render: (r) => r.ctgs },
    { key: "kh", header: "Ký hiệu", render: (r) => r.kyHieu, sapXep: (r) => r.kyHieu },
    { key: "so", header: "Số HĐ", render: (r) => r.soHoaDon, sapXep: (r) => r.soChuan },
    { key: "ban", header: "Người bán", render: (r) => r.tenBan },
    {
      key: "tong",
      header: "Tổng cộng",
      so: true,
      render: (r) => num(r.tongCong),
      sapXep: (r) => r.tongCong,
    },
    { key: "bc", header: "Bằng chứng đối chiếu", render: (r) => r.bangChung },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!chiThieu ? "default" : "outline"}
          size="sm"
          onClick={() => setChiThieu(false)}
        >
          Tất cả <span className="tnum ml-1">({num(sheet.dong.length)})</span>
        </Button>
        <Button
          variant={chiThieu ? "default" : "outline"}
          size="sm"
          onClick={() => setChiThieu(true)}
        >
          Chưa có HĐĐT <span className="tnum ml-1">({num(dem.thieu)})</span>
        </Button>
      </div>
      <RecordTable
        columns={cot}
        rows={rows}
        getKey={(r) => `pm#${r.soDong}`}
        timKiem={(r) => `${r.phieu} ${r.ctgs} ${r.kyHieu} ${r.soHoaDon} ${r.tenBan} ${r.bangChung}`}
        nhanTimKiem="Tìm phiếu / CTGS / số HĐ / người bán…"
        emptyText="Không có dòng nào ở trạng thái này."
      />
    </div>
  );
}

const PM_TAB = "__phan-mem__";

export default function DoiSoatScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [nguong, setNguong] = useState<number | null>(1000);
  const [ketQua, setKetQua] = useState<KetQuaDoiSoat | null>(null);
  const [dangChay, setDangChay] = useState(false);
  const [tab, setTab] = useState<string>("");

  const chonFile = () => fileRef.current?.click();

  const napFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setKetQua(null);
    e.target.value = ""; // cho chọn lại cùng file
  };

  const chay = async () => {
    if (!file) {
      notify.canhBao("Chưa chọn file Excel để đối soát.");
      return;
    }
    setDangChay(true);
    try {
      const kq = await docVaDoiSoat(file, { nguong: nguong ?? 0 });
      setKetQua(kq);
      setTab(kq.sheetsHoaDon[0]?.ten ?? (kq.sheetPhanMem ? PM_TAB : ""));
      notify.daLuu(
        `Đối soát xong: ${kq.tong.khop} khớp · ${kq.tong.lech} lệch · ${kq.tong.thieu} chưa có ở PM.`
      );
    } catch (err) {
      notify.loi(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDangChay(false);
    }
  };

  const taiExcel = () => {
    if (!ketQua) return;
    const ten = (file?.name ?? "doi-soat").replace(/\.xlsx?$/i, "");
    xuatExcelDoiSoat(ketQua, `${ten} - đã đối soát.xlsx`);
    notify.daLuu("Đã xuất file Excel kết quả (tô màu + cột phân tích).");
  };

  const the: TheThongTin[] = useMemo(() => {
    if (!ketQua) return [];
    const t = ketQua.tong;
    return [
      { nhan: "Hóa đơn điện tử", giaTri: num(t.soHoaDon), so: true, mau: "brand", icon: FileSpreadsheet },
      { nhan: "Khớp", giaTri: num(t.khop), so: true, mau: "success" },
      { nhan: "Lệch tiền", giaTri: num(t.lech), so: true, mau: "warning" },
      { nhan: "Chưa có ở PMKT", giaTri: num(t.thieu), so: true, mau: "danger" },
      { nhan: "Bút toán phần mềm", giaTri: num(t.soDongPm), so: true, mau: "brand" },
      { nhan: "PM chưa có HĐĐT", giaTri: num(t.pmThieu), so: true, mau: "danger" },
      { nhan: "Tổng chênh (đ)", giaTri: num(t.tongChenh), so: true, mau: "warning", phu: "các dòng lệch" },
      { nhan: "Ngưỡng khớp (đ)", giaTri: num(ketQua.nguong), so: true, mau: "trung-tinh" },
    ];
  }, [ketQua]);

  return (
    <div className="space-y-6">
      {/* Thanh điều khiển: chọn file · ngưỡng · chạy · tải kết quả */}
      <Card>
        <CardHeader>
          <CardTitle>Đối soát hóa đơn điện tử với phần mềm kế toán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tải file Excel gồm các sheet hóa đơn điện tử (cổng thuế) và sheet PHẦN MỀM (kế toán).
            Hệ thống đối chiếu theo <b>MST người bán · ký hiệu · số hóa đơn</b>, quy về VND, rồi
            báo dòng khớp / lệch tiền / chưa có ở phần mềm.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={napFile}
          />

          {/* Mobile: nút chính full-width lên đầu; desktop: xếp ngang */}
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
            <Button variant="outline" onClick={chonFile} className="w-full md:w-auto">
              <Upload />
              {file ? "Chọn file khác" : "Chọn file Excel"}
            </Button>
            <div className="w-full md:w-56">
              <NumberField
                label="Ngưỡng khớp"
                unit="đ"
                value={nguong}
                onChange={setNguong}
                hint="Chênh ≤ ngưỡng vẫn coi là khớp (nuốt sai số làm tròn)."
              />
            </div>
            <Button onClick={chay} disabled={dangChay} className="w-full md:w-auto">
              <ScanSearch />
              {dangChay ? "Đang đối soát…" : "Đối soát"}
            </Button>
            {ketQua && (
              <Button variant="outline" onClick={taiExcel} className="w-full md:w-auto">
                <Download />
                Tải Excel kết quả
              </Button>
            )}
          </div>

          {file && (
            <p className="text-sm text-muted-foreground">
              File đang chọn: <span className="font-medium text-foreground">{file.name}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {!ketQua ? (
        <EmptyState
          icon={FileSpreadsheet}
          tieuDe="Chưa có kết quả đối soát"
          moTa="Chọn file Excel rồi bấm Đối soát. File cần có ít nhất một sheet hóa đơn điện tử và một sheet PHẦN MỀM."
          action={
            <Button variant="outline" onClick={chonFile}>
              <Upload />
              Chọn file Excel
            </Button>
          }
        />
      ) : (
        <>
          <ThongKe the={the} cot={4} />

          {ketQua.canhBao.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="size-5" aria-hidden />
                  Cảnh báo cần soát ({ketQua.canhBao.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {ketQua.canhBao.slice(0, 40).map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-medium whitespace-nowrap text-muted-foreground">
                        {c.loai}:
                      </span>
                      <span>{c.chiTiet}</span>
                    </li>
                  ))}
                  {ketQua.canhBao.length > 40 && (
                    <li className="text-muted-foreground">
                      … và {num(ketQua.canhBao.length - 40)} cảnh báo nữa (xem trong file Excel tải về).
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap">
              {ketQua.sheetsHoaDon.map((s) => (
                <TabsTrigger key={s.ten} value={s.ten}>
                  {s.ten}
                </TabsTrigger>
              ))}
              {ketQua.sheetPhanMem && (
                <TabsTrigger value={PM_TAB}>Phần mềm kế toán</TabsTrigger>
              )}
            </TabsList>
            {ketQua.sheetsHoaDon.map((s) => (
              <TabsContent key={s.ten} value={s.ten} className="mt-4">
                <BangHoaDon sheet={s} />
              </TabsContent>
            ))}
            {ketQua.sheetPhanMem && (
              <TabsContent value={PM_TAB} className="mt-4">
                <BangPhanMem sheet={ketQua.sheetPhanMem} />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}
