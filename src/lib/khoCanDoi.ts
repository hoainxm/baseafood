// ============================================================
// Tên file: src/lib/khoCanDoi.ts
// Tên tiếng Việt: Hai dòng kho của Cân đối ⇄ Sổ kho theo tháng (hàm thuần)
// Description: Balancing stock rows (draw-from-lot / send-to-freezer) ⇄ monthly stock ledger
// ============================================================
import type { BalancingInputItem, MonthlyStockLine } from "@/types";
import { loaiDongKho } from "@/lib/balancingGrid";
import { donKyVaoSo, suyDong, thangSau, type MonthlyStockRow } from "@/lib/monthlyStock";
import { num, viDate } from "@/lib/format";

/**
 * VÌ SAO — khối NL ở Cân đối có hai dòng kho (chốt 2026-10-06):
 *   - LẤY XẢ ĐÔNG: lấy NL đông ra chế biến từ một LÔ chọn ĐÍCH DANH (dòng của Sổ kho
 *     tháng: kho · tên · invoice). Kg của tháng ghi vào cột XUẤT của đúng lô đó.
 *   - GỬI ĐÔNG: NL không chế biến, cất kho. Mỗi NGÀY GỬI là MỘT LÔ RIÊNG trong sổ (nhóm
 *     "Nguyên liệu gửi đông", invoice `GĐ-yyyymmdd`, ngày nhập = ngày gửi) — tách khỏi
 *     lô nhập khẩu / mua ngoài cho khỏi nhầm, truy ngược được về kỳ cân đối.
 *
 * MỘT nơi giữ số kho: Sổ kho tháng. Cân đối ghi theo kiểu ĐẶT GIÁ TRỊ (không cộng dồn
 * theo phím gõ) nên chạy lại bao nhiêu lần cũng ra cùng kết quả:
 *   - Lấy xả đông: phần của MỖI dòng cân đối trong một lô-tháng được ghi thành một dòng
 *     vết trong ghi chú lô `⟦CĐ:<id dòng>:<kg>⟧ …`. Đặt lại ⇒ đọc phần cũ từ vết, cột
 *     xuất cộng phần CHÊNH, vết đổi theo. Ai đọc sổ kho cũng thấy kg nào do cân đối lấy.
 *   - Gửi đông: dòng sổ id `cd|<id dòng>|<ngày>` THUỘC dòng cân đối ⇒ đặt thẳng `inKg`.
 * Xoá dòng / xoá kỳ = đặt mọi phần về 0 ⇒ sổ kho trả lại đúng như trước.
 *
 * Tháng chưa mở (chưa có dòng nào) ⇒ tự KẾ THỪA tồn cuối tháng gần nhất trước đó, từng
 * tháng một — đúng nút "Kế thừa & lưu vào sổ" của màn Sổ kho tháng (chốt với người dùng).
 */

export const NHOM_GUI_DONG = "Nguyên liệu gửi đông";
/** Sổ kho mặc định khi vị trí gửi là kho ngoài chưa từng xuất hiện trong sổ. */
export const SO_KHO_MAC_DINH = "Kho 1500 tấn";

export const thangCuaNgay = (iso: string) => iso.slice(0, 7);

/** "<sổ kho>|<vị trí>" ⇄ cặp (warehouse, storageLocation) của dòng sổ kho. */
export function tachKhoGui(v: string): { warehouse: string; storageLocation: string } {
  const i = v.indexOf("|");
  if (i < 0) return { warehouse: v, storageLocation: "" };
  return { warehouse: v.slice(0, i), storageLocation: v.slice(i + 1) };
}
export const ghepKhoGui = (warehouse: string, storageLocation: string) =>
  `${warehouse}|${storageLocation}`;

/** Tên ngắn của nơi để hàng: vị trí nếu có, không thì sổ kho; bỏ chữ "Kho " đầu. */
export const viTriNgan = (l: Pick<MonthlyStockLine, "warehouse" | "storageLocation">) =>
  (l.storageLocation || l.warehouse).replace(/^Kho\s+/i, "");

/* ---------- Tháng của sổ ---------- */

/**
 * Bảo đảm tháng `thang` đã MỞ: chưa có dòng nào thì kế thừa tồn cuối từ tháng gần nhất
 * TRƯỚC đó có dòng, dồn qua từng tháng (tối đa 24) — id `carry|…` tất định nên chạy lại
 * không nhân đôi. Tháng đã có dòng (dù một) thì để nguyên: dồn lúc đó dễ cộng đôi.
 */
export function damBaoThang(
  lines: MonthlyStockLine[],
  month: string
): { lines: MonthlyStockLine[]; keThua: number } {
  if (lines.some((l) => l.period === month)) return { lines, keThua: 0 };
  const prevRows = [...new Set(lines.map((l) => l.period))].filter((p) => p < month).sort();
  const tu = prevRows[prevRows.length - 1];
  if (!tu) return { lines, keThua: 0 };
  let ds = lines;
  let keThua = 0;
  let source = tu;
  for (let i = 0; i < 24 && source < month; i++) {
    const nextMonth = thangSau(source);
    if (!ds.some((l) => l.period === nextMonth)) {
      // Cùng hàm ghi dồn kỳ của màn Sổ kho tháng (không thay cả dòng đã có).
      const kq = donKyVaoSo(ds, nextMonth);
      ds = kq.lines;
      keThua += kq.soDong;
    }
    source = nextMonth;
  }
  return { lines: ds, keThua };
}

/**
 * Dòng sổ của LÔ `loId` trong tháng `thang`: chính nó nếu cùng tháng, tháng sau theo
 * chuỗi dồn kỳ `carry|<id>` (id dồn tất định). Không có ⇒ null (lô đã hết, chưa dồn).
 */
export function dongLoTheoThang(
  lines: MonthlyStockLine[],
  loId: string,
  month: string
): MonthlyStockLine | null {
  const goc = lines.find((l) => l.id === loId);
  if (!goc || goc.period > month) return null;
  let id = loId;
  let p = goc.period;
  while (p < month) {
    id = `carry|${id}`;
    p = thangSau(p);
  }
  return lines.find((l) => l.id === id && l.period === month) ?? null;
}

/* ---------- Vết của cân đối trong ghi chú lô ---------- */

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reVet = (rowId: string) => new RegExp(`⟦CĐ:${escapeRegex(rowId)}:(-?[0-9.]+)⟧[^\\n]*`);

/** Phần kg dòng cân đối `rowId` đang ghi vào lô (đọc từ vết trong ghi chú). */
export function phanCanDoiTrongLo(l: Pick<MonthlyStockLine, "note">, rowId: string): number {
  const m = (l.note ?? "").match(reVet(rowId));
  return m ? Number(m[1]) || 0 : 0;
}

/** Đặt dòng vết của `rowId` trong ghi chú (thay dòng cũ / thêm mới / gỡ khi 0 kg). */
function appendTrace(note: string, rowId: string, kg: number, chu: string): string {
  const dongs = (note ?? "").split("\n").filter((d) => d.length > 0 && !reVet(rowId).test(d));
  if (Math.abs(kg) > 1e-9) dongs.push(`⟦CĐ:${rowId}:${+kg.toFixed(3)}⟧ ${chu}`);
  return dongs.join("\n");
}

/* ---------- Phần của một dòng cân đối trong sổ ---------- */

/** Lấy xả đông: kg theo THÁNG (Σ các ngày của tháng). */
function thawByMonth(r: BalancingInputItem): Map<string, number> {
  const m = new Map<string, number>();
  for (const [iso, v] of Object.entries(r.dailyQuantities ?? {})) {
    if (!v) continue;
    const t = thangCuaNgay(iso);
    m.set(t, (m.get(t) ?? 0) + Math.abs(v));
  }
  return m;
}

/** Gửi đông: kg theo NGÀY (lưu âm như dòng giảm ⇒ lấy trị tuyệt đối). */
function freezeDepositByDay(r: BalancingInputItem): Map<string, number> {
  const m = new Map<string, number>();
  for (const [iso, v] of Object.entries(r.dailyQuantities ?? {})) if (v) m.set(iso, Math.abs(v));
  return m;
}

export const idDongGui = (rowId: string, date: string) => `cd|${rowId}|${date}`;

export interface NguCanhKy {
  /** Nhãn kỳ để ghi vết, VD "Bạch tuộc 2 da 01/10/2026 – 05/10/2026". */
  nhanKy: string;
  /** Tên HỌ nguyên liệu của kỳ — tên lô gửi đông trong sổ. */
  hoNL: string;
}

export interface KetQuaDongBo {
  lines: MonthlyStockLine[];
  /** Có đổi gì trong sổ không (khỏi ghi thừa). */
  doi: boolean;
  /** Lỗi chặn ghi (VD vượt tồn lô, chưa chọn lô) — có lỗi thì KHÔNG ghi gì. */
  loi: string | null;
  /** Số dòng sổ tự kế thừa sang tháng chưa mở. */
  keThua: number;
}

/**
 * Đồng bộ phần kho của các dòng cân đối `truoc` → `sau` vào Sổ kho tháng. Dòng chỉ có
 * ở `truoc` (bị xoá) ⇒ đặt mọi phần về 0. ĐẶT GIÁ TRỊ ⇒ gọi lại với cùng `sau` không đổi
 * gì; truyền `truoc = []` để GHI LẠI toàn bộ (sửa lệch sau khi sổ bị nạp đè).
 */
export function dongBoSoKho(
  lines: MonthlyStockLine[],
  prevRows: BalancingInputItem[],
  after: BalancingInputItem[],
  ctx: NguCanhKy
): KetQuaDongBo {
  const isStockLine = (r: BalancingInputItem) => loaiDongKho(r) != null;
  const prev = new Map(prevRows.filter(isStockLine).map((r) => [r.id, r]));
  const nextById = new Map(after.filter(isStockLine).map((r) => [r.id, r]));
  let ds = lines;
  let keThua = 0;
  let doi = false;

  const ensureMonth = (t: string) => {
    const kq = damBaoThang(ds, t);
    if (kq.keThua) {
      ds = kq.lines;
      keThua += kq.keThua;
      doi = true;
    }
  };

  /** Hai bảng phần (tháng/ngày → kg) có khác nhau không. */
  const khac = (x: Map<string, number>, y: Map<string, number>) =>
    [...new Set([...x.keys(), ...y.keys()])].some((k) => (x.get(k) ?? 0) !== (y.get(k) ?? 0));

  for (const id of new Set([...prev.keys(), ...nextById.keys()])) {
    const a = prev.get(id);
    const b = nextById.get(id);
    const lineKind = loaiDongKho((b ?? a)!);

    if (lineKind === "lay-xa-dong") {
      const prevStockLineId = a?.stockLineId ?? "";
      const nextStockLineId = b?.stockLineId ?? "";
      const oldParts = a ? thawByMonth(a) : new Map<string, number>();
      const newParts = b ? thawByMonth(b) : new Map<string, number>();
      /* Cặp (lô, tháng) cần ĐẶT: lô cũ ⇒ đặt 0 nếu đổi lô; lô mới ⇒ đặt số mới. */
      const can: { lo: string; thang: string; kg: number }[] = [];
      if (prevStockLineId && prevStockLineId !== nextStockLineId) for (const t of oldParts.keys()) can.push({ lo: prevStockLineId, thang: t, kg: 0 });
      if (nextStockLineId) {
        for (const t of new Set([...newParts.keys(), ...(prevStockLineId === nextStockLineId ? oldParts.keys() : [])])) {
          const kg = newParts.get(t) ?? 0;
          /* Cùng lô, tháng không đổi ⇒ bỏ qua (khỏi tự mở tháng khi sửa ô khác). */
          if (a && prevStockLineId === nextStockLineId && (oldParts.get(t) ?? 0) === kg) continue;
          can.push({ lo: nextStockLineId, thang: t, kg });
        }
      } else if (khac(oldParts, newParts) && [...newParts.values()].some((v) => v > 0)) {
        /* Chỉ chặn khi CHÍNH dòng này đổi số — dòng cũ có số mà chưa chọn lô (ghi trước khi
           nối sổ kho) không được làm kẹt mọi lần ghi khác của khối NL. */
        return { lines, doi: false, keThua: 0, loi: "Chọn lô (kho · invoice) trước khi ghi số Lấy xả đông." };
      }
      /* Tháng SỚM trước: tháng sau mở bằng kế thừa tồn cuối tháng trước ⇒ phải ghi xuất
         tháng trước xong mới mở, không thì tồn đầu tháng sau đông băng số cũ. */
      can.sort((x, y) => x.thang.localeCompare(y.thang) || (x.kg === 0 ? -1 : 1));
      for (const c of can) {
        ensureMonth(c.thang);
        const dong = dongLoTheoThang(ds, c.lo, c.thang);
        if (!dong) {
          if (c.kg === 0) continue; // lô không còn ở tháng đó — không có gì để trả
          return {
            lines,
            doi: false,
            keThua: 0,
            loi: `Lô đã chọn không còn trong sổ kho ${c.thang.slice(5)}/${c.thang.slice(0, 4)} — chọn lô khác.`,
          };
        }
        const existing = phanCanDoiTrongLo(dong, id);
        const chenh = c.kg - existing;
        if (Math.abs(chenh) < 1e-9) continue;
        const outKg = dong.outKg + chenh;
        const stock = dong.openKg + dong.inKg - outKg;
        if (stock < -1e-6) {
          return {
            lines,
            doi: false,
            keThua: 0,
            loi: `Lô ${viTriNgan(dong)} · ${dong.itemName}${dong.origin ? ` · ${dong.origin}` : ""} chỉ còn ${num(
              dong.openKg + dong.inKg - dong.outKg + existing
            )} kg — không lấy được ${num(c.kg)} kg.`,
          };
        }
        const updatedLine: MonthlyStockLine = {
          ...dong,
          outKg,
          outCtn: dong.outCtn + (dong.kgPerCtn ? chenh / dong.kgPerCtn : 0),
          note: appendTrace(dong.note, id, c.kg, `Cân đối ${ctx.nhanKy}: lấy xả đông ${num(c.kg)} kg`),
        };
        ds = ds.map((l) => (l.id === dong.id ? updatedLine : l));
        doi = true;
      }
      continue;
    }

    if (lineKind === "gui-dong") {
      const oldParts = a ? freezeDepositByDay(a) : new Map<string, number>();
      const newParts = b ? freezeDepositByDay(b) : new Map<string, number>();
      const newLocation = b?.stockLocation ?? "";
      if (!newLocation) {
        if (b && khac(oldParts, newParts) && [...newParts.values()].some((v) => v > 0))
          return { lines, doi: false, keThua: 0, loi: "Chọn kho gửi trước khi ghi số Gửi đông." };
        if (b) continue; // chưa chọn kho: chưa có gì trong sổ để đặt
      }
      const { warehouse, storageLocation } = tachKhoGui(newLocation);
      for (const date of [...new Set([...oldParts.keys(), ...newParts.keys()])].sort()) {
        const kg = newParts.get(date) ?? 0;
        if (
          a &&
          b &&
          (oldParts.get(date) ?? 0) === kg &&
          a.stockLocation === b.stockLocation &&
          a.unitPrice === b.unitPrice
        )
          continue; // ngày này không đổi gì
        const did = idDongGui(id, date);
        const coSan = ds.find((l) => l.id === did);
        if (kg === 0) {
          if (coSan) {
            ds = ds.filter((l) => l.id !== did);
            doi = true;
          }
          continue;
        }
        const month = thangCuaNgay(date);
        ensureMonth(month);
        const dong: MonthlyStockLine = {
          id: did,
          period: month,
          category: NHOM_GUI_DONG,
          warehouse,
          itemName: ctx.hoNL,
          size: "",
          origin: `GĐ-${date.replace(/-/g, "")}`,
          importDate: date,
          storageLocation,
          kgPerCtn: coSan?.kgPerCtn ?? null,
          unitPrice: b?.unitPrice ?? null,
          openCtn: 0,
          openKg: 0,
          inCtn: coSan?.kgPerCtn ? kg / coSan.kgPerCtn : 0,
          inKg: kg,
          outCtn: coSan?.outCtn ?? 0,
          outKg: coSan?.outKg ?? 0,
          carriedFromId: "",
          sortOrder: coSan?.sortOrder ?? 9000,
          /* Giữ các dòng vết ⟦CĐ:…⟧ của dòng LẤY từ chính lô gửi này (cùng tháng). */
          note: [
            `Gửi đông từ cân đối ${ctx.nhanKy} — ngày gửi ${viDate(date)}`,
            ...(coSan?.note ?? "").split("\n").filter((d) => d.startsWith("⟦CĐ:")),
          ].join("\n"),
        };
        const giong =
          coSan &&
          coSan.inKg === dong.inKg &&
          coSan.warehouse === dong.warehouse &&
          coSan.storageLocation === dong.storageLocation &&
          coSan.unitPrice === dong.unitPrice &&
          coSan.itemName === dong.itemName &&
          coSan.note === dong.note;
        if (giong) continue;
        ds = coSan ? ds.map((l) => (l.id === did ? dong : l)) : [...ds, dong];
        doi = true;
      }
    }
  }
  return { lines: ds, doi, loi: null, keThua };
}

/* ---------- Kiểm khớp Cân đối ⇄ sổ kho ---------- */

/**
 * Số chỗ sổ kho KHÔNG khớp phần kho của các dòng cân đối (VD sổ tháng bị nạp lại Excel
 * đè mất cột xuất). = số thay đổi mà `dongBoSoKho(lines, [], rows)` sẽ phải ghi.
 */
export function soChoLechSoKho(
  lines: MonthlyStockLine[],
  rows: BalancingInputItem[]
): number {
  let lech = 0;
  for (const r of rows) {
    const lineKind = loaiDongKho(r);
    if (lineKind === "lay-xa-dong" && r.stockLineId) {
      for (const [t, kg] of thawByMonth(r)) {
        const dong = dongLoTheoThang(lines, r.stockLineId, t);
        if (!dong || Math.abs(phanCanDoiTrongLo(dong, r.id) - kg) > 1e-6) lech++;
      }
    } else if (lineKind === "gui-dong" && r.stockLocation) {
      for (const [date, kg] of freezeDepositByDay(r)) {
        const dong = lines.find((l) => l.id === idDongGui(r.id, date));
        if (!dong || Math.abs(dong.inKg - kg) > 1e-6) lech++;
      }
    }
  }
  return lech;
}

/* ---------- Danh sách chọn ---------- */

/** Chuẩn hoá tên để so: bỏ dấu, "B." → "bach", chỉ giữ chữ số. */
export function chuanTenHang(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\bb\.\s*/g, "bach ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Độ khớp tên lô với họ NL của kỳ: số từ của họ có mặt trong tên lô. */
export function diemKhopTen(itemName: string, materialFamily: string): number {
  const tu = new Set(chuanTenHang(itemName).split(" "));
  return chuanTenHang(materialFamily)
    .split(" ")
    .filter((w) => w && tu.has(w)).length;
}

export interface LuaChonLo {
  value: string;
  label: string;
  phu: string;
  /** Tồn cuối hiện tại của lô (đã gồm phần cân đối đã lấy). */
  ton: number;
  /** Đơn giá của lô — gợi ý đơn giá dòng Lấy xả đông. */
  gia: number | null;
}

/**
 * Lô để chọn LẤY XẢ ĐÔNG trong tháng `thang` (tháng chưa mở ⇒ xem trước phần kế thừa,
 * id `carry|…` tất định nên chọn trước, ghi sau vẫn trúng). Chỉ lô còn tồn (+ lô đang
 * chọn). Lô trùng tên họ NL của kỳ lên đầu.
 */
export function danhSachLo(
  lines: MonthlyStockLine[],
  month: string,
  materialFamily: string,
  selected: string[] = []
): LuaChonLo[] {
  const { lines: ds } = damBaoThang(lines, month);
  const giu = new Set(selected);
  return ds
    .filter((l) => l.period === month)
    .map((l): MonthlyStockRow => suyDong(l))
    .filter((r) => r.closeKg > 1e-9 || giu.has(r.id))
    .sort(
      (a, b) =>
        diemKhopTen(b.itemName, materialFamily) - diemKhopTen(a.itemName, materialFamily) ||
        viTriNgan(a).localeCompare(viTriNgan(b), "vi") ||
        a.itemName.localeCompare(b.itemName, "vi") ||
        (a.importDate || "").localeCompare(b.importDate || "")
    )
    .map((r) => ({
      value: r.id,
      label: `${viTriNgan(r)} · ${r.itemName}${r.size ? ` ${r.size}` : ""}${r.origin ? ` · ${r.origin}` : ""}`,
      phu: `còn ${num(r.closeKg)} kg${r.importDate ? ` · nhập ${viDate(r.importDate)}` : ""}`,
      ton: r.closeKg,
      gia: r.unitPrice,
    }));
}

/**
 * Kho để chọn GỬI ĐÔNG: kho xí nghiệp (sổ riêng) + nơi để hàng (danh mục kho lưu và vị
 * trí đã dùng trong sổ). Kho ngoài ghi vào sổ kho đang quản lý nó nhiều nhất.
 */
export function danhSachKhoGui(
  lines: MonthlyStockLine[],
  plantWarehouses: string[],
  storageLocations: string[]
): { value: string; label: string; phu?: string }[] {
  const qtyByLocation = new Map<string, Map<string, number>>();
  for (const l of lines) {
    if (!l.storageLocation) continue;
    const m = qtyByLocation.get(l.storageLocation) ?? new Map<string, number>();
    m.set(l.warehouse, (m.get(l.warehouse) ?? 0) + 1);
    qtyByLocation.set(l.storageLocation, m);
  }
  const soChinh = (vt: string) => {
    const m = qtyByLocation.get(vt);
    if (!m) return SO_KHO_MAC_DINH;
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  const ra: { value: string; label: string; phu?: string }[] = [];
  const existing = new Set<string>();
  for (const k of plantWarehouses) {
    if (existing.has(k)) continue;
    existing.add(k);
    ra.push({ value: ghepKhoGui(k, ""), label: k });
  }
  for (const vt of [...storageLocations, ...qtyByLocation.keys()]) {
    if (!vt || existing.has(vt)) continue;
    existing.add(vt);
    const so = soChinh(vt);
    ra.push({ value: ghepKhoGui(so, vt), label: vt, phu: `sổ ${so}` });
  }
  return ra;
}
