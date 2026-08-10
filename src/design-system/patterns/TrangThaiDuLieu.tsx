import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { hasSupabase, supabase, SITE_ID } from "@/lib/supabase";
import { ketNoi } from "@/lib/ketNoi";
import { cn } from "@/lib/utils";
import { Cloud, CloudOff, HardDrive, Loader2, RotateCcw } from "lucide-react";

type Trang = "cuc-bo" | "dang-kiem" | "da-noi" | "loi";

/**
 * Thử một lần đọc thật lên máy chủ để cập nhật đèn trạng thái. Đọc `dai_ly` là
 * phép probe rẻ nhất (bảng nhỏ, luôn có). Kết quả báo vào store `ketNoi` chung —
 * mọi nơi hiển thị trạng thái tự cập nhật.
 */
async function probeKetNoi(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("dai_ly")
    .select("id")
    .eq("site_id", SITE_ID)
    .limit(1);
  if (error) ketNoi.baoLoi(error.message);
  else ketNoi.baoOK();
}

const CAU_HINH: Record<
  Trang,
  { icon: typeof Cloud; chu: string; phu: string; mau: string }
> = {
  "cuc-bo": {
    icon: HardDrive,
    chu: "Lưu trên máy này",
    phu: "Chỉ máy này thấy. Xóa dữ liệu trình duyệt là mất.",
    mau: "text-warning",
  },
  "dang-kiem": {
    icon: Loader2,
    chu: "Đang kiểm tra máy chủ…",
    phu: "",
    mau: "text-muted-foreground",
  },
  "da-noi": {
    icon: Cloud,
    chu: "Đã nối máy chủ",
    phu: `Mọi máy dùng chung số liệu · ${SITE_ID}`,
    mau: "text-success",
  },
  loi: {
    icon: CloudOff,
    chu: "Mất kết nối máy chủ",
    phu: "Đang ghi tạm trên máy, nối lại sẽ đồng bộ.",
    mau: "text-destructive",
  },
};

/** Suy trạng thái hiển thị từ cấu hình môi trường + snapshot store. */
function useTrangKetNoi() {
  const anh = React.useSyncExternalStore(ketNoi.subscribe, ketNoi.laySnapshot);
  const trang: Trang = !hasSupabase
    ? "cuc-bo"
    : anh.trang === "chua-ro"
      ? "dang-kiem"
      : anh.trang;
  return { trang, loi: anh.loi };
}

/**
 * Bản CHI TIẾT (nhiều dòng) — giữ lại cho nơi có chỗ rộng. Header dùng
 * `NutTrangThai` (gom thành 1 nút icon) bên dưới.
 */
export function TrangThaiDuLieu({ className }: { className?: string }) {
  const { trang, loi } = useTrangKetNoi();

  React.useEffect(() => {
    void probeKetNoi();
  }, []);

  const c = CAU_HINH[trang];
  const Icon = c.icon;
  const phu = trang === "loi" ? loi || c.phu : c.phu;

  return (
    <div className={cn("space-y-1", className)}>
      <p className={cn("flex items-center gap-2 text-base font-semibold", c.mau)}>
        <Icon
          className={cn("size-5 shrink-0", trang === "dang-kiem" && "animate-spin")}
          aria-hidden
        />
        {c.chu}
      </p>
      {phu && <p className="text-sm text-muted-foreground">{phu}</p>}
    </div>
  );
}

/**
 * NutTrangThai — 1 nút icon gọn cho header. Màu icon = sức khỏe kết nối thật
 * (bám store `ketNoi`). Bấm mở popover chi tiết + nút "Thử kết nối lại".
 *
 * Probe một lần lúc mở để có trạng thái ban đầu khi người dùng chưa thao tác gì.
 * Trên tablet tay ướt: bấm (không chỉ hover) là mở được — Radix Popover mở bằng
 * cả click lẫn touch.
 */
export function NutTrangThai({ className }: { className?: string }) {
  const { trang, loi } = useTrangKetNoi();
  const [dangThu, setDangThu] = React.useState(false);

  React.useEffect(() => {
    void probeKetNoi();
  }, []);

  const c = CAU_HINH[trang];
  const Icon = c.icon;
  const phu = trang === "loi" ? loi || c.phu : c.phu;
  const coTheThu = hasSupabase && trang !== "dang-kiem";

  const thuLai = async () => {
    setDangThu(true);
    await probeKetNoi();
    setDangThu(false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Trạng thái máy chủ: ${c.chu}`}
          title={c.chu}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-input transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            c.mau,
            className
          )}
        >
          <Icon
            className={cn(
              "size-6",
              (trang === "dang-kiem" || dangThu) && "animate-spin"
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-1">
          <p
            className={cn(
              "flex items-center gap-2 text-base font-semibold",
              c.mau
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {c.chu}
          </p>
          {phu && <p className="text-sm text-muted-foreground">{phu}</p>}
        </div>
        {coTheThu && (
          <button
            type="button"
            onClick={thuLai}
            disabled={dangThu}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-input text-base font-medium transition-colors hover:bg-muted disabled:opacity-60"
          >
            <RotateCcw
              className={cn("size-5", dangThu && "animate-spin")}
              aria-hidden
            />
            {dangThu ? "Đang thử…" : "Thử kết nối lại"}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
