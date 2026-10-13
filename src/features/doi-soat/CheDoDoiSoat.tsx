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
  HorizontalScroll,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  RecordTable,
  Tag,
  StatCardGrid,
  type RecordTableColumn,
  type StatCardData,
} from "@/design-system";
import {
  SUM_MISMATCH_LABELS,
  aoaToExcelColumn,
  type FlowWarning,
  type SumMismatchRow,
  type InvoiceSheet,
} from "@/lib/einvoiceReconciliation";
import {
  columnIndexToLetter,
  type SideSplitMethod,
  type TwoVersionRow,
  type TwoVersionResult,
  type SameDayGroup,
} from "@/lib/twoVersionReconciliation";
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
        const isSelected = cheDo === c.id;
        const Icon = c.icon;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={`Xem kết quả kiểu "${c.nhan}": ${c.moTa}`}
            onClick={() => setCheDo(c.id)}
            className={`flex min-h-11 flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              isSelected ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              {c.nhan}
              {isSelected && <span className="ml-auto shrink-0 text-sm font-medium text-primary">Đang xem</span>}
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
const RULES: { ten: string; noiDung: string }[] = [
  { ten: "Khóa ghép", noiDung: "MST người bán + ký hiệu + số hóa đơn. MST chỉ so phần chữ số (0301234567-001 = 0301234567001), MST mất số 0 đầu được bù lại; số hóa đơn bỏ số 0 ở đầu (00060568 = 60568); ký hiệu bỏ chữ số mẫu số gộp đầu (1C26TTN = C26TTN)." },
  { ten: "Cộng dồn", noiDung: "Một hóa đơn tách nhiều dòng sổ (theo thuế suất / theo mặt hàng) được cộng lại rồi mới so." },
  { ten: "So đủ 3 cột", noiDung: "So trước thuế, thuế và tổng ở từng hóa đơn. Tổng lệch ⇒ LỆCH TIỀN; tổng khớp mà thuế lệch ⇒ LỆCH THUẾ; chỉ trước thuế lệch ⇒ vẫn khớp (thường do chiết khấu / phí)." },
  { ten: "Ngoại tệ", noiDung: "Máy tự dò bản xuất để tiền ở nguyên tệ (phải nhân tỷ giá) hay đã quy sẵn VND, bằng cách so với các hóa đơn đã khớp sổ. Không mặc định nhân. Ngoại tệ thiếu tỷ giá thì máy báo, không tự coi là VND." },
  { ten: "Không cần vào sổ", noiDung: "Hóa đơn đã bị thay thế / xóa bỏ / hủy không phải kê. Hóa đơn đã bị ĐIỀU CHỈNH vẫn phải kê — không gộp chung." },
  { ten: "Hóa đơn bán hàng (mẫu số 2)", noiDung: "Không có thuế GTGT: ô thuế trống là đúng, chưa thuế phải bằng tổng thanh toán." },
  { ten: "Làm tròn", noiDung: "Lệch ±1 đ là làm tròn của bên phát hành, không phải sai. Hóa đơn để nguyên tệ thì chỉ ±1 xu (0,01) mới là làm tròn — lệch 1 USD là lệch thật." },
  { ten: "Gần khớp", noiDung: "Hóa đơn chưa vào sổ nhưng sổ có dòng cùng MST + cùng số tiền ⇒ nghi gõ sai số hóa đơn ở sổ, tách riêng để khỏi kê hai lần." },
  { ten: "Ghi chú tay", noiDung: "Dòng ghi chú kế toán gõ dưới bảng (không có ký hiệu, không có MST hợp lệ) bị bỏ qua, không bị coi là hóa đơn." },
  { ten: "Hai bản", noiDung: "Sheet có chữ “thuế” trong tên là bản thuế gửi; không có thì sheet mang chữ “tải” là bản tự tải. Nhận sai thì chọn lại ở mục So hai bản. File có sổ mà hai bản gối nhau thì chỉ bản thuế gửi được đối chiếu sổ (khỏi đếm hai lần)." },
  { ten: "Không sửa số", noiDung: "Máy chỉ báo. Số chỉ đổi khi bạn bấm Sửa từng dòng; file xuất giữ nguyên định dạng và địa chỉ ô của file gốc." },
];

export function QuyTacBox({ canhBao }: { canhBao: FlowWarning[] }) {
  const [mo, setMo] = useState(false);
  const fxWarnings = canhBao.filter((c) => c.loai === "Đơn vị tiền tệ ngoại tệ");
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
        Quy tắc máy đang áp dụng ({RULES.length})
      </button>
      {mo && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <ul className="space-y-2 text-sm">
            {RULES.map((q) => (
              <li key={q.ten}>
                <span className="font-medium">{q.ten}: </span>
                <span className="text-muted-foreground">{q.noiDung}</span>
              </li>
            ))}
          </ul>
          {fxWarnings.length > 0 && (
            <p className="rounded-lg border border-warning/30 bg-warning-surface p-2 text-sm">
              <b>Ngoại tệ ở file này:</b> {fxWarnings.map((c) => c.chiTiet).join(" ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Chia bên thuế gửi / tự tải ----------
const METHOD_LABELS: Record<SideSplitMethod, string> = {
  "chi-dinh": "bạn đã tự chọn",
  "ten-thue": "máy nhận theo chữ “thuế” trong tên sheet",
  "ten-tai": "máy nhận theo chữ “tải” trong tên sheet",
  "khong-ro": "máy chưa nhận ra — hãy chọn",
};

function SideSplitBox({
  tenSheets,
  benThue,
  cach,
  onDoi,
  onTuNhan,
}: {
  tenSheets: string[];
  benThue: ReadonlySet<string>;
  cach: SideSplitMethod;
  onDoi: (ten: string, laThue: boolean) => void;
  onTuNhan: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Sheet nào là bản nào? <span className="font-normal text-muted-foreground">({METHOD_LABELS[cach]})</span>
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
type TwoVersionFilter = "all" | "CHI_THUE" | "CHI_TAI" | "LECH" | "KHONG_SO";

function twoVersionChip(d: TwoVersionRow) {
  if (d.ben === "CHI_THUE") return <Tag variant="loi">Chỉ bản thuế có</Tag>;
  if (d.ben === "CHI_TAI") return <Tag variant="luu-y">Chỉ bản tự tải có</Tag>;
  if (d.khongSoDuocTien) return <Tag variant="luu-y">Không so được tiền</Tag>;
  if (d.lechTien) return <Tag variant="loi">Lệch tiền</Tag>;
  return <Tag variant="xong">Khớp</Tag>;
}

export function SoHaiBanView({
  kq,
  tenSheets,
  benThue,
  cach,
  onDoiBen,
  onTuNhan,
}: {
  kq: TwoVersionResult | null;
  tenSheets: string[];
  benThue: ReadonlySet<string>;
  cach: SideSplitMethod;
  onDoiBen: (ten: string, laThue: boolean) => void;
  onTuNhan: () => void;
}) {
  const [filter, setFilter] = useState<TwoVersionFilter>("all");
  const rows = useMemo(() => {
    if (!kq) return [];
    if (filter === "all") return kq.dong;
    if (filter === "LECH") return kq.dong.filter((d) => d.lechTien);
    if (filter === "KHONG_SO") return kq.dong.filter((d) => d.khongSoDuocTien);
    return kq.dong.filter((d) => d.ben === filter);
  }, [kq, filter]);

  const sideSplitBox = (
    <SideSplitBox tenSheets={tenSheets} benThue={benThue} cach={cach} onDoi={onDoiBen} onTuNhan={onTuNhan} />
  );

  if (tenSheets.length < 2)
    return (
      <EmptyState
        icon={Files}
        title="File chỉ có một sheet hóa đơn"
        description="So hai bản cần ít nhất hai sheet hóa đơn: một bản cơ quan thuế gửi và một bản kế toán tự tải. Dán hai bản vào hai sheet của cùng một file rồi chạy lại."
      />
    );
  if (!kq)
    return (
      <div className="space-y-4">
        {sideSplitBox}
        <EmptyState
          icon={Files}
          title="Chưa chia được hai bên"
          description="Cần ít nhất một sheet ở mỗi bên. Bấm “Thuế gửi” / “Tự tải” cho từng sheet ở trên."
        />
      </div>
    );

  const t = kq.tong;
  const the: StatCardData[] = [
    { label: "Bản thuế gửi", value: num(t.soThue), numeric: true, color: "brand", subtext: `${num(t.tienThue)} đ`, onSelect: () => setFilter("all"), selectHint: "Xem tất cả hóa đơn" },
    { label: "Bản tự tải", value: num(t.soTai), numeric: true, color: "brand", subtext: `${num(t.tienTai)} đ`, onSelect: () => setFilter("all"), selectHint: "Xem tất cả hóa đơn" },
    { label: "Chỉ bản thuế có", value: num(t.chiThue), numeric: true, color: t.chiThue ? "danger" : "success", subtext: `${num(t.tienChiThue)} đ — bản tự tải thiếu`, onSelect: () => setFilter("CHI_THUE"), selectHint: "Xem hóa đơn bản tự tải thiếu" },
    { label: "Chỉ bản tự tải có", value: num(t.chiTai), numeric: true, color: t.chiTai ? "warning" : "success", subtext: `${num(t.tienChiTai)} đ`, onSelect: () => setFilter("CHI_TAI"), selectHint: "Xem hóa đơn bản thuế không có" },
    { label: "Có cả hai, lệch tiền", value: num(t.lechTien), numeric: true, color: t.lechTien ? "warning" : "success", onSelect: () => setFilter("LECH"), selectHint: "Xem hóa đơn lệch tiền giữa hai bản" },
    { label: "Không so được tiền", value: num(t.khongSoDuocTien), numeric: true, color: "trung-tinh", subtext: "sheet trộn hai bố cục cột", onSelect: () => setFilter("KHONG_SO"), selectHint: "Xem hóa đơn không so được tiền" },
  ];
  const TWO_VERSION_FILTERS: { id: TwoVersionFilter; nhan: string; n: number }[] = [
    { id: "all", nhan: "Tất cả", n: kq.dong.length },
    { id: "CHI_THUE", nhan: "Chỉ bản thuế có", n: t.chiThue },
    { id: "CHI_TAI", nhan: "Chỉ bản tự tải có", n: t.chiTai },
    { id: "LECH", nhan: "Lệch tiền", n: t.lechTien },
    { id: "KHONG_SO", nhan: "Không so được", n: t.khongSoDuocTien },
  ];
  const columns: RecordTableColumn<TwoVersionRow>[] = [
    { key: "kq", header: "Kết quả", primary: true, render: twoVersionChip },
    { key: "kh", header: "Ký hiệu", render: (d) => d.kyHieu, getSortValue: (d) => d.kyHieu },
    { key: "so", header: "Số HĐ", render: (d) => d.soHoaDon },
    { key: "ngay", header: "Ngày lập", render: (d) => d.ngayLap, getSortValue: (d) => d.ngayLap },
    { key: "ban", header: "Người bán", render: (d) => d.tenBan },
    { key: "tT", header: "Tổng bản thuế", numeric: true, render: (d) => (d.tongT == null ? "—" : num(d.tongT)), getSortValue: (d) => d.tongT ?? 0 },
    { key: "tX", header: "Tổng bản tự tải", numeric: true, render: (d) => (d.tongX == null ? "—" : num(d.tongX)), getSortValue: (d) => d.tongX ?? 0 },
    { key: "chenh", header: "Chênh (thuế − tải)", numeric: true, render: (d) => (d.chenhTong == null ? "—" : num(d.chenhTong)), getSortValue: (d) => Math.abs(d.chenhTong ?? 0) },
    { key: "vt", header: "Ở đâu", render: (d) => [d.viTriT, d.viTriX].filter(Boolean).join(" · "), hideOnMobile: true },
    { key: "gc", header: "Ghi chú", render: (d) => d.ghiChu },
  ];
  return (
    <div className="space-y-4">
      {sideSplitBox}
      <StatCardGrid cards={the} />
      <div className="flex flex-wrap gap-2">
        {TWO_VERSION_FILTERS.map((l) => (
          <Button key={l.id} title={`Lọc danh sách: ${l.nhan}.`} size="sm" variant={filter === l.id ? "default" : "outline"} onClick={() => setFilter(l.id)}>
            {l.nhan} <span className="tnum ml-1">({num(l.n)})</span>
          </Button>
        ))}
      </div>
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(d) => d.khoa}
        getSearchText={(d) => `${d.kyHieu} ${d.soHoaDon} ${d.tenBan} ${d.mstBan}`}
        searchLabel="Tìm ký hiệu / số HĐ / người bán / MST…"
        emptyText="Không có hóa đơn nào ở mục này."
      />
    </div>
  );
}

// ---------- 2. Kiểm cộng cột bảng kê ----------
function SheetSumCheck({ sh }: { sh: InvoiceSheet }) {
  const cd = sh.canDoiCot;
  const [onlyReal, setOnlyReal] = useState(cd.soDong.lechThat > 0);
  const rows = useMemo(() => (onlyReal ? cd.dongLech.filter((d) => d.loai === "that") : cd.dongLech), [cd, onlyReal]);
  const columnLetter = (c: number) => (c >= 0 ? columnIndexToLetter(aoaToExcelColumn(sh.goc, c)) : "");
  const columnName = (c: number, ten: string) => (c >= 0 ? `${ten} (cột ${columnLetter(c)})` : ten);
  const isMatch = Math.abs(cd.lech) < 0.5;
  const o = cd.oTuDat;

  const bang: [string, number, number | null][] = [
    ["Phí (hợp lệ)", cd.boc.phi, cd.soDong.phi],
    ["Chiết khấu (hợp lệ)", cd.boc.chietKhau, cd.soDong.chietKhau],
    ["Làm tròn ±1 đ", cd.boc.lamTron, cd.soDong.lamTron],
    ["LỆCH THẬT — phải sửa", cd.boc.lechThat, cd.soDong.lechThat],
  ];
  const columns: RecordTableColumn<SumMismatchRow>[] = [
    { key: "d", header: "Dòng", primary: true, render: (d) => `dòng ${d.dongFile}`, getSortValue: (d) => d.dongFile },
    { key: "loai", header: "Nguyên nhân", render: (d) => (d.loai === "that" ? <Tag variant="loi">Lệch thật</Tag> : <Tag variant="luu-y">{SUM_MISMATCH_LABELS[d.loai]}</Tag>) },
    { key: "ma", header: "Hóa đơn", render: (d) => d.ma },
    { key: "ngay", header: "Ngày", render: (d) => d.ngay, hideOnMobile: true },
    { key: "ban", header: "Người bán", render: (d) => d.ban, hideOnMobile: true },
    { key: "chua", header: "Chưa thuế", numeric: true, render: (d) => num(d.chua) },
    { key: "thue", header: "Thuế", numeric: true, render: (d) => num(d.thue) },
    { key: "tong", header: "Tổng TT", numeric: true, render: (d) => num(d.tong) },
    { key: "lech", header: "Lệch", numeric: true, render: (d) => num(d.lech), getSortValue: (d) => Math.abs(d.lech) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Sheet {sh.ten}
          {isMatch ? <Tag variant="xong">Cộng khớp</Tag> : cd.soDong.lechThat ? <Tag variant="loi">{`${num(cd.soDong.lechThat)} dòng lệch thật`}</Tag> : <Tag variant="luu-y">Lệch bình thường</Tag>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Tổng {columnName(cd.cotTong, cd.tenTong || "tổng thanh toán")} <span className="tnum font-medium">{num(cd.sumTong)}</span> − (
          {columnName(cd.cotChua, cd.tenChua || "chưa thuế")} <span className="tnum font-medium">{num(cd.sumChua)}</span> +{" "}
          {columnName(cd.cotThue, cd.tenThue || "thuế")} <span className="tnum font-medium">{num(cd.sumThue)}</span>) ={" "}
          <span className={`tnum font-bold ${isMatch ? "text-success" : "text-foreground"}`}>{num(cd.lech)} đ</span>
        </p>
        {o && (
          <p className="rounded-lg border border-border bg-muted/40 p-2 text-sm">
            Ô bạn tự đặt dưới bảng: <b>{columnIndexToLetter(aoaToExcelColumn(sh.goc, o.cot))}{o.dongFile}</b> ={" "}
            <span className="tnum font-medium">{num(o.giaTri)} đ</span>
            {o.congPhi ? " — công thức đã cộng phí" : ""}
            {o.truCk ? ", đã trừ chiết khấu" : ""}. File xuất sẽ chỉ ra ô này gồm những dòng nào.
          </p>
        )}
        {!isMatch && (
          <HorizontalScroll>
            <table className="w-full min-w-80 text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Phần lệch do</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Số dòng</th>
                  <th className="py-1.5 text-right font-medium">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {bang.map(([ten, amount, n]) => (
                  <tr key={ten} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">{ten}</td>
                    <td className="tnum py-1.5 pr-3 text-right">{num(n ?? 0)}</td>
                    <td className="tnum py-1.5 text-right">{num(amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5 pr-3">Cộng = phần lệch</td>
                  <td />
                  <td className="tnum py-1.5 text-right">{num(cd.lech)}</td>
                </tr>
              </tbody>
            </table>
          </HorizontalScroll>
        )}
        {cd.dongLech.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button title="Chỉ xem dòng lệch không giải thích được — chỗ phải mở hóa đơn gốc ra sửa." size="sm" variant={onlyReal ? "default" : "outline"} onClick={() => setOnlyReal(true)}>
                Chỉ lệch thật <span className="tnum ml-1">({num(cd.soDong.lechThat)})</span>
              </Button>
              <Button title="Xem mọi dòng có chưa thuế + thuế khác tổng thanh toán, kể cả phí / chiết khấu / làm tròn." size="sm" variant={!onlyReal ? "default" : "outline"} onClick={() => setOnlyReal(false)}>
                Mọi dòng lệch <span className="tnum ml-1">({num(cd.dongLech.length)})</span>
              </Button>
            </div>
            <RecordTable
              columns={columns}
              rows={rows}
              getKey={(d) => `${d.dongFile}`}
              getSearchText={(d) => `${d.ma} ${d.ban} ${d.dongFile}`}
              searchLabel="Tìm hóa đơn / người bán / số dòng…"
              emptyText="Không có dòng lệch thật — phần lệch đều do phí, chiết khấu hoặc làm tròn."
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function KiemCongView({ sheets }: { sheets: InvoiceSheet[] }) {
  const ds = sheets.filter((s) => !s.laPhu && s.canDoiCot.cotTong >= 0);
  if (!ds.length)
    return (
      <EmptyState
        icon={Calculator}
        title="Không tìm thấy cột tiền để cộng"
        description="Cần sheet hóa đơn có cột chưa thuế, thuế và tổng thanh toán."
      />
    );
  const the: StatCardData[] = ds.map((s) => {
    const cd = s.canDoiCot;
    const isMatch = Math.abs(cd.lech) < 0.5;
    return {
      label: s.ten,
      value: `${num(cd.lech)} đ`,
      so: true,
      color: isMatch ? "success" : cd.soDong.lechThat ? "danger" : "warning",
      phu: isMatch ? "cộng khớp" : cd.soDong.lechThat ? `${num(cd.soDong.lechThat)} dòng lệch thật · ${num(cd.boc.lechThat)} đ` : "chỉ phí / chiết khấu / làm tròn",
    };
  });
  return (
    <div className="space-y-4">
      <StatCardGrid cards={the} />
      {ds.map((s) => (
        <SheetSumCheck key={s.ten} sh={s} />
      ))}
    </div>
  );
}

// ---------- 3. Cùng MST cùng ngày ----------
export function CungNgayView({ nhom }: { nhom: SameDayGroup[] }) {
  const soTrung = nhom.filter((g) => g.trungSoTien).length;
  const [onlyDuplicates, setOnlyDuplicates] = useState(soTrung > 0);
  const rows = useMemo(() => (onlyDuplicates ? nhom.filter((g) => g.trungSoTien) : nhom), [nhom, onlyDuplicates]);
  if (!nhom.length)
    return (
      <EmptyState
        icon={CalendarSearch}
        title="Không có nhóm nào"
        description="Không người bán nào xuất từ 2 hóa đơn trở lên trong cùng một ngày."
      />
    );
  const the: StatCardData[] = [
    { label: "Nhóm cùng MST cùng ngày", value: num(nhom.length), numeric: true, color: "brand", onSelect: () => setOnlyDuplicates(false), selectHint: "Xem mọi nhóm" },
    { label: "Hóa đơn trong các nhóm", value: num(nhom.reduce((s, g) => s + g.soHoaDon, 0)), numeric: true, color: "trung-tinh" },
    { label: "Nhóm trùng khít số tiền", value: num(soTrung), numeric: true, color: soTrung ? "warning" : "success", subtext: "dễ kê hai lần — soát trước", onSelect: () => setOnlyDuplicates(true), selectHint: "Xem nhóm trùng khít số tiền" },
  ];
  const columns: RecordTableColumn<SameDayGroup>[] = [
    { key: "ban", header: "Người bán", primary: true, render: (g) => g.tenBan || g.mstBan, getSortValue: (g) => g.tenBan },
    { key: "mst", header: "MST", render: (g) => g.mstBan, hideOnMobile: true },
    { key: "ngay", header: "Ngày", render: (g) => g.ngay, getSortValue: (g) => g.ngay },
    { key: "n", header: "Số HĐ", numeric: true, render: (g) => num(g.soHoaDon), getSortValue: (g) => g.soHoaDon },
    { key: "tien", header: "Tổng tiền", numeric: true, render: (g) => num(g.tongTien), getSortValue: (g) => g.tongTien },
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
      <StatCardGrid cards={the} />
      <div className="flex flex-wrap gap-2">
        <Button title="Chỉ xem nhóm có hóa đơn trùng khít số tiền." size="sm" variant={onlyDuplicates ? "default" : "outline"} onClick={() => setOnlyDuplicates(true)}>
          Trùng khít số tiền <span className="tnum ml-1">({num(soTrung)})</span>
        </Button>
        <Button title="Xem mọi nhóm cùng người bán cùng ngày." size="sm" variant={!onlyDuplicates ? "default" : "outline"} onClick={() => setOnlyDuplicates(false)}>
          Tất cả <span className="tnum ml-1">({num(nhom.length)})</span>
        </Button>
      </div>
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(g) => `${g.mstBan}#${g.ngay}`}
        getSearchText={(g) => `${g.tenBan} ${g.mstBan} ${g.ngay} ${g.dong.map((d) => d.soHoaDon).join(" ")}`}
        searchLabel="Tìm người bán / MST / ngày / số HĐ…"
        emptyText="Không có nhóm nào ở mục này."
      />
    </div>
  );
}
