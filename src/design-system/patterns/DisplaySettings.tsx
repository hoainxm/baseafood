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
const BASE_CO_CHU = "coChu";
const BASE_MAT_DO = "matDo";
const BASE_BE_RONG = "beRong";

function khoa(base: string, taiKhoan?: string) {
  return taiKhoan ? `bsf.${taiKhoan}.${base}` : `bsf.${base}`;
}

export const CO_CHU = [
  { id: "100", nhan: "A", scale: "100%", moTa: "Thường — 18px" },
  { id: "110", nhan: "A", scale: "110%", moTa: "Hơi lớn — 20px" },
  { id: "120", nhan: "A", scale: "120%", moTa: "Lớn — 22px" },
  { id: "130", nhan: "A", scale: "130%", moTa: "Rất lớn — 23px" },
] as const;

export const MAT_DO = [
  { id: "thoang", nhan: "Thoáng", moTa: "Ô cao 48px — dễ bấm nhất" },
  { id: "vua", nhan: "Vừa", moTa: "Ô cao 44px" },
  { id: "gon", nhan: "Gọn", moTa: "Ô cao 40px — thấy nhiều dòng hơn" },
] as const;

export const BE_RONG = [
  { id: "vua", nhan: "Vừa", moTa: "Dễ đọc, ít đảo mắt", css: "64rem" },
  { id: "rong", nhan: "Rộng", moTa: "Bảng nhiều cột đỡ chật", css: "80rem" },
  { id: "toi-da", nhan: "Tối đa", moTa: "Dùng hết màn hình", css: "100%" },
] as const;

function doc(key: string, macDinh: string) {
  return localStorage.getItem(key) ?? macDinh;
}

function apCoChu(id: string) {
  const m = CO_CHU.find((x) => x.id === id) ?? CO_CHU[0];
  document.documentElement.style.setProperty("--app-font-scale", m.scale);
}

function apMatDo(id: string) {
  document.documentElement.setAttribute("data-density", id);
}

function apBeRong(id: string) {
  const m = BE_RONG.find((x) => x.id === id) ?? BE_RONG[0];
  document.documentElement.style.setProperty("--app-content-width", m.css);
}

/**
 * Nạp cài đặt đã lưu và áp vào `<html>`. Gọi lúc app khởi động (chưa có
 * username → bucket mặc định) VÀ mỗi khi đổi tài khoản đăng nhập (nạp lại đúng
 * giao diện của người vừa đăng nhập).
 */
export function apDungCaiDatHienThi(taiKhoan?: string) {
  apCoChu(doc(khoa(BASE_CO_CHU, taiKhoan), "100"));
  apMatDo(doc(khoa(BASE_MAT_DO, taiKhoan), "gon"));
  apBeRong(doc(khoa(BASE_BE_RONG, taiKhoan), "toi-da"));
}

export interface AnhCaiDat {
  coChu: string;
  matDo: string;
  beRong: string;
}

/** Chụp cài đặt hiện tại của một tài khoản — để làm mốc "hoàn tác" khi Hủy. */
export function docCaiDatHienThi(taiKhoan?: string): AnhCaiDat {
  return {
    coChu: doc(khoa(BASE_CO_CHU, taiKhoan), "100"),
    matDo: doc(khoa(BASE_MAT_DO, taiKhoan), "gon"),
    beRong: doc(khoa(BASE_BE_RONG, taiKhoan), "toi-da"),
  };
}

/** Ghi lại một ảnh cài đặt và áp ngay — dùng để khôi phục khi người dùng Hủy. */
export function ghiCaiDatHienThi(taiKhoan: string | undefined, snap: AnhCaiDat) {
  localStorage.setItem(khoa(BASE_CO_CHU, taiKhoan), snap.coChu);
  localStorage.setItem(khoa(BASE_MAT_DO, taiKhoan), snap.matDo);
  localStorage.setItem(khoa(BASE_BE_RONG, taiKhoan), snap.beRong);
  apDungCaiDatHienThi(taiKhoan);
}

/* ---------- Hook dùng chung cho cả nút nhanh và panel đầy đủ ---------- */

function useCaiDat(taiKhoan?: string) {
  const kCoChu = khoa(BASE_CO_CHU, taiKhoan);
  const kMatDo = khoa(BASE_MAT_DO, taiKhoan);
  const kBeRong = khoa(BASE_BE_RONG, taiKhoan);

  const [coChu, setCoChu] = React.useState(() => doc(kCoChu, "100"));
  const [matDo, setMatDo] = React.useState(() => doc(kMatDo, "gon"));
  const [beRong, setBeRong] = React.useState(() => doc(kBeRong, "toi-da"));

  // Đổi tài khoản → nạp lại state từ bucket của người mới rồi áp ngay.
  React.useEffect(() => {
    setCoChu(doc(kCoChu, "100"));
    setMatDo(doc(kMatDo, "gon"));
    setBeRong(doc(kBeRong, "toi-da"));
    apDungCaiDatHienThi(taiKhoan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taiKhoan]);

  return {
    coChu,
    matDo,
    beRong,
    doiCoChu: (id: string) => {
      setCoChu(id);
      localStorage.setItem(kCoChu, id);
      apCoChu(id);
    },
    doiMatDo: (id: string) => {
      setMatDo(id);
      localStorage.setItem(kMatDo, id);
      apMatDo(id);
    },
    doiBeRong: (id: string) => {
      setBeRong(id);
      localStorage.setItem(kBeRong, id);
      apBeRong(id);
    },
    datLai: () => {
      setCoChu("100");
      setMatDo("gon");
      setBeRong("toi-da");
      localStorage.removeItem(kCoChu);
      localStorage.removeItem(kMatDo);
      localStorage.removeItem(kBeRong);
      apDungCaiDatHienThi(taiKhoan);
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
  const { coChu, doiCoChu } = useCaiDat(taiKhoan);

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
            "min-h-10 min-w-10 rounded-md px-2 font-semibold transition-colors",
            i === 0 && "text-sm",
            i === 1 && "text-base",
            i === 2 && "text-lg",
            i === 3 && "text-xl",
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

function NhomChon({
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
      <p className="text-base text-muted-foreground">{moTa}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {muc.map((m) => {
          const chon = m.id === giaTri;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={chon}
              onClick={() => onChange(m.id)}
              className={cn(
                "min-h-16 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                chon
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-input bg-background hover:bg-muted"
              )}
            >
              <span className="block text-base font-semibold">{m.nhan}</span>
              <span
                className={cn(
                  "block text-sm",
                  chon ? "text-accent-foreground" : "text-muted-foreground"
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
  const c = useCaiDat(taiKhoan);

  return (
    <div className="space-y-8 rounded-xl border-2 border-border p-5">
      <NhomChon
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

      <NhomChon
        nhan="Mật độ (chiều cao ô nhập và dòng bảng)"
        moTa="Thoáng dễ bấm nhất. Gọn cho người quen Excel muốn thấy nhiều dòng."
        giaTri={c.matDo}
        onChange={c.doiMatDo}
        muc={MAT_DO}
      />

      <NhomChon
        nhan="Bề rộng nội dung"
        moTa="Bảng cân đối nhiều cột thì để Rộng hoặc Tối đa."
        giaTri={c.beRong}
        onChange={c.doiBeRong}
        muc={BE_RONG}
      />

      <div className="flex justify-end border-t border-border pt-5">
        <Button variant="outline" onClick={c.datLai}>
          <RotateCcw />
          Đặt lại mặc định
        </Button>
      </div>
    </div>
  );
}
