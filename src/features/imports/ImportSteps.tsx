// ============================================================
// Tên file: src/features/imports/FormStep.tsx
// Tên tiếng Việt: Danh sách chuyến đã ghi trong ngày (cột phải màn Nhập hàng)
// Description: Presentational list of the day's saved shipments (no data access).
// ============================================================
import { Button, Tag } from "@/design-system";
import { kg } from "@/lib/format";
import { formatMaterialLotLabel } from "@/lib/lotTraceability";
import { cn } from "@/lib/utils";
import { Pencil, QrCode } from "lucide-react";
import type { ShipmentGroup } from "./importHelpers";

/** Các chuyến ĐÃ GHI của ngày + xưởng đang nhập — nhìn ngay cạnh phiếu, khỏi đổi tab. */
export function DayShipmentList({
  groups: group,
  isLocked,
  editingGroupKey: editingKey,
  onEdit,
  onPrintLabel,
}: {
  groups: ShipmentGroup[];
  /** Ngày đã chốt ⇒ không cho sửa. */
  isLocked: boolean;
  /** Khóa nhóm đang mở để sửa (tô nổi). */
  editingGroupKey: string | null;
  onEdit: (n: ShipmentGroup) => void;
  /** Có thì chuyến có mã lô hiện nút in tem QR. */
  onPrintLabel?: (n: ShipmentGroup) => void;
}) {
  if (group.length === 0)
    return (
      <p className="rounded-lg border-2 border-dashed border-border px-4 py-5 text-center text-muted-foreground">
        Chưa ghi chuyến nào cho ngày này.
      </p>
    );
  return (
    <ul className="space-y-2">
      {group.map((n, i) => (
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
                <Tag variant="warning" className="ml-2 align-middle">
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
              · {n.rows.length} loại
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
                  variant="edit"
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
