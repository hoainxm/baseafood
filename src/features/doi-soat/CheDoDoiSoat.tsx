// ============================================================
// Tên file: src/features/doi-soat/CheDoDoiSoat.tsx
// Tên tiếng Việt tương đương: Các kiểu đối soát trên màn /doi-soat
// Description: Bộ chọn "việc cần soát" + 3 khung xem ngoài chiều hóa đơn ⇄ sổ:
//   so hai bản HĐĐT · kiểm cộng cột bảng kê · hóa đơn cùng MST cùng ngày.
//   Trước đây ba việc này CHỈ ra trong file Excel; nay xem + lọc ngay trên màn.
//   Mọi số lấy từ hàm thuần ở lib (doiSoatHaiBan / canDoiCot của engine) — màn
//   không tự tính lại gì, nên số trên màn và số trong file xuất là một.
// ============================================================
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  RecordTable,
  StatusChip,
  ThongKe,
  type Cot,
  type TheThongTin,
} from "@/design-system";
import {
  NHAN_LECH_CONG,
  cotExcel,
  type CanhBao,
  type DongLechCong,
  type SheetHoaDon,
} from "@/lib/doiSoatHddt";
import {
  chuCotExcel,
  type CachPhanBen,
  type DongSoBan,
  type KetQuaSoHaiBan,
  type NhomCungNgay,
} from "@/lib/doiSoatHaiBan";
import { num } from "@/lib/format";
import type { CheDo } from "./cheDo";
import {
  BookOpenCheck,
  Calculator,
  CalendarSearch,
  ChevronDown,
  ChevronRight,
  Files,
  ListChecks,
  RotateCcw,
} from "lucide-react";

const CHE_DO: { id: CheDo; nhan: string; moTa: string; icon: typeof Files }[] = [
  {
    id: "so",
    nhan: "Hóa đơn ⇄ sổ kế toán",
    moTa: "Hóa đơn nào chưa vào sổ, lệch tiền, lệch thuế; dòng sổ nào không có hóa đơn.",
    icon: BookOpenCheck,
  },
  {
    id: "haiBan",
    nhan: "So hai bản hóa đơn",
    moTa: "Bản cơ quan thuế gửi ⇄ bản kế toán tự tải: hóa đơn chỉ một bên có, hóa đơn lệch tiền.",
    icon: Files,
  },
  {
    id: "kiemCong",
    nhan: "Kiểm cộng cột bảng kê",
    moTa: "Chưa thuế + thuế có bằng tổng thanh toán không; lệch ở dòng nào, do phí / chiết khấu / làm tròn hay sai thật.",
    icon: Calculator,
  },
  {
    id: "cungNgay",
    nhan: "Cùng MST cùng ngày",
    moTa: "Một người bán xuất nhiều hóa đơn trong một ngày — lọc ra nhóm trùng khít số tiền (dễ kê hai lần).",
    icon: CalendarSearch,
  },
];

// ---------- Bộ chọn kiểu đối soát ----------
export function ChonCheDo({
  cheDo,
  setCheDo,
  dem,
}: {
  cheDo: CheDo;
  setCheDo: (c: CheDo) => void;
  /** Dòng tóm tắt dưới mỗi nút (VD "56 chưa vào sổ"), hoặc lý do chưa áp dụng được. */
  dem: Record<CheDo, { chu: string; apDung: boolean }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Việc cần soát">
      {CHE_DO.map((c) => {
        const chon = cheDo === c.id;
        const Icon = c.icon;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={chon}
            title={`Xem kết quả kiểu "${c.nhan}": ${c.moTa}`}
            onClick={() => setCheDo(c.id)}
            className={`flex min-h-11 flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              chon ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              {c.nhan}
              {chon && <span className="ml-auto shrink-0 text-sm font-medium text-primary">Đang xem</span>}
            </span>
            <span className="text-sm text-muted-foreground">{c.moTa}</span>
            <span className={`text-sm font-medium ${dem[c.id].apDung ? "text-foreground" : "text-muted-foreground"}`}>
              {dem[c.id].chu}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Quy tắc máy đang áp dụng ----------
/** Quy tắc đã chốt qua các đợt đối soát thật (doc 37). Giữ câu ngắn, lời thường. */
const QUY_TAC: { ten: string; noiDung: string }[] = [
  { ten: "Khóa ghép", noiDung: "MST người bán + ký hiệu + số hóa đơn. Số hóa đơn bỏ số 0 ở đầu (00060568 = 60568); ký hiệu bỏ chữ số mẫu số gộp đầu (1C26TTN = C26TTN)." },
  { ten: "Cộng dồn", noiDung: "Một hóa đơn tách nhiều dòng sổ (theo thuế suất / theo mặt hàng) được cộng lại rồi mới so." },
  { ten: "So đủ 3 cột", noiDung: "So trước thuế, thuế và tổng ở từng hóa đơn. Tổng lệch ⇒ LỆCH TIỀN; tổng khớp mà thuế lệch ⇒ LỆCH THUẾ; chỉ trước thuế lệch ⇒ vẫn khớp (thường do chiết khấu / phí)." },
  { ten: "Ngoại tệ", noiDung: "Máy tự dò bản xuất để tiền ở nguyên tệ (phải nhân tỷ giá) hay đã quy sẵn VND, bằng cách so với các hóa đơn đã khớp sổ. Không mặc định nhân." },
  { ten: "Không cần vào sổ", noiDung: "Hóa đơn đã bị thay thế / xóa bỏ / hủy không phải kê. Hóa đơn đã bị ĐIỀU CHỈNH vẫn phải kê — không gộp chung." },
  { ten: "Hóa đơn bán hàng (mẫu số 2)", noiDung: "Không có thuế GTGT: ô thuế trống là đúng, chưa thuế phải bằng tổng thanh toán." },
  { ten: "Làm tròn", noiDung: "Lệch ±1 đ là làm tròn của bên phát hành, không phải sai." },
  { ten: "Gần khớp", noiDung: "Hóa đơn chưa vào sổ nhưng sổ có dòng cùng MST + cùng số tiền ⇒ nghi gõ sai số hóa đơn ở sổ, tách riêng để khỏi kê hai lần." },
  { ten: "Ghi chú tay", noiDung: "Dòng ghi chú kế toán gõ dưới bảng (không có ký hiệu, không có MST hợp lệ) bị bỏ qua, không bị coi là hóa đơn." },
  { ten: "Hai bản", noiDung: "Sheet có chữ “thuế” trong tên là bản thuế gửi; không có thì sheet mang chữ “tải” là bản tự tải. Nhận sai thì chọn lại ở mục So hai bản." },
  { ten: "Không sửa số", noiDung: "Máy chỉ báo. Số chỉ đổi khi bạn bấm Sửa từng dòng; file xuất giữ nguyên định dạng và địa chỉ ô của file gốc." },
];

export function QuyTacBox({ canhBao }: { canhBao: CanhBao[] }) {
  const [mo, setMo] = useState(false);
  const ngoaiTe = canhBao.filter((c) => c.loai === "Đơn vị tiền tệ ngoại tệ");
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        title="Mở / thu danh sách quy tắc máy đang dùng để ghép và kết luận."
        aria-expanded={mo}
        onClick={() => setMo((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {mo ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
        <ListChecks className="size-4 text-muted-foreground" aria-hidden />
        Quy tắc máy đang áp dụng ({QUY_TAC.length})
      </button>
      {mo && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <ul className="space-y-2 text-sm">
            {QUY_TAC.map((q) => (
              <li key={q.ten}>
                <span className="font-medium">{q.ten}: </span>
                <span className="text-muted-foreground">{q.noiDung}</span>
              </li>
            ))}
          </ul>
          {ngoaiTe.length > 0 && (
            <p className="rounded-lg border border-warning/30 bg-warning-surface p-2 text-sm">
              <b>Ngoại tệ ở file này:</b> {ngoaiTe.map((c) => c.chiTiet).join(" ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Chia bên thuế gửi / tự tải ----------
const NHAN_CACH: Record<CachPhanBen, string> = {
  "chi-dinh": "bạn đã tự chọn",
  "ten-thue": "máy nhận theo chữ “thuế” trong tên sheet",
  "ten-tai": "máy nhận theo chữ “tải” trong tên sheet",
  "khong-ro": "máy chưa nhận ra — hãy chọn",
};

function PhanBenBox({
  tenSheets,
  benThue,
  cach,
  onDoi,
  onTuNhan,
}: {
  tenSheets: string[];
  benThue: ReadonlySet<string>;
  cach: CachPhanBen;
  onDoi: (ten: string, laThue: boolean) => void;
  onTuNhan: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Sheet nào là bản nào? <span className="font-normal text-muted-foreground">({NHAN_CACH[cach]})</span>
        </p>
        {cach === "chi-dinh" && (
          <Button title="Bỏ lựa chọn tay, để máy tự nhận bản thuế / bản tự tải theo tên sheet." variant="outline" size="sm" onClick={onTuNhan}>
            <RotateCcw /> Để máy tự nhận
          </Button>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {tenSheets.map((t) => {
          const thue = benThue.has(t);
          return (
            <li key={t} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 break-words font-medium">{t}</span>
              <span className="flex shrink-0 gap-2">
                <Button
                  title={`Đánh dấu sheet "${t}" là bản CƠ QUAN THUẾ gửi.`}
                  size="sm"
                  variant={thue ? "default" : "outline"}
                  aria-pressed={thue}
                  onClick={() => onDoi(t, true)}
                >
                  Thuế gửi
                </Button>
                <Button
                  title={`Đánh dấu sheet "${t}" là bản kế toán TỰ TẢI từ cổng.`}
                  size="sm"
                  variant={!thue ? "default" : "outline"}
                  aria-pressed={!thue}
                  onClick={() => onDoi(t, false)}
                >
                  Tự tải
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- 1. So hai bản ----------
type LocHaiBan = "all" | "CHI_THUE" | "CHI_TAI" | "LECH" | "KHONG_SO";

function chipHaiBan(d: DongSoBan) {
  if (d.ben === "CHI_THUE") return <StatusChip trangThai="stopped" nhan="Chỉ bản thuế có" />;
  if (d.ben === "CHI_TAI") return <StatusChip trangThai="idle" nhan="Chỉ bản tự tải có" />;
  if (d.khongSoDuocTien) return <StatusChip trangThai="idle" nhan="Không so được tiền" />;
  if (d.lechTien) return <StatusChip trangThai="idle" nhan="Lệch tiền" />;
  return <StatusChip trangThai="running" nhan="Khớp" />;
}

export function SoHaiBanView({
  kq,
  tenSheets,
  benThue,
  cach,
  onDoiBen,
  onTuNhan,
}: {
  kq: KetQuaSoHaiBan | null;
  tenSheets: string[];
  benThue: ReadonlySet<string>;
  cach: CachPhanBen;
  onDoiBen: (ten: string, laThue: boolean) => void;
  onTuNhan: () => void;
}) {
  const [loc, setLoc] = useState<LocHaiBan>("all");
  const rows = useMemo(() => {
    if (!kq) return [];
    if (loc === "all") return kq.dong;
    if (loc === "LECH") return kq.dong.filter((d) => d.lechTien);
    if (loc === "KHONG_SO") return kq.dong.filter((d) => d.khongSoDuocTien);
    return kq.dong.filter((d) => d.ben === loc);
  }, [kq, loc]);

  const phanBen = (
    <PhanBenBox tenSheets={tenSheets} benThue={benThue} cach={cach} onDoi={onDoiBen} onTuNhan={onTuNhan} />
  );

  if (tenSheets.length < 2)
    return (
      <EmptyState
        icon={Files}
        tieuDe="File chỉ có một sheet hóa đơn"
        moTa="So hai bản cần ít nhất hai sheet hóa đơn: một bản cơ quan thuế gửi và một bản kế toán tự tải. Dán hai bản vào hai sheet của cùng một file rồi chạy lại."
      />
    );
  if (!kq)
    return (
      <div className="space-y-4">
        {phanBen}
        <EmptyState
          icon={Files}
          tieuDe="Chưa chia được hai bên"
          moTa="Cần ít nhất một sheet ở mỗi bên. Bấm “Thuế gửi” / “Tự tải” cho từng sheet ở trên."
        />
      </div>
    );

  const t = kq.tong;
  const the: TheThongTin[] = [
    { nhan: "Bản thuế gửi", giaTri: num(t.soThue), so: true, mau: "brand", phu: `${num(t.tienThue)} đ`, onChon: () => setLoc("all"), moTaChon: "Xem tất cả hóa đơn" },
    { nhan: "Bản tự tải", giaTri: num(t.soTai), so: true, mau: "brand", phu: `${num(t.tienTai)} đ`, onChon: () => setLoc("all"), moTaChon: "Xem tất cả hóa đơn" },
    { nhan: "Chỉ bản thuế có", giaTri: num(t.chiThue), so: true, mau: t.chiThue ? "danger" : "success", phu: `${num(t.tienChiThue)} đ — bản tự tải thiếu`, onChon: () => setLoc("CHI_THUE"), moTaChon: "Xem hóa đơn bản tự tải thiếu" },
    { nhan: "Chỉ bản tự tải có", giaTri: num(t.chiTai), so: true, mau: t.chiTai ? "warning" : "success", phu: `${num(t.tienChiTai)} đ`, onChon: () => setLoc("CHI_TAI"), moTaChon: "Xem hóa đơn bản thuế không có" },
    { nhan: "Có cả hai, lệch tiền", giaTri: num(t.lechTien), so: true, mau: t.lechTien ? "warning" : "success", onChon: () => setLoc("LECH"), moTaChon: "Xem hóa đơn lệch tiền giữa hai bản" },
    { nhan: "Không so được tiền", giaTri: num(t.khongSoDuocTien), so: true, mau: "trung-tinh", phu: "sheet trộn hai bố cục cột", onChon: () => setLoc("KHONG_SO"), moTaChon: "Xem hóa đơn không so được tiền" },
  ];
  const LOC: { id: LocHaiBan; nhan: string; n: number }[] = [
    { id: "all", nhan: "Tất cả", n: kq.dong.length },
    { id: "CHI_THUE", nhan: "Chỉ bản thuế có", n: t.chiThue },
    { id: "CHI_TAI", nhan: "Chỉ bản tự tải có", n: t.chiTai },
    { id: "LECH", nhan: "Lệch tiền", n: t.lechTien },
    { id: "KHONG_SO", nhan: "Không so được", n: t.khongSoDuocTien },
  ];
  const cot: Cot<DongSoBan>[] = [
    { key: "kq", header: "Kết quả", chinh: true, render: chipHaiBan },
    { key: "kh", header: "Ký hiệu", render: (d) => d.kyHieu, sapXep: (d) => d.kyHieu },
    { key: "so", header: "Số HĐ", render: (d) => d.soHoaDon },
    { key: "ngay", header: "Ngày lập", render: (d) => d.ngayLap, sapXep: (d) => d.ngayLap },
    { key: "ban", header: "Người bán", render: (d) => d.tenBan },
    { key: "tT", header: "Tổng bản thuế", so: true, render: (d) => (d.tongT == null ? "—" : num(d.tongT)), sapXep: (d) => d.tongT ?? 0 },
    { key: "tX", header: "Tổng bản tự tải", so: true, render: (d) => (d.tongX == null ? "—" : num(d.tongX)), sapXep: (d) => d.tongX ?? 0 },
    { key: "chenh", header: "Chênh (thuế − tải)", so: true, render: (d) => (d.chenhTong == null ? "—" : num(d.chenhTong)), sapXep: (d) => Math.abs(d.chenhTong ?? 0) },
    { key: "vt", header: "Ở đâu", render: (d) => [d.viTriT, d.viTriX].filter(Boolean).join(" · "), anTrenDienThoai: true },
    { key: "gc", header: "Ghi chú", render: (d) => d.ghiChu },
  ];
  return (
    <div className="space-y-4">
      {phanBen}
      <ThongKe the={the} />
      <div className="flex flex-wrap gap-2">
        {LOC.map((l) => (
          <Button key={l.id} title={`Lọc danh sách: ${l.nhan}.`} size="sm" variant={loc === l.id ? "default" : "outline"} onClick={() => setLoc(l.id)}>
            {l.nhan} <span className="tnum ml-1">({num(l.n)})</span>
          </Button>
        ))}
      </div>
      <RecordTable
        columns={cot}
        rows={rows}
        getKey={(d) => d.khoa}
        timKiem={(d) => `${d.kyHieu} ${d.soHoaDon} ${d.tenBan} ${d.mstBan}`}
        nhanTimKiem="Tìm ký hiệu / số HĐ / người bán / MST…"
        emptyText="Không có hóa đơn nào ở mục này."
      />
    </div>
  );
}

// ---------- 2. Kiểm cộng cột bảng kê ----------
function KiemCongSheet({ sh }: { sh: SheetHoaDon }) {
  const cd = sh.canDoiCot;
  const [chiThat, setChiThat] = useState(cd.soDong.lechThat > 0);
  const rows = useMemo(() => (chiThat ? cd.dongLech.filter((d) => d.loai === "that") : cd.dongLech), [cd, chiThat]);
  const oCot = (c: number) => (c >= 0 ? chuCotExcel(cotExcel(sh.goc, c)) : "");
  const tenCot = (c: number, ten: string) => (c >= 0 ? `${ten} (cột ${oCot(c)})` : ten);
  const khop = Math.abs(cd.lech) < 0.5;
  const o = cd.oTuDat;

  const bang: [string, number, number | null][] = [
    ["Phí (hợp lệ)", cd.boc.phi, cd.soDong.phi],
    ["Chiết khấu (hợp lệ)", cd.boc.chietKhau, cd.soDong.chietKhau],
    ["Làm tròn ±1 đ", cd.boc.lamTron, cd.soDong.lamTron],
    ["LỆCH THẬT — phải sửa", cd.boc.lechThat, cd.soDong.lechThat],
  ];
  const cot: Cot<DongLechCong>[] = [
    { key: "d", header: "Dòng", chinh: true, render: (d) => `dòng ${d.dongFile}`, sapXep: (d) => d.dongFile },
    { key: "loai", header: "Nguyên nhân", render: (d) => (d.loai === "that" ? <StatusChip trangThai="stopped" nhan="Lệch thật" /> : <StatusChip trangThai="idle" nhan={NHAN_LECH_CONG[d.loai]} />) },
    { key: "ma", header: "Hóa đơn", render: (d) => d.ma },
    { key: "ngay", header: "Ngày", render: (d) => d.ngay, anTrenDienThoai: true },
    { key: "ban", header: "Người bán", render: (d) => d.ban, anTrenDienThoai: true },
    { key: "chua", header: "Chưa thuế", so: true, render: (d) => num(d.chua) },
    { key: "thue", header: "Thuế", so: true, render: (d) => num(d.thue) },
    { key: "tong", header: "Tổng TT", so: true, render: (d) => num(d.tong) },
    { key: "lech", header: "Lệch", so: true, render: (d) => num(d.lech), sapXep: (d) => Math.abs(d.lech) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Sheet {sh.ten}
          {khop ? <StatusChip trangThai="running" nhan="Cộng khớp" /> : cd.soDong.lechThat ? <StatusChip trangThai="stopped" nhan={`${num(cd.soDong.lechThat)} dòng lệch thật`} /> : <StatusChip trangThai="idle" nhan="Lệch bình thường" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Tổng {tenCot(cd.cotTong, cd.tenTong || "tổng thanh toán")} <span className="tnum font-medium">{num(cd.sumTong)}</span> − (
          {tenCot(cd.cotChua, cd.tenChua || "chưa thuế")} <span className="tnum font-medium">{num(cd.sumChua)}</span> +{" "}
          {tenCot(cd.cotThue, cd.tenThue || "thuế")} <span className="tnum font-medium">{num(cd.sumThue)}</span>) ={" "}
          <span className={`tnum font-bold ${khop ? "text-success" : "text-foreground"}`}>{num(cd.lech)} đ</span>
        </p>
        {o && (
          <p className="rounded-lg border border-border bg-muted/40 p-2 text-sm">
            Ô bạn tự đặt dưới bảng: <b>{chuCotExcel(cotExcel(sh.goc, o.cot))}{o.dongFile}</b> ={" "}
            <span className="tnum font-medium">{num(o.giaTri)} đ</span>
            {o.congPhi ? " — công thức đã cộng phí" : ""}
            {o.truCk ? ", đã trừ chiết khấu" : ""}. File xuất sẽ chỉ ra ô này gồm những dòng nào.
          </p>
        )}
        {!khop && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-80 text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Phần lệch do</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Số dòng</th>
                  <th className="py-1.5 text-right font-medium">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {bang.map(([ten, tien, n]) => (
                  <tr key={ten} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">{ten}</td>
                    <td className="tnum py-1.5 pr-3 text-right">{num(n ?? 0)}</td>
                    <td className="tnum py-1.5 text-right">{num(tien)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5 pr-3">Cộng = phần lệch</td>
                  <td />
                  <td className="tnum py-1.5 text-right">{num(cd.lech)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {cd.dongLech.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button title="Chỉ xem dòng lệch không giải thích được — chỗ phải mở hóa đơn gốc ra sửa." size="sm" variant={chiThat ? "default" : "outline"} onClick={() => setChiThat(true)}>
                Chỉ lệch thật <span className="tnum ml-1">({num(cd.soDong.lechThat)})</span>
              </Button>
              <Button title="Xem mọi dòng có chưa thuế + thuế khác tổng thanh toán, kể cả phí / chiết khấu / làm tròn." size="sm" variant={!chiThat ? "default" : "outline"} onClick={() => setChiThat(false)}>
                Mọi dòng lệch <span className="tnum ml-1">({num(cd.dongLech.length)})</span>
              </Button>
            </div>
            <RecordTable
              columns={cot}
              rows={rows}
              getKey={(d) => `${d.dongFile}`}
              timKiem={(d) => `${d.ma} ${d.ban} ${d.dongFile}`}
              nhanTimKiem="Tìm hóa đơn / người bán / số dòng…"
              emptyText="Không có dòng lệch thật — phần lệch đều do phí, chiết khấu hoặc làm tròn."
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function KiemCongView({ sheets }: { sheets: SheetHoaDon[] }) {
  const ds = sheets.filter((s) => !s.laPhu && s.canDoiCot.cotTong >= 0);
  if (!ds.length)
    return (
      <EmptyState
        icon={Calculator}
        tieuDe="Không tìm thấy cột tiền để cộng"
        moTa="Cần sheet hóa đơn có cột chưa thuế, thuế và tổng thanh toán."
      />
    );
  const the: TheThongTin[] = ds.map((s) => {
    const cd = s.canDoiCot;
    const khop = Math.abs(cd.lech) < 0.5;
    return {
      nhan: s.ten,
      giaTri: `${num(cd.lech)} đ`,
      so: true,
      mau: khop ? "success" : cd.soDong.lechThat ? "danger" : "warning",
      phu: khop ? "cộng khớp" : cd.soDong.lechThat ? `${num(cd.soDong.lechThat)} dòng lệch thật · ${num(cd.boc.lechThat)} đ` : "chỉ phí / chiết khấu / làm tròn",
    };
  });
  return (
    <div className="space-y-4">
      <ThongKe the={the} />
      {ds.map((s) => (
        <KiemCongSheet key={s.ten} sh={s} />
      ))}
    </div>
  );
}

// ---------- 3. Cùng MST cùng ngày ----------
export function CungNgayView({ nhom }: { nhom: NhomCungNgay[] }) {
  const soTrung = nhom.filter((g) => g.trungSoTien).length;
  const [chiTrung, setChiTrung] = useState(soTrung > 0);
  const rows = useMemo(() => (chiTrung ? nhom.filter((g) => g.trungSoTien) : nhom), [nhom, chiTrung]);
  if (!nhom.length)
    return (
      <EmptyState
        icon={CalendarSearch}
        tieuDe="Không có nhóm nào"
        moTa="Không người bán nào xuất từ 2 hóa đơn trở lên trong cùng một ngày."
      />
    );
  const the: TheThongTin[] = [
    { nhan: "Nhóm cùng MST cùng ngày", giaTri: num(nhom.length), so: true, mau: "brand", onChon: () => setChiTrung(false), moTaChon: "Xem mọi nhóm" },
    { nhan: "Hóa đơn trong các nhóm", giaTri: num(nhom.reduce((s, g) => s + g.soHoaDon, 0)), so: true, mau: "trung-tinh" },
    { nhan: "Nhóm trùng khít số tiền", giaTri: num(soTrung), so: true, mau: soTrung ? "warning" : "success", phu: "dễ kê hai lần — soát trước", onChon: () => setChiTrung(true), moTaChon: "Xem nhóm trùng khít số tiền" },
  ];
  const cot: Cot<NhomCungNgay>[] = [
    { key: "ban", header: "Người bán", chinh: true, render: (g) => g.tenBan || g.mstBan, sapXep: (g) => g.tenBan },
    { key: "mst", header: "MST", render: (g) => g.mstBan, anTrenDienThoai: true },
    { key: "ngay", header: "Ngày", render: (g) => g.ngay, sapXep: (g) => g.ngay },
    { key: "n", header: "Số HĐ", so: true, render: (g) => num(g.soHoaDon), sapXep: (g) => g.soHoaDon },
    { key: "tien", header: "Tổng tiền", so: true, render: (g) => num(g.tongTien), sapXep: (g) => g.tongTien },
    { key: "trung", header: "Trùng tiền", render: (g) => (g.trungSoTien ? <span className="font-medium text-warning">{g.moTaTrung}</span> : "—") },
    {
      key: "ds",
      header: "Các hóa đơn",
      render: (g) => g.dong.map((d) => `${d.kyHieu}-${d.soHoaDon} (${num(d.tongTtVnd)})`).join(" · "),
    },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nhiều hóa đơn cùng người bán trong một ngày <b>chưa chắc là sai</b> (xăng dầu, siêu thị, phí ngân hàng…). Nhóm có hóa
        đơn trùng khít số tiền mới đáng soát trước.
      </p>
      <ThongKe the={the} />
      <div className="flex flex-wrap gap-2">
        <Button title="Chỉ xem nhóm có hóa đơn trùng khít số tiền." size="sm" variant={chiTrung ? "default" : "outline"} onClick={() => setChiTrung(true)}>
          Trùng khít số tiền <span className="tnum ml-1">({num(soTrung)})</span>
        </Button>
        <Button title="Xem mọi nhóm cùng người bán cùng ngày." size="sm" variant={!chiTrung ? "default" : "outline"} onClick={() => setChiTrung(false)}>
          Tất cả <span className="tnum ml-1">({num(nhom.length)})</span>
        </Button>
      </div>
      <RecordTable
        columns={cot}
        rows={rows}
        getKey={(g) => `${g.mstBan}#${g.ngay}`}
        timKiem={(g) => `${g.tenBan} ${g.mstBan} ${g.ngay} ${g.dong.map((d) => d.soHoaDon).join(" ")}`}
        nhanTimKiem="Tìm người bán / MST / ngày / số HĐ…"
        emptyText="Không có nhóm nào ở mục này."
      />
    </div>
  );
}
