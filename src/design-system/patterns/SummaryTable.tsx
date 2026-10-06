// ============================================================
// Tên file cũ: src/design-system/patterns/BangTong.tsx
// Tên tiếng Việt: Bảng tổng hợp số liệu
// Description: Summary Table Pattern Component
// ============================================================
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
import { cn } from "@/lib/utils";
import { ThanhToMau } from "./ToMauDong";
import { useThanhCuonTren } from "./thanhCuonTren";
import { useChonDong, useToMau } from "./toMauNguon";

/**
 * Tick chọn dòng (tuỳ chọn). Bật lên thì BangTong thêm một cột ô tick ở đầu bảng;
 * màn hình tự giữ tập khóa đã chọn để cộng tổng / thao tác theo lô — như các phần
 * mềm kế toán kho (chọn vài dòng → xem tổng, gán kho, in riêng).
 */
export interface ChonBang<T = unknown> {
  /** Khóa (getKey) của các dòng đang tick. */
  daChon: Set<string>;
  /** Bật/tắt MỘT dòng. */
  doi: (key: string) => void;
  /** Bật/tắt TOÀN BỘ dòng đang hiện trong bảng này. */
  doiTatCa: (keys: string[], bat: boolean) => void;
  /** Nhãn a11y cho ô tick từng dòng (VD "2 DA 250UP"). */
  nhanDong?: (row: T) => string;
}

export interface CotTong<T> {
  key: string;
  header: string;
  /** Ô của một dòng. */
  render: (row: T) => React.ReactNode;
  /** Cột số → căn phải + có ô tổng ở chân. */
  so?: boolean;
  /** Nội dung ô tổng cột (thường là tổng số). Bỏ trống ⇒ ô tổng để rỗng. */
  tong?: (rows: T[]) => React.ReactNode;
}

/**
 * BangTong — bảng tổng hợp cho các trang Báo cáo. Cột số căn phải (`tnum`), có
 * hàng TỔNG CỘNG ở chân với con số tự cộng theo `tong` của từng cột.
 *
 * Chỉ hiển thị số đã tổng hợp sẵn (component cha lo gom nhóm) — không đọc/ghi dữ
 * liệu. Dùng chung cho báo cáo Nhập hàng, Bán hàng… để mọi bảng báo cáo cùng dáng.
 */
export function BangTong<T>({
  rows,
  cot,
  getKey,
  nhanTong = "Tổng cộng",
  emptyText = "Chưa có số liệu trong kỳ này.",
  className,
  chon,
  dinhDau,
  xoRa,
  dongThem,
  toMau,
}: {
  rows: T[];
  cot: CotTong<T>[];
  getKey: (row: T, i: number) => string;
  nhanTong?: string;
  emptyText?: string;
  className?: string;
  /** Bật cột ô tick để chọn dòng (cộng tổng / thao tác theo lô). */
  chon?: ChonBang<T>;
  /**
   * Giữ hàng tên cột dính trên cùng khi cuộn dọc. Bảng dài tự cuộn trong khung
   * cao tối đa ~70% màn hình (cần khung cuộn riêng vì bảng rộng đã cuộn ngang —
   * sticky theo trang không chạy xuyên qua khung cuộn ngang).
   */
  dinhDau?: boolean;
  /**
   * XỔ bảng ra (thay cho `dinhDau`): KHÔNG khung cuộn riêng — bảng dài trải hết,
   * trang cuộn một mạch. Hàng tên cột NỔI dính ngay dưới header trang khi cuộn
   * qua bảng; bảng rộng thì thanh cuộn ngang DÍNH ĐÁY màn hình (không phải cuộn
   * xuống tận đáy bảng mới kéo ngang được). Dùng cho sổ dài kế toán dò từng dòng.
   */
  xoRa?: boolean;
  /**
   * Tô màu dòng "đã dò" (lưu chung, mọi máy thấy): khoá ỔN ĐỊNH của bảng, VD
   * "ton-kho-thang". Bật ⇒ thêm nút tô ở đầu mỗi dòng. `getKey` phải là id bản
   * ghi (không dùng chỉ số dòng). Luật: README § Tô màu dòng.
   */
  toMau?: string;
  /**
   * Dòng THÊM MỚI cuối thân bảng (trước hàng tổng), trải hết bề ngang — VD ô gõ tên
   * hàng để ghi dòng mới ngay trên bảng. Có `dongThem` thì bảng rỗng vẫn hiện (để
   * còn chỗ thêm dòng đầu tiên).
   */
  dongThem?: React.ReactNode;
}) {
  const to = useToMau(toMau);
  // Tick dòng: màn truyền `chon` thì dùng của màn (màn tự đặt nút tô vào thanh
  // "Đã chọn" riêng); không thì bảng tự giữ + tự hiện thanh tô màu khi bật toMau.
  const chonTrong = useChonDong();
  const neoTick = React.useRef<string | null>(null);
  // Thanh cuộn ngang TRÊN đầu bảng (README § 5a) — vùng cuộn thật là table-container.
  const gocRef = React.useRef<HTMLDivElement>(null);
  const thanhTren = useThanhCuonTren(
    () => gocRef.current?.querySelector<HTMLElement>('[data-slot="table-container"]') ?? null
  );
  // Bảng rỗng không có dòng thêm thì không vẽ bảng ⇒ khỏi đo.
  const { bangRef, dauNoiRef, thanhRef, rongCot, rongBang, rongCuon, tran, hienDau } = useXoRa(
    Boolean(xoRa) && (rows.length > 0 || Boolean(dongThem))
  );

  if (rows.length === 0 && !dongThem) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  const coTong = cot.some((c) => c.tong);
  const khoa = rows.map((r, i) => getKey(r, i));
  const chonDung: ChonBang<T> | undefined =
    chon ??
    (to.bat
      ? { daChon: chonTrong.daChon as Set<string>, doi: (k) => chonTrong.doi(k), doiTatCa: chonTrong.doiTatCa }
      : undefined);
  const daTick = chonDung ? khoa.filter((k) => chonDung.daChon.has(k)) : [];
  const chonHet = daTick.length > 0 && daTick.length === khoa.length;
  /** Bấm ô tick; Shift ⇒ cả khoảng từ dòng bấm trước (như Shift+bấm ở Excel). */
  const bamTick = (k: string, shift: boolean) => {
    if (!chonDung) return;
    const a = neoTick.current ? khoa.indexOf(neoTick.current) : -1;
    const b = khoa.indexOf(k);
    if (shift && a >= 0 && b >= 0) {
      chonDung.doiTatCa(khoa.slice(Math.min(a, b), Math.max(a, b) + 1), !chonDung.daChon.has(k));
    } else chonDung.doi(k);
    neoTick.current = k;
  };

  const coCotDau = Boolean(chonDung);
  const soCot = cot.length + (coCotDau ? 1 : 0);
  /* Chữ "Cộng …" ở dòng tổng trải qua cột đầu dòng + các cột đầu KHÔNG có tổng —
     để trong một ô riêng thì chữ dài ("Cộng Nguyên liệu mua ngoài") đẩy cột đầu
     (VD Ngày nhập) rộng gấp rưỡi, cả bảng phải kéo ngang thêm. */
  const kTongDau = Math.max(0, cot.findIndex((c) => c.tong));
  const soCotNhan = cot.some((c) => c.tong) ? kTongDau : cot.length;

  /** Hàng tên cột — vẽ ở bảng thật và (chế độ xoRa) ở hàng tên cột nổi. */
  const hangDau = (noi: boolean) => (
    <TableRow>
      {chonDung && (
        <TableHead className="w-10">
          <input
            type="checkbox"
            className="size-5"
            checked={chonHet}
            tabIndex={noi ? -1 : undefined}
            onChange={() => chonDung.doiTatCa(khoa, !chonHet)}
            aria-label={chonHet ? "Bỏ chọn tất cả dòng" : "Chọn tất cả dòng"}
            title={chonHet ? "Bỏ tick mọi dòng của bảng này." : "Tick mọi dòng của bảng này (để tô màu / in đậm / in / xử lý cùng lúc)."}
          />
        </TableHead>
      )}
      {/* Tên cột XUỐNG DÒNG ("Nhập trong kỳ (kg)" thành 2 dòng): cột số rộng theo
          con số, không theo tên cột dài — bớt kéo ngang. */}
      {cot.map((c) => (
        <TableHead key={c.key} className={cn("leading-tight whitespace-normal", c.so && "text-right")}>
          {c.header}
        </TableHead>
      ))}
    </TableRow>
  );

  return (
    <>
    <div
      ref={gocRef}
      className={cn(
        // xoRa: gốc KHÔNG được là khung cuộn (sticky của hàng tên cột nổi và thanh
        // cuộn đáy bám theo khung cuộn của trang); cuộn ngang do khung của primitive.
        xoRa ? "bang-xo-ra relative" : dinhDau ? "bang-dinh-dau" : "scroll-nice-x overflow-x-auto",
        className
      )}
    >
      {thanhTren}
      {xoRa && (
        // Hàng tên cột NỔI: hộp cao 0 dính dưới header trang (h-16 ở AppShell —
        // đổi chiều cao header thì đổi cả top-16 này). Chỉ hiện khi hàng tên cột
        // thật đã trôi khỏi tầm nhìn mà bảng vẫn còn trên màn.
        <div className="pointer-events-none sticky top-16 z-20 h-0 print:hidden" aria-hidden>
          <div
            ref={dauNoiRef}
            className={cn(
              "overflow-hidden bg-card shadow-sm ring-1 ring-border",
              hienDau ? "pointer-events-auto visible" : "invisible"
            )}
          >
            <table
              className="caption-bottom text-sm"
              style={{ width: rongBang || undefined, tableLayout: "fixed" }}
            >
              <colgroup>
                {rongCot.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <TableHeader>{hangDau(true)}</TableHeader>
            </table>
          </div>
        </div>
      )}
      <Table ref={bangRef}>
        <TableHeader>{hangDau(false)}</TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const k = getKey(r, i);
            const tick = !!chonDung?.daChon.has(k);
            return (
              <TableRow
                key={k}
                data-chon={tick || undefined}
                className={cn(tick && "bg-primary/5")}
                {...to.thuocTinh(k)}
              >
                {chonDung && (
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={tick}
                      onChange={() => {}}
                      onClick={(e) => bamTick(k, e.shiftKey)}
                      aria-label={`Chọn dòng ${chon?.nhanDong ? chon.nhanDong(r) : k}`}
                    />
                  </TableCell>
                )}
                {cot.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(c.so && "text-right tnum")}
                  >
                    {c.render(r)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {dongThem && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={soCot} className="bg-muted/30">
                {dongThem}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {coTong && (
          <TableFooter>
            <TableRow>
              {(coCotDau ? 1 : 0) + soCotNhan > 0 && (
                <TableCell colSpan={(coCotDau ? 1 : 0) + soCotNhan} className="font-bold whitespace-normal">
                  {nhanTong}
                </TableCell>
              )}
              {cot.slice(soCotNhan).map((c) => (
                <TableCell
                  key={c.key}
                  className={cn("font-bold", c.so && "text-right tnum")}
                >
                  {c.tong ? c.tong(rows) : null}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
      {xoRa && tran && (
        // Thanh cuộn ngang DÍNH ĐÁY màn hình, đồng bộ hai chiều với bảng.
        <div
          ref={thanhRef}
          className="bang-thanh-cuon sticky bottom-0 z-20 bg-background/90 py-1 print:hidden"
          aria-hidden
        >
          <div style={{ width: rongCuon, height: 1 }} />
        </div>
      )}
    </div>
    {/* Thanh tô màu cho dòng đang tick — chỉ khi BẢNG tự giữ tick (màn có `chon`
        riêng thì tự đặt NutToMauChon vào thanh "Đã chọn" của màn). */}
    {!chon && (
      <ThanhToMau
        to={to}
        khoa={daTick}
        onBoChon={chonTrong.boChon}
        className={xoRa ? "bottom-8" : undefined}
      />
    )}
    </>
  );
}

/**
 * Máy đo cho chế độ `xoRa`: bề rộng từng cột (để hàng tên cột nổi khớp cột thật),
 * bảng có tràn ngang không, đồng bộ cuộn ngang bảng ⇄ hàng tên cột nổi ⇄ thanh
 * cuộn dính đáy, và lúc nào hiện hàng tên cột nổi.
 */
function useXoRa(bat: boolean) {
  const bangRef = React.useRef<HTMLTableElement>(null);
  const dauNoiRef = React.useRef<HTMLDivElement>(null);
  const thanhRef = React.useRef<HTMLDivElement>(null);
  const [rongCot, setRongCot] = React.useState<number[]>([]);
  const [rongBang, setRongBang] = React.useState(0);
  const [rongCuon, setRongCuon] = React.useState(0);
  const [tran, setTran] = React.useState(false);
  const [hienDau, setHienDau] = React.useState(false);

  // Đo cột + tràn ngang mỗi khi bảng / khung đổi cỡ (gõ số, đổi cỡ chữ, thu thanh bên…).
  React.useLayoutEffect(() => {
    if (!bat) return;
    const bang = bangRef.current;
    const khung = bang?.parentElement; // div[data-slot=table-container] của primitive
    if (!bang || !khung) return;
    const do_ = () => {
      const o = bang.tHead?.rows[0]?.cells;
      const ws = o ? Array.from(o, (c) => c.getBoundingClientRect().width) : [];
      setRongCot((cu) => (cu.length === ws.length && cu.every((w, i) => Math.abs(w - ws[i]) < 0.5) ? cu : ws));
      setRongBang(bang.getBoundingClientRect().width);
      setRongCuon(khung.scrollWidth);
      setTran(khung.scrollWidth > khung.clientWidth + 1);
    };
    do_();
    const ro = new ResizeObserver(do_);
    ro.observe(bang);
    ro.observe(khung);
    for (const c of Array.from(bang.tHead?.rows[0]?.cells ?? [])) ro.observe(c);
    return () => ro.disconnect();
  }, [bat]);

  // Đồng bộ cuộn ngang ba phía. Gán scrollLeft bằng giá trị đang có thì trình
  // duyệt không bắn sự kiện ⇒ không vòng lặp.
  React.useEffect(() => {
    if (!bat) return;
    const khung = bangRef.current?.parentElement;
    if (!khung) return;
    const theoBang = () => {
      if (dauNoiRef.current) dauNoiRef.current.scrollLeft = khung.scrollLeft;
      if (thanhRef.current) thanhRef.current.scrollLeft = khung.scrollLeft;
    };
    const theoThanh = () => {
      if (thanhRef.current) khung.scrollLeft = thanhRef.current.scrollLeft;
    };
    const thanh = thanhRef.current;
    khung.addEventListener("scroll", theoBang, { passive: true });
    thanh?.addEventListener("scroll", theoThanh, { passive: true });
    theoBang();
    return () => {
      khung.removeEventListener("scroll", theoBang);
      thanh?.removeEventListener("scroll", theoThanh);
    };
  }, [bat, tran]);

  // Hiện hàng tên cột nổi khi hàng thật đã trôi lên dưới header trang và bảng
  // còn đủ cao bên dưới (gần đáy bảng thì ẩn để khỏi đè dòng tổng).
  React.useEffect(() => {
    if (!bat) return;
    const tinh = () => {
      const bang = bangRef.current;
      const dau = bang?.tHead;
      if (!bang || !dau) return;
      const dinh = dauNoiRef.current?.parentElement?.getBoundingClientRect().top ?? 64;
      const r = bang.getBoundingClientRect();
      const cao = dau.getBoundingClientRect().height;
      setHienDau(r.top < dinh - 1 && r.bottom > dinh + cao * 2);
    };
    tinh();
    // capture: bắt cuộn của MỌI khung (cột nội dung desktop cuộn riêng, điện thoại cuộn trang).
    document.addEventListener("scroll", tinh, { capture: true, passive: true });
    window.addEventListener("resize", tinh);
    return () => {
      document.removeEventListener("scroll", tinh, { capture: true });
      window.removeEventListener("resize", tinh);
    };
  }, [bat]);

  return { bangRef, dauNoiRef, thanhRef, rongCot, rongBang, rongCuon, tran, hienDau };
}
