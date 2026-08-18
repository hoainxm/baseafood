// ============================================================
// Tên file: src/design-system/patterns/EditableGrid.tsx
// Tên tiếng Việt: Lưới nhập liệu kiểu bảng tính
// Description: Spreadsheet-like editable grid (day columns, paste from Excel)
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";
import { dinhDangSo, parseSo } from "./NumberField";

/**
 * LuoiNhap — lưới nhập liệu thay cho "mở hộp thoại, điền, bấm lưu" từng dòng.
 *
 * Vì sao cần: người dùng đang làm bảng cân đối trên Excel. Nếu phần mềm bắt mở
 * hộp thoại cho từng ô sản lượng ngày thì Excel vẫn nhanh hơn và họ sẽ quay về
 * Excel. Lưới này giữ ba thứ Excel làm tốt — gõ liên tục, di chuyển bằng phím,
 * dán cả khối số — và bỏ hai thứ Excel làm dở: cột tổng gõ tay được (nguồn sai
 * số kinh điển) và công thức vỡ khi chèn dòng.
 *
 * Vẫn theo luật giao diện cho người lớn tuổi: ô cao ≥44px, nhãn cột luôn hiện,
 * cột tên dính bên trái để cuộn ngang không lạc dòng.
 */

export type KieuOLuoi = "so" | "tinh" | "chu";

export interface CotLuoi<R> {
  key: string;
  header: React.ReactNode;
  /** Nhãn đọc cho trình đọc màn hình + tiêu đề khi thu gọn. */
  nhan: string;
  kieu: KieuOLuoi;
  /** Giá trị hiện tại của ô. */
  lay: (row: R) => number | null;
  /** Chuỗi hiển thị thay cho số (dùng cho cột chữ / cột tính đặc biệt). */
  hien?: (row: R) => React.ReactNode;
  /**
   * Ô điều khiển riêng (Combobox chọn khách, nút…). Khác `hien` ở chỗ nội dung
   * TƯƠNG TÁC được: ô không bọc lớp căn phải cứng và không bị coi là ô số.
   */
  oRieng?: (row: R) => React.ReactNode;
  /** Ô này có khoá không (dòng hút từ sổ khác, dòng tổng…). */
  khoa?: (row: R) => boolean;
  /** Lý do khoá — hiện thành tooltip, đừng để người dùng gõ vào ô câm. */
  lyDoKhoa?: (row: R) => string;
  /** Nhóm cột để gập chung (VD "ngay" cho toàn bộ cột ngày). */
  nhom?: string;
  /** Tô nền riêng (VD cột Chuyển kỳ). */
  toNen?: "chuyen-ky" | "tinh" | "hut";
  /** Rộng tối thiểu, px. */
  rong?: number;
}

export interface HangLuoi<R> {
  id: string;
  du: R;
  /** Dòng tiêu đề nhóm — chỉ hiện chữ, không có ô nhập. */
  tieuDeNhom?: string;
  /** Kiểu dòng: dòng giảm tô đỏ nhạt, dòng tổng in đậm. */
  kieu?: "thuong" | "giam" | "tong";
  /** Tên hiện ở cột dính bên trái. */
  ten: React.ReactNode;
  /** Chú thích nhỏ dưới tên (VD "hút từ sổ nhập hàng"). */
  phu?: React.ReactNode;
}

const NEN: Record<NonNullable<CotLuoi<unknown>["toNen"]>, string> = {
  "chuyen-ky": "bg-warning-surface",
  tinh: "bg-muted",
  hut: "bg-primary/8",
};

/** Khoá ô để định vị khi di chuyển bằng phím. */
const khoaO = (rowId: string, colKey: string) => `${rowId}|${colKey}`;

export function LuoiNhap<R>({
  cot,
  hang,
  onGhiO,
  onDanKhoi,
  nhomAn = [],
  cuoiBang,
  className,
  moTa,
}: {
  cot: CotLuoi<R>[];
  hang: HangLuoi<R>[];
  /** Ghi một ô. Trả về false nếu bị từ chối (VD ngày đã chốt, chưa có lý do). */
  onGhiO: (rowId: string, colKey: string, giaTri: number | null) => void | boolean;
  /**
   * Dán một khối số từ Excel: `khoi[i][j]` là ô ở dòng thứ i, cột thứ j tính từ
   * ô đang đứng. Không có hàm này thì lưới vẫn dán được từng ô một.
   */
  onDanKhoi?: (rowId: string, colKey: string, khoi: (number | null)[][]) => void;
  /** Nhóm cột đang thu gọn (VD ["ngay"]). */
  nhomAn?: string[];
  /** Dòng tổng cuối bảng, tự dựng ở màn gọi. */
  cuoiBang?: React.ReactNode;
  className?: string;
  /** Câu mô tả cho trình đọc màn hình. */
  moTa: string;
}) {
  const oRef = React.useRef(new Map<string, HTMLInputElement>());
  const cotHien = React.useMemo(
    () => cot.filter((c) => !c.nhom || !nhomAn.includes(c.nhom)),
    [cot, nhomAn]
  );
  /** Chỉ ô gõ được mới nằm trong đường đi của phím mũi tên. */
  const hangNhap = React.useMemo(() => hang.filter((h) => !h.tieuDeNhom), [hang]);

  /**
   * Nhảy sang ô gõ được kế tiếp theo hướng (dRow, dCol). Ô khoá bị bỏ qua chứ
   * không làm kẹt con trỏ; quét có giới hạn số bước để không treo khi cả lưới
   * chỉ toàn ô khoá.
   */
  const chuyenO = (rowId: string, colKey: string, dRow: number, dCol: number) => {
    let r = hangNhap.findIndex((h) => h.id === rowId);
    let c = cotHien.findIndex((x) => x.key === colKey);
    if (r < 0 || c < 0) return;
    const toiDa = hangNhap.length * cotHien.length;
    for (let buoc = 0; buoc < toiDa; buoc++) {
      r += dRow;
      c += dCol;
      /* Đi hết hàng thì xuống dòng dưới, đúng thói quen Tab của Excel. */
      while (c >= cotHien.length) {
        c -= cotHien.length;
        r += 1;
      }
      while (c < 0) {
        c += cotHien.length;
        r -= 1;
      }
      const hangDich = hangNhap[r];
      const cotDich = cotHien[c];
      if (!hangDich || !cotDich) return;
      const o = oRef.current.get(khoaO(hangDich.id, cotDich.key));
      if (o) {
        o.focus();
        o.select();
        return;
      }
      /* Ô khoá: đi tiếp theo hàng ngang; đang đi dọc thì dừng ở cột này. */
      if (dRow !== 0 && dCol === 0) continue;
    }
  };

  const xuLyPhim = (e: React.KeyboardEvent<HTMLInputElement>, rowId: string, colKey: string) => {
    const k = e.key;
    if (k === "Enter" || k === "ArrowDown") {
      e.preventDefault();
      chuyenO(rowId, colKey, 1, 0);
    } else if (k === "ArrowUp") {
      e.preventDefault();
      chuyenO(rowId, colKey, -1, 0);
    } else if (k === "Tab") {
      e.preventDefault();
      chuyenO(rowId, colKey, 0, e.shiftKey ? -1 : 1);
    } else if (k === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      e.preventDefault();
      chuyenO(rowId, colKey, 0, 1);
    } else if (k === "ArrowLeft" && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      chuyenO(rowId, colKey, 0, -1);
    }
  };

  /**
   * Dán từ Excel: clipboard là văn bản, dòng cách nhau bằng \n, cột bằng \t.
   * Ô rỗng giữ nguyên số cũ (null) thay vì xoá về 0 — dán nhầm một khối thưa
   * không được phép thổi bay số đã nhập.
   */
  const xuLyDan = (e: React.ClipboardEvent<HTMLInputElement>, rowId: string, colKey: string) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !/[\t\n\r]/.test(text)) return; // dán một ô — để trình duyệt lo
    e.preventDefault();
    const khoi = text
      .replace(/\r\n?/g, "\n")
      .replace(/\n+$/, "")
      .split("\n")
      .map((dong) =>
        dong.split("\t").map((o) => {
          const t = o.trim();
          if (!t) return null;
          /* Kế toán ghi số âm bằng ngoặc: (2.000) = −2.000 */
          const am = /^\(.*\)$/.test(t);
          const so = parseSo(am ? t.slice(1, -1) : t);
          if (so == null) return null;
          return am ? -so : so;
        })
      );
    if (onDanKhoi) {
      onDanKhoi(rowId, colKey, khoi);
      return;
    }
    /* Không khai onDanKhoi → rải từng ô qua onGhiO. */
    const iH = hangNhap.findIndex((h) => h.id === rowId);
    const iC = cotHien.findIndex((c) => c.key === colKey);
    khoi.forEach((dong, i) =>
      dong.forEach((v, j) => {
        if (v == null) return;
        const h = hangNhap[iH + i];
        const c = cotHien[iC + j];
        if (h && c && c.kieu === "so" && !c.khoa?.(h.du)) onGhiO(h.id, c.key, v);
      })
    );
  };

  return (
    <div
      className={cn(
        "scroll-nice overflow-x-auto rounded-xl ring-1 ring-foreground/10",
        className
      )}
    >
      {/* Tên bảng đặt bằng aria-label, KHÔNG dùng <caption className="sr-only">:
          sr-only là position:absolute, mà hộp cuộn ngoài không phải khối định vị
          ⇒ caption rơi ra toạ độ trang, đội chiều cao trang lên và sinh thêm một
          thanh cuộn dọc + mảng trắng dưới cùng. */}
      <table className="w-full border-collapse text-base" aria-label={moTa}>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-30 min-w-44 border-b-2 border-border bg-card px-4 py-3 text-left align-bottom text-base font-semibold sm:min-w-60"
            >
              Mặt hàng
            </th>
            {cotHien.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.rong ? { minWidth: c.rong } : undefined}
                className={cn(
                  "border-b-2 border-l border-border bg-card px-3 py-3 text-right align-bottom text-base font-semibold whitespace-nowrap",
                  c.toNen === "chuyen-ky" && "text-warning"
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hang.map((h) =>
            h.tieuDeNhom ? (
              <tr key={h.id}>
                <td
                  colSpan={cotHien.length + 1}
                  className="sticky left-0 border-b border-border bg-muted px-4 py-2 text-left text-base font-semibold text-muted-foreground"
                >
                  {h.tieuDeNhom}
                </td>
              </tr>
            ) : (
              <tr
                key={h.id}
                className={cn(
                  h.kieu === "giam" && "bg-warning-surface/40",
                  h.kieu === "tong" && "bg-muted font-semibold"
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 border-r-2 border-b border-border px-4 py-2 text-left align-middle font-normal",
                    h.kieu === "tong" ? "bg-muted font-semibold" : "bg-card",
                    h.kieu === "giam" && "bg-warning-surface/40"
                  )}
                >
                  <span className="block leading-tight">{h.ten}</span>
                  {h.phu && (
                    <span className="block text-sm text-muted-foreground">{h.phu}</span>
                  )}
                </th>
                {cotHien.map((c) => {
                  const oRieng = h.kieu === "tong" ? undefined : c.oRieng?.(h.du);
                  const bikhoa = c.kieu !== "so" || Boolean(c.khoa?.(h.du)) || h.kieu === "tong";
                  const gt = c.lay(h.du);
                  const nen = c.toNen ? NEN[c.toNen] : undefined;
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b border-l border-border p-0 text-right align-middle",
                        nen,
                        c.kieu === "tinh" && !nen && "bg-muted"
                      )}
                    >
                      {oRieng ? (
                        <div className="px-2 py-1 text-left">{oRieng}</div>
                      ) : bikhoa ? (
                        <span
                          title={c.lyDoKhoa?.(h.du)}
                          className={cn(
                            "tnum flex min-h-11 items-center justify-end px-3 py-2",
                            c.kieu === "tinh" && "font-semibold",
                            gt != null && gt < 0 && "text-destructive"
                          )}
                        >
                          {c.hien
                            ? c.hien(h.du)
                            : gt == null || gt === 0
                              ? <span className="text-muted-foreground">—</span>
                              : dinhDangSo(gt)}
                        </span>
                      ) : (
                        <OLuoi
                          giaTri={gt}
                          nhan={`${c.nhan} — ${typeof h.ten === "string" ? h.ten : "dòng"}`}
                          dangKy={(el) => {
                            const k = khoaO(h.id, c.key);
                            if (el) oRef.current.set(k, el);
                            else oRef.current.delete(k);
                          }}
                          onGhi={(v) => onGhiO(h.id, c.key, v)}
                          onPhim={(e) => xuLyPhim(e, h.id, c.key)}
                          onDan={(e) => xuLyDan(e, h.id, c.key)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            )
          )}
          {cuoiBang}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Một ô số.
 *
 * Ghi ngay theo TỪNG PHÍM (như `NumberField` của bộ giao diện), không đợi rời ô:
 * cột Tổng, dòng T.CỘNG và khối kết quả phải nhúc nhích theo con số đang gõ.
 * Chờ đến lúc blur mới tính thì người dùng phải gõ hết cả bảng rồi mới biết
 * mình gõ đúng hay sai — đúng cái khó chịu khiến họ quay về Excel.
 *
 * Chuỗi đang gõ vẫn giữ ở state riêng để gõ được "-" hay "1," dở dang mà ô
 * không tự nhảy số dưới tay; dấu chấm phần nghìn chỉ hiện khi rời ô.
 */
function OLuoi({
  giaTri,
  nhan,
  dangKy,
  onGhi,
  onPhim,
  onDan,
}: {
  giaTri: number | null;
  nhan: string;
  dangKy: (el: HTMLInputElement | null) => void;
  onGhi: (v: number | null) => void;
  onPhim: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onDan: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  const [dangGo, setDangGo] = React.useState(false);
  const [tho, setTho] = React.useState("");
  const hienThi = dangGo ? tho : giaTri == null || giaTri === 0 ? "" : dinhDangSo(giaTri);

  return (
    <input
      ref={dangKy}
      value={hienThi}
      aria-label={nhan}
      inputMode="decimal"
      onChange={(e) => {
        setTho(e.target.value);
        const s = e.target.value.trim();
        onGhi(s === "" ? null : parseSo(s));
      }}
      onFocus={(e) => {
        setTho(giaTri == null || giaTri === 0 ? "" : String(giaTri).replace(".", ","));
        setDangGo(true);
        e.currentTarget.select();
      }}
      onBlur={() => setDangGo(false)}
      onPaste={onDan}
      onKeyDown={onPhim}
      className={cn(
        "tnum h-11 w-full min-w-24 border-0 bg-transparent px-3 text-right text-base",
        "focus:ring-2 focus:ring-ring focus:ring-inset focus:outline-none",
        giaTri != null && giaTri < 0 && "text-destructive"
      )}
    />
  );
}
