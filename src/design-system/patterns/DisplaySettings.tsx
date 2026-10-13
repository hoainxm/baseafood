// ============================================================
// Tên file cũ: src/design-system/patterns/CaiDatHienThi.tsx
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

function khoa(base: string, account?: string) {
  return account ? `bsf.${account}.${base}` : `bsf.${base}`;
}

/** MẶC ĐỊNH là "100" — thang token nền 16px (mật độ web thường). Người mắt kém
 *  kéo lên 110–130% như một lối phóng to; ai muốn gọn hơn nữa hạ 90%. Thang rem
 *  nên bố cục giãn theo, không vỡ như phóng to trình duyệt. */
export const CO_CHU = [
  { id: "90", nhan: "A", scale: "90%", moTa: "Nhỏ — 14px" },
  { id: "100", nhan: "A", scale: "100%", moTa: "Thường — 16px" },
  { id: "110", nhan: "A", scale: "110%", moTa: "Lớn — 18px" },
  { id: "120", nhan: "A", scale: "120%", moTa: "Rất lớn — 19px" },
  { id: "130", nhan: "A", scale: "130%", moTa: "Cực lớn — 21px" },
] as const;

/** Bậc cỡ chữ mặc định khi chưa ai chọn gì. */
export const CO_CHU_MAC_DINH = "100";

export const MAT_DO = [
  { id: "thoang", nhan: "Thoáng", moTa: "Ô cao 44px — dễ bấm nhất" },
  { id: "vua", nhan: "Vừa", moTa: "Ô cao 40px" },
  { id: "gon", nhan: "Gọn", moTa: "Ô cao 36px — thấy nhiều dòng hơn" },
] as const;

export const BE_RONG = [
  { id: "vua", nhan: "Vừa", moTa: "Dễ đọc, ít đảo mắt", css: "64rem" },
  { id: "rong", nhan: "Rộng", moTa: "Bảng nhiều cột đỡ chật", css: "80rem" },
  { id: "toi-da", nhan: "Tối đa", moTa: "Dùng hết màn hình", css: "100%" },
] as const;

function doc(key: string, fallback: string) {
  return localStorage.getItem(key) ?? fallback;
}

function applyFontSize(id: string) {
  const m = CO_CHU.find((x) => x.id === id) ?? CO_CHU[0];
  document.documentElement.style.setProperty("--app-font-scale", m.scale);
}

function applyDensity(id: string) {
  document.documentElement.setAttribute("data-density", id);
}

function applyWidth(id: string) {
  const m = BE_RONG.find((x) => x.id === id) ?? BE_RONG[0];
  document.documentElement.style.setProperty("--app-content-width", m.css);
}

/**
 * Nạp cài đặt đã lưu và áp vào `<html>`. Gọi lúc app khởi động (chưa có
 * username → bucket mặc định) VÀ mỗi khi đổi tài khoản đăng nhập (nạp lại đúng
 * giao diện của người vừa đăng nhập).
 */
export function apDungCaiDatHienThi(account?: string) {
  applyFontSize(doc(khoa(BASE_FONT_SIZE, account), CO_CHU_MAC_DINH));
  applyDensity(doc(khoa(BASE_DENSITY, account), "gon"));
  applyWidth(doc(khoa(BASE_WIDTH, account), "toi-da"));
}

export interface AnhCaiDat {
  coChu: string;
  matDo: string;
  beRong: string;
}

/** Chụp cài đặt hiện tại của một tài khoản — để làm mốc "hoàn tác" khi Hủy. */
export function docCaiDatHienThi(account?: string): AnhCaiDat {
  return {
    coChu: doc(khoa(BASE_FONT_SIZE, account), CO_CHU_MAC_DINH),
    matDo: doc(khoa(BASE_DENSITY, account), "gon"),
    beRong: doc(khoa(BASE_WIDTH, account), "toi-da"),
  };
}

/** Ghi lại một ảnh cài đặt và áp ngay — dùng để khôi phục khi người dùng Hủy. */
export function ghiCaiDatHienThi(account: string | undefined, snap: AnhCaiDat) {
  localStorage.setItem(khoa(BASE_FONT_SIZE, account), snap.coChu);
  localStorage.setItem(khoa(BASE_DENSITY, account), snap.matDo);
  localStorage.setItem(khoa(BASE_WIDTH, account), snap.beRong);
  apDungCaiDatHienThi(account);
}

/* ---------- Hook dùng chung cho cả nút nhanh và panel đầy đủ ---------- */

function useSettings(account?: string) {
  const fontSizeKey = khoa(BASE_FONT_SIZE, account);
  const densityKey = khoa(BASE_DENSITY, account);
  const widthKey = khoa(BASE_WIDTH, account);

  const [fontSize, setFontSize] = React.useState(() => doc(fontSizeKey, CO_CHU_MAC_DINH));
  const [density, setDensity] = React.useState(() => doc(densityKey, "gon"));
  const [width, setWidth] = React.useState(() => doc(widthKey, "toi-da"));

  // Đổi tài khoản → nạp lại state từ bucket của người mới rồi áp ngay.
  React.useEffect(() => {
    setFontSize(doc(fontSizeKey, CO_CHU_MAC_DINH));
    setDensity(doc(densityKey, "gon"));
    setWidth(doc(widthKey, "toi-da"));
    apDungCaiDatHienThi(account);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  return {
    coChu: fontSize,
    matDo: density,
    beRong: width,
    doiCoChu: (id: string) => {
      setFontSize(id);
      localStorage.setItem(fontSizeKey, id);
      applyFontSize(id);
    },
    doiMatDo: (id: string) => {
      setDensity(id);
      localStorage.setItem(densityKey, id);
      applyDensity(id);
    },
    doiBeRong: (id: string) => {
      setWidth(id);
      localStorage.setItem(widthKey, id);
      applyWidth(id);
    },
    datLai: () => {
      setFontSize(CO_CHU_MAC_DINH);
      setDensity("gon");
      setWidth("toi-da");
      localStorage.removeItem(fontSizeKey);
      localStorage.removeItem(densityKey);
      localStorage.removeItem(widthKey);
      apDungCaiDatHienThi(account);
    },
  };
}

/* ---------- Nút cỡ chữ nhanh, đặt ở header ---------- */

/**
 * Chỉ có cỡ chữ — thứ người dùng cần chỉnh ngay giữa ca làm.
 * Các cấu hình còn lại nằm trong trang "Bộ giao diện".
 */
export function CoChuNhanh({
  className,
  taiKhoan,
}: {
  className?: string;
  taiKhoan?: string;
}) {
  const { coChu, doiCoChu } = useSettings(taiKhoan);

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
      {CO_CHU.map((m, i) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={coChu === m.id}
          aria-label={m.moTa}
          title={m.moTa}
          onClick={() => doiCoChu(m.id)}
          className={cn(
            "min-h-10 min-w-10 rounded-md px-2 font-semibold nhan-an",
            i === 0 && "text-xs",
            i === 1 && "text-sm",
            i === 2 && "text-base",
            i === 3 && "text-lg",
            i === 4 && "text-xl",
            coChu === m.id
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-muted"
          )}
        >
          {m.nhan}
        </button>
      ))}
    </div>
  );
}

/* ---------- Panel đầy đủ, đặt trong trang "Bộ giao diện" ---------- */

function OptionGroup({
  nhan,
  moTa,
  giaTri,
  onChange,
  muc,
}: {
  nhan: string;
  moTa: string;
  giaTri: string;
  onChange: (id: string) => void;
  muc: readonly { id: string; nhan: string; moTa: string }[];
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-semibold text-foreground">{nhan}</legend>
      <p className="text-sm text-muted-foreground">{moTa}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {muc.map((m) => {
          const isSelected = m.id === giaTri;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(m.id)}
              className={cn(
                "min-h-14 rounded-lg border-2 px-4 py-3 text-left nhan-an",
                isSelected
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-input bg-background hover:bg-muted"
              )}
            >
              <span className="block text-sm font-semibold">{m.nhan}</span>
              <span
                className={cn(
                  "block text-sm",
                  isSelected ? "text-accent-foreground" : "text-muted-foreground"
                )}
              >
                {m.moTa}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CaiDatHienThi({ taiKhoan }: { taiKhoan?: string }) {
  const c = useSettings(taiKhoan);

  return (
    <div className="space-y-8 rounded-xl border border-border p-5">
      <OptionGroup
        nhan="Cỡ chữ toàn hệ thống"
        moTa="Áp cho mọi màn. Bố cục giãn theo, không vỡ như khi phóng to trình duyệt."
        giaTri={c.coChu}
        onChange={c.doiCoChu}
        muc={CO_CHU.map((m) => ({
          id: m.id,
          nhan: `${m.scale}`,
          moTa: m.moTa,
        }))}
      />

      <OptionGroup
        nhan="Mật độ (chiều cao ô nhập và dòng bảng)"
        moTa="Thoáng dễ bấm nhất. Gọn cho người quen Excel muốn thấy nhiều dòng."
        giaTri={c.matDo}
        onChange={c.doiMatDo}
        muc={MAT_DO}
      />

      <OptionGroup
        nhan="Bề rộng nội dung"
        moTa="Bảng cân đối nhiều cột thì để Rộng hoặc Tối đa."
        giaTri={c.beRong}
        onChange={c.doiBeRong}
        muc={BE_RONG}
      />

      <div className="flex justify-end border-t border-border pt-5">
        <Button
          variant="outline"
          onClick={c.datLai}
          title="Trả cỡ chữ, mật độ và giao diện sáng/tối về mức mặc định của hệ thống. Chỉ đổi trên máy này."
        >
          <RotateCcw />
          Đặt lại mặc định
        </Button>
      </div>
    </div>
  );
}
