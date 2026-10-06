// ============================================================
// Tên file: src/design-system/patterns/toMauNguon.ts
// Tên tiếng Việt: Tô màu dòng/ô — hợp đồng dữ liệu + hook + bút tô (không phải component)
// Description: Row/cell highlight context, palette, hooks and brush store
// ============================================================
import * as React from "react";
import { notify } from "./notify";

/*
 * Design-system CHỈ định nghĩa hợp đồng `NguonToMau`; đọc/ghi dấu do app cấp qua
 * `ToMauContext` — provider ở `features/shared/ToMauProvider.tsx` nối bảng
 * `row_marks`. Nút + bảng màu ở `ToMauDong.tsx`. Luật: README § Tô màu dòng.
 */

/* ---------- Bảng màu kiểu Excel: 10 sắc × 5 mức (1 rất nhạt → 5 rất đậm) ----------
   Mã lưu DB = "<sắc>-<mức>" (VD "vang-5"). Màu thật ở token `--to-<mã>` (tokens.css,
   sinh bằng script có kiểm tương phản). Khớp `SAC_TO_LIB` ở lib/toMau.ts. */
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

/** Ô nền "tối" (độ chói < 0,68) ⇒ chữ phụ/chữ màu trong ô về màu chữ thường. */
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
  const [sac, muc] = [ma.slice(0, ma.lastIndexOf("-")), Number(ma.slice(ma.lastIndexOf("-") + 1))];
  const s = SAC_TO.find((x) => x.ma === sac);
  return s && MUC_TO[muc - 1] ? `${s.nhan} ${MUC_TO[muc - 1]}` : "";
}

/** Style nền cho ô màu / dòng tô — gọi token, không viết mã màu. */
export function styleMau(ma: string): React.CSSProperties {
  const sac = ma.slice(0, ma.lastIndexOf("-"));
  return {
    "--to-nen": `var(--to-${ma})`,
    "--to-vach": `var(--to-${sac}-line)`,
  } as React.CSSProperties;
}

/** Dấu của một dòng / ô. `mau` rỗng = chỉ in đậm. */
export interface DauDong {
  mau: MauTo | "";
  dam: boolean;
}

/** Đích tô: cả dòng (`cot` null) hoặc một ô. */
export interface DichTo {
  dong: string;
  cot: string | null;
}

/** Dấu của một bảng như app cấp: theo dòng + theo ô (khoá ô = khoaODau). */
export interface DauBang {
  dong: ReadonlyMap<string, DauDong>;
  o: ReadonlyMap<string, DauDong>;
}

/** Khoá tra dấu ô trong `DauBang.o` — khớp `khoaO` ở lib/toMau.ts. */
export const khoaODau = (dong: string, cot: string) => `${dong}\u0001${cot}`;

/** Hợp đồng app cấp cho design-system — đọc/ghi dấu theo khoá bảng. */
export interface NguonToMau {
  /** Dấu của một bảng. Bảng chưa có dấu ⇒ hai Map rỗng. */
  dauCuaBang: (maBang: string) => DauBang;
  /** Đặt dấu cho nhiều đích một lượt. `null` = bỏ tô (xoá dấu). */
  dat: (maBang: string, dich: DichTo[], dau: DauDong | null) => void;
}

export const ToMauContext = React.createContext<NguonToMau | null>(null);

const RONG: DauBang = { dong: new Map(), o: new Map() };

/** Câu đọc dấu cho người: "tô vàng rất đậm, in đậm" / "in đậm" / "". */
export function moTaDau(d: DauDong | undefined): string {
  if (!d) return "";
  return [d.mau ? `tô ${tenMau(d.mau)}` : "", d.dam ? "in đậm" : ""].filter(Boolean).join(", ");
}

/** Vá dấu: chỉ đổi phần được nêu (màu HOẶC in đậm), phần kia giữ theo từng đích. */
export type VaDau = Partial<DauDong>;

/* ---------- Bút tô: một trạng thái dùng chung theo KHOÁ BẢNG ----------
   Sổ kho tháng có 3 bảng (3 nhóm) cùng khoá "ton-kho-thang" ⇒ cầm bút ở bảng
   này là tô được cả bảng kia. Kho nhỏ ngoài React (useSyncExternalStore). */
export interface ButTo {
  maBang: string;
  /** Vá áp cho ô bị tô; `null` = cục tẩy (bỏ tô). */
  va: VaDau | null;
}
interface TrangThaiBut {
  but: ButTo | null;
  /** Ô/dòng của NÉT ĐANG KÉO — vẽ trước màu bút, nhả tay mới ghi một lần. */
  xem: ReadonlySet<string>;
}
const KHONG_XEM: ReadonlySet<string> = new Set();
let trangThaiBut: TrangThaiBut = { but: null, xem: KHONG_XEM };
const ngheBut = new Set<() => void>();
function doiBut(p: Partial<TrangThaiBut>) {
  trangThaiBut = { ...trangThaiBut, ...p };
  ngheBut.forEach((f) => f());
}
/** Cầm bút (hoặc thả bút: null). */
export function datBut(b: ButTo | null) {
  doiBut({ but: b, xem: KHONG_XEM });
}
function useTrangThaiBut(): TrangThaiBut {
  return React.useSyncExternalStore(
    (f) => {
      ngheBut.add(f);
      return () => ngheBut.delete(f);
    },
    () => trangThaiBut,
    () => trangThaiBut
  );
}
/** Bút đang cầm (của BẤT KỲ bảng nào) — cho dải nhắc nổi dùng chung. */
export function useButDangCam(): ButTo | null {
  return useTrangThaiBut().but;
}
/** Khoá một đích trong nét đang kéo ("*" = cả dòng). */
const khoaNet = (d: DichTo) => `${d.dong}\u0001${d.cot ?? "*"}`;

/* Esc thả bút ở bất kỳ đâu (gắn một lần). */
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && trangThaiBut.but) datBut(null);
  });
}

export interface ToMauBang {
  /** Có tô được không (có provider + màn đã khai khoá bảng). */
  bat: boolean;
  lay: (khoa: string) => DauDong | undefined;
  layO: (khoa: string, cot: string) => DauDong | undefined;
  /**
   * Vá dấu một hay nhiều đích (chuỗi = cả dòng). `null` = bỏ tô. Đổi màu giữ
   * nguyên in đậm của TỪNG đích (và ngược lại) — tô hàng loạt các dòng khác màu
   * không xoá màu cũ. `thongBao` ⇒ toast + Hoàn tác (thao tác hàng loạt; tô một
   * dòng/ô thì màu đổi ngay đã là phản hồi, khỏi toast).
   */
  sua: (dich: string | string[] | DichTo[], va: VaDau | null, thongBao?: boolean) => void;
  /** Thuộc tính gắn lên `<tr>` / thẻ để nền + chữ đậm ăn theo dấu DÒNG. */
  thuocTinh: (khoa: string) => Record<string, unknown>;
  /**
   * Thuộc tính gắn lên `<td>`: dấu Ô + mốc cho bút tô. `cot` = khoá cột; "*" = ô
   * đầu dòng (bút tô bấm vào đây là tô cả dòng).
   */
  thuocTinhO: (khoa: string, cot: string) => Record<string, unknown>;
  /** Bút tô đang cầm cho bảng này (null = không). */
  but: ButTo | null;
}

/** Gom các đích theo dấu đích ⇒ mỗi nhóm một lần ghi. */
function gomTheoDau(cap: [DichTo, DauDong | null][]) {
  const nhom = new Map<string, { dau: DauDong | null; dich: DichTo[] }>();
  for (const [d, dau] of cap) {
    const kk = JSON.stringify(dau);
    const g = nhom.get(kk) ?? { dau, dich: [] };
    g.dich.push(d);
    nhom.set(kk, g);
  }
  return [...nhom.values()];
}

function thuocTinhDau(d: DauDong | undefined): Record<string, unknown> {
  if (!d) return {};
  return {
    ...(d.mau ? { "data-to-mau": d.mau, style: styleMau(d.mau) } : {}),
    ...(d.mau && MAU_TOI.has(d.mau) ? { "data-to-toi": "" } : {}),
    ...(d.dam ? { "data-dam": "" } : {}),
  };
}

/** Áp vá lên dấu cũ ⇒ dấu mới (null = hết dấu). */
export function apVa(cu: DauDong | undefined | null, va: VaDau | null): DauDong | null {
  if (!va) return null;
  const dau = { mau: va.mau ?? cu?.mau ?? "", dam: va.dam ?? cu?.dam ?? false };
  return dau.mau || dau.dam ? dau : null;
}

/**
 * Hook tô màu của MỘT bảng. `maBang` = khoá ổn định của bảng (VD "ton-kho-thang")
 * — đổi khoá là mất dấu cũ, nên đặt một lần rồi để yên. Bỏ trống ⇒ tắt.
 */
export function useToMau(maBang?: string): ToMauBang {
  const nguon = React.useContext(ToMauContext);
  const bat = Boolean(nguon && maBang);
  const bang = bat && nguon && maBang ? nguon.dauCuaBang(maBang) : RONG;
  const { but: butChung, xem } = useTrangThaiBut();
  const but = bat && butChung?.maBang === maBang ? butChung : null;

  return React.useMemo<ToMauBang>(() => {
    const layDich = (d: DichTo) => (d.cot == null ? bang.dong.get(d.dong) : bang.o.get(khoaODau(d.dong, d.cot)));
    const sua = (dich: string | string[] | DichTo[], va: VaDau | null, thongBao = false) => {
      const ds: DichTo[] = (Array.isArray(dich) ? dich : [dich]).map((x) =>
        typeof x === "string" ? { dong: x, cot: null } : x
      );
      if (!nguon || !maBang || ds.length === 0) return;
      const cu = ds.map((d) => [d, layDich(d) ?? null] as [DichTo, DauDong | null]);
      const moi = cu.map(([d, dau]) => [d, apVa(dau, va)] as [DichTo, DauDong | null]);
      for (const g of gomTheoDau(moi)) nguon.dat(maBang, g.dich, g.dau);
      if (!thongBao) return;
      const dv = ds.every((d) => d.cot == null) ? "dòng" : "ô";
      const viec = !va
        ? "Đã bỏ tô"
        : va.mau
          ? `Đã tô ${tenMau(va.mau)}`
          : va.dam
            ? "Đã in đậm"
            : "Đã bỏ in đậm";
      // Hoàn tác trả đúng dấu cũ của TỪNG đích.
      notify.daLuu(`${viec} ${ds.length} ${dv}`, () => {
        for (const g of gomTheoDau(cu)) nguon.dat(maBang, g.dich, g.dau);
      });
    };
    /** Dấu sẽ hiện: dấu đã lưu, hoặc (đang kéo bút qua) dấu sau khi áp bút. */
    const hien = (d: DichTo, luu: DauDong | undefined) =>
      but && xem.has(khoaNet(d)) ? (apVa(luu, but.va) ?? undefined) : luu;
    return {
      bat,
      but,
      lay: (k) => bang.dong.get(k),
      layO: (k, c) => bang.o.get(khoaODau(k, c)),
      sua,
      thuocTinh: (k) => thuocTinhDau(hien({ dong: k, cot: null }, bang.dong.get(k))),
      thuocTinhO: (k, c) => {
        if (!bat) return {};
        const moc = { "data-o-dong": k, "data-o-cot": c };
        return c === "*" ? moc : { ...moc, ...thuocTinhDau(hien({ dong: k, cot: c }, bang.o.get(khoaODau(k, c)))) };
      },
    };
  }, [bat, bang, nguon, maBang, but, xem]);
}

/**
 * Gắn bút tô vào một khung bảng: khi đang cầm bút cho bảng này, bấm một ô là tô
 * ô đó, kéo qua nhiều ô là tô hết (chuột lẫn cảm ứng), bấm ô đầu dòng ("*") là tô
 * cả dòng, Shift+bấm tô cả VÙNG chữ nhật từ ô bấm trước. Một nét kéo = MỘT lần
 * ghi (nét ≥ 2 ô có toast + Hoàn tác). `thuTu` = thứ tự dòng + cột ĐANG HIỆN.
 */
export function useButToBang(
  to: ToMauBang,
  khungRef: React.RefObject<HTMLElement | null>,
  thuTu: () => { dong: string[]; cot: string[] }
) {
  const neo = React.useRef<DichTo | null>(null);
  const thuTuRef = React.useRef(thuTu);
  const toRef = React.useRef(to);
  React.useLayoutEffect(() => {
    thuTuRef.current = thuTu;
    toRef.current = to;
  });
  const dangCam = Boolean(to.but);

  React.useEffect(() => {
    const khung = khungRef.current;
    if (!khung || !dangCam) return;
    let net: Map<string, DichTo> | null = null;

    const oTai = (x: number, y: number): DichTo | null => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-o-dong]");
      if (!el || !khung.contains(el)) return null;
      const cot = el.dataset.oCot ?? "*";
      return { dong: el.dataset.oDong ?? "", cot: cot === "*" ? null : cot };
    };
    const them = (d: DichTo) => {
      if (!net) return;
      const k = khoaNet(d);
      if (net.has(k)) return;
      net.set(k, d);
      // Vẽ trước màu bút ở ô vừa kéo qua (màu chạy theo tay); nhả tay mới ghi.
      doiBut({ xem: new Set(net.keys()) });
    };
    const vung = (a: DichTo, b: DichTo): DichTo[] => {
      const { dong, cot } = thuTuRef.current();
      const [d1, d2] = [dong.indexOf(a.dong), dong.indexOf(b.dong)].sort((x, y) => x - y);
      if (d1 < 0) return [b];
      if (a.cot == null || b.cot == null) return dong.slice(d1, d2 + 1).map((k) => ({ dong: k, cot: null }));
      const [c1, c2] = [cot.indexOf(a.cot), cot.indexOf(b.cot)].sort((x, y) => x - y);
      if (c1 < 0) return [b];
      const ra: DichTo[] = [];
      for (const k of dong.slice(d1, d2 + 1)) for (const c of cot.slice(c1, c2 + 1)) ra.push({ dong: k, cot: c });
      return ra;
    };

    const xuong = (e: PointerEvent) => {
      const d = oTai(e.clientX, e.clientY);
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      net = new Map();
      if (e.shiftKey && neo.current) {
        const ds = vung(neo.current, d);
        const t = toRef.current;
        if (t.but) t.sua(ds, t.but.va, ds.length > 1);
        net = null;
      } else {
        them(d);
      }
      neo.current = d;
    };
    const di = (e: PointerEvent) => {
      if (!net) return;
      const d = oTai(e.clientX, e.clientY);
      if (d) them(d);
    };
    const len = () => {
      if (!net) return;
      const ds = [...net.values()];
      net = null;
      // MỘT lần ghi cho cả nét; nét ≥ 2 đích có toast + Hoàn tác.
      const t = toRef.current;
      if (t.but) t.sua(ds, t.but.va, ds.length > 1);
      doiBut({ xem: KHONG_XEM });
    };
    const chanClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-o-dong]")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    khung.addEventListener("pointerdown", xuong, true);
    khung.addEventListener("click", chanClick, true);
    window.addEventListener("pointermove", di);
    window.addEventListener("pointerup", len);
    window.addEventListener("pointercancel", len);
    return () => {
      khung.removeEventListener("pointerdown", xuong, true);
      khung.removeEventListener("click", chanClick, true);
      window.removeEventListener("pointermove", di);
      window.removeEventListener("pointerup", len);
      window.removeEventListener("pointercancel", len);
    };
  }, [dangCam, khungRef]);

  /** Gắn lên khung bảng: CSS đổi con trỏ + chặn cuộn khi chạm-kéo. */
  return dangCam ? { "data-but-to": "" } : {};
}
