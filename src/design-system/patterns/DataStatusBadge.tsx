// ============================================================
// Tên file cũ: src/design-system/patterns/DataSyncStatus.tsx
// Tên tiếng Việt: Badge trạng thái đồng bộ dữ liệu máy chủ
// Description: Server Sync & Connectivity Status Indicator
// ============================================================
import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { hasSupabase, supabase, SITE_ID } from "@/lib/supabase";
import { connectivity } from "@/lib/connectivity";
import { cn } from "@/lib/utils";
import { Cloud, CloudOff, HardDrive, Loader2, RotateCcw } from "lucide-react";

type SyncState = "cuc-bo" | "dang-kiem" | "da-noi" | "loi";

/**
 * Thử một lần đọc thật lên máy chủ để cập nhật đèn trạng thái. Đọc `dai_ly` là
 * phép probe rẻ nhất (bảng nhỏ, luôn có). Kết quả báo vào store `connectivity` chung —
 * mọi nơi hiển thị trạng thái tự cập nhật.
 */
async function probeConnection(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("site_id", SITE_ID)
    .limit(1);
  if (error) connectivity.reportError(error.message);
  else connectivity.reportOk();
}

const STATUS_CONFIG: Record<
  SyncState,
  { icon: typeof Cloud; label: string; hint: string; color: string }
> = {
  "cuc-bo": {
    icon: HardDrive,
    label: "Lưu trên máy này",
    hint: "Chỉ máy này thấy. Xóa dữ liệu trình duyệt là mất.",
    color: "text-warning",
  },
  "dang-kiem": {
    icon: Loader2,
    label: "Đang kiểm tra máy chủ…",
    hint: "",
    color: "text-muted-foreground",
  },
  "da-noi": {
    icon: Cloud,
    label: "Đã nối máy chủ",
    hint: `Mọi máy dùng chung số liệu · ${SITE_ID}`,
    color: "text-success",
  },
  loi: {
    icon: CloudOff,
    label: "Mất kết nối máy chủ",
    hint: "Đang ghi tạm trên máy, nối lại sẽ đồng bộ.",
    color: "text-destructive",
  },
};

/** Suy trạng thái hiển thị từ cấu hình môi trường + snapshot store. */
function useConnectionStatus() {
  const snapshot = React.useSyncExternalStore(connectivity.subscribe, connectivity.getSnapshot);
  const status: SyncState = !hasSupabase
    ? "cuc-bo"
    : snapshot.trang === "chua-ro"
      ? "dang-kiem"
      : snapshot.trang;
  return { trang: status, loi: snapshot.loi };
}

/**
 * Bản CHI TIẾT (nhiều dòng) — giữ lại cho nơi có chỗ rộng. Header dùng
 * `DataSyncStatusButton` (gom thành 1 nút icon) bên dưới.
 */
export function DataSyncStatus({ className }: { className?: string }) {
  const { trang: state, loi } = useConnectionStatus();

  React.useEffect(() => {
    void probeConnection();
  }, []);

  const c = STATUS_CONFIG[state];
  const Icon = c.icon;
  const phu = state === "loi" ? loi || c.hint : c.hint;

  return (
    <div className={cn("space-y-1", className)}>
      <p className={cn("flex items-center gap-2 text-sm font-semibold", c.color)}>
        <Icon
          className={cn("size-5 shrink-0", state === "dang-kiem" && "animate-spin")}
          aria-hidden
        />
        {c.label}
      </p>
      {phu && <p className="text-sm text-muted-foreground">{phu}</p>}
    </div>
  );
}

/**
 * DataSyncStatusButton — 1 nút icon gọn cho header. Màu icon = sức khỏe kết nối thật
 * (bám store `connectivity`). Bấm mở popover chi tiết + nút "Thử kết nối lại".
 *
 * Probe một lần lúc mở để có trạng thái ban đầu khi người dùng chưa thao tác gì.
 * Trên tablet tay ướt: bấm (không chỉ hover) là mở được — Radix Popover mở bằng
 * cả click lẫn touch.
 */
export function DataSyncStatusButton({ className }: { className?: string }) {
  const { trang: state, loi } = useConnectionStatus();
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    void probeConnection();
  }, []);

  const c = STATUS_CONFIG[state];
  const Icon = c.icon;
  const phu = state === "loi" ? loi || c.hint : c.hint;
  const canRetry = hasSupabase && state !== "dang-kiem";

  const retry = async () => {
    setIsRetrying(true);
    await probeConnection();
    setIsRetrying(false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Trạng thái máy chủ: ${c.label}`}
          title={c.label}
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-input press-feedback hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            c.color,
            className
          )}
        >
          <Icon
            className={cn(
              "size-5",
              (state === "dang-kiem" || isRetrying) && "animate-spin"
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-1">
          <p
            className={cn(
              "flex items-center gap-2 text-sm font-semibold",
              c.color
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {c.label}
          </p>
          {phu && <p className="text-sm text-muted-foreground">{phu}</p>}
        </div>
        {canRetry && (
          <button
            type="button"
            onClick={retry}
            disabled={isRetrying}
            className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-input text-sm font-medium press-feedback hover:bg-muted disabled:opacity-60"
          >
            <RotateCcw
              className={cn("size-5", isRetrying && "animate-spin")}
              aria-hidden
            />
            {isRetrying ? "Đang thử…" : "Thử kết nối lại"}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
