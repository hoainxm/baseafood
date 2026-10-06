import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Search, X } from "lucide-react";
import { ThanhToMau } from "./ToMauDong";
import { useThanhCuonTren } from "./thanhCuonTren";
import { useChonDong, useToMau } from "./toMauNguon";

export interface Cot<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Cột số: căn phải + tabular-nums */
  so?: boolean;
  /** Trường chính, hiện làm tiêu đề thẻ trên điện thoại */
  chinh?: boolean;
  /** Ẩn khỏi thẻ trên điện thoại (thông tin phụ) — xem qua nút "Chi tiết". */
  anTrenDienThoai?: boolean;
  /** Cột phụ: ẩn khỏi BẢNG (desktop) cho bảng gọn, xem qua nút "Chi tiết" ở
   *  cuối dòng. Cột `chinh` không bao giờ bị ẩn. */
  phu?: boolean;
  /** Giá trị dùng để sắp xếp. Không có → cột không sắp xếp được. */
  sapXep?: (row: T) => string | number;
}

type Huong = "tang" | "giam";

/**
 * RecordTable — một nguồn dữ liệu, hai hình thức.
 *
 *  Vùng chứa ≥ 48rem: bảng, sọc xen kẽ, header không in hoa, bấm header để
 *             sắp xếp. Cột đầu ghim trái, cột Thao tác ghim phải (nút Sửa/Xóa
 *             không bao giờ trôi khỏi tầm nhìn), chữ dài xuống dòng thay vì
 *             kéo bảng rộng ra.
 *  Vùng chứa hẹp hơn: MỖI BẢN GHI MỘT THẺ, nhãn–giá trị xếp dọc; sắp xếp
 *             bằng danh sách nút thay cho header bảng.
 *
 * Mốc đổi thẻ ↔ bảng đo theo BỀ RỘNG VÙNG CHỨA (container query), không theo
 * màn hình: laptop có thanh bên, bảng nằm trong lưới 2 cột… đều tự ra thẻ khi
 * không đủ chỗ. Cột `phu` (bảng) / `anTrenDienThoai` (thẻ) gom vào nút
 * "Chi tiết" — ẩn cho gọn nhưng không bao giờ mất đường xem.
 *
 * Không bao giờ bắt người dùng cuộn ngang để đọc số — cuộn ngang là chỗ hay
 * đọc nhầm dòng nhất.
 */
export function RecordTable<T>({
  columns,
  rows,
  getKey,
  actions,
  footer,
  emptyText = "Chưa có dữ liệu.",
  timKiem,
  nhanTimKiem = "Tìm trong bảng…",
  className,
  toMau,
}: {
  columns: Cot<T>[];
  rows: T[];
  getKey: (row: T) => string;
  /** Nút hành động cuối dòng / cuối thẻ. Phải là nút CÓ NHÃN CHỮ. */
  actions?: (row: T) => React.ReactNode;
  footer?: React.ReactNode;
  emptyText?: string;
  /** Có hàm này → hiện ô tìm kiếm ngay trên bảng. */
  timKiem?: (row: T) => string;
  nhanTimKiem?: string;
  className?: string;
  /**
   * Tô màu dòng "đã dò" (lưu chung, mọi máy thấy): khoá ỔN ĐỊNH của bảng, VD
   * "nhap-hang". Bật ⇒ nút tô ở cột Thao tác (bảng) / hàng nút (thẻ). `getKey`
   * phải là id bản ghi. Luật: README § Tô màu dòng.
   */
  toMau?: string;
}) {
  const to = useToMau(toMau);
  // Tick dòng để tô màu / in đậm nhiều dòng một lúc (chỉ khi bật toMau).
  const chonDong = useChonDong();
  // Thanh cuộn ngang TRÊN đầu bảng (README § 5a) — vùng cuộn thật là table-container.
  const khungBangRef = React.useRef<HTMLDivElement>(null);
  const thanhTren = useThanhCuonTren(
    () => khungBangRef.current?.querySelector<HTMLElement>('[data-slot="table-container"]') ?? null,
    "mx-2 mt-2"
  );
  const [q, setQ] = React.useState("");
  const [sapTheo, setSapTheo] = React.useState<string | null>(null);
  const [huong, setHuong] = React.useState<Huong>("tang");
  const [moRong, setMoRong] = React.useState<ReadonlySet<string>>(() => new Set());
  const doiMoRong = (k: string) =>
    setMoRong((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const cotSapDuoc = columns.filter((c) => c.sapXep);
  // Chế độ thẻ: chỉ đưa nút sắp theo cột ĐANG HIỆN trên thẻ — 9 nút cho mọi
  // trường (kể cả trường ẩn) rối hơn là giúp.
  const cotSapThe = cotSapDuoc.filter((c) => !c.anTrenDienThoai);

  const daLoc = React.useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw || !timKiem) return rows;
    return rows.filter((r) => timKiem(r).toLowerCase().includes(kw));
  }, [rows, q, timKiem]);

  const daSap = React.useMemo(() => {
    const cot = columns.find((c) => c.key === sapTheo);
    if (!cot?.sapXep) return daLoc;
    const fn = cot.sapXep;
    return [...daLoc].sort((a, b) => {
      const va = fn(a);
      const vb = fn(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "vi");
      return huong === "tang" ? cmp : -cmp;
    });
  }, [daLoc, columns, sapTheo, huong]);

  const doiSap = (key: string) => {
    if (sapTheo === key) {
      setHuong((h) => (h === "tang" ? "giam" : "tang"));
    } else {
      setSapTheo(key);
      setHuong("tang");
    }
  };

  const thanhCongCu = (timKiem || cotSapDuoc.length > 0) && rows.length > 0 && (
    <div className="flex min-w-0 flex-col gap-3 @3xl:flex-row @3xl:items-center">
      {timKiem && (
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={nhanTimKiem}
            aria-label={nhanTimKiem}
            className="pl-12"
          />
        </div>
      )}
      {/* Sắp xếp trên điện thoại: header bảng không hiện nên cần nút riêng */}
      {cotSapThe.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 @3xl:hidden">
          <span className="text-sm text-muted-foreground">Sắp theo</span>
          {cotSapThe.map((c) => (
            <Button
              key={c.key}
              variant={sapTheo === c.key ? "default" : "outline"}
              size="sm"
              onClick={() => doiSap(c.key)}
              className="max-w-full min-w-0"
              title={`Sắp danh sách theo cột "${c.header}". Bấm lại để đảo tăng ↔ giảm.`}
            >
              <span className="truncate">{c.header}</span>
              {sapTheo === c.key ? (
                huong === "tang" ? (
                  <ArrowUp />
                ) : (
                  <ArrowDown />
                )
              ) : null}
            </Button>
          ))}
        </div>
      )}
      {(q || sapTheo) && (
        <Button
          variant="outline"
          size="sm"
          title="Bỏ ô tìm và bỏ sắp xếp — về lại danh sách đầy đủ theo thứ tự gốc."
          onClick={() => {
            setQ("");
            setSapTheo(null);
          }}
        >
          <X />
          Bỏ lọc
        </Button>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border-2 border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground",
          className
        )}
      >
        {emptyText}
      </div>
    );
  }

  const cotChinh = columns.find((c) => c.chinh) ?? columns[0];
  const cotBang = columns.filter((c) => !c.phu || c === cotChinh);
  const cotAnBang = columns.filter((c) => c.phu && c !== cotChinh);
  const cotThe = columns.filter((c) => c !== cotChinh && !c.anTrenDienThoai);
  const cotAnThe = columns.filter((c) => c !== cotChinh && c.anTrenDienThoai);
  const coCotThaoTac = Boolean(actions) || cotAnBang.length > 0;
  /** Nhãn dòng cho trình đọc màn hình của ô tick (chữ của cột chính nếu là chữ). */
  const nhanDong = (r: T) => {
    const v = cotChinh.render(r);
    return typeof v === "string" || typeof v === "number" ? String(v) : getKey(r);
  };
  const khoaHien = daSap.map((r) => getKey(r));
  const daTick = khoaHien.filter((k) => chonDong.daChon.has(k));
  const chonHet = daTick.length > 0 && daTick.length === khoaHien.length;
  const oTick = (r: T) => {
    const k = getKey(r);
    return (
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0"
        checked={chonDong.daChon.has(k)}
        onChange={() => {}}
        onClick={(e) => chonDong.doi(k, e.shiftKey, khoaHien)}
        aria-label={`Chọn dòng ${nhanDong(r)}`}
        title="Tick để tô màu / in đậm dòng này (Shift+tick chọn cả khoảng)."
      />
    );
  };

  const nutChiTiet = (k: string, coAn: boolean) =>
    coAn && (
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={moRong.has(k)}
        onClick={() => doiMoRong(k)}
        title={
          moRong.has(k)
            ? "Thu gọn phần thông tin thêm của dòng này."
            : "Xem các thông tin còn lại của dòng này (đang ẩn cho bảng gọn)."
        }
      >
        <ChevronDown
          className={cn("transition-transform", moRong.has(k) && "rotate-180")}
        />
        {moRong.has(k) ? "Thu gọn" : "Chi tiết"}
      </Button>
    );

  const chiTiet = (r: T, cot: Cot<T>[]) => (
    <dl className="grid gap-x-8 gap-y-3 @3xl:grid-cols-2 @5xl:grid-cols-3">
      {cot.map((c) => (
        <div key={c.key} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{c.header}</dt>
          <dd className={cn("text-sm font-medium break-words", c.so && "tnum")}>
            {c.render(r)}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    // min-w-0: khi RecordTable là con của lưới (VD dashboard 2 cột), không cho
    // bảng ép ô rộng theo nội-dung-tối-thiểu → tránh tràn đè khối bên cạnh.
    // @container: mốc thẻ ↔ bảng đo theo bề rộng CHÍNH VÙNG NÀY.
    <div className={cn("@container min-w-0 space-y-4", className)}>
      {thanhCongCu}

      {daSap.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Không có dòng nào khớp “{q}”.
        </div>
      ) : (
        <>
          {/* Desktop — cuộn ngang khi ô chứa hẹp (VD nằm trong lưới 2 cột) để bảng
              KHÔNG tràn đè khối bên cạnh; đủ rộng thì không có thanh cuộn. */}
          <div
            ref={khungBangRef}
            className="scroll-nice-x hidden overflow-x-auto rounded-xl ring-1 ring-foreground/10 @3xl:block"
          >
            {thanhTren}
            <Table className={cn("bang-ghim-dau", coCotThaoTac && "bang-ghim-cuoi")}>
              <TableHeader>
                <TableRow>
                  {cotBang.map((c, ci) => (
                    <TableHead
                      key={c.key}
                      className={cn(c.so && "text-right", "p-0 whitespace-normal")}
                      aria-sort={
                        sapTheo === c.key
                          ? huong === "tang"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <div className="flex items-center">
                      {to.bat && ci === 0 && (
                        <input
                          type="checkbox"
                          className="ml-(--pad-o,0.75rem) size-5 shrink-0"
                          checked={chonHet}
                          onChange={() => chonDong.doiTatCa(khoaHien, !chonHet)}
                          aria-label={chonHet ? "Bỏ chọn tất cả dòng" : "Chọn tất cả dòng"}
                          title={chonHet ? "Bỏ tick mọi dòng đang hiện." : "Tick mọi dòng đang hiện (để tô màu / in đậm cùng lúc)."}
                        />
                      )}
                      {c.sapXep ? (
                        <button
                          type="button"
                          onClick={() => doiSap(c.key)}
                          title={`Sắp danh sách theo cột "${c.header}". Bấm lại để đảo tăng ↔ giảm.`}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-2 px-(--pad-o,0.75rem) py-1.5 text-left text-sm leading-snug font-semibold hover:bg-accent",
                            c.so && "justify-end text-right"
                          )}
                        >
                          {c.header}
                          {sapTheo === c.key ? (
                            huong === "tang" ? (
                              <ArrowUp className="size-5 shrink-0 text-primary" />
                            ) : (
                              <ArrowDown className="size-5 shrink-0 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="size-5 shrink-0 text-muted-foreground/60" />
                          )}
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "flex min-h-11 items-center px-(--pad-o,0.75rem) py-1.5 leading-snug",
                            c.so && "justify-end"
                          )}
                        >
                          {c.header}
                        </span>
                      )}
                      </div>
                    </TableHead>
                  ))}
                  {coCotThaoTac && (
                    <TableHead className="text-right">Thao tác</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* hien-len: mỗi dòng hiện vào (mờ→rõ + nhích lên) khi MOUNT.
                    Sắp/lọc giữ nguyên key → KHÔNG re-animate; thêm 1 dòng mới
                    (key mới) thì chỉ dòng đó chạy. Lần đầu/đổi trang thì cả bảng
                    hiện vào một lượt — nhẹ, nằm gọn trong page-fade của AppShell. */}
                {daSap.map((r) => {
                  const k = getKey(r);
                  return (
                    <React.Fragment key={k}>
                      <TableRow className="hien-len" {...to.thuocTinh(k)}>
                        {cotBang.map((c, ci) => (
                          <TableCell
                            key={c.key}
                            className={c.so ? "tnum text-right" : undefined}
                          >
                            <div className={cn(to.bat && ci === 0 && "flex items-start gap-2")}>
                              {to.bat && ci === 0 && oTick(r)}
                              {c.so ? (
                                c.render(r)
                              ) : (
                                // Chữ dài xuống dòng trong khung ≤ 18rem thay vì kéo
                                // cả bảng rộng ra (ô gốc để whitespace-nowrap).
                                <div className="max-w-72 break-words whitespace-normal">
                                  {c.render(r)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        ))}
                        {coCotThaoTac && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {nutChiTiet(k, cotAnBang.length > 0)}
                              {actions?.(r)}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      {moRong.has(k) && cotAnBang.length > 0 && (
                        <TableRow
                          data-chi-tiet=""
                          className="odd:bg-muted/30 even:bg-muted/30 hover:bg-muted/30"
                        >
                          <TableCell
                            colSpan={cotBang.length + 1}
                            className="whitespace-normal"
                          >
                            {chiTiet(r, cotAnBang)}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
              {footer && <TableFooter>{footer}</TableFooter>}
            </Table>
          </div>

          {/* Vùng chứa hẹp (điện thoại, laptop có thanh bên, lưới 2 cột) */}
          <ul className="space-y-3 @3xl:hidden">
            {daSap.map((r) => {
              const k = getKey(r);
              return (
              <li
                key={k}
                className="hien-len rounded-xl bg-card p-4 ring-1 ring-foreground/10"
                {...to.thuocTinh(k)}
              >
                <div className="mb-3 flex items-start gap-2 text-lg font-semibold text-foreground">
                  {to.bat && oTick(r)}
                  <div className="min-w-0">{cotChinh.render(r)}</div>
                </div>
                <dl className="space-y-2">
                  {cotThe.map((c) => (
                      <div
                        key={c.key}
                        className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2 last:border-0"
                      >
                        <dt className="text-sm text-muted-foreground">
                          {c.header}
                        </dt>
                        <dd
                          className={cn(
                            "min-w-0 text-right text-sm font-medium break-words",
                            c.so && "tnum"
                          )}
                        >
                          {c.render(r)}
                        </dd>
                      </div>
                    ))}
                </dl>
                {moRong.has(k) && cotAnThe.length > 0 && (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3">
                    {chiTiet(r, cotAnThe)}
                  </div>
                )}
                {(actions || cotAnThe.length > 0) && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {nutChiTiet(k, cotAnThe.length > 0)}
                    {actions?.(r)}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
          <ThanhToMau to={to} khoa={daTick} onBoChon={chonDong.boChon} />
        </>
      )}
    </div>
  );
}
