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
import { filesOfStep, shipmentFilesOf, shipmentKindLabel } from "@/lib/exportPlanning";
import { formatDateTimeVN, formatDateVN } from "@/lib/format";
import { hasTransport } from "@/lib/exportBooking";
import type { Customer, ExportContract, ExportFile, ExportShipment, ExportShipmentLine } from "@/types";
import { Camera, ClipboardCheck, ClipboardList, Container } from "lucide-react";
import { loadingCountSummary, shipmentLinesOf } from "@/lib/exportInvoice";
import { ShipmentLineSummary } from "./ShipmentGoods";
import { EXTRA_PHOTO_TEXT, loadingCountText } from "./shipmentGoodsLogic";
import { FileList, type PreviewTarget } from "./parts";
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
  shipmentLines,
  canCount,
  onCount,
  extraPhotosEnabled,
  containerPhotosEnabled = false,
}: {
  shipments: readonly ExportShipment[];
  contracts: readonly ExportContract[];
  files: readonly ExportFile[];
  customers: readonly Customer[];
  today: string;
  canUpload: boolean;
  onUpload: (t: LoadingUploadTarget) => void;
  onPreview: (f: PreviewTarget) => void;
  /** Hàng của chuyến (mig 0096) — rỗng khi máy chủ chưa chạy 0096. Không có giá (R10 ba-spec 41). */
  shipmentLines: readonly ExportShipmentLine[];
  /** Quyền `export-plans.loading` thêm ⇒ điền được số thực đóng. */
  canCount: boolean;
  onCount: (s: ExportShipment) => void;
  /** Mig 0097 đã chạy ⇒ đính ảnh số lượng thực đóng + ảnh bao bì / cân gross. */
  extraPhotosEnabled: boolean;
  /** Mig 0103 (ba-spec 72 R9): người đóng hàng đính ảnh cont / seal. */
  containerPhotosEnabled?: boolean;
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
  const goodsOf = (s: ExportShipment) => shipmentLinesOf(shipmentLines, s.id);

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
                  {/* ba-spec 71 R9: người đóng hàng xem booking + xe (không sửa); file booking vẫn ẩn. */}
                  {s.booking && (s.vesselVoyage || s.booking.returnYard || s.booking.cargoCutoff) && (
                    <p className="tnum text-sm">
                      {[
                        s.vesselVoyage && `Tàu ${s.vesselVoyage}`,
                        s.booking.returnYard && `Hạ bãi ${s.booking.returnYard}`,
                        s.booking.cargoCutoff && `Hạn hạ bãi ${formatDateTimeVN(s.booking.cargoCutoff)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {hasTransport(s.transport) && s.transport && (
                    <p className="tnum text-sm">
                      {[
                        `Xe ${s.transport.haulier}`,
                        s.transport.truckPlate,
                        s.transport.driverName && `Tài xế ${s.transport.driverName}`,
                        s.transport.driverPhone,
                        `Lấy rỗng ${s.transport.emptyPickupPlace}`,
                        `Đóng ${s.transport.stuffingPlace}`,
                        `Hạ bãi ${s.transport.returnYard}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <Tag variant={photos.length ? "done" : "muted"}>{photos.length} ảnh</Tag>
                    <Tag variant={plans.length ? "done" : "muted"}>{plans.length ? "Có sơ đồ" : "Chưa có sơ đồ"}</Tag>
                  </div>
                </div>
                <FileList files={[...plans, ...photos, ...(containerPhotosEnabled ? shipmentFilesOf(data, s.id, "container-seal-photos") : [])]} onPreview={onPreview} caption={label} />
                {(goodsOf(s).length > 0 || canCount) && (
                  <div className="grid min-w-0 gap-2 rounded-lg border border-border px-3 py-1">
                    {goodsOf(s).map((l) => (
                      <ShipmentLineSummary key={l.id} line={l} />
                    ))}
                    <p className="tnum pb-2 text-sm">{loadingCountText(goodsOf(s))}</p>
                    {canCount && (
                      <Button variant={loadingCountSummary(goodsOf(s)).filledCount ? "edit" : "default"} className="mb-2" onClick={() => onCount(s)} title="Đóng cont xong: ghi số kiện thực đã đóng của từng dòng hàng (lấy từ dòng hàng của hợp đồng nếu chuyến chưa có hàng).">
                        <ClipboardCheck className="mr-2 h-4 w-4" aria-hidden />
                        {loadingCountSummary(goodsOf(s)).filledCount ? "Sửa số thực đóng" : "Điền số thực đóng"}
                      </Button>
                    )}
                  </div>
                )}
                {canUpload && containerPhotosEnabled && s.kind !== "consolidated" && (
                  <Button variant="outline" className="h-auto min-h-9 whitespace-normal" onClick={() => onUpload({ shipment: s, contractId: s.contractId, step: "container-seal-photos", label })} title="Chụp số container, seal, cửa cont của chuyến này — bắt buộc: Phòng Kế hoạch điền số và có ảnh thì mục Số cont + seal mới Xong.">
                    <Camera className="mr-2 h-4 w-4" aria-hidden />
                    Ảnh cont / seal{shipmentFilesOf(data, s.id, "container-seal-photos").length ? ` (${shipmentFilesOf(data, s.id, "container-seal-photos").length})` : ""}
                  </Button>
                )}
                {canUpload && extraPhotosEnabled && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["loading-count-photos", "package-weight-photos"] as const).map((step) => {
                      const n = shipmentFilesOf(data, s.id, step).length;
                      return (
                        <Button key={step} variant="outline" className="h-auto min-h-9 whitespace-normal" onClick={() => onUpload({ shipment: s, contractId: s.contractId, step, label })} title={EXTRA_PHOTO_TEXT[step].description}>
                          <Camera className="mr-2 h-4 w-4" aria-hidden />
                          {EXTRA_PHOTO_TEXT[step].title}
                          {n ? ` (${n})` : ""}
                        </Button>
                      );
                    })}
                  </div>
                )}
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
