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
  ConfirmDelete,
  EmptyState,
  InfoTip,
  Input,
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
  tenFileKetQua,
  xuatExcelDoiSoat,
  xuatFileMau,
  fileSangBase64,
  sheetsTuBase64,
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
import { gomCungMstCungNgay, phanBenThue, soHaiBanHddt } from "@/lib/doiSoatHaiBan";
import { num } from "@/lib/format";
import {
  ChonCheDo,
  CungNgayView,
  KiemCongView,
  QuyTacBox,
  SoHaiBanView,
} from "./CheDoDoiSoat";
import { DS_CHE_DO, cheDoMacDinh, type CheDo } from "./cheDo";
import { useReconciliationRuns } from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import type { ReconciliationRun } from "@/types";
import {
  Upload,
  FileSpreadsheet,
  FileDown,
  Download,
  AlertTriangle,
  ScanSearch,
  ShieldCheck,
  Wrench,
  Undo2,
  ChevronDown,
  ChevronRight,
  Save,
  FolderOpen,
  History,
} from "lucide-react";

type Workbook = Awaited<ReturnType<typeof docWorkbook>>;
const PM_TAB = "__phan-mem__";
const keySua = (nv: NghiVan) => `${nv.sheet}#${nv.soDong}#${nv.cot}`;

function chipHoaDon(r: DongHoaDon) {
  if (r.trangThai === "KHOP") return <StatusChip trangThai="running" nhan="Khớp" />;
  if (r.trangThai === "LECH")
    return <StatusChip trangThai="idle" nhan={r.ketLuan === "LỆCH THUẾ" ? "Lệch thuế" : "Lệch tiền"} />;
  // Hóa đơn đã bị thay thế / hủy: không có trong sổ là ĐÚNG — đừng tô đỏ như việc phải làm.
  if (r.khongCanVaoSo) return <StatusChip trangThai="idle" nhan="Không cần vào sổ" />;
  return <StatusChip trangThai="stopped" nhan="Chưa vào sổ" />;
}

/** Suy kỳ "T02-2026" / "T3" từ tên file. */
function suyKy(name: string): string {
  const m = name.match(/T\s?0?(\d{1,2})(?:[-_ ]?(\d{4}))?/i);
  if (!m) return "";
  return m[2] ? `T${m[1].padStart(2, "0")}-${m[2]}` : `T${m[1]}`;
}
function dtHienThi(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Cuộn mượt tới một khối theo id (drill-down từ thẻ tổng) — dùng DOM id, không ref. */
function cuonToiId(id: string) {
  requestAnimationFrame(() =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  );
}

// ---------- Bản đã lưu (theo tài khoản) ----------
function BanDaLuuBox({
  runs,
  banDangMo,
  laAdmin,
  onMo,
  onTai,
  onXoa,
}: {
  runs: ReconciliationRun[];
  banDangMo: string | null;
  laAdmin: boolean;
  onMo: (r: ReconciliationRun) => void;
  onTai: (r: ReconciliationRun) => void;
  onXoa: (r: ReconciliationRun) => void;
}) {
  const cot: Cot<ReconciliationRun>[] = [
    {
      key: "ten",
      header: "Tên bản",
      chinh: true,
      render: (r) => (
        <span>
          {r.title}
          {r.id === banDangMo && <span className="ml-2 text-sm text-primary">(đang mở)</span>}
        </span>
      ),
    },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) =>
        r.status === "official" ? (
          <Badge>Chính thức</Badge>
        ) : (
          <Badge variant="secondary">Nháp</Badge>
        ),
    },
    { key: "ky", header: "Kỳ", render: (r) => r.period || "—" },
    {
      key: "tom",
      header: "Kết quả (lúc lưu)",
      render: (r) =>
        `${num(r.summary?.khop ?? 0)} khớp · ${num(r.summary?.lech ?? 0)} lệch · ${num(r.summary?.thieu ?? 0)} chưa`,
    },
    { key: "luc", header: "Lưu lúc", render: (r) => dtHienThi(r.updatedAt), anTrenDienThoai: true },
    ...(laAdmin
      ? [{ key: "nguoi", header: "Người lưu", render: (r: ReconciliationRun) => r.ownerName || r.ownerUsername || "—" }]
      : []),
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5" aria-hidden />
          Bản đã lưu ({runs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RecordTable
          columns={cot}
          rows={runs}
          getKey={(r) => r.id}
          timKiem={(r) => `${r.title} ${r.period} ${r.ownerName}`}
          nhanTimKiem="Tìm theo tên / kỳ…"
          emptyText="Chưa có bản đối soát nào được lưu. Chạy đối soát rồi bấm Lưu."
          actions={(r) => (
            <>
              <Button
                title="Mở lại bản đối soát đã lưu và chạy lại trên chính file gốc của nó." size="sm" onClick={() => onMo(r)}>
                <FolderOpen /> Mở lại
              </Button>
              <Button
                title="Tải kết quả của bản đối soát này ra file Excel." variant="outline" size="sm" onClick={() => onTai(r)}>
                <Download /> Tải Excel
              </Button>
              <ConfirmDelete
                moTaBanGhi={`${r.title} — ${r.period || "không rõ kỳ"} — ${r.status === "official" ? "Chính thức" : "Nháp"}`}
                tieuDe="Xóa bản đối soát này?"
                nhanNut="Xóa bản"
                onConfirm={() => onXoa(r)}
              />
            </>
          )}
        />
      </CardContent>
    </Card>
  );
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
          Máy tự kiểm tra lại{" "}
          <span className={tatCaDat ? "text-success" : "text-destructive"}>
            {tatCaDat ? `Đạt ${dat}/${phepThu.length}` : `Có ${phepThu.length - dat} phép không đạt`}
          </span>
          <InfoTip label="Máy tự kiểm tra lại">
            Máy tự chạy vài phép tính đối chứng để chắc chắn kết quả đối soát không sai.
            <b> Đáng lẽ</b> = con số đúng phải ra; <b>Thực tế</b> = con số máy đang tính được.
            Hai số bằng nhau ⇒ Đạt. Lệch nhau ⇒ có chỗ cần xem lại (bấm xuống bảng để dò).
          </InfoTip>
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
                <div>Đáng lẽ: <span className="tnum font-medium">{p.mong}</span></div>
                <div>Thực tế: <span className="tnum font-medium">{p.thuc}</span></div>
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
        <CardTitle className="flex items-center gap-2">
          Kiểm tra tổng số tiền chưa vào sổ
          <InfoTip label="Kiểm tra tổng số tiền chưa vào sổ">
            Tính số tiền hóa đơn <b>chưa có trong sổ kế toán</b> bằng hai cách khác nhau. Nếu
            hai cách ra cùng một số ⇒ số liệu đáng tin. Đây chỉ là bước tự đối chứng, bạn không
            cần thao tác gì.
          </InfoTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-muted-foreground">Cách 1 — lấy tổng hóa đơn trừ phần đã khớp</p>
            <p className="mt-1 text-sm">
              Tổng hóa đơn <span className="tnum">{num(cauNoi.tongFile)}</span> − đã khớp{" "}
              <span className="tnum">{num(cauNoi.khopFile)}</span> − lệch tiền{" "}
              <span className="tnum">{num(cauNoi.lechFile)}</span>
            </p>
            <p className="mt-1 text-lg font-bold tnum">= {num(cauNoi.chuaCoBenSo)} đ</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-muted-foreground">Cách 2 — cộng thẳng các hóa đơn chưa vào sổ</p>
            <p className="mt-1 text-lg font-bold tnum">= {num(cauNoi.chuaCoBenSoTrucTiep)} đ</p>
            <p className="mt-2 text-sm">
              Hai cách lệch nhau:{" "}
              <span className={Math.abs(chenhAB) < 0.5 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                {num(chenhAB)} đ {Math.abs(chenhAB) < 0.5 ? "✓ bằng 0 — khớp" : "✗ đang lệch, cần soát"}
              </span>
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning-surface p-3">
          <p className="text-sm font-medium">
            Chênh nhỏ giữa hóa đơn và sổ ở các dòng đã khớp:{" "}
            <span className="tnum font-bold">{num(cauNoi.duTruCheo)} đ</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <b>Đây KHÔNG phải hóa đơn bị bỏ sót</b> — chỉ là chênh lệch nhỏ do hóa đơn và sổ tách
            tiền hàng/thuế/chiết khấu khác nhau. Máy đã tách rõ theo từng hóa đơn (tổng cộng{" "}
            <span className="tnum">{num(sumBoc)}</span> đ):
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
  2: "Thiếu ô chưa thuế/thuế",
  3: "Gần khớp",
  4: "Thiếu cả cụm",
  5: "Tổng bị xóa",
  6: "Cột quy đổi phụ",
  7: "Sheet trùng lặp",
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
          Chỗ cần soát lại — máy KHÔNG tự sửa số của bạn
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
                  <Button
                    title="Bỏ thao tác gộp / sửa vừa làm cho dòng này, trả về như file gốc." variant="outline" size="sm" onClick={() => onHoanTac(k)}>
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
                      <Button
                        title="Bỏ phần sửa tay ở dòng này, trả số về như trong file gốc." variant="outline" size="sm" onClick={() => onHoanTac(keySua(r))}>
                        <Undo2 /> Hoàn tác
                      </Button>
                    ) : (
                      <Button
                        title="Sửa tay số hoặc ký hiệu của dòng này để hai bên khớp nhau." size="sm" onClick={() => onSua(r)}>
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
                    title="Mở / thu nhóm dòng này để xem chi tiết từng hóa đơn trong nhóm."
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
                              <Button
                                title="Bỏ phần sửa tay ở dòng nghi vấn này." variant="outline" size="sm" onClick={() => onHoanTac(keySua(nv))}>
                                <Undo2 /> Hoàn tác
                              </Button>
                            ) : (
                              <Button
                                title="Sửa tay dòng nghi vấn này cho khớp." size="sm" onClick={() => onSua(nv)}>
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
  { id: "LECH", nhan: "Lệch tiền / thuế" },
  { id: "THIEU", nhan: "Chưa vào sổ" },
];

function BangHoaDon({
  sheet,
  loc,
  setLoc,
}: {
  sheet: SheetHoaDon;
  loc: TrangThaiHoaDon | "all";
  setLoc: (v: TrangThaiHoaDon | "all") => void;
}) {
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
    { key: "kq", header: "Kết quả", chinh: true, render: (r) => chipHoaDon(r) },
    { key: "kh", header: "Ký hiệu", render: (r) => r.kyHieu, sapXep: (r) => r.kyHieu },
    { key: "so", header: "Số HĐ", render: (r) => r.soHoaDon, sapXep: (r) => r.soChuan },
    { key: "ngay", header: "Ngày lập", render: (r) => r.ngayLap, sapXep: (r) => r.ngayLap },
    { key: "ban", header: "Người bán", render: (r) => r.tenBan },
    { key: "tt", header: "Tổng TT (VND)", so: true, render: (r) => num(r.tongTtVnd), sapXep: (r) => r.tongTtVnd },
    { key: "pm", header: "Tổng trên sổ", so: true, render: (r) => (r.trangThai === "THIEU" ? "—" : num(r.tongTtPm)) },
    { key: "chenh", header: "Chênh", so: true, render: (r) => (r.chenh == null ? "—" : num(r.chenh)), sapXep: (r) => (r.chenh == null ? 0 : Math.abs(r.chenh)) },
    { key: "bc", header: "Bằng chứng đối chiếu", render: (r) => r.bangChung },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LOC_HD.map((l) => (
          <Button
            title="Lọc danh sách hóa đơn theo trạng thái khớp này." key={l.id} variant={loc === l.id ? "default" : "outline"} size="sm" onClick={() => setLoc(l.id)}>
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

function BangPhanMem({
  sheet,
  chiThieu,
  setChiThieu,
}: {
  sheet: SheetPhanMem;
  chiThieu: boolean;
  setChiThieu: (v: boolean) => void;
}) {
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
        r.trangThai === "CO" ? <StatusChip trangThai="running" nhan="Đã có hóa đơn" /> : <StatusChip trangThai="stopped" nhan="Chưa có hóa đơn" />,
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
          Sheet sổ phụ (là một phần của sổ chính) — <b>KHÔNG cộng vào tổng</b>, chỉ để tra cứu (tránh đếm hai lần).
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          title="Xem toàn bộ dòng của sổ phần mềm." variant={!chiThieu ? "default" : "outline"} size="sm" onClick={() => setChiThieu(false)}>
          Tất cả <span className="tnum ml-1">({num(sheet.dong.length)})</span>
        </Button>
        <Button
          title="Chỉ xem các dòng phần mềm chưa tìm được hóa đơn tương ứng." variant={chiThieu ? "default" : "outline"} size="sm" onClick={() => setChiThieu(true)}>
          Chưa có hóa đơn <span className="tnum ml-1">({num(dem.thieu)})</span>
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
  const [nguong, setNguong] = useState<number | null>(1);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [suaLog, setSuaLog] = useState<Record<string, { viTri: string; cu: string; moi: string }>>({});
  const [nghiVanBanDau, setNghiVanBanDau] = useState<number | null>(null);
  const [soChuanTen, setSoChuanTen] = useState<string | undefined>(undefined);
  const [dangChay, setDangChay] = useState(false);
  const [tab, setTab] = useState<string>("");
  const [locHD, setLocHD] = useState<TrangThaiHoaDon | "all">("all"); // lọc bảng HĐĐT (điều khiển được từ thẻ tổng)
  const [pmChiThieu, setPmChiThieu] = useState(false); // lọc bảng sổ: chỉ dòng chưa có hóa đơn
  const [moKiemTra, setMoKiemTra] = useState(false); // mở khối "Kiểm tra chi tiết"
  const [cheDo, setCheDo] = useState<CheDo>("so"); // kiểu đối soát đang xem
  // Sheet thuộc bản thuế gửi do người dùng chỉ định; null = để máy tự nhận theo tên sheet.
  const [benThueChon, setBenThueChon] = useState<string[] | null>(null);
  // Lưu theo tài khoản (v4)
  const [b64, setB64] = useState<string>(""); // base64 file gốc hiện hành (để lưu / mở lại)
  const [tenHienThi, setTenHienThi] = useState<string>(""); // tên file / tên bản đang mở
  const [tenBanLuu, setTenBanLuu] = useState<string>(""); // ô nhập tên bản lưu
  const [banDangMo, setBanDangMo] = useState<string | null>(null); // id bản đã lưu đang mở (lưu = cập nhật)
  const auth = useAuth();
  const [runs, ghiRuns] = useReconciliationRuns();

  const runsCuaToi = useMemo(() => {
    const list = auth.laAdmin
      ? runs
      : runs.filter((r) => !r.userId || r.userId === auth.nguoiDung?.id);
    return [...list].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [runs, auth.laAdmin, auth.nguoiDung]);

  const ketQua: KetQuaDoiSoat | null = useMemo(() => {
    if (!wb) return null;
    return doiSoat(wb, {
      nguong: nguong ?? 0,
      edits,
      nghiVanBanDau: nghiVanBanDau ?? undefined,
      soChuanTen,
    });
  }, [wb, nguong, edits, nghiVanBanDau, soChuanTen]);

  // Ba chiều soát ngoài "hóa đơn ⇄ sổ" — cùng hàm thuần lớp xuất dùng, nên số trên màn = số trong file.
  const tenSheetHd = useMemo(() => ketQua?.sheetsHoaDon.map((s) => s.ten) ?? [], [ketQua]);
  const phanBen = useMemo(() => phanBenThue(tenSheetHd, benThueChon), [tenSheetHd, benThueChon]);
  const soHaiBan = useMemo(
    () => (ketQua ? soHaiBanHddt(ketQua.sheetsHoaDon, ketQua.nguong, phanBen.benThue) : null),
    [ketQua, phanBen]
  );
  const cungNgay = useMemo(
    () => (ketQua ? gomCungMstCungNgay(ketQua.sheetsHoaDon.filter((s) => !s.laPhu), phanBen.benThue) : []),
    [ketQua, phanBen]
  );
  const doiBen = (ten: string, laThue: boolean) => {
    const s = new Set(phanBen.benThue);
    if (laThue) s.add(ten);
    else s.delete(ten);
    setBenThueChon(tenSheetHd.filter((t) => s.has(t)));
  };
  /** Kiểu mặc định theo nội dung file, tính trên kết quả vừa chạy. */
  const cheDoTheoFile = (kq: KetQuaDoiSoat, benChon: string[] | null) =>
    cheDoMacDinh(
      !!kq.sheetPhanMem,
      !!soHaiBanHddt(kq.sheetsHoaDon, kq.nguong, phanBenThue(kq.sheetsHoaDon.map((s) => s.ten), benChon).benThue)
    );

  const chonFile = () => fileRef.current?.click();
  const napFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setWb(null);
    setEdits({});
    setSuaLog({});
    setNghiVanBanDau(null);
    setSoChuanTen(undefined);
    setBenThueChon(null);
    setB64("");
    setTenHienThi(f?.name ?? "");
    setBanDangMo(null);
    e.target.value = "";
  };

  const chay = async () => {
    if (!file) {
      notify.canhBao("Chưa chọn file Excel để đối soát.");
      return;
    }
    setDangChay(true);
    try {
      // MỘT bộ bytes cho cả đọc lẫn xuất (đã chuẩn hoá .xls → .xlsx): hai lần đọc
      // riêng dễ lệch toạ độ dòng/cột, mà toạ độ là thứ cột "Vị trí" dựa vào.
      const b64Goc = await fileSangBase64(file);
      const raw = sheetsTuBase64(b64Goc);
      const kq0 = doiSoat(raw, { nguong: nguong ?? 0 });
      const baseline = kq0.nghiVan.length + kq0.nghiVanGop.reduce((s, g) => s + g.soDong, 0);
      setEdits({});
      setSuaLog({});
      setNghiVanBanDau(baseline);
      setSoChuanTen(undefined);
      setB64(b64Goc);
      setTenHienThi(file.name);
      setTenBanLuu(file.name.replace(/\.xls[xmb]?$/i, ""));
      setBanDangMo(null);
      setWb(raw);
      setTab(kq0.sheetsHoaDon[0]?.ten ?? (kq0.sheetPhanMem ? PM_TAB : ""));
      setLocHD("all");
      setPmChiThieu(false);
      setBenThueChon(null);
      setCheDo(cheDoTheoFile(kq0, null));
      notify.daLuu(
        kq0.sheetPhanMem
          ? `Đối soát xong: ${kq0.tong.khop} khớp · ${kq0.tong.lech + kq0.tong.lechThue} lệch tiền/thuế · ${kq0.tong.thieu} chưa vào sổ · ${baseline} chỗ cần soát.`
          : `Đã đọc ${kq0.tong.soHoaDon} hóa đơn ở ${kq0.sheetsHoaDon.length} sheet (file không có sổ kế toán) — chọn việc cần soát bên dưới.`
      );
    } catch (err) {
      notify.loi(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDangChay(false);
    }
  };

  /**
   * Xuất Excel: ƯU TIÊN sửa tại chỗ trên chính file gốc (giữ nguyên font/khung/ô
   * gộp/định dạng số để kế toán soi song song được). Không còn bytes file gốc
   * hoặc thư viện nạp hụt thì mới lùi về bản dựng-mới.
   */
  const xuatFile = async (
    kq: KetQuaDoiSoat,
    ten: string,
    fileGocB64: string,
    editsCuaBan: Record<string, number> | undefined
  ) => {
    const tenFile = tenFileKetQua(ten);
    if (fileGocB64) {
      try {
        const { xuatExcelGiuDinhDang } = await import("@/lib/doiSoatXuat");
        await xuatExcelGiuDinhDang(kq, fileGocB64, tenFile, editsCuaBan);
        notify.daLuu("Đã xuất Excel — giữ nguyên định dạng file gốc, chỉ thêm cột đối soát và tô màu dòng.");
        return;
      } catch (err) {
        notify.loi(
          `Không giữ được định dạng gốc (${err instanceof Error ? err.message : String(err)}) — xuất bản dựng mới.`
        );
      }
    }
    xuatExcelDoiSoat(kq, tenFile);
    notify.daLuu("Đã xuất Excel (tô màu + cột phân tích + nhật ký sửa nếu có).");
  };

  const taiExcel = () => {
    if (!ketQua) return;
    // Chở cách chia bên thuế/tự tải sang lớp xuất để sheet SO HAI BẢN giống màn hình.
    void xuatFile({ ...ketQua, benThue: benThueChon ?? undefined }, tenHienThi || file?.name || "doi-soat", b64, edits);
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

  // ---- Lưu / mở lại / xóa bản đối soát theo tài khoản ----
  const luuBan = (status: "draft" | "official") => {
    if (!ketQua || !b64) {
      notify.canhBao("Chưa có kết quả để lưu — hãy chọn file và bấm Đối soát.");
      return;
    }
    const nd = auth.nguoiDung;
    const now = new Date().toISOString();
    const t = ketQua.tong;
    const id = banDangMo ?? crypto.randomUUID();
    const cu = banDangMo ? runs.find((r) => r.id === banDangMo) : null;
    const run: ReconciliationRun = {
      id,
      userId: nd?.id ?? "",
      ownerUsername: nd?.username ?? "",
      ownerName: nd?.fullName || nd?.username || "",
      title: tenBanLuu.trim() || tenHienThi || "Bản đối soát",
      period: suyKy(tenHienThi),
      status,
      threshold: nguong ?? 1,
      fileName: tenHienThi,
      fileB64: b64,
      options: { soChuanTen, edits, benThue: benThueChon ?? undefined, cheDo },
      summary: {
        soHoaDon: t.soHoaDon, khop: t.khop, lech: t.lech, thieu: t.thieu, ganKhop: t.ganKhop,
        soDongPm: t.soDongPm, pmCo: t.pmCo, pmThieu: t.pmThieu, tongChenh: t.tongChenh,
        nguong: ketQua.nguong, savedAt: now,
      },
      createdAt: cu?.createdAt || now,
      updatedAt: now,
    };
    ghiRuns([...runs.filter((r) => r.id !== id), run]);
    setBanDangMo(id);
    notify.daLuu(`Đã lưu bản ${status === "official" ? "CHÍNH THỨC" : "nháp"}: "${run.title}".`);
  };

  const moLai = (run: ReconciliationRun) => {
    try {
      const raw = sheetsTuBase64(run.fileB64);
      const kq0 = doiSoat(raw, {
        nguong: run.threshold,
        edits: run.options?.edits,
        soChuanTen: run.options?.soChuanTen,
      });
      const baseline = kq0.nghiVan.length + kq0.nghiVanGop.reduce((s, g) => s + g.soDong, 0);
      setFile(null);
      setB64(run.fileB64);
      setTenHienThi(run.fileName || run.title);
      setTenBanLuu(run.title);
      setNguong(run.threshold);
      setEdits(run.options?.edits ?? {});
      setSuaLog({});
      setSoChuanTen(run.options?.soChuanTen);
      setNghiVanBanDau(baseline);
      setBanDangMo(run.id);
      setWb(raw);
      setTab(kq0.sheetsHoaDon[0]?.ten ?? (kq0.sheetPhanMem ? PM_TAB : ""));
      setLocHD("all");
      setPmChiThieu(false);
      const benLuu = run.options?.benThue ?? null;
      setBenThueChon(benLuu);
      const cheDoLuu = run.options?.cheDo as CheDo | undefined;
      setCheDo(cheDoLuu && DS_CHE_DO.includes(cheDoLuu) ? cheDoLuu : cheDoTheoFile(kq0, benLuu));
      notify.daLuu(`Đã mở lại "${run.title}" (${run.status === "official" ? "chính thức" : "nháp"}).`);
    } catch (err) {
      notify.loi(`Không mở lại được: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const xoaBan = (run: ReconciliationRun) => {
    const con = runs.filter((r) => r.id !== run.id);
    ghiRuns(con);
    if (banDangMo === run.id) setBanDangMo(null);
    notify.daXoa(`Đã xóa bản "${run.title}".`, () => ghiRuns([...con, run]));
  };

  const taiExcelBan = (run: ReconciliationRun) => {
    try {
      const raw = sheetsTuBase64(run.fileB64);
      const kq = doiSoat(raw, {
        nguong: run.threshold,
        edits: run.options?.edits,
        soChuanTen: run.options?.soChuanTen,
      });
      void xuatFile({ ...kq, benThue: run.options?.benThue }, run.title || "doi-soat", run.fileB64, run.options?.edits);
    } catch (err) {
      notify.loi(`Không xuất được: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Drill-down: bấm thẻ tổng → nhảy xuống đúng bảng + lọc sẵn theo trạng thái đó.
  const firstHdTab = ketQua?.sheetsHoaDon[0]?.ten ?? "";
  const denHD = (loc: TrangThaiHoaDon | "all") => {
    if (firstHdTab) setTab(firstHdTab);
    setLocHD(loc);
    cuonToiId("ds-bang");
  };
  const denPM = (chiThieu: boolean) => {
    if (ketQua?.sheetPhanMem) setTab(PM_TAB);
    setPmChiThieu(chiThieu);
    cuonToiId("ds-bang");
  };

  const the: TheThongTin[] = [];
  if (ketQua) {
    const t = ketQua.tong;
    const soNghi = ketQua.nghiVan.length + ketQua.nghiVanGop.reduce((s, g) => s + g.soDong, 0);
    the.push(
      { nhan: "Hóa đơn điện tử", giaTri: num(t.soHoaDon), so: true, mau: "brand", icon: FileSpreadsheet, onChon: () => denHD("all"), moTaChon: "Xem tất cả hóa đơn điện tử" },
      { nhan: "Khớp", giaTri: num(t.khop), so: true, mau: "success", onChon: () => denHD("KHOP"), moTaChon: "Xem hóa đơn đã khớp sổ" },
      // tong.lech và tong.lechThue là HAI nhóm rời (cùng trạng thái LECH) — thẻ cộng cả hai cho khớp số ở bộ lọc bảng.
      { nhan: "Lệch tiền / thuế", giaTri: num(t.lech + t.lechThue), so: true, mau: "warning", phu: `${num(t.lech)} lệch tiền · ${num(t.lechThue)} lệch thuế`, onChon: () => denHD("LECH"), moTaChon: "Xem hóa đơn lệch tiền / lệch thuế" },
      {
        nhan: "Chưa vào sổ",
        giaTri: num(t.thieu),
        so: true,
        mau: "danger",
        phu: [t.thieuKhongCanVaoSo ? `${num(t.thieuKhongCanVaoSo)} không cần vào sổ` : "", t.ganKhop ? `${num(t.ganKhop)} gần khớp` : ""].filter(Boolean).join(" · ") || undefined,
        onChon: () => denHD("THIEU"),
        moTaChon: "Xem hóa đơn chưa có trong sổ",
      },
      { nhan: "Dòng sổ kế toán", giaTri: num(t.soDongPm), so: true, mau: "brand", onChon: () => denPM(false), moTaChon: "Xem tất cả dòng sổ kế toán" },
      { nhan: "Dòng sổ thiếu hóa đơn", giaTri: num(t.pmThieu), so: true, mau: "danger", onChon: () => denPM(true), moTaChon: "Xem dòng sổ chưa có hóa đơn" },
      { nhan: "Tổng tiền lệch", giaTri: num(t.tongChenh), so: true, mau: "warning", phu: "ở các hóa đơn lệch tiền", onChon: () => denHD("LECH"), moTaChon: "Xem hóa đơn lệch tiền" },
      { nhan: "Cần soát lại", giaTri: num(soNghi), so: true, mau: soNghi ? "warning" : "success", onChon: soNghi ? () => cuonToiId("ds-nghivan") : undefined, moTaChon: soNghi ? "Xuống mục cần soát lại" : undefined }
    );
  }

  const demCheDo: Record<CheDo, { chu: string; apDung: boolean }> = {
    so: ketQua?.sheetPhanMem
      ? { chu: `${num(ketQua.tong.thieu)} chưa vào sổ · ${num(ketQua.tong.lech)} lệch tiền · ${num(ketQua.tong.lechThue)} lệch thuế`, apDung: true }
      : { chu: "File không có sheet sổ kế toán", apDung: false },
    haiBan: soHaiBan
      ? { chu: `${num(soHaiBan.tong.chiThue)} bản tự tải thiếu · ${num(soHaiBan.tong.lechTien)} lệch tiền`, apDung: true }
      : { chu: tenSheetHd.length < 2 ? "Cần 2 sheet hóa đơn (thuế gửi + tự tải)" : "Chưa chia được hai bên — bấm để chọn", apDung: false },
    kiemCong: (() => {
      const ds = ketQua?.sheetsHoaDon.filter((s) => !s.laPhu) ?? [];
      const that = ds.reduce((n, s) => n + s.canDoiCot.soDong.lechThat, 0);
      return { chu: that ? `${num(that)} dòng lệch thật` : "Không có dòng lệch thật", apDung: ds.length > 0 };
    })(),
    cungNgay: cungNgay.length
      ? { chu: `${num(cungNgay.length)} nhóm · ${num(cungNgay.filter((g) => g.trungSoTien).length)} trùng khít tiền`, apDung: true }
      : { chu: "Không có nhóm nào", apDung: false },
  };

  const dsSoPm = ketQua ? [ketQua.sheetPhanMem, ...ketQua.sheetsPhanMemPhu].filter(Boolean) as SheetPhanMem[] : [];
  const tuKiemLoi = ketQua ? ketQua.phepThu.some((p) => !p.dat) : false;
  const moKiemTraHieuLuc = moKiemTra || tuKiemLoi; // luôn mở khi có phép tự kiểm chưa đạt

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Đối soát hóa đơn điện tử với phần mềm kế toán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tải một file Excel có các sheet hóa đơn điện tử (cổng thuế), kèm sheet sổ kế toán nếu có. Máy
            chạy một lần rồi cho xem theo <b>việc bạn cần soát</b>: hóa đơn ⇄ sổ · so hai bản hóa đơn (thuế
            gửi ⇄ tự tải) · kiểm cộng cột bảng kê · cùng MST cùng ngày. Ghép theo <b>MST người bán · ký hiệu ·
            số hóa đơn</b>. Hệ thống <b>KHÔNG tự sửa số liệu</b> — chỗ nghi sai chỉ được báo, bạn tự bấm Sửa từng dòng.
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={napFile} />
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
            <Button
              title="Chọn file Excel hóa đơn điện tử để đối soát với sổ phần mềm." variant="outline" onClick={chonFile} className="w-full md:w-auto">
              <Upload />
              {file ? "Chọn file khác" : "Chọn file Excel"}
            </Button>
            <Button
              title="Tải về file Excel mẫu đúng định dạng. Hệ thống vẫn đọc được file khác, đây chỉ là bản chuẩn cho dễ."
              variant="outline"
              onClick={() => {
                xuatFileMau();
                notify.daLuu("Đã tải file mẫu — làm theo format này (hệ thống vẫn đọc file khác).");
              }}
              className="w-full md:w-auto"
            >
              <FileDown />
              Tải file mẫu
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
            <Button
              title="Chạy đối soát trên file đã chọn — sau đó chọn việc cần soát: đối chiếu sổ, so hai bản, kiểm cộng cột, cùng MST cùng ngày." onClick={chay} disabled={dangChay} className="w-full md:w-auto">
              <ScanSearch />
              {dangChay ? "Đang đối soát…" : "Đối soát"}
            </Button>
            {ketQua && (
              <Button
                title="Tải toàn bộ kết quả đối soát ra file Excel để gửi kế toán." variant="outline" onClick={taiExcel} className="w-full md:w-auto">
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
                    title="Chọn sheet này làm sổ phần mềm chuẩn để đối chiếu."
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
          {/* Lưu bản đối soát theo tài khoản (v4) */}
          {ketQua && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">Lưu bản đối soát này theo tài khoản</p>
              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end">
                <div className="w-full md:flex-1">
                  <Input
                    value={tenBanLuu}
                    onChange={(e) => setTenBanLuu(e.target.value)}
                    placeholder="Tên bản (VD: Đối soát T02-2026)"
                    aria-label="Tên bản lưu"
                  />
                </div>
                <Button
                  title="Lưu lần đối soát này dưới dạng NHÁP — mở lại sửa tiếp được, số chưa đóng băng." variant="outline" onClick={() => luuBan("draft")} className="w-full md:w-auto">
                  <Save /> Lưu nháp
                </Button>
                <Button
                  title="Lưu lần đối soát này thành bản CHÍNH THỨC — tóm tắt kết quả được đóng băng để đối chiếu về sau." onClick={() => luuBan("official")} className="w-full md:w-auto">
                  <Save /> Lưu chính thức
                </Button>
              </div>
              {banDangMo && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Đang mở một bản đã lưu — bấm Lưu sẽ CẬP NHẬT bản đó (không tạo bản mới).
                </p>
              )}
              {!auth.session && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Chưa đăng nhập máy chủ → bản lưu chỉ nằm trên MÁY NÀY. Đăng nhập để lưu theo tài khoản, xem trên máy khác.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <BanDaLuuBox
        runs={runsCuaToi}
        banDangMo={banDangMo}
        laAdmin={auth.laAdmin}
        onMo={moLai}
        onTai={taiExcelBan}
        onXoa={xoaBan}
      />

      {!ketQua ? (
        <EmptyState
          icon={FileSpreadsheet}
          tieuDe="Chưa có kết quả đối soát"
          moTa="Chọn file Excel rồi bấm Đối soát. File cần ít nhất một sheet hóa đơn điện tử; có thêm sheet sổ kế toán thì đối chiếu được với sổ, có hai bản hóa đơn thì so được hai bản."
          action={
            <Button
              title="Chọn file Excel hóa đơn điện tử để bắt đầu." variant="outline" onClick={chonFile}>
              <Upload /> Chọn file Excel
            </Button>
          }
        />
      ) : (
        <>
          <section className="space-y-3" aria-label="Việc cần soát">
            <h2 className="font-semibold">Bạn cần soát việc gì?</h2>
            <ChonCheDo cheDo={cheDo} setCheDo={setCheDo} dem={demCheDo} />
            <QuyTacBox canhBao={ketQua.canhBao} />
          </section>

          {cheDo === "haiBan" && (
            <SoHaiBanView
              kq={soHaiBan}
              tenSheets={tenSheetHd}
              benThue={phanBen.benThue}
              cach={phanBen.cach}
              onDoiBen={doiBen}
              onTuNhan={() => setBenThueChon(null)}
            />
          )}
          {cheDo === "kiemCong" && <KiemCongView sheets={ketQua.sheetsHoaDon} />}
          {cheDo === "cungNgay" && <CungNgayView nhom={cungNgay} />}

          {cheDo === "so" && (
          <>
          {!ketQua.sheetPhanMem && (
            <div className="rounded-xl border border-warning/30 bg-warning-surface p-3 text-sm">
              File này <b>không có sheet sổ kế toán</b> (PHẦN MỀM / PMEM) nên mọi hóa đơn sẽ hiện “chưa vào sổ”.
              Nếu bạn chỉ cần kiểm cộng cột hay so hai bản hóa đơn, chọn kiểu tương ứng ở trên.
            </div>
          )}
          <ThongKe the={the} cot={4} />
          <p className="text-sm text-muted-foreground">
            Bấm vào một thẻ số ở trên để nhảy thẳng xuống danh sách tương ứng bên dưới.
          </p>

          {ketQua.daGoCotCu && (
            <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Đã tự gỡ cột đối soát của lần chạy trước (KẾT QUẢ + các cột phân tích) để chạy lại sạch — file gốc của bạn không bị đổi.
            </p>
          )}

          {(ketQua.nghiVan.length > 0 || ketQua.nghiVanGop.length > 0 || Object.keys(suaLog).length > 0) && (
            <div id="ds-nghivan">
              <NghiVanBox
                nghiVan={ketQua.nghiVan}
                nghiVanGop={ketQua.nghiVanGop}
                edits={edits}
                onSua={apDungSua}
                onHoanTac={hoanTacSua}
                suaLog={suaLog}
              />
            </div>
          )}

          <div id="ds-bang">
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
                  <BangHoaDon sheet={s} loc={locHD} setLoc={setLocHD} />
                </TabsContent>
              ))}
              {ketQua.sheetPhanMem && (
                <TabsContent value={PM_TAB} className="mt-4">
                  <BangPhanMem sheet={ketQua.sheetPhanMem} chiThieu={pmChiThieu} setChiThieu={setPmChiThieu} />
                </TabsContent>
              )}
              {ketQua.sheetsPhanMemPhu.map((s) => (
                <TabsContent key={s.ten} value={`phu-${s.ten}`} className="mt-4">
                  <BangPhanMem sheet={s} chiThieu={pmChiThieu} setChiThieu={setPmChiThieu} />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Kiểm tra chi tiết — gập cho gọn; tự mở khi có phép chưa đạt hoặc có cảnh báo */}
          <div className="space-y-4">
            <button
              title="Mở / thu phần máy tự kiểm tra và đối chiếu số liệu."
              type="button"
              onClick={() => setMoKiemTra((v) => !v)}
              aria-expanded={moKiemTraHieuLuc}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-center gap-2 font-semibold">
                {moKiemTraHieuLuc ? <ChevronDown className="size-5" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
                <ShieldCheck className="size-5 text-muted-foreground" aria-hidden />
                Máy tự kiểm tra &amp; đối chiếu số liệu
              </span>
              <span className={`shrink-0 text-sm font-medium ${tuKiemLoi ? "text-destructive" : "text-success"}`}>
                {tuKiemLoi ? "⚠ có chỗ chưa đạt — mở xem" : "✓ đã tự kiểm, khớp"}
              </span>
            </button>
            {moKiemTraHieuLuc && (
              <>
                <TuKiemBox phepThu={ketQua.phepThu} />
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
              </>
            )}
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
