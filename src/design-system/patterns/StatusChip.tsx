import { cn } from "@/lib/utils";

/**
 * StatusChip — chip trạng thái cho các màn MES (dây chuyền, lệnh sản xuất, kho
 * lạnh). Luật hệ: màu KHÔNG bao giờ là tín hiệu duy nhất → luôn có chấm màu +
 * nhãn chữ. Màu bám token `--status-*` (đăng ký thành bg-status-* / text-*-ink).
 */
export type TrangThaiSX =
  | "running"
  | "idle"
  | "stopped"
  | "maintenance"
  | "changeover";

const STATUS: Record<
  TrangThaiSX,
  { nhan: string; cham: string; chu: string; nen: string; vien: string }
> = {
  running: { nhan: "Đang chạy", cham: "bg-status-running", chu: "text-status-running-ink", nen: "bg-status-running/15", vien: "border-status-running/40" },
  idle: { nhan: "Chờ việc", cham: "bg-status-idle", chu: "text-status-idle-ink", nen: "bg-status-idle/15", vien: "border-status-idle/40" },
  stopped: { nhan: "Dừng", cham: "bg-status-stopped", chu: "text-status-stopped-ink", nen: "bg-status-stopped/15", vien: "border-status-stopped/40" },
  maintenance: { nhan: "Bảo trì", cham: "bg-status-maintenance", chu: "text-status-maintenance-ink", nen: "bg-status-maintenance/15", vien: "border-status-maintenance/40" },
  changeover: { nhan: "Chuyển mã", cham: "bg-status-changeover", chu: "text-status-changeover-ink", nen: "bg-status-changeover/15", vien: "border-status-changeover/40" },
};

export function StatusChip({
  trangThai,
  nhan,
  className,
}: {
  trangThai: TrangThaiSX;
  nhan?: string;
  className?: string;
}) {
  const s = STATUS[trangThai];
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm font-semibold",
        s.nen,
        s.vien,
        s.chu,
        className
      )}
    >
      <span className={cn("size-2.5 shrink-0 rounded-full", s.cham)} aria-hidden />
      {nhan ?? s.nhan}
    </span>
  );
}
