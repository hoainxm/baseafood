import * as React from "react";
import { Button } from "@/components/ui/button";
import { ErrorSummary, type LoiNhap } from "./ErrorSummary";
import { ChuThichBatBuoc, useCoOBatBuoc } from "./Field";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

export interface BuocNhap {
  tieuDe: string;
  moTa?: string;
  noiDung: React.ReactNode;
  /** Trả về danh sách lỗi. Rỗng = qua bước. */
  kiemTra?: () => LoiNhap[];
}

/**
 * StepForm — chia form dài thành từng bước.
 *
 * Luật: form quá 5 ô thì chia bước. Mỗi bước hỏi MỘT nhóm việc
 * ("Ai giao?" → "Hàng gì, bao nhiêu?" → "Xe, ghi chú").
 * Bước cuối LUÔN là màn xem lại: đọc to lại toàn bộ số trước khi ghi sổ.
 *
 * Nút "Tiếp" không bao giờ disable — bấm mà thiếu thì hiện ErrorSummary.
 */
export function StepForm({
  steps,
  xemLai,
  onSubmit,
  nhanHoanTat = "Ghi vào sổ",
  onCancel,
}: {
  steps: BuocNhap[];
  /** Nội dung màn xem lại (bước cuối) */
  xemLai: React.ReactNode;
  onSubmit: () => void;
  nhanHoanTat?: string;
  onCancel?: () => void;
}) {
  const [i, setI] = React.useState(0);
  const [loi, setLoi] = React.useState<LoiNhap[]>([]);

  const tong = steps.length + 1; // + màn xem lại
  const laXemLai = i === steps.length;
  const buoc = laXemLai ? null : steps[i];

  const tien = () => {
    const ls = buoc?.kiemTra?.() ?? [];
    setLoi(ls);
    if (ls.length === 0) {
      setLoi([]);
      setI((v) => Math.min(v + 1, steps.length));
    }
  };

  const lui = () => {
    setLoi([]);
    setI((v) => Math.max(0, v - 1));
  };

  // Bước nào có ô bắt buộc thì bước đó mới hiện chú thích dấu *.
  const thanRef = React.useRef<HTMLDivElement>(null);
  const coOBatBuoc = useCoOBatBuoc(thanRef, [i]);

  return (
    <div className="space-y-6">
      {/* Thanh tiến độ — luôn cho biết đang ở đâu và còn bao xa */}
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-base font-semibold text-muted-foreground">
            Bước {i + 1} / {tong}
          </p>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Hủy
            </Button>
          )}
        </div>
        <div className="mt-2 flex gap-2" aria-hidden>
          {Array.from({ length: tong }).map((_, k) => (
            <div
              key={k}
              className={cn(
                "h-3 flex-1 rounded-full",
                k <= i ? "bg-primary" : "bg-secondary"
              )}
            />
          ))}
        </div>
      </div>

      <ErrorSummary loi={loi} />

      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {laXemLai ? "Xem lại trước khi ghi" : buoc!.tieuDe}
        </h2>
        {!laXemLai && buoc!.moTa && (
          <p className="mt-2 text-base text-muted-foreground">{buoc!.moTa}</p>
        )}
        {laXemLai && (
          <p className="mt-2 text-base text-muted-foreground">
            Đọc lại số một lượt. Sai chỗ nào bấm "Quay lại" để sửa.
          </p>
        )}
      </div>

      <div ref={thanRef} className="space-y-6">
        {coOBatBuoc && <ChuThichBatBuoc />}
        {laXemLai ? xemLai : buoc!.noiDung}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          size="lg"
          onClick={lui}
          disabled={i === 0}
          className="sm:w-auto"
        >
          <ArrowLeft />
          Quay lại
        </Button>

        {laXemLai ? (
          <Button size="lg" onClick={onSubmit}>
            <Check />
            {nhanHoanTat}
          </Button>
        ) : (
          <Button size="lg" onClick={tien}>
            Tiếp tục
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
