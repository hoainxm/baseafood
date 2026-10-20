// ============================================================
// Tên file: src/features/export-planning/LoadingView.tsx
// Tên tiếng Việt: Màn của người đóng hàng — chuyến sắp / vừa đóng cont, đính ảnh lớp + sơ đồ
// Description: Phone-first view for loading staff (export-plans.loading only): shipments loading
//              within ±7 days (or without a date), upload layer photos / load plan. No prices.
// ============================================================
// Luật: ba-spec 41 NV9 + R10 — người đóng hàng chỉ THÊM file 4a / 4b, đọc đầu chuyến, không thấy
// giá, không sửa chuyến. Số cont + seal do phòng Kế hoạch điền từ ảnh gửi lên.
import { useState } from "react";
import { Button, Card, CardContent, EmptyState, Field, Input, Tag, addDays } from "@/design-system";
import { filesOfStep, shipmentKindLabel } from "@/lib/exportPlanning";
import { formatDateVN } from "@/lib/format";
import type { Customer, ExportContract, ExportFile, ExportShipment } from "@/types";
import { Camera, ClipboardList, Container } from "lucide-react";
import { FileChips, type PreviewTarget } from "./parts";
import type { LoadingUploadTarget } from "./ShipmentDialogs";

export function LoadingView({
  shipments,
  contracts,
  files,
  customers,
  today,
  canUpload,
  onUpload,
  onPreview,
}: {
  shipments: readonly ExportShipment[];
  contracts: readonly ExportContract[];
  files: readonly ExportFile[];
  customers: readonly Customer[];
  today: string;
  canUpload: boolean;
  onUpload: (t: LoadingUploadTarget) => void;
  onPreview: (f: PreviewTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const from = addDays(today, -7);
  const to = addDays(today, 7);
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  const rows = shipments
    .filter((s) => s.status === "open" && byId.get(s.contractId)?.status !== "cancelled")
    .filter((s) =>
      q
        ? [s.lotCode, s.bookingNo, s.containerNo, byId.get(s.contractId)?.contractNo ?? ""].some((x) => x.toLowerCase().replace(/\s+/g, "").includes(q))
        : !s.loadingDate || (s.loadingDate >= from && s.loadingDate <= to),
    )
    .sort((a, b) => (a.loadingDate || "9999").localeCompare(b.loadingDate || "9999"));
  const nameOf = (s: ExportShipment) => customers.find((c) => c.id === byId.get(s.contractId)?.customerId)?.name || "(khách chưa rõ)";
  const data = { files };

  return (
    <div className="grid min-w-0 gap-4">
      <p className="max-w-3xl text-muted-foreground">
        Chuyến đóng cont trong 7 ngày trước / sau hôm nay. Bấm <b>Đính ảnh</b> để chụp từng lớp hàng (kèm tờ giấy lớp / số thùng), ảnh seal và ảnh số cont.
      </p>
      <Field label="Tìm chuyến" hint="Mã lô, booking, số cont, số hợp đồng — tìm cả chuyến ngoài 7 ngày.">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
      </Field>
      {!rows.length && <EmptyState icon={Container} title="Không có chuyến nào cần đóng" description="Chưa có chuyến đóng cont quanh hôm nay. Tìm theo mã lô / số cont nếu cần chuyến khác." />}
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((s) => {
          const label = [s.lotCode && `Lô ${s.lotCode}`, shipmentKindLabel(s.kind)].filter(Boolean).join(" · ");
          const photos = filesOfStep(data, s.id, "loading-photos");
          const plans = filesOfStep(data, s.id, "loading-plan");
          return (
            <Card key={s.id}>
              <CardContent className="grid gap-3 pt-6">
                <div className="grid gap-1">
                  <p className="font-semibold">
                    {nameOf(s)} · {label}
                  </p>
                  <p className="tnum text-sm text-muted-foreground">
                    {[
                      s.loadingDate ? `Đóng ${formatDateVN(s.loadingDate)}` : "Chưa có ngày đóng",
                      s.bookingNo ? `Booking ${s.bookingNo}` : "Chờ booking",
                      s.containerNo && `Cont ${s.containerNo}`,
                      s.sealNo && `Seal ${s.sealNo}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {s.goodsSummary && <p className="text-sm">{s.goodsSummary}</p>}
                  <div className="flex flex-wrap gap-1">
                    <Tag variant={photos.length ? "done" : "muted"}>{photos.length} ảnh</Tag>
                    <Tag variant={plans.length ? "done" : "muted"}>{plans.length ? "Có sơ đồ" : "Chưa có sơ đồ"}</Tag>
                  </div>
                </div>
                <FileChips files={[...plans, ...photos]} onPreview={onPreview} caption={label} />
                {canUpload && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button onClick={() => onUpload({ shipment: s, contractId: s.contractId, step: "loading-photos", label })} title="Chụp / chọn ảnh từng lớp hàng, seal, số cont của chuyến này.">
                      <Camera className="mr-2 h-4 w-4" aria-hidden />
                      Đính ảnh
                    </Button>
                    <Button variant="outline" onClick={() => onUpload({ shipment: s, contractId: s.contractId, step: "loading-plan", label })} title="Đính file sơ đồ xếp hàng trong container.">
                      <ClipboardList className="mr-2 h-4 w-4" aria-hidden />
                      Đính sơ đồ
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
