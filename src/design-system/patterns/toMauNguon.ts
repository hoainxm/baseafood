// ============================================================
// Tên file: src/design-system/patterns/toMauNguon.ts
// Tên tiếng Việt: Tô màu dòng — hợp đồng dữ liệu + hook (không phải component)
// Description: Row highlight context, palette, hooks (components in ToMauDong.tsx)
// ============================================================
import * as React from "react";
import { notify } from "./notify";

/*
 * MỘT cách dùng, giống Excel: tick các dòng → thanh "Đã chọn N dòng" → Tô màu ▾ /
 * In đậm / Bỏ tô áp cho mọi dòng đang tick. Design-system CHỈ định nghĩa hợp đồng
 * `NguonToMau`; đọc/ghi dấu do app cấp qua `ToMauContext` — provider ở
 * `features/shared/ToMauProvider.tsx` nối bảng `row_marks`. Luật: README § Tô màu dòng.
 */

/* ---------- Bảng màu kiểu Excel: 10 sắc × 5 mức (1 rất nhạt → 5 rất đậm) ----------
   Mã lưu DB = "<sắc>-<mức>" (VD "vang-5"). Màu thật ở token `--to-<mã>` (tokens.css).
   Khớp `SAC_TO_LIB` ở lib/toMau.ts — test toMauNguon.test.ts canh. */
export const SAC_TO = [
  { ma: "xam", nhan: "xám" },
  { ma: "do", nhan: "đỏ" },
  { ma: "cam", nhan: "cam" },
  { ma: "vang", nhan: "vàng" },
  { ma: "chuoi", nhan: "xanh nõn chuối" },
  { ma: "la", nhan: "xanh lá" },
  { ma: "troi", nhan: "xanh da trời" },
  { ma: "duong", nhan: "xanh dương" },
  { ma: "tim", nhan: "tím" },
  { ma: "hong", nhan: "hồng" },
] as const;
export const MUC_TO = ["rất nhạt", "nhạt", "vừa", "đậm", "rất đậm"] as const;

export type SacTo = (typeof SAC_TO)[number]["ma"];
export type MauTo = `${SacTo}-${1 | 2 | 3 | 4 | 5}`;

/** Ô nền "tối" (độ chói < 0,68) ⇒ chữ phụ/chữ màu trong dòng về màu chữ thường. */
export const MAU_TOI: ReadonlySet<string> = new Set([
  "xam-3", "xam-4", "xam-5", "do-2", "do-3", "do-4", "do-5", "cam-3", "cam-4", "cam-5",
  "chuoi-4", "chuoi-5", "la-3", "la-4", "la-5", "troi-3", "troi-4", "troi-5",
  "duong-2", "duong-3", "duong-4", "duong-5", "tim-3", "tim-4", "tim-5",
  "hong-3", "hong-4", "hong-5",
]);

/** Lưới bảng chọn: HÀNG = mức (nhạt → đậm), CỘT = sắc — như bảng màu Excel. */
export const LUOI_MAU: MauTo[][] = MUC_TO.map((_, i) =>
  SAC_TO.map((s) => `${s.ma}-${(i + 1) as 1 | 2 | 3 | 4 | 5}` as MauTo)
);

/** "vàng rất đậm", "xanh lá nhạt"… — cho aria-label / title. */
export function tenMau(ma: string): string {
  const i = ma.lastIndexOf("-");
  const s = SAC_TO.find((x) => x.ma === ma.slice(0, i));
  const muc = MUC_TO[Number(ma.slice(i + 1)) - 1];
  return s && muc ? `${s.nhan} ${muc}` : "";
}

/** Dấu của một dòng. `mau` rỗng = chỉ in đậm. */
export interface DauDong {
  mau: MauTo | "";
  dam: boolean;
}

/** Hợp đồng app cấp cho design-system — đọc/ghi dấu theo khoá bảng. */
export interface NguonToMau {
  /** Dấu CẢ DÒNG của một bảng: Map(khoá dòng → dấu). Bảng chưa có dấu ⇒ Map rỗng. */
  dauCuaBang: (maBang: string) => ReadonlyMap<string, DauDong>;
  /** Đặt dấu cho nhiều dòng một lượt. `null` = bỏ tô (xoá dấu). */
  dat: (maBang: string, khoaDong: string[], dau: DauDong | null) => void;
}

export const ToMauContext = React.createContext<NguonToMau | null>(null);

const RONG: ReadonlyMap<string, DauDong> = new Map();

/** Vá dấu: chỉ đổi phần được nêu (màu HOẶC in đậm), phần kia giữ theo từng dòng. */
export type VaDau = Partial<DauDong>;

/** Áp vá lên dấu cũ ⇒ dấu mới (null = hết dấu). */
export function apVa(cu: DauDong | undefined | null, va: VaDau | null): DauDong | null {
  if (!va) return null;
  const dau = { mau: va.mau ?? cu?.mau ?? "", dam: va.dam ?? cu?.dam ?? false };
  return dau.mau || dau.dam ? dau : null;
}

export interface ToMauBang {
  /** Có tô được không (có provider + màn đã khai khoá bảng). */
  bat: boolean;
  lay: (khoa: string) => DauDong | undefined;
  /**
   * Vá dấu các dòng. `null` = bỏ tô. Đổi màu giữ nguyên in đậm của TỪNG dòng (và
   * ngược lại). Từ 2 dòng trở lên có toast + Hoàn tác (trả đúng dấu cũ từng dòng).
   */
  sua: (khoa: string[], va: VaDau | null) => void;
  /** Thuộc tính gắn lên `<tr>` / thẻ để nền + chữ đậm ăn theo dấu. */
  thuocTinh: (khoa: string) => Record<string, unknown>;
}

/** Gom các dòng theo dấu đích ⇒ mỗi nhóm một lần ghi. */
function gomTheoDau(cap: [string, DauDong | null][]) {
  const nhom = new Map<string, { dau: DauDong | null; khoa: string[] }>();
  for (const [k, d] of cap) {
    const kk = JSON.stringify(d);
    const g = nhom.get(kk) ?? { dau: d, khoa: [] };
    g.khoa.push(k);
    nhom.set(kk, g);
  }
  return [...nhom.values()];
}

/**
 * Hook tô màu của MỘT bảng. `maBang` = khoá ổn định của bảng (VD "ton-kho-thang")
 * — đổi khoá là mất dấu cũ, nên đặt một lần rồi để yên. Bỏ trống ⇒ tắt.
 */
export function useToMau(maBang?: string): ToMauBang {
  const nguon = React.useContext(ToMauContext);
  const bat = Boolean(nguon && maBang);
  const map = bat && nguon && maBang ? nguon.dauCuaBang(maBang) : RONG;

  return React.useMemo<ToMauBang>(() => {
    const sua = (khoa: string[], va: VaDau | null) => {
      const ds = [...new Set(khoa)];
      if (!nguon || !maBang || ds.length === 0) return;
      const cu = ds.map((k) => [k, map.get(k) ?? null] as [string, DauDong | null]);
      const moi = cu.map(([k, d]) => [k, apVa(d, va)] as [string, DauDong | null]);
      for (const g of gomTheoDau(moi)) nguon.dat(maBang, g.khoa, g.dau);
      if (ds.length < 2) return; // một dòng: màu đổi ngay đã là phản hồi
      const viec = !va
        ? "Đã bỏ tô"
        : va.mau
          ? `Đã tô ${tenMau(va.mau)}`
          : va.dam
            ? "Đã in đậm"
            : "Đã bỏ in đậm";
      notify.daLuu(`${viec} ${ds.length} dòng`, () => {
        for (const g of gomTheoDau(cu)) nguon.dat(maBang, g.khoa, g.dau);
      });
    };
    return {
      bat,
      lay: (k) => map.get(k),
      sua,
      thuocTinh: (k) => {
        const d = map.get(k);
        if (!d) return {};
        return {
          ...(d.mau ? { "data-to-mau": d.mau, style: { "--to-nen": `var(--to-${d.mau})` } } : {}),
          ...(d.mau && MAU_TOI.has(d.mau) ? { "data-to-toi": "" } : {}),
          ...(d.dam ? { "data-dam": "" } : {}),
        };
      },
    };
  }, [bat, map, nguon, maBang]);
}

/**
 * Tick chọn dòng do BẢNG tự giữ (khi màn không truyền `chon` riêng). Shift+tick
 * chọn cả khoảng từ dòng tick trước — như Shift+bấm ở Excel.
 */
export function useChonDong() {
  const [daChon, setDaChon] = React.useState<ReadonlySet<string>>(() => new Set());
  const neo = React.useRef<string | null>(null);
  /** Tick/bỏ một dòng; `shift` + `thuTu` (khoá đang hiện) ⇒ đặt cả khoảng theo dòng vừa bấm. */
  const doi = React.useCallback((k: string, shift = false, thuTu: string[] = []) => {
    const a = neo.current ? thuTu.indexOf(neo.current) : -1;
    neo.current = k;
    setDaChon((cu) => {
      const n = new Set(cu);
      const bat = !cu.has(k);
      const b = thuTu.indexOf(k);
      if (shift && a >= 0 && b >= 0) {
        for (const x of thuTu.slice(Math.min(a, b), Math.max(a, b) + 1)) {
          if (bat) n.add(x);
          else n.delete(x);
        }
      } else if (bat) n.add(k);
      else n.delete(k);
      return n;
    });
  }, []);
  const doiTatCa = React.useCallback((keys: string[], bat: boolean) => {
    setDaChon((cu) => {
      const n = new Set(cu);
      for (const k of keys) {
        if (bat) n.add(k);
        else n.delete(k);
      }
      return n;
    });
  }, []);
  const boChon = React.useCallback(() => setDaChon(new Set()), []);
  return { daChon, doi, doiTatCa, boChon };
}
