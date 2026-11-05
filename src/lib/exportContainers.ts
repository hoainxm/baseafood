// ============================================================
// Tên file: src/lib/exportContainers.ts
// Tên tiếng Việt: Cont của chuyến xuất (một chuyến nhiều cont — ba-spec 73)
// Description: Pure helpers for multi-container export shipments: container list (cont 1 on the shipment +
//              extra containers table), line ↔ container grouping, quantity text, remove gate.
// ============================================================
import type { ExportContainerKind, ExportFile, ExportShipment, ExportShipmentContainer, ExportShipmentKind, ExportShipmentLine } from "@/types";

/** Chuyến đi bằng container riêng (đếm vào số cont của HĐ, cần số cont + seal). */
export const isContainerKind = (k: ExportShipmentKind) => k !== "truck" && k !== "consolidated";

export const CONTAINER_KINDS: readonly ExportContainerKind[] = ["20RF", "40RF", "40HC-RF"];

/** Một cont của chuyến. `id` "" = cont 1 (loại / số / seal nằm trên chuyến); khác "" = cont thêm (bảng 0106). */
export interface ContainerView {
  id: string;
  /** Thứ tự hiển thị, từ 1. */
  no: number;
  kind: ExportShipmentKind;
  containerNo: string;
  sealNo: string;
  /** Ngày đóng của cont — cont thêm để trống thì theo ngày đóng của chuyến. */
  loadingDate: string;
}

type ContainerData = { shipmentContainers?: readonly ExportShipmentContainer[] };
const NO_CONTAINERS: readonly ExportShipmentContainer[] = [];

/** Cont thêm của chuyến, theo thứ tự (R1). Chuyến không phải cont lạnh ⇒ không có cont thêm (R2). */
export function extraContainersOf(d: ContainerData, s: Pick<ExportShipment, "id" | "kind">): ExportShipmentContainer[] {
  if (!isContainerKind(s.kind)) return [];
  return (d.shipmentContainers ?? NO_CONTAINERS)
    .filter((c) => c.shipmentId === s.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

/** Mọi cont của chuyến: cont 1 từ chuyến + cont thêm (R1). Chuyến cũ ⇒ đúng 1 cont. */
export function shipmentContainers(
  d: ContainerData,
  s: Pick<ExportShipment, "id" | "kind" | "containerNo" | "sealNo" | "loadingDate">,
): ContainerView[] {
  const first: ContainerView = { id: "", no: 1, kind: s.kind, containerNo: s.containerNo, sealNo: s.sealNo, loadingDate: s.loadingDate };
  return [
    first,
    ...extraContainersOf(d, s).map((c, i) => ({ id: c.id, no: i + 2, kind: c.kind, containerNo: c.containerNo, sealNo: c.sealNo, loadingDate: c.loadingDate || s.loadingDate })),
  ];
}

export const isMultiContainer = (d: ContainerData, s: Pick<ExportShipment, "id" | "kind">) => extraContainersOf(d, s).length > 0;

/** Số cont của chuyến tính vào độ phủ HĐ / báo cáo (R10): xe tải / đóng ghép = 0. */
export const containerCountOf = (d: ContainerData, s: Pick<ExportShipment, "id" | "kind">) => (isContainerKind(s.kind) ? 1 + extraContainersOf(d, s).length : 0);

/** "40HC-RF + 20RF" — loại của các cont theo thứ tự (thẻ chuyến, AC-2). */
export function shipmentContainerSummary(d: ContainerData, s: Pick<ExportShipment, "id" | "kind">): string {
  return [s.kind, ...extraContainersOf(d, s).map((c) => c.kind)].join(" + ");
}

/** "1 x 40HC-RF + 1 x 20RF", "2 x 40RF" — các cont gom theo loại, giữ thứ tự xuất hiện (Lệnh xuất, R7). */
export function containerQuantityText(kinds: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${n} x ${k}`).join(" + ");
}

/** Cont của một dòng: id cont thêm còn tồn tại trên chuyến, không thì "" (cont 1) — R4. */
export function lineContainerId(l: Pick<ExportShipmentLine, "containerId">, validIds: ReadonlySet<string>): string {
  const id = l.containerId ?? "";
  return id && validIds.has(id) ? id : "";
}

/** Dòng hàng của chuyến nhóm theo cont (R5), đủ mọi cont kể cả cont chưa có dòng, theo thứ tự cont. */
export function linesByContainer<L extends Pick<ExportShipmentLine, "containerId">>(
  containers: readonly ContainerView[],
  lines: readonly L[],
): { container: ContainerView; lines: L[] }[] {
  const ids = new Set(containers.map((c) => c.id).filter(Boolean));
  const groups = new Map(containers.map((c) => [c.id, [] as L[]]));
  for (const l of lines) groups.get(lineContainerId(l, ids))?.push(l);
  return containers.map((c) => ({ container: c, lines: groups.get(c.id) ?? [] }));
}

/** Xóa cont thêm còn dòng gán ⇒ chặn, trả các dòng (R4, AC-4). */
export function removeContainerGate(
  d: { shipmentLines?: readonly ExportShipmentLine[] },
  container: Pick<ExportShipmentContainer, "id" | "shipmentId">,
): { ok: boolean; blockingLines: ExportShipmentLine[] } {
  const blockingLines = (d.shipmentLines ?? []).filter((l) => l.shipmentId === container.shipmentId && l.containerId === container.id);
  return { ok: blockingLines.length === 0, blockingLines };
}

/** Ảnh của một cont: ảnh gắn id cont đó; ảnh không gắn cont / gắn cont đã xóa thuộc cont 1 (R6). */
export function filesOfContainer(files: readonly ExportFile[], containers: readonly ContainerView[], containerId: string): ExportFile[] {
  const ids = new Set(containers.map((c) => c.id).filter(Boolean));
  return files.filter((f) => {
    const own = f.containerId && ids.has(f.containerId) ? f.containerId : "";
    return own === containerId;
  });
}

/** Nhãn ngắn của một cont để in / hiện: "Cont 2 · 20RF · TGHU1234567". */
export function containerLabel(c: Pick<ContainerView, "no" | "kind" | "containerNo">): string {
  return [`Cont ${c.no}`, c.kind, c.containerNo.trim()].filter(Boolean).join(" · ");
}
