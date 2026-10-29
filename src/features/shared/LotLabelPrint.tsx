// ============================================================
// Tem mã lô QR in được — dùng chung cho MỌI loại lô (NL · BTP · TP).
// In ĐÚNG KHỔ TEM (không phải A4) qua LabelPrintSheet — chọn cỡ tem, xem trước phóng
// to, in ra tem nhãn thật. Kết nối thẳng máy in tem (WebUSB/ESC-POS) làm sau.
//
// QR chứa một ĐƯỜNG LINK tới hộ chiếu lô (kiểu GS1 Digital Link): camera điện thoại
// nào quét cũng mở thẳng app đúng lô, không cần mở app trước. Mã trong link là
// "loại:id" — DUY NHẤT (TCVN 13274), còn nhãn đọc được chỉ in cho người xem.
// Tem cũ (QR chỉ chứa mã lô trần) vẫn quét được: xem parseQrCode ở lib/truyXuatLo.
// Thiết kế: docs/spec/qr-truy-xuat-lo.md
// ============================================================
import { useEffect, useState } from "react";
import type { ImportShipment, LotKind } from "@/types";
import { LabelPrintSheet, type PrintLabel } from "@/design-system";
import { kg, formatDateVN } from "@/lib/format";
import { createQrDataUrl } from "@/lib/qr";
import { TRACE_KIND_LABELS, buildLabelPrintRecords, getShipmentLines, formatMaterialLotLabel, buildLotQrUrl, buildLotNode, getDefaultLabelCount, type LotNode } from "@/lib/lotTraceability";
import { useLabelPrints, usePackagings, useWipProductions } from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import { newId } from "@/lib/store";
import { useTraceData } from "./useTraceData";
import { recordName } from "@/lib/personName";

const laLo = (n: LotNode) => n.kind === "S" || n.kind === "W" || n.kind === "P";

/** Các dòng chữ phụ in dưới mã lô. */
function labelLines(node: LotNode): string[] {
  return [
    `${TRACE_KIND_LABELS[node.kind]} · ${node.description}`,
    [node.date && formatDateVN(node.date), node.workshop && `xưởng ${node.workshop}`, node.kg ? kg(Math.round(node.kg * 10) / 10) : ""]
      .filter(Boolean)
      .join(" · "),
    ...node.details.filter((c) => c.label === "Đại lý" || c.label === "SSCC").map((c) => `${c.label}: ${c.value}`),
  ].filter(Boolean);
}

/**
 * Tem cho MỘT hoặc NHIỀU lô (nút đã dựng bằng `buildLotNode`). Nhiều lô ⇒ in một lượt,
 * mỗi tem một nhãn (dùng cho "In tem hàng loạt" và in tem cả mẻ vừa lưu).
 */
export function LotQrLabels({ node, nuts, onClose }: { node?: LotNode; nuts?: LotNode[]; onClose: () => void }) {
  const items = (nuts ?? (node ? [node] : [])).filter(laLo);
  const key = items.map((n) => `${n.kind}:${n.id}`).join("|");
  const [qr, setQr] = useState<Record<string, string>>({});
  useEffect(() => {
    let isCancelled = false;
    // Tên miền lấy từ chính địa chỉ app đang chạy — không ghi cứng trong code.
    Promise.all(
      items.map(async (n) => [`${n.kind}:${n.id}`, await createQrDataUrl(buildLotQrUrl(n.kind as LotKind, n.id, window.location.origin), 320)] as const)
    ).then((cap) => {
      if (!isCancelled) setQr(Object.fromEntries(cap));
    });
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `khoa` đại diện đủ cho ds
  }, [key]);

  // Sổ in tem (mig 0049): bấm In là ghi mỗi lô một dòng — biết lô nào đã có tem,
  // và nhãn in ra lúc đó (nhãn BTP/TP suy lại từ bản ghi có thể đổi về sau).
  const [soIn, saveLabelPrints] = useLabelPrints();
  const { profile } = useAuth();
  const recordPrintCount = (copies: number[]) => {
    const newPrints = buildLabelPrintRecords(items, recordName(profile), new Date().toISOString(), newId, (n) => copies[items.indexOf(n)] ?? 1);
    if (newPrints.length) saveLabelPrints([...soIn, ...newPrints]);
  };

  // Mặc định mỗi block (BTP) / mỗi thùng-gói (TP) một tem; người in sửa được ở xem trước.
  const [wips] = useWipProductions();
  const [packagings] = usePackagings();
  const labels: PrintLabel[] = items.map((n) => ({
    lotCode: n.label,
    qrDataUrl: qr[`${n.kind}:${n.id}`] ?? "",
    lines: labelLines(n),
    copies: getDefaultLabelCount(n, { wips, packagings }),
  }));
  return <LabelPrintSheet onClose={onClose} labels={labels} onPrint={recordPrintCount} />;
}

/**
 * Tem lô NL của một chuyến nhập — giữ API cũ cho màn Nhập hàng. Lô NL = MỖI LOẠI NL
 * của chuyến (chốt 2026-10-08) ⇒ in mỗi loại một tem: cùng mã lô chuyến in to, dòng
 * dưới là loại NL + kg của loại đó, QR trỏ đúng lô loại đó (`S:<id dòng nhập>`).
 * Chuyến chưa có dòng nào trong dữ liệu chung (vừa lưu, chưa nạp) thì dựng tạm một
 * tem theo đầu chuyến như trước.
 */
export function LotLabelPrint({ shipment, onClose }: { shipment: ImportShipment; onClose: () => void }) {
  const { traceData } = useTraceData();
  const byType = getShipmentLines(traceData, shipment.id).map((m) => buildLotNode("S", m.id, traceData));
  if (byType.length) return <LotQrLabels nuts={byType} onClose={onClose} />;
  const placeholder: LotNode = {
    kind: "S",
    id: shipment.id,
    label: formatMaterialLotLabel(shipment),
    description: "nguyên liệu",
    date: shipment.deliveryDate,
    workshop: shipment.workshop,
    kg: 0,
    details: [
      { label: "Đại lý", value: shipment.supplierName || "—" },
      ...(shipment.ssccCode ? [{ label: "SSCC", value: shipment.ssccCode }] : []),
    ],
    isMissing: false,
  };
  return <LotQrLabels node={placeholder} onClose={onClose} />;
}
