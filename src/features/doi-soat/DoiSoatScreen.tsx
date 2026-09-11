// ============================================================
// Tên file: src/features/doi-soat/DoiSoatScreen.tsx
// Tên tiếng Việt tương đương: Màn Đối soát Hóa đơn điện tử ⇄ Phần mềm kế toán (v2)
// Description: Upload invoice workbook → reconcile e-invoices vs accounting rows.
//   v2: khối tự kiểm, cầu nối số liệu, nghi vấn 6 nhóm (không tự sửa — người dùng
//   bấm Sửa từng dòng, giữ giá trị cũ), chọn sổ chuẩn khi có nhiều sheet sổ.
// ============================================================
import { useMemo, useRef, useState } from "react";
import {
  Badge,
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
  doiSoat,
  docWorkbook,
  xuatExcelDoiSoat,
  type CauNoi,
  type DongHoaDon,
  type DongPhanMem,
  type KetQuaDoiSoat,
  type NghiVan,
  type NghiVanGop,
  type PhepThu,
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
  ShieldCheck,
  Wrench,
  Undo2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type Workbook = Awaited<ReturnType<typeof docWorkbook>>;
const PM_TAB = "__phan-mem__";
const keySua = (nv: NghiVan) => `${nv.sheet}#${nv.soDong}#${nv.cot}`;

function chipHoaDon(t: TrangThaiHoaDon) {
  if (t === "KHOP") return <StatusChip trangThai="running" nhan="Khớp" />;
  if (t === "LECH") return <StatusChip trangThai="idle" nhan="Lệch tiền" />;
  return <StatusChip trangThai="stopped" nhan="Chưa có ở PM" />;
}

// ---------- Khối tự kiểm (§6) ----------
function TuKiemBox({ phepThu }: { phepThu: PhepThu[] }) {
  const dat = phepThu.filter((p) => p.dat).length;
  const tatCaDat = dat === phepThu.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" aria-hidden />
          Tự kiểm{" "}
          <span className={tatCaDat ? "text-success" : "text-destructive"}>
            {tatCaDat ? `Đạt ${dat}/${phepThu.length}` : `Có ${phepThu.length - dat} phép không đạt`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {phepThu.map((p, i) => (
            <li key={i} className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {p.dat ? (
                    <StatusChip trangThai="running" nhan="Đạt" />
                  ) : (
                    <StatusChip trangThai="stopped" nhan="Không đạt" />
                  )}
                  <span>{p.ten}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Bắt lỗi: {p.batLoiGi}</p>
              </div>
              <div className="shrink-0 text-sm sm:text-right">
                <div>Mong: <span className="tnum font-medium">{p.mong}</span></div>
                <div>Thực: <span className="tnum font-medium">{p.thuc}</span></div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Cầu nối số liệu (§5) ----------
function CauNoiBox({ cauNoi }: { cauNoi: CauNoi }) {
  const chenhAB = cauNoi.chuaCoBenSo - cauNoi.chuaCoBenSoTrucTiep;
  const sumBoc = cauNoi.bocTach.reduce((s, x) => s + x.tien, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cầu nối số liệu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-muted-foreground">Cách A — trừ theo số BÊN FILE</p>
            <p className="mt-1 text-sm">
              Tổng file <span className="tnum">{num(cauNoi.tongFile)}</span> − khớp{" "}
              <span className="tnum">{num(cauNoi.khopFile)}</span> − lệch{" "}
              <span className="tnum">{num(cauNoi.lechFile)}</span>
            </p>
            <p className="mt-1 text-lg font-bold tnum">= {num(cauNoi.chuaCoBenSo)} đ</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-muted-foreground">Cách B — tổng trực tiếp nhóm CHƯA CÓ</p>
            <p className="mt-1 text-lg font-bold tnum">= {num(cauNoi.chuaCoBenSoTrucTiep)} đ</p>
            <p className="mt-2 text-sm">
              Chênh A − B:{" "}
              <span className={Math.abs(chenhAB) < 0.5 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                {num(chenhAB)} đ {Math.abs(chenhAB) < 0.5 ? "✓ phải bằng 0" : "✗ SAI"}
              </span>
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning-surface p-3">
          <p className="text-sm font-medium">
            Phần dư khi TRỪ CHÉO (file − sổ) của phần đã ghép:{" "}
            <span className="tnum font-bold">{num(cauNoi.duTruCheo)} đ</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <b>Đây KHÔNG phải giao dịch bị sót</b> — chỉ là chênh do hai bên tách cấu phần khác nhau,
            bóc tách được về từng hóa đơn (tổng bóc tách <span className="tnum">{num(sumBoc)}</span> đ):
          </p>
          {cauNoi.bocTach.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {cauNoi.bocTach.slice(0, 8).map((b, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate">{b.mo}</span>
                  <span className="tnum shrink-0">{num(b.tien)} đ</span>
                </li>
              ))}
              {cauNoi.bocTach.length > 8 && (
                <li className="text-muted-foreground">… và {num(cauNoi.bocTach.length - 8)} hóa đơn nữa</li>
              )}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Nghi vấn ----------
const TEN_NHOM: Record<number, string> = {
  1: "Cộng không khớp",
  2: "Thiếu 1 ô (suy được)",
  3: "Thiếu cả cụm",
  4: "Tổng bị xóa",
  5: "Cột phụ trùng tên",
  6: "Sheet trùng lặp",
};

function NghiVanBox({
  nghiVan,
  nghiVanGop,
  edits,
  onSua,
  onHoanTac,
  suaLog,
}: {
  nghiVan: NghiVan[];
  nghiVanGop: NghiVanGop[];
  edits: Record<string, number>;
  onSua: (nv: NghiVan) => void;
  onHoanTac: (key: string) => void;
  suaLog: Record<string, { viTri: string; cu: string; moi: string }>;
}) {
  const [moGop, setMoGop] = useState<Record<string, boolean>>({});
  const daSua = Object.keys(suaLog);

  const cot: Cot<NghiVan>[] = [
    {
      key: "nhom",
      header: "Nhóm",
      chinh: true,
      render: (r) => <Badge variant="outline">Nhóm {r.nhom} · {TEN_NHOM[r.nhom]}</Badge>,
    },
    { key: "vitri", header: "Vị trí", render: (r) => r.viTri },
    { key: "dangco", header: "Số đang có", so: true, render: (r) => r.soDangCo },
    { key: "doichung", header: "Số đối chứng", so: true, render: (r) => r.soDoiChung },
    { key: "nguon", header: "Nguồn đối chứng", render: (r) => r.nguonDoiChung },
    { key: "sai", header: "Sai ở chỗ nào", render: (r) => r.saiOCho },
    { key: "anhhuong", header: "Ảnh hưởng nếu sửa", render: (r) => r.anhHuong },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="size-5" aria-hidden />
          Nghi vấn cần soát — hệ thống KHÔNG tự sửa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {daSua.length > 0 && (
          <div className="rounded-xl border border-success/30 bg-success-surface p-3">
            <p className="text-sm font-medium">Đã sửa trong phiên ({daSua.length}) — giá trị cũ được giữ, vào file xuất:</p>
            <ul className="mt-2 space-y-1 text-sm">
              {daSua.map((k) => (
                <li key={k} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {suaLog[k].viTri}: <span className="tnum">{suaLog[k].cu}</span> →{" "}
                    <span className="tnum font-medium">{suaLog[k].moi}</span>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => onHoanTac(k)}>
                    <Undo2 /> Hoàn tác
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {nghiVan.length === 0 && nghiVanGop.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không phát hiện nghi vấn nào.</p>
        ) : (
          <>
            {nghiVan.length > 0 && (
              <RecordTable
                columns={cot}
                rows={nghiVan}
                getKey={(r) => `${r.nhom}-${r.viTri}`}
                actions={(r) =>
                  r.giaTriDung != null ? (
                    edits[keySua(r)] != null ? (
                      <Button variant="outline" size="sm" onClick={() => onHoanTac(keySua(r))}>
                        <Undo2 /> Hoàn tác
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => onSua(r)}>
                        <Wrench /> Sửa
                      </Button>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">chưa xác định</span>
                  )
                }
                emptyText="Không có nghi vấn per dòng."
              />
            )}

            {nghiVanGop.map((g) => {
              const gk = `${g.nhom}-${g.ten}`;
              const mo = moGop[gk];
              return (
                <div key={gk} className="rounded-xl border border-border p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setMoGop((m) => ({ ...m, [gk]: !m[gk] }))}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {mo ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      <Badge variant="outline">Nhóm {g.nhom}</Badge>
                      {g.ten}
                    </span>
                    <span className="shrink-0 text-sm">
                      <span className="tnum font-semibold">{num(g.soDong)}</span> dòng ·{" "}
                      <span className="tnum">{num(g.tongTien)}</span> đ
                    </span>
                  </button>
                  <p className="mt-2 text-sm text-muted-foreground">{g.canhBao}</p>
                  {mo && g.chiTiet.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {g.chiTiet.slice(0, 200).map((nv, i) => (
                        <li key={i} className="flex flex-col gap-1 border-t border-border/60 pt-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="min-w-0">
                            {nv.viTri} — {nv.saiOCho}
                            {nv.giaTriDung != null && (
                              <> · đối chứng <span className="tnum font-medium">{nv.soDoiChung}</span></>
                            )}
                          </span>
                          {nv.giaTriDung != null &&
                            (edits[keySua(nv)] != null ? (
                              <Button variant="outline" size="sm" onClick={() => onHoanTac(keySua(nv))}>
                                <Undo2 /> Hoàn tác
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => onSua(nv)}>
                                <Wrench /> Sửa
                              </Button>
                            ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Bảng HĐĐT ----------
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
    { key: "tt", header: "Tổng TT (VND)", so: true, render: (r) => num(r.tongTtVnd), sapXep: (r) => r.tongTtVnd },
    { key: "pm", header: "Tổng bên PM", so: true, render: (r) => (r.trangThai === "THIEU" ? "—" : num(r.tongTtPm)) },
    { key: "chenh", header: "Chênh", so: true, render: (r) => (r.chenh == null ? "—" : num(r.chenh)), sapXep: (r) => (r.chenh == null ? 0 : Math.abs(r.chenh)) },
    { key: "bc", header: "Bằng chứng đối chiếu", render: (r) => r.bangChung },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LOC_HD.map((l) => (
          <Button key={l.id} variant={loc === l.id ? "default" : "outline"} size="sm" onClick={() => setLoc(l.id)}>
            {l.nhan}
            {l.id !== "all" && <span className="tnum ml-1">({num(dem[l.id as TrangThaiHoaDon])})</span>}
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
    return { thieu };
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
        r.trangThai === "CO" ? <StatusChip trangThai="running" nhan="Đã có HĐĐT" /> : <StatusChip trangThai="stopped" nhan="Chưa có HĐĐT" />,
    },
    { key: "phieu", header: "Phiếu", render: (r) => r.phieu },
    { key: "ctgs", header: "CTGS", render: (r) => r.ctgs },
    { key: "kh", header: "Ký hiệu", render: (r) => r.kyHieu, sapXep: (r) => r.kyHieu },
    { key: "so", header: "Số HĐ", render: (r) => r.soHoaDon, sapXep: (r) => r.soChuan },
    { key: "ban", header: "Người bán", render: (r) => r.tenBan },
    { key: "tong", header: "Tổng cộng", so: true, render: (r) => num(r.tongCong), sapXep: (r) => r.tongCong },
    { key: "bc", header: "Bằng chứng đối chiếu", render: (r) => r.bangChung },
  ];
  return (
    <div className="space-y-4">
      {sheet.laPhu && (
        <div className="rounded-xl border border-warning/30 bg-warning-surface p-3 text-sm">
          Sheet phụ / tập con — <b>KHÔNG cộng vào tổng</b>, chỉ để tra cứu (tránh đếm hai lần).
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant={!chiThieu ? "default" : "outline"} size="sm" onClick={() => setChiThieu(false)}>
          Tất cả <span className="tnum ml-1">({num(sheet.dong.length)})</span>
        </Button>
        <Button variant={chiThieu ? "default" : "outline"} size="sm" onClick={() => setChiThieu(true)}>
          Chưa có HĐĐT <span className="tnum ml-1">({num(dem.thieu)})</span>
        </Button>
      </div>
      <RecordTable
        columns={cot}
        rows={rows}
        getKey={(r) => `${r.sheet}#${r.soDong}`}
        timKiem={(r) => `${r.phieu} ${r.ctgs} ${r.kyHieu} ${r.soHoaDon} ${r.tenBan} ${r.bangChung}`}
        nhanTimKiem="Tìm phiếu / CTGS / số HĐ / người bán…"
        emptyText="Không có dòng nào ở trạng thái này."
      />
    </div>
  );
}

export default function DoiSoatScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [wb, setWb] = useState<Workbook | null>(null);
  const [nguong, setNguong] = useState<number | null>(1000);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [suaLog, setSuaLog] = useState<Record<string, { viTri: string; cu: string; moi: string }>>({});
  const [nghiVanBanDau, setNghiVanBanDau] = useState<number | null>(null);
  const [soChuanTen, setSoChuanTen] = useState<string | undefined>(undefined);
  const [dangChay, setDangChay] = useState(false);
  const [tab, setTab] = useState<string>("");

  const ketQua: KetQuaDoiSoat | null = useMemo(() => {
    if (!wb) return null;
    return doiSoat(wb, {
      nguong: nguong ?? 0,
      edits,
      nghiVanBanDau: nghiVanBanDau ?? undefined,
      soChuanTen,
    });
  }, [wb, nguong, edits, nghiVanBanDau, soChuanTen]);

  const chonFile = () => fileRef.current?.click();
  const napFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setWb(null);
    setEdits({});
    setSuaLog({});
    setNghiVanBanDau(null);
    setSoChuanTen(undefined);
    e.target.value = "";
  };

  const chay = async () => {
    if (!file) {
      notify.canhBao("Chưa chọn file Excel để đối soát.");
      return;
    }
    setDangChay(true);
    try {
      const raw = await docWorkbook(file);
      const kq0 = doiSoat(raw, { nguong: nguong ?? 0 });
      const baseline = kq0.nghiVan.length + kq0.nghiVanGop.reduce((s, g) => s + g.soDong, 0);
      setEdits({});
      setSuaLog({});
      setNghiVanBanDau(baseline);
      setSoChuanTen(undefined);
      setWb(raw);
      setTab(kq0.sheetsHoaDon[0]?.ten ?? (kq0.sheetPhanMem ? PM_TAB : ""));
      notify.daLuu(
        `Đối soát xong: ${kq0.tong.khop} khớp · ${kq0.tong.lech} lệch · ${kq0.tong.thieu} chưa có ở PM · ${baseline} nghi vấn.`
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
    notify.daLuu("Đã xuất Excel (tô màu + cột phân tích + nhật ký sửa nếu có).");
  };

  const apDungSua = (nv: NghiVan) => {
    if (nv.giaTriDung == null || nv.sheet == null || nv.soDong == null || nv.cot == null) return;
    const k = keySua(nv);
    setEdits((e) => ({ ...e, [k]: nv.giaTriDung! }));
    setSuaLog((l) => ({
      ...l,
      [k]: { viTri: nv.viTri, cu: nv.giaTriCu == null ? "(trống)" : num(nv.giaTriCu), moi: num(nv.giaTriDung!) },
    }));
    notify.daLuu("Đã áp sửa trong phiên. Giá trị cũ được giữ, sẽ vào file xuất.");
  };
  const hoanTacSua = (k: string) => {
    setEdits((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
    setSuaLog((l) => {
      const n = { ...l };
      delete n[k];
      return n;
    });
  };

  const the: TheThongTin[] = useMemo(() => {
    if (!ketQua) return [];
    const t = ketQua.tong;
    const soNghi = ketQua.nghiVan.length + ketQua.nghiVanGop.reduce((s, g) => s + g.soDong, 0);
    return [
      { nhan: "Hóa đơn điện tử", giaTri: num(t.soHoaDon), so: true, mau: "brand", icon: FileSpreadsheet },
      { nhan: "Khớp", giaTri: num(t.khop), so: true, mau: "success" },
      { nhan: "Lệch tiền", giaTri: num(t.lech), so: true, mau: "warning" },
      { nhan: "Chưa có ở PMKT", giaTri: num(t.thieu), so: true, mau: "danger" },
      { nhan: "Bút toán phần mềm", giaTri: num(t.soDongPm), so: true, mau: "brand" },
      { nhan: "PM chưa có HĐĐT", giaTri: num(t.pmThieu), so: true, mau: "danger" },
      { nhan: "Tổng chênh (đ)", giaTri: num(t.tongChenh), so: true, mau: "warning", phu: "các dòng lệch" },
      { nhan: "Nghi vấn", giaTri: num(soNghi), so: true, mau: soNghi ? "warning" : "success" },
    ];
  }, [ketQua]);

  const dsSoPm = ketQua ? [ketQua.sheetPhanMem, ...ketQua.sheetsPhanMemPhu].filter(Boolean) as SheetPhanMem[] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Đối soát hóa đơn điện tử với phần mềm kế toán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tải file Excel gồm các sheet hóa đơn điện tử (cổng thuế) và sheet PHẦN MỀM (kế toán). Đối
            chiếu theo <b>MST người bán · ký hiệu · số hóa đơn</b>, quy về VND. Hệ thống <b>KHÔNG tự sửa
            số liệu</b> — chỗ nghi sai chỉ được báo, bạn tự bấm Sửa từng dòng.
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={napFile} />
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
          {/* Chọn sổ chuẩn khi có nhiều sheet sổ (§4) */}
          {dsSoPm.length > 1 && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">
                Có {dsSoPm.length} sheet sổ. Chọn bản CHUẨN (chỉ bản này vào tổng):
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dsSoPm.map((s) => (
                  <Button
                    key={s.ten}
                    size="sm"
                    variant={ketQua?.sheetPhanMem?.ten === s.ten ? "default" : "outline"}
                    onClick={() => setSoChuanTen(s.ten)}
                  >
                    {s.ten}
                    {ketQua?.sheetPhanMem?.ten === s.ten && " ✓"}
                  </Button>
                ))}
              </div>
            </div>
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
              <Upload /> Chọn file Excel
            </Button>
          }
        />
      ) : (
        <>
          <ThongKe the={the} cot={4} />

          <TuKiemBox phepThu={ketQua.phepThu} />

          {(ketQua.nghiVan.length > 0 || ketQua.nghiVanGop.length > 0 || Object.keys(suaLog).length > 0) && (
            <NghiVanBox
              nghiVan={ketQua.nghiVan}
              nghiVanGop={ketQua.nghiVanGop}
              edits={edits}
              onSua={apDungSua}
              onHoanTac={hoanTacSua}
              suaLog={suaLog}
            />
          )}

          <CauNoiBox cauNoi={ketQua.cauNoi} />

          {ketQua.canhBao.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="size-5" aria-hidden />
                  Cảnh báo khác ({ketQua.canhBao.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {ketQua.canhBao.slice(0, 40).map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-medium whitespace-nowrap text-muted-foreground">{c.loai}:</span>
                      <span>{c.chiTiet}</span>
                    </li>
                  ))}
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
              {ketQua.sheetPhanMem && <TabsTrigger value={PM_TAB}>{ketQua.sheetPhanMem.ten}</TabsTrigger>}
              {ketQua.sheetsPhanMemPhu.map((s) => (
                <TabsTrigger key={s.ten} value={`phu-${s.ten}`}>
                  {s.ten} (phụ)
                </TabsTrigger>
              ))}
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
            {ketQua.sheetsPhanMemPhu.map((s) => (
              <TabsContent key={s.ten} value={`phu-${s.ten}`} className="mt-4">
                <BangPhanMem sheet={s} />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
