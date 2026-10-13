// ============================================================
// Tên file: src/features/imports/FormStep.tsx
// Tên tiếng Việt: Khối giao diện của luồng nhập nhanh — thẻ BƯỚC có số, thẻ CHỌN lớn, chuyến trong ngày
// Description: Presentational blocks for the guided import flow (no data access).
// ============================================================
import type { ReactNode } from "react";
import { Button, Tag } from "@/design-system";
import { kg } from "@/lib/format";
import { formatMaterialLotLabel } from "@/lib/lotTraceability";
import { cn } from "@/lib/utils";
import { Check, Pencil, QrCode } from "lucide-react";
import type { ShipmentGroup } from "./importHelpers";

/**
 * Một BƯỚC của phiếu nhập. Đang làm ⇒ mở, viền đậm. Làm xong ⇒ THU lại còn một dòng
 * tóm tắt + nút "Đổi" — màn ngắn lại, mắt chỉ còn nhìn bước đang làm.
 */
export function StepCard({
  so,
  title,
  xong,
  mo,
  summary,
  onDoi,
  children,
}: {
  so: number;
  title: string;
  /** Bước đã có dữ liệu (đổi số thành dấu ✓). */
  xong: boolean;
  /** Đang mở để thao tác. */
  mo: boolean;
  /** Dòng tóm tắt khi thu lại. */
  summary?: ReactNode;
  /** Có thì hiện nút "Đổi" lúc thu lại. */
  onDoi?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border-2 bg-card",
        mo ? "border-primary/50" : "border-border",
      )}
    >
      <div className="flex min-h-12 items-center gap-3 px-4 py-2">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full font-semibold tnum",
            xong
              ? "bg-primary text-primary-foreground"
              : "border-2 border-primary text-primary",
          )}
        >
          {xong ? <Check className="size-4" /> : so}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold", !mo && "text-muted-foreground")}>
            {title}
          </p>
          {!mo && summary && (
            <div className="min-w-0 font-semibold">{summary}</div>
          )}
        </div>
        {!mo && onDoi && (
          <Button
            title={`Mở lại bước "${title}" để chọn lại.`}
            type="button"
            variant="outline"
            size="sm"
            onClick={onDoi}
          >
            <Pencil />
            Đổi
          </Button>
        )}
      </div>
      {mo && (
        <div className="space-y-3 border-t-2 border-border p-4">{children}</div>
      )}
    </section>
  );
}

/** Thẻ chọn LỚN — một chạm. Trạng thái chọn có ✓ + viền đậm, không chỉ báo bằng màu. */
export function ChoiceCard({
  label: cardLabel,
  phu,
  isSelected,
  title,
  onClick,
  icon,
}: {
  label: string;
  phu?: string;
  isSelected?: boolean;
  /** Câu giải thích khi rê chuột (luật nút thao tác). */
  title: string;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={isSelected}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg border-2 px-3 py-2 text-left transition-colors",
        isSelected
          ? "border-primary bg-accent"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted",
      )}
    >
      {icon && (
        <span
          className="shrink-0 text-muted-foreground [&_svg]:size-5"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold break-words">{cardLabel}</span>
        {phu && (
          <span className="block text-sm break-words text-muted-foreground">
            {phu}
          </span>
        )}
      </span>
      {isSelected && (
        <Check className="size-5 shrink-0 text-primary" aria-hidden />
      )}
    </button>
  );
}

/** Các chuyến ĐÃ GHI của ngày + xưởng đang nhập — nhìn ngay cạnh phiếu, khỏi đổi tab. */
export function DayShipmentList({
  nhom,
  isLocked,
  editingGroupKey: editingKey,
  onEdit,
  onPrintLabel,
}: {
  nhom: ShipmentGroup[];
  /** Ngày đã chốt ⇒ không cho sửa. */
  isLocked: boolean;
  /** Khóa nhóm đang mở để sửa (tô nổi). */
  editingGroupKey: string | null;
  onEdit: (n: ShipmentGroup) => void;
  /** Có thì chuyến có mã lô hiện nút in tem QR. */
  onPrintLabel?: (n: ShipmentGroup) => void;
}) {
  if (nhom.length === 0)
    return (
      <p className="rounded-lg border-2 border-dashed border-border px-4 py-5 text-center text-muted-foreground">
        Chưa ghi chuyến nào cho ngày này.
      </p>
    );
  return (
    <ul className="space-y-2">
      {nhom.map((n, i) => (
        <li
          key={n.groupKey}
          className={cn(
            "space-y-1 rounded-lg border-2 px-3 py-2",
            editingKey === n.groupKey
              ? "border-primary bg-accent"
              : "border-border",
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 font-semibold">
              <span className="tnum mr-2 font-normal text-muted-foreground">
                {i + 1}.
              </span>
              {n.supplierName || "(chưa có đại lý)"}
              {n.isBackdated && (
                <Tag variant="luu-y" className="ml-2 align-middle">
                  Ghi bù
                </Tag>
              )}
            </p>
            <span className="tnum shrink-0 font-semibold">{kg(n.totalKg)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">
              {[n.licensePlate, n.driverName].filter(Boolean).join(" · ") ||
                "Không ghi xe"}{" "}
              · {n.dong.length} loại
            </p>
            <span className="flex shrink-0 gap-1">
              {onPrintLabel && n.shipment && (
                <Button
                  title={`In tem QR lô ${formatMaterialLotLabel(n.shipment)} — mỗi loại nguyên liệu của chuyến một tem (loại + kg của loại đó) để dán đúng sọt. Quét tem là ra hộ chiếu lô.`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPrintLabel(n)}
                >
                  <QrCode />
                  Tem
                </Button>
              )}
              {!isLocked && (
                <Button
                  title="Mở lại chuyến này lên phiếu để sửa dòng hàng, số kg hay giá."
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(n)}
                >
                  <Pencil />
                  Sửa
                </Button>
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
