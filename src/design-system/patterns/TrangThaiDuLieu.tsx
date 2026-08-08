import * as React from "react";
import { hasSupabase, supabase, SITE_ID } from "@/lib/supabase";
import { ketNoi } from "@/lib/ketNoi";
import { cn } from "@/lib/utils";
import { Cloud, CloudOff, HardDrive, Loader2 } from "lucide-react";

type Trang = "cuc-bo" | "dang-kiem" | "da-noi" | "loi";

/**
 * Cho biết dữ liệu đang nằm ở đâu — câu hỏi người dùng hay hỏi nhất khi
 * chuyển máy. Nói thẳng hệ quả ("chỉ máy này thấy") thay vì tên công nghệ.
 *
 * Màu đèn bám theo KẾT QUẢ ĐỌC/GHI THẬT của repo.ts (qua store `ketNoi`):
 * ghi bảng bất kỳ lỗi là đỏ ngay, không còn kiểu probe 1 bảng 1 lần rồi xanh
 * mãi. Có thêm một probe lúc mở chỉ để có trạng thái ban đầu khi chưa thao tác.
 */
export function TrangThaiDuLieu({ className }: { className?: string }) {
  const anh = React.useSyncExternalStore(ketNoi.subscribe, ketNoi.laySnapshot);

  React.useEffect(() => {
    if (!supabase) return;
    let huy = false;
    (async () => {
      const { error } = await supabase
        .from("dai_ly")
        .select("id")
        .eq("site_id", SITE_ID)
        .limit(1);
      if (huy) return;
      if (error) ketNoi.baoLoi(error.message);
      else ketNoi.baoOK();
    })();
    return () => {
      huy = true;
    };
  }, []);

  const trang: Trang = !hasSupabase
    ? "cuc-bo"
    : anh.trang === "chua-ro"
      ? "dang-kiem"
      : anh.trang;
  const loi = anh.loi;

  const cauHinh: Record<
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
      phu: loi || "Đang ghi tạm trên máy, nối lại sẽ đồng bộ.",
      mau: "text-destructive",
    },
  };

  const c = cauHinh[trang];
  const Icon = c.icon;

  return (
    <div className={cn("space-y-1", className)}>
      <p className={cn("flex items-center gap-2 text-base font-semibold", c.mau)}>
        <Icon
          className={cn("size-5 shrink-0", trang === "dang-kiem" && "animate-spin")}
          aria-hidden
        />
        {c.chu}
      </p>
      {c.phu && <p className="text-sm text-muted-foreground">{c.phu}</p>}
    </div>
  );
}
