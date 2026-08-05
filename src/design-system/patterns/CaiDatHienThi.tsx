import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

/* ============================================================
   Cài đặt hiển thị toàn hệ thống.
   Lưu localStorage, áp bằng thuộc tính / biến CSS trên <html>.
   ============================================================ */

const KEY_CO_CHU = "bsf.coChu";
const KEY_MAT_DO = "bsf.matDo";
const KEY_BE_RONG = "bsf.beRong";

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

/** Nạp cài đặt đã lưu — gọi một lần lúc app khởi động, trước khi vẽ. */
export function apDungCaiDatHienThi() {
  apCoChu(doc(KEY_CO_CHU, "100"));
  apMatDo(doc(KEY_MAT_DO, "thoang"));
  apBeRong(doc(KEY_BE_RONG, "vua"));
}

/* ---------- Hook dùng chung cho cả nút nhanh và panel đầy đủ ---------- */

function useCaiDat() {
  const [coChu, setCoChu] = React.useState(() => doc(KEY_CO_CHU, "100"));
  const [matDo, setMatDo] = React.useState(() => doc(KEY_MAT_DO, "thoang"));
  const [beRong, setBeRong] = React.useState(() => doc(KEY_BE_RONG, "vua"));

  return {
    coChu,
    matDo,
    beRong,
    doiCoChu: (id: string) => {
      setCoChu(id);
      localStorage.setItem(KEY_CO_CHU, id);
      apCoChu(id);
    },
    doiMatDo: (id: string) => {
      setMatDo(id);
      localStorage.setItem(KEY_MAT_DO, id);
      apMatDo(id);
    },
    doiBeRong: (id: string) => {
      setBeRong(id);
      localStorage.setItem(KEY_BE_RONG, id);
      apBeRong(id);
    },
    datLai: () => {
      setCoChu("100");
      setMatDo("thoang");
      setBeRong("vua");
      localStorage.removeItem(KEY_CO_CHU);
      localStorage.removeItem(KEY_MAT_DO);
      localStorage.removeItem(KEY_BE_RONG);
      apDungCaiDatHienThi();
    },
  };
}

/* ---------- Nút cỡ chữ nhanh, đặt ở header ---------- */

/**
 * Chỉ có cỡ chữ — thứ người dùng cần chỉnh ngay giữa ca làm.
 * Các cấu hình còn lại nằm trong trang "Bộ giao diện".
 */
export function CoChuNhanh({ className }: { className?: string }) {
  const { coChu, doiCoChu } = useCaiDat();

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

export function CaiDatHienThi() {
  const c = useCaiDat();

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
