/**
 * Hai việc soát nằm NGOÀI chiều "hóa đơn ⇄ sổ kế toán" của `doiSoatHddt.ts`.
 *
 * 1. **So HAI BẢN hóa đơn điện tử với nhau** (`soHaiBanHddt`). Cơ quan thuế gửi một
 *    bảng kê, kế toán tự tải một bảng kê từ cổng hóa đơn điện tử — lẽ ra y hệt nhau,
 *    thực tế lệch. Thuế bắt kiểm tra lại thì phải chỉ ra ĐÍCH DANH hóa đơn nào chỉ
 *    có một bên, hóa đơn nào có cả hai mà số tiền khác nhau.
 *
 * 2. **Gom hóa đơn cùng MST người bán + cùng ngày** (`gomCungMstCungNgay`). Một nhà
 *    cung cấp xuất nhiều hóa đơn trong cùng một ngày thì hoặc là tách đơn thật, hoặc
 *    là hạch toán trùng. Máy không đoán thay được, chỉ lọc ra cho người soát.
 *
 * Cả hai đều là hàm THUẦN trên `SheetHoaDon[]` đã parse — không đọc file, không đụng
 * engine đối soát, nên bật/tắt không ảnh hưởng các phép tự kiểm đã verify.
 */
import type { DongHoaDon, SheetHoaDon } from "./doiSoatHddt";
import { boDau } from "./username";

const chuan = (s: unknown): string =>
  boDau(String(s ?? "")).toLowerCase().trim().replace(/[_\s]+/g, " ");

/** Sheet thuộc bản CƠ QUAN THUẾ gửi: tên sheet có chữ "thuế". */
export const laBenThue = (tenSheet: string): boolean => chuan(tenSheet).includes("thue");

// ---------- 1. So hai bản hóa đơn điện tử ----------

export type BenCo = "CA_HAI" | "CHI_THUE" | "CHI_TAI";

export interface DongSoBan {
  khoa: string;
  kyHieu: string;
  soHoaDon: string;
  ngayLap: string;
  mstBan: string;
  tenBan: string;
  ben: BenCo;
  /** Số tiền bên bản THUẾ gửi (null = bản thuế không có hóa đơn này). */
  chuaThueT: number | null;
  thueT: number | null;
  tongT: number | null;
  /** Số tiền bên bản TỰ TẢI. */
  chuaThueX: number | null;
  thueX: number | null;
  tongX: number | null;
  /** Chênh = bản thuế − bản tự tải (null nếu một bên không có). */
  chenhChuaThue: number | null;
  chenhThue: number | null;
  chenhTong: number | null;
  /** Có cả hai bên nhưng số tiền lệch quá ngưỡng. */
  lechTien: boolean;
  /** Một trong hai bên nằm ở dòng lệch bố cục ⇒ số tiền không đem so được. */
  khongSoDuocTien: boolean;
  viTriT: string;
  viTriX: string;
  ghiChu: string;
}

export interface KetQuaSoHaiBan {
  sheetThue: string[];
  sheetTai: string[];
  dong: DongSoBan[];
  tong: {
    soThue: number;
    soTai: number;
    caHai: number;
    chiThue: number;
    chiTai: number;
    lechTien: number;
    khongSoDuocTien: number;
    tienThue: number;
    tienTai: number;
    tienChiThue: number;
    tienChiTai: number;
    chenhTongTien: number;
  };
}

const viTri = (d: DongHoaDon): string => `${d.sheet} dòng ${d.dongFile}`;

/**
 * So bản THUẾ gửi với bản TỰ TẢI. Trả `null` nếu file không có đủ hai bên
 * (⇒ nơi gọi biết là không áp dụng chế độ này).
 *
 * Gộp TẤT CẢ sheet của mỗi bên rồi so theo khóa `MST | ký hiệu | số HĐ chuẩn` —
 * khỏi phải ghép đôi sheet theo tên (bản thuế hay gộp "có mã + không mã" vào một
 * sheet trong khi bản tự tải tách ra, ghép đôi theo tên là gãy).
 */
export function soHaiBanHddt(
  sheets: readonly SheetHoaDon[],
  nguong = 1
): KetQuaSoHaiBan | null {
  const benT = sheets.filter((s) => laBenThue(s.ten));
  const benX = sheets.filter((s) => !laBenThue(s.ten));
  if (!benT.length || !benX.length) return null;

  /** Gộp theo khóa: một khóa có thể xuất hiện nhiều dòng (hóa đơn bị kê hai lần). */
  const gom = (ds: readonly SheetHoaDon[]) => {
    const m = new Map<string, DongHoaDon[]>();
    for (const sh of ds)
      for (const d of sh.dong) {
        const a = m.get(d.khoa);
        if (a) a.push(d);
        else m.set(d.khoa, [d]);
      }
    return m;
  };
  const mT = gom(benT);
  const mX = gom(benX);

  const cong = (ds: DongHoaDon[] | undefined, lay: (d: DongHoaDon) => number) =>
    ds?.length ? ds.reduce((s, d) => s + lay(d), 0) : null;

  const dong: DongSoBan[] = [];
  for (const khoa of new Set([...mT.keys(), ...mX.keys()])) {
    const t = mT.get(khoa);
    const x = mX.get(khoa);
    const mau = (t ?? x)![0]!;
    const tongT = cong(t, (d) => d.tongTtVnd);
    const tongX = cong(x, (d) => d.tongTtVnd);
    const chenhTong = tongT != null && tongX != null ? tongT - tongX : null;
    const ben: BenCo = t && x ? "CA_HAI" : t ? "CHI_THUE" : "CHI_TAI";
    // Dòng lệch bố cục thì cột tiền đọc sai chỗ — so tiền là kết luận bừa.
    const khongSoDuocTien =
      ben === "CA_HAI" && [...(t ?? []), ...(x ?? [])].some((d) => d.boCucLech);
    const lechTien = !khongSoDuocTien && chenhTong != null && Math.abs(chenhTong) > nguong;
    dong.push({
      khoa,
      kyHieu: mau.kyHieu,
      soHoaDon: mau.soHoaDon,
      ngayLap: mau.ngayLap,
      mstBan: mau.mstBan,
      tenBan: mau.tenBan,
      ben,
      chuaThueT: cong(t, (d) => d.chuaThueVnd),
      thueT: cong(t, (d) => d.thueVnd),
      tongT,
      chuaThueX: cong(x, (d) => d.chuaThueVnd),
      thueX: cong(x, (d) => d.thueVnd),
      tongX,
      chenhChuaThue:
        t && x ? cong(t, (d) => d.chuaThueVnd)! - cong(x, (d) => d.chuaThueVnd)! : null,
      chenhThue: t && x ? cong(t, (d) => d.thueVnd)! - cong(x, (d) => d.thueVnd)! : null,
      chenhTong,
      lechTien,
      khongSoDuocTien,
      viTriT: t?.map(viTri).join("; ") ?? "",
      viTriX: x?.map(viTri).join("; ") ?? "",
      ghiChu: khongSoDuocTien
        ? "Có ở cả hai bản. KHÔNG so được số tiền: dòng bên bản tự tải nằm ở bố cục cột khác (sheet bị dán hai bản xuất vào làm một) nên cột tiền lệch ô. Tách sheet ra rồi chạy lại mới so được."
        : ben === "CHI_THUE"
          ? "CHỈ có ở bản cơ quan thuế gửi — bản tự tải THIẾU hóa đơn này. Tải lại từ cổng hóa đơn điện tử rồi kê bổ sung."
          : ben === "CHI_TAI"
            ? "CHỈ có ở bản tự tải — bản thuế gửi KHÔNG có. Kiểm tra lại: có thể tải nhầm kỳ, hoặc hóa đơn chưa lên hệ thống thuế."
            : lechTien
              ? `Có ở cả hai bản nhưng SỐ TIỀN LỆCH ${Math.round(chenhTong ?? 0).toLocaleString("vi-VN")} đ (thuế − tự tải). Đây là chỗ thuế bắt kiểm tra.`
              : (t?.length ?? 0) > 1 || (x?.length ?? 0) > 1
                ? "Khớp tiền, nhưng hóa đơn này xuất hiện NHIỀU DÒNG — xem cột vị trí, coi chừng kê hai lần."
                : "Khớp cả hai bản.",
    });
  }

  // Thiếu ở bản tự tải xếp lên trước — đó là việc phải đi làm ngay.
  const uuTien: Record<BenCo, number> = { CHI_THUE: 0, CHI_TAI: 1, CA_HAI: 2 };
  dong.sort(
    (a, b) =>
      uuTien[a.ben] - uuTien[b.ben] ||
      Number(b.lechTien) - Number(a.lechTien) ||
      Math.abs(b.chenhTong ?? 0) - Math.abs(a.chenhTong ?? 0) ||
      (b.tongT ?? b.tongX ?? 0) - (a.tongT ?? a.tongX ?? 0)
  );

  const loc = (b: BenCo) => dong.filter((d) => d.ben === b);
  const congTien = (ds: DongSoBan[], lay: (d: DongSoBan) => number | null) =>
    ds.reduce((s, d) => s + (lay(d) ?? 0), 0);

  return {
    sheetThue: benT.map((s) => s.ten),
    sheetTai: benX.map((s) => s.ten),
    dong,
    tong: {
      soThue: benT.reduce((s, sh) => s + sh.dong.length, 0),
      soTai: benX.reduce((s, sh) => s + sh.dong.length, 0),
      caHai: loc("CA_HAI").length,
      chiThue: loc("CHI_THUE").length,
      chiTai: loc("CHI_TAI").length,
      lechTien: dong.filter((d) => d.lechTien).length,
      khongSoDuocTien: dong.filter((d) => d.khongSoDuocTien).length,
      tienThue: congTien(dong, (d) => d.tongT),
      tienTai: congTien(dong, (d) => d.tongX),
      tienChiThue: congTien(loc("CHI_THUE"), (d) => d.tongT),
      tienChiTai: congTien(loc("CHI_TAI"), (d) => d.tongX),
      chenhTongTien: congTien(dong, (d) => d.tongT) - congTien(dong, (d) => d.tongX),
    },
  };
}

// ---------- 2. Hóa đơn cùng MST người bán + cùng ngày ----------

export interface DongCungNgay {
  sheet: string;
  dongFile: number;
  kyHieu: string;
  soHoaDon: string;
  tongTtVnd: number;
  ketLuan: string;
}

export interface NhomCungNgay {
  mstBan: string;
  tenBan: string;
  ngay: string;
  soHoaDon: number;
  tongTien: number;
  /** Trong nhóm có ≥2 hóa đơn TRÙNG KHÍT số tiền — dấu hiệu nghi trùng mạnh nhất. */
  trungSoTien: boolean;
  /** Mô tả các cụm trùng tiền, VD "2 hóa đơn cùng 1.200.000 đ". */
  moTaTrung: string;
  dong: DongCungNgay[];
}

/**
 * Gom hóa đơn theo **MST người bán + ngày lập**, chỉ giữ nhóm từ 2 hóa đơn trở lên.
 *
 * Nhiều hóa đơn cùng nhà cung cấp trong một ngày là chuyện bình thường (xăng dầu,
 * siêu thị…), nên KHÔNG kết luận là sai. Việc của hàm này là lọc ra để người soát
 * nhìn, và đánh dấu riêng nhóm có hóa đơn **trùng khít số tiền** — chỗ dễ kê hai lần nhất.
 */
export function gomCungMstCungNgay(sheets: readonly SheetHoaDon[]): NhomCungNgay[] {
  const m = new Map<string, { mst: string; ten: string; ngay: string; ds: DongHoaDon[] }>();
  for (const sh of sheets)
    for (const d of sh.dong) {
      const mst = chuan(d.mstBan);
      if (!mst || !d.ngayLap) continue;
      const k = `${mst}#${d.ngayLap}`;
      const o = m.get(k);
      if (o) o.ds.push(d);
      else m.set(k, { mst: d.mstBan, ten: d.tenBan, ngay: d.ngayLap, ds: [d] });
    }

  const ra: NhomCungNgay[] = [];
  for (const { mst, ten, ngay, ds } of m.values()) {
    if (ds.length < 2) continue;
    // cụm trùng khít số tiền trong cùng nhóm
    const theoTien = new Map<number, number>();
    for (const d of ds) theoTien.set(d.tongTtVnd, (theoTien.get(d.tongTtVnd) ?? 0) + 1);
    const trung = [...theoTien].filter(([, n]) => n > 1);
    ra.push({
      mstBan: mst,
      tenBan: ten,
      ngay,
      soHoaDon: ds.length,
      tongTien: ds.reduce((s, d) => s + d.tongTtVnd, 0),
      trungSoTien: trung.length > 0,
      moTaTrung: trung
        .map(([tien, n]) => `${n} hóa đơn cùng ${Math.round(tien).toLocaleString("vi-VN")} đ`)
        .join("; "),
      dong: ds.map((d) => ({
        sheet: d.sheet,
        dongFile: d.dongFile,
        kyHieu: d.kyHieu,
        soHoaDon: d.soHoaDon,
        tongTtVnd: d.tongTtVnd,
        ketLuan: d.ketLuan,
      })),
    });
  }

  // Nghi trùng tiền lên đầu, rồi tới nhóm đông hóa đơn / nhiều tiền.
  return ra.sort(
    (a, b) =>
      Number(b.trungSoTien) - Number(a.trungSoTien) ||
      b.soHoaDon - a.soHoaDon ||
      b.tongTien - a.tongTien
  );
}
