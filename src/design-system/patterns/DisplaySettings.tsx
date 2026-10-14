// ============================================================
// Tên file cũ: src/design-system/patterns/DisplaySettingsPanel.tsx
// Tên tiếng Việt: Cấu hình hiển thị cỡ chữ, mật độ UI
// Description: Display & Density Preference Settings Panel
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

/* ============================================================
   Cài đặt hiển thị toàn hệ thống.
   Lưu localStorage, áp bằng thuộc tính / biến CSS trên <html>.
   ============================================================ */

/**
 * Khóa lưu THEO NGƯỜI DÙNG: mỗi tài khoản giữ giao diện riêng (cỡ chữ / mật độ /
 * bề rộng) — tổ trưởng mắt kém để cỡ 130%, kế toán để Gọn, không đạp lên nhau khi
 * dùng chung một tablet. Không có username (chạy localStorage ở xưởng, chưa đăng
 * nhập) ⇒ dùng bucket mặc định = khóa cũ `bsf.coChu` → tương thích ngược, không
 * làm mất cài đặt người dùng đã chọn trước khi có tính năng này.
 */
const BASE_FONT_SIZE = "coChu";
const BASE_DENSITY = "matDo";
const BASE_WIDTH = "beRong";

function storageKey(base: string, account?: string) {
  return account ? `bsf.${account}.${base}` : `bsf.${base}`;
}

/** MẶC ĐỊNH là "100" — thang token nền 16px (mật độ web thường). Người mắt kém
 *  kéo lên 110–130% như một lối phóng to; ai muốn gọn hơn nữa hạ 90%. Thang rem
 *  nên bố cục giãn theo, không vỡ như phóng to trình duyệt. */
export const FONT_SIZES = [
  { id: "90", label: "A", scale: "90%", description: "Nhỏ — 14px" },
  { id: "100", label: "A", scale: "100%", description: "Thường — 16px" },
  { id: "110", label: "A", scale: "110%", description: "Lớn — 18px" },
  { id: "120", label: "A", scale: "120%", description: "Rất lớn — 19px" },
  { id: "130", label: "A", scale: "130%", description: "Cực lớn — 21px" },
] as const;

/** Bậc cỡ chữ mặc định khi chưa ai chọn gì. */
export const DEFAULT_FONT_SIZE = "100";

export const DENSITIES = [
  { id: "thoang", label: "Thoáng", description: "Ô cao 44px — dễ bấm nhất" },
  { id: "vua", label: "Vừa", description: "Ô cao 40px" },
  { id: "gon", label: "Gọn", description: "Ô cao 36px — thấy nhiều dòng hơn" },
] as const;

export const CONTENT_WIDTHS = [
  { id: "vua", label: "Vừa", description: "Dễ đọc, ít đảo mắt", css: "64rem" },
  { id: "rong", label: "Rộng", description: "Bảng nhiều cột đỡ chật", css: "80rem" },
  { id: "toi-da", label: "Tối đa", description: "Dùng hết màn hình", css: "100%" },
] as const;

function doc(key: string, fallback: string) {
  return localStorage.getItem(key) ?? fallback;
}

function applyFontSize(id: string) {
  const m = FONT_SIZES.find((x) => x.id === id) ?? FONT_SIZES[0];
  document.documentElement.style.setProperty("--app-font-scale", m.scale);
}

function applyDensity(id: string) {
  document.documentElement.setAttribute("data-density", id);
}

function applyWidth(id: string) {
  const m = CONTENT_WIDTHS.find((x) => x.id === id) ?? CONTENT_WIDTHS[0];
  document.documentElement.style.setProperty("--app-content-width", m.css);
}

/**
 * Nạp cài đặt đã lưu và áp vào `<html>`. Gọi lúc app khởi động (chưa có
 * username → bucket mặc định) VÀ mỗi khi đổi tài khoản đăng nhập (nạp lại đúng
 * giao diện của người vừa đăng nhập).
 */
export function applyDisplaySettings(account?: string) {
  applyFontSize(doc(storageKey(BASE_FONT_SIZE, account), DEFAULT_FONT_SIZE));
  applyDensity(doc(storageKey(BASE_DENSITY, account), "gon"));
  applyWidth(doc(storageKey(BASE_WIDTH, account), "toi-da"));
}

export interface DisplaySettingsSnapshot {
  fontSize: string;
  density: string;
  contentWidth: string;
}

/** Chụp cài đặt hiện tại của một tài khoản — để làm mốc "hoàn tác" khi Hủy. */
export function readDisplaySettings(account?: string): DisplaySettingsSnapshot {
  return {
    fontSize: doc(storageKey(BASE_FONT_SIZE, account), DEFAULT_FONT_SIZE),
    density: doc(storageKey(BASE_DENSITY, account), "gon"),
    contentWidth: doc(storageKey(BASE_WIDTH, account), "toi-da"),
  };
}

/** Ghi lại một ảnh cài đặt và áp ngay — dùng để khôi phục khi người dùng Hủy. */
export function writeDisplaySettings(account: string | undefined, snap: DisplaySettingsSnapshot) {
  localStorage.setItem(storageKey(BASE_FONT_SIZE, account), snap.fontSize);
  localStorage.setItem(storageKey(BASE_DENSITY, account), snap.density);
  localStorage.setItem(storageKey(BASE_WIDTH, account), snap.contentWidth);
  applyDisplaySettings(account);
}

/* ---------- Hook dùng chung cho cả nút nhanh và panel đầy đủ ---------- */

function useSettings(account?: string) {
  const fontSizeKey = storageKey(BASE_FONT_SIZE, account);
  const densityKey = storageKey(BASE_DENSITY, account);
  const widthKey = storageKey(BASE_WIDTH, account);

  const [fontSize, setFontSize] = React.useState(() => doc(fontSizeKey, DEFAULT_FONT_SIZE));
  const [density, setDensity] = React.useState(() => doc(densityKey, "gon"));
  const [width, setWidth] = React.useState(() => doc(widthKey, "toi-da"));

  // Đổi tài khoản → nạp lại state từ bucket của người mới rồi áp ngay.
  React.useEffect(() => {
    setFontSize(doc(fontSizeKey, DEFAULT_FONT_SIZE));
    setDensity(doc(densityKey, "gon"));
    setWidth(doc(widthKey, "toi-da"));
    applyDisplaySettings(account);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  return {
    fontSize,
    density,
    width,
    changeFontSize: (id: string) => {
      setFontSize(id);
      localStorage.setItem(fontSizeKey, id);
      applyFontSize(id);
    },
    changeDensity: (id: string) => {
      setDensity(id);
      localStorage.setItem(densityKey, id);
      applyDensity(id);
    },
    changeWidth: (id: string) => {
      setWidth(id);
      localStorage.setItem(widthKey, id);
      applyWidth(id);
    },
    reset: () => {
      setFontSize(DEFAULT_FONT_SIZE);
      setDensity("gon");
      setWidth("toi-da");
      localStorage.removeItem(fontSizeKey);
      localStorage.removeItem(densityKey);
      localStorage.removeItem(widthKey);
      applyDisplaySettings(account);
    },
  };
}

/* ---------- Nút cỡ chữ nhanh, đặt ở header ---------- */

/**
 * Chỉ có cỡ chữ — thứ người dùng cần chỉnh ngay giữa ca làm.
 * Các cấu hình còn lại nằm trong trang "Bộ giao diện".
 */
export function FontSizeQuickPicker({
  className,
  account,
}: {
  className?: string;
  account?: string;
}) {
  const { fontSize, changeFontSize } = useSettings(account);

  return (
    <div
      role="group"
      aria-label="Cỡ chữ"
      className={cn(
        "flex items-center gap-1 rounded-lg border-2 border-input p-1",
        className
      )}
    >
      {/* Nhãn ẩn trên điện thoại: header hẹp, ưu tiên chỗ cho logo */}
      <span className="hidden px-2 text-sm font-medium text-muted-foreground sm:inline">
        Cỡ chữ
      </span>
      {FONT_SIZES.map((m, i) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={fontSize === m.id}
          aria-label={m.description}
          title={m.description}
          onClick={() => changeFontSize(m.id)}
          className={cn(
            "min-h-10 min-w-10 rounded-md px-2 font-semibold press-feedback",
            i === 0 && "text-xs",
            i === 1 && "text-sm",
            i === 2 && "text-base",
            i === 3 && "text-lg",
            i === 4 && "text-xl",
            fontSize === m.id
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-muted"
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Panel đầy đủ, đặt trong trang "Bộ giao diện" ---------- */

function OptionGroup({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (id: string) => void;
  options: readonly { id: string; label: string; description: string }[];
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-semibold text-foreground">{label}</legend>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((m) => {
          const isSelected = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(m.id)}
              className={cn(
                "min-h-14 rounded-lg border-2 px-4 py-3 text-left press-feedback",
                isSelected
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-input bg-background hover:bg-muted"
              )}
            >
              <span className="block text-sm font-semibold">{m.label}</span>
              <span
                className={cn(
                  "block text-sm",
                  isSelected ? "text-accent-foreground" : "text-muted-foreground"
                )}
              >
                {m.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function DisplaySettingsPanel({ account }: { account?: string }) {
  const c = useSettings(account);

  return (
    <div className="space-y-8 rounded-xl border border-border p-5">
      <OptionGroup
        label="Cỡ chữ toàn hệ thống"
        description="Áp cho mọi màn. Bố cục giãn theo, không vỡ như khi phóng to trình duyệt."
        value={c.fontSize}
        onChange={c.changeFontSize}
        options={FONT_SIZES.map((m) => ({
          id: m.id,
          label: `${m.scale}`,
          description: m.description,
        }))}
      />

      <OptionGroup
        label="Mật độ (chiều cao ô nhập và dòng bảng)"
        description="Thoáng dễ bấm nhất. Gọn cho người quen Excel muốn thấy nhiều dòng."
        value={c.density}
        onChange={c.changeDensity}
        options={DENSITIES}
      />

      <OptionGroup
        label="Bề rộng nội dung"
        description="Bảng cân đối nhiều cột thì để Rộng hoặc Tối đa."
        value={c.width}
        onChange={c.changeWidth}
        options={CONTENT_WIDTHS}
      />

      <div className="flex justify-end border-t border-border pt-5">
        <Button
          variant="outline"
          onClick={c.reset}
          title="Trả cỡ chữ, mật độ và giao diện sáng/tối về mức mặc định của hệ thống. Chỉ đổi trên máy này."
        >
          <RotateCcw />
          Đặt lại mặc định
        </Button>
      </div>
    </div>
  );
}
