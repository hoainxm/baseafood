// ============================================================
// Tên file: src/features/export-planning/ExportOrderComposer.tsx
// Tên tiếng Việt: Lập Lệnh xuất hàng (Word mẫu QTI-KH-01-07) từ một chuyến xuất
// Description: Wires one export shipment into the generic document composer (ba-spec 72 NV1): source = issued
//              production orders of the shipment (fallback: shipment goods lines) + booking; "previous" = same
//              customer (workshops + Có / Không notes carry over); exporting Word attaches the file to "Lệnh xuất".
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentComposerView } from "@/features/document-composer";
import { useProductionOrderLines, useProductionOrderShipments, useProductionOrders, useProducts } from "@/lib/catalogRepo";
import { downloadExportFile } from "@/lib/exportFileStorage";
import { orderFromFile, readOrderFile, type OrderFile } from "@/lib/productionOrderFile";
import { buildExportOrderLines, exportOrderForm, exportOrderPreviousKey, newExportOrderDocument, type ExportOrderFormSource } from "@/lib/documentTypes/exportOrderForm";
import { currentContractLineId, workingRevision, type ExportData } from "@/lib/exportPlanning";
import { shipmentContainers } from "@/lib/exportContainers";
import type { DocumentValues, ExportContract, ExportShipment } from "@/types";

export function ExportOrderComposer({
  data,
  shipment,
  contract,
  customerName,
  canWrite,
  isAdmin,
  by,
  onBack,
  onExported,
}: {
  data: ExportData;
  shipment: ExportShipment;
  contract: ExportContract;
  customerName: string;
  canWrite: boolean;
  isAdmin: boolean;
  by: string;
  onBack: () => void;
  onExported: (file: Uint8Array, fileName: string, values: DocumentValues) => void;
}) {
  const [orders] = useProductionOrders();
  const [orderLines] = useProductionOrderLines();
  const [links] = useProductionOrderShipments();
  const [products] = useProducts();
  /* ba-spec 72 R2c: file LSX đính ở bước Lệnh sản xuất của chuyến — đọc một lần khi mở bộ soạn (không ghi gì). */
  const lsxFiles = useMemo(
    () => data.files.filter((f) => f.shipmentId === shipment.id && f.step === "production-order" && /\.(docx?|pdf)$/i.test(f.fileName)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.files, shipment.id],
  );
  const [readFiles, setReadFiles] = useState<{ key: string; files: { name: string; file: OrderFile }[] } | null>(null);
  const filesKey = lsxFiles.map((f) => f.path).join("|");
  useEffect(() => {
    let live = true;
    if (!lsxFiles.length) {
      setReadFiles({ key: filesKey, files: [] });
      return;
    }
    void Promise.all(
      lsxFiles.map(async (f) => {
        const blob = await downloadExportFile(f.path);
        const res = blob ? await readOrderFile(blob, f.fileName) : null;
        return res?.ok ? { name: f.fileName, file: res.file } : null;
      }),
    ).then((xs) => live && setReadFiles({ key: filesKey, files: xs.filter((x): x is { name: string; file: OrderFile } => !!x) }));
    return () => {
      live = false;
    };
  }, [filesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const filesReady = readFiles?.key === filesKey;
  const { source, notices } = useMemo((): { source: ExportOrderFormSource; notices: string[] } => {
    const linked = new Set(links.filter((l) => l.shipmentId === shipment.id).map((l) => l.orderId));
    // Dòng HĐ của mọi HĐ có hàng trên chuyến (chuyến gộp — ba-spec 70) để tra size + HS code.
    const appOrders = orders.filter((o) => linked.has(o.id));
    const conts = shipmentContainers(data, shipment); // ba-spec 73: bảng hàng + ô cont theo mọi cont của chuyến
    const contractIds = new Set([
      shipment.contractId,
      ...(data.shipmentLines ?? []).filter((l) => l.shipmentId === shipment.id).map((l) => l.contractId),
      ...appOrders.map((o) => o.contractId),
    ]);
    const contractLines = [...contractIds].flatMap((id) => workingRevision(data, id)?.lines ?? []);
    // HĐ trên chuyến chưa có lệnh đã phát hành trong app ⇒ dùng file LSX đính ở chuyến (file khớp nhiều dòng HĐ nhất).
    const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "";
    const fileOrders: ReturnType<typeof orderFromFile>[] = [];
    const fileNotices: string[] = [];
    const usedFiles = new Set<string>();
    for (const cid of contractIds) {
      if (appOrders.some((o) => o.contractId === cid && o.status === "issued")) continue;
      const lines = workingRevision(data, cid)?.lines ?? [];
      const no = data.contracts.find((c) => c.id === cid)?.contractNo ?? "";
      const best = (readFiles?.files ?? [])
        .filter((f) => !usedFiles.has(f.name))
        .map((f) => ({ f, v: orderFromFile(f.file, { id: `file:${shipment.id}:${f.name}`, contractId: cid, contractNo: no, contractLines: lines, productName }) }))
        .sort((a, b) => b.v.matched - a.v.matched)[0];
      if (!best || !best.v.matched) continue;
      usedFiles.add(best.f.name);
      fileOrders.push(best.v);
      fileNotices.push(
        `Hàng của HĐ ${no} lấy theo file lệnh sản xuất "${best.f.name}" đã đính ở bước Lệnh sản xuất (chưa lập lệnh trong app): tên hàng theo danh mục, MSL ${best.v.order.lotCode || "(file không ghi)"}, ngày SX theo ngày ISO từng dòng, hạn ${best.v.expiry ? best.v.expiry.split("-").reverse().join("/") : "tính theo HSD"}.` +
          (best.v.unmatched ? ` ${best.v.unmatched} dòng của file không khớp dòng hợp đồng nào — thêm tay ở bảng hàng.` : ""),
      );
    }
    const linkedOrders = [...appOrders, ...fileOrders.map((x) => x.order)];
    const built = buildExportOrderLines({
      shipment,
      orders: linkedOrders,
      // Dòng lệnh trỏ id dòng của bản HĐ lúc lập lệnh ⇒ nối sang bản đang dùng, cùng id với Hàng của chuyến.
      orderLines: [
        ...orderLines.map((l) => {
          const o = appOrders.find((x) => x.id === l.orderId);
          const to = o ? currentContractLineId(data, o.contractId, l.contractLineId) : l.contractLineId;
          return to === l.contractLineId ? l : { ...l, contractLineId: to };
        }),
        ...fileOrders.flatMap((x) => x.lines),
      ],
      contractLines,
      shipmentLines: data.shipmentLines ?? [],
      containers: conts,
      overrides: {
        expiry: new Map(fileOrders.filter((x) => x.expiry).map((x) => [x.order.id, x.expiry])),
        productionDates: new Map(fileOrders.flatMap((x) => [...x.datesByLine.entries()])),
      },
    });
    const source = {
      shipment,
      containerKinds: conts.map((c) => c.kind),
      contractNo: contract.contractNo,
      customerName,
      rows: built.rows,
    };
    return { source, notices: [...fileNotices, ...built.notices] };
  }, [links, orders, orderLines, shipment, contract.contractNo, customerName, data, products, readFiles]);
  const previousKey = useMemo(() => exportOrderPreviousKey(source), [source]);
  const isSourceLive = useCallback((id: string) => data.shipments.some((s) => s.id === id && s.status !== "cancelled"), [data.shipments]);
  const label = [contract.contractNo && `HĐ ${contract.contractNo}`, shipment.lotCode && `lô ${shipment.lotCode}`].filter(Boolean).join(" · ");
  // Bảng hàng dựng một lần lúc tạo lệnh mới ⇒ chờ đọc xong file LSX rồi mới mở bộ soạn.
  if (!filesReady)
    return (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        Đang đọc file lệnh sản xuất đã đính ở chuyến để điền bảng hàng…
      </p>
    );
  return (
    <DocumentComposerView
      type={exportOrderForm}
      source={source}
      sourceId={shipment.id}
      sourceTitle={label || "Chuyến chưa có mã lô"}
      sourceRevisionNo={0}
      sourceLive={shipment.status !== "cancelled"}
      previousKey={previousKey}
      isSourceLive={isSourceLive}
      newDocument={(state, meta) => newExportOrderDocument(source, state, meta)}
      onExported={onExported}
      notices={notices}
      canWrite={canWrite}
      isAdmin={isAdmin}
      by={by}
      onBack={onBack}
    />
  );
}
