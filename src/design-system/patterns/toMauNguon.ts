// ============================================================
// Tên file: src/design-system/patterns/toMauNguon.ts
// Tên tiếng Việt: Tô màu dòng — hợp đồng dữ liệu + hook (không phải component)
// Description: Row-highlight context, types and hook (components in ToMauDong.tsx)
// ============================================================
import * as React from "react";
import { notify } from "./notify";

/*
 * Design-system CHỈ định nghĩa hợp đồng `NguonToMau`; đọc/ghi dấu do app cấp qua
 * `ToMauContext` — provider ở `features/shared/ToMauProvider.tsx` nối bảng
 * `row_marks`. Nút + bảng màu ở `ToMauDong.tsx`. Luật: README § Tô màu dòng.
 */

/** Màu tô — mã lưu DB (khớp `MA_MAU_TO` ở lib/toMau.ts). */
export type MauTo = "vang" | "xanh-la" | "xanh-duong" | "do";

/** Dấu của một dòng. `mau` rỗng = chỉ in đậm. */
export interface DauDong {
  mau: MauTo | "";
  dam: boolean;
}

/** Bảng màu theo thứ tự hiện trên nút. Class lấy từ token `--to-*` (tokens.css). */
export const MAU_TO: { ma: MauTo; nhan: string; nen: string; vach: string }[] = [
  { ma: "vang", nhan: "vàng", nen: "bg-to-vang", vach: "text-to-vang-line" },
  { ma: "xanh-la", nhan: "xanh lá", nen: "bg-to-xanh-la", vach: "text-to-xanh-la-line" },
  { ma: "xanh-duong", nhan: "xanh dương", nen: "bg-to-xanh-duong", vach: "text-to-xanh-duong-line" },
  { ma: "do", nhan: "đỏ", nen: "bg-to-do", vach: "text-to-do-line" },
];

/** Hợp đồng app cấp cho design-system — đọc/ghi dấu theo khoá bảng. */
export interface NguonToMau {
  /** Dấu CẢ DÒNG của một bảng: Map(khoá dòng → dấu). Bảng chưa có dấu ⇒ Map rỗng. */
  dauCuaBang: (maBang: string) => ReadonlyMap<string, DauDong>;
  /** Đặt dấu cho nhiều dòng một lượt. `null` = bỏ tô (xoá dấu). */
  dat: (maBang: string, khoaDong: string[], dau: DauDong | null) => void;
}

export const ToMauContext = React.createContext<NguonToMau | null>(null);

const RONG: ReadonlyMap<string, DauDong> = new Map();

/** Câu đọc dấu cho người: "tô vàng, in đậm" / "in đậm" / "". */
export function moTaDau(d: DauDong | undefined): string {
  if (!d) return "";
  const mau = MAU_TO.find((m) => m.ma === d.mau);
  return [mau ? `tô ${mau.nhan}` : "", d.dam ? "in đậm" : ""].filter(Boolean).join(", ");
}

/** Vá dấu: chỉ đổi phần được nêu (màu HOẶC in đậm), phần kia giữ theo từng dòng. */
export type VaDau = Partial<DauDong>;

export interface ToMauBang {
  /** Có tô được không (có provider + màn đã khai khoá bảng). */
  bat: boolean;
  lay: (khoa: string) => DauDong | undefined;
  /**
   * Vá dấu một hay nhiều dòng. `null` = bỏ tô. Đổi màu giữ nguyên in đậm của
   * TỪNG dòng (và ngược lại) — tô hàng loạt các dòng khác màu không xoá màu cũ.
   * `thongBao` ⇒ toast + Hoàn tác (dùng cho thao tác hàng loạt; tô một dòng thì
   * màu dòng đổi ngay đã là phản hồi, khỏi toast).
   */
  sua: (khoa: string | string[], va: VaDau | null, thongBao?: boolean) => void;
  /** Thuộc tính gắn lên `<tr>` / thẻ để nền + chữ đậm ăn theo dấu. */
  thuocTinh: (khoa: string) => { "data-to-mau"?: string; "data-dam"?: "" };
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
    const sua = (khoa: string | string[], va: VaDau | null, thongBao = false) => {
      const ds = [...new Set(Array.isArray(khoa) ? khoa : [khoa])];
      if (!nguon || !maBang || ds.length === 0) return;
      const cu = ds.map((k) => [k, map.get(k) ?? null] as [string, DauDong | null]);
      const moi = cu.map(([k, d]): [string, DauDong | null] => {
        if (!va) return [k, null];
        const dau = { mau: va.mau ?? d?.mau ?? "", dam: va.dam ?? d?.dam ?? false };
        return [k, dau.mau || dau.dam ? dau : null];
      });
      for (const g of gomTheoDau(moi)) nguon.dat(maBang, g.khoa, g.dau);
      if (!thongBao) return;
      const viec = !va
        ? "Đã bỏ tô"
        : va.mau !== undefined
          ? `Đã tô ${MAU_TO.find((m) => m.ma === va.mau)?.nhan ?? ""}`.trim()
          : va.dam
            ? "Đã in đậm"
            : "Đã bỏ in đậm";
      // Hoàn tác trả đúng dấu cũ của TỪNG dòng.
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
          ...(d.mau ? { "data-to-mau": d.mau } : {}),
          ...(d.dam ? { "data-dam": "" as const } : {}),
        };
      },
    };
  }, [bat, map, nguon, maBang]);
}
