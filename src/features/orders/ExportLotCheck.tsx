// ============================================================
// KIỂM LÔ LỆNH XUẤT bằng quét tem (truy xuất QR — đợt 2a, nâng ở 2b).
// Lệnh xuất chọn lô BTP theo FIFO (SalesOrderScreen.taoLenhXuat) — máy biết phải
// xuất lô nào, nhưng người xếp container có thể bốc lô khác. Hộp này liệt kê đúng
// các lô của lệnh; thủ kho quét tem từng block:
//   • đúng lô ⇒ GHI "đã quét kiểm" (lot_dispatches, doc export_item — bằng chứng
//     xếp đúng lô; đóng hộp mở lại vẫn còn);
//   • lô khác CÙNG mặt hàng × quy cách, còn đủ tồn ⇒ hỏi THAY LÔ: sửa dòng lệnh trỏ
//     sang lô đang cầm trên tay (ghi đè ⇒ xác nhận trước + Hoàn tác). Hồ sơ thu hồi
//     khi đó đúng lô thật đã lên xe;
//   • lô khác mặt hàng / hết tồn ⇒ báo đỏ, đừng xếp lên xe.
// Thiết kế: docs/spec/qr-truy-xuat-lo.md §6c–6d
// ============================================================
import { useMemo, useState } from "react";
import type { ExportItem, ExportOrder, LotDispatch, Product, WipProductionItem } from "@/types";
import { QrScanner } from "@/features/shared";
import { useAuth } from "@/lib/auth";
import { useLotDispatches } from "@/lib/catalogRepo";
import type { LotStock } from "@/lib/inventory";
import { newId } from "@/lib/store";
import { kg, formatDateVN } from "@/lib/format";
import { parseQrCode, formatWipLotLabel, findLots, type LotNode } from "@/lib/lotTraceability";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Tag,
  ConfirmAction,
  notify,
} from "@/design-system";
import { ArrowLeftRight, Camera, CameraOff, Search } from "lucide-react";

interface OrderLot {
  wipId: string;
  label: string;
  productId: string;
  spec: string;
  kg: number;
  block: number;
}

export function ExportLotCheck({
  exportOrder: order,
  orderItems,
  allOrderItems: allExportItems,
  onSaveOrderItems: onSaveExportItems,
  lotStock: stock,
  wips,
  matHang: products,
  onClose,
}: {
  exportOrder: ExportOrder;
  /** Các dòng của RIÊNG lệnh này. */
  orderItems: readonly ExportItem[];
  /** Mọi dòng lệnh xuất (để ghi khi thay lô). */
  allOrderItems: readonly ExportItem[];
  onSaveOrderItems: (rows: ExportItem[]) => void;
  /** Tồn từng lô hiện tại (đã trừ mọi lệnh xuất, kể cả lệnh này). */
  lotStock: readonly LotStock[];
  wips: readonly WipProductionItem[];
  matHang: readonly Product[];
  onClose: () => void;
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [lotDispatches, saveLotDispatches] = useLotDispatches();
  const { profile } = useAuth();
  const recordedBy = profile?.fullName || profile?.username || "";
  /** Đề nghị thay lô đang chờ xác nhận. */
  const [proposal, setProposal] = useState<{ current: OrderLot; replacement: LotNode } | null>(null);

  const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";
  // Gom dòng lệnh theo lô (một lô có thể tách nhiều dòng).
  const lotsOfOrder = useMemo(() => {
    const m = new Map<string, OrderLot>();
    for (const d of orderItems) {
      const w = wips.find((x) => x.id === d.wipId);
      const prev = m.get(d.wipId);
      m.set(d.wipId, {
        wipId: d.wipId,
        label: w ? formatWipLotLabel(w) : d.wipId,
        productId: d.productId,
        spec: d.spec,
        kg: (prev?.kg ?? 0) + (d.quantityKg || 0),
        block: (prev?.block ?? 0) + (d.blocksCount || 0),
      });
    }
    return [...m.values()];
  }, [orderItems, wips]);

  /** Lô đã quét kiểm = có dấu export_item cho mọi dòng của lô đó trong lệnh. */
  const checked = useMemo(() => {
    const s = new Set<string>();
    for (const l of lotsOfOrder) {
      const dong = orderItems.filter((d) => d.wipId === l.wipId);
      if (dong.every((d) => lotDispatches.some((x) => x.docKind === "export_item" && x.docId === d.id && x.lotId === l.wipId)))
        s.add(l.wipId);
    }
    return s;
  }, [lotsOfOrder, orderItems, lotDispatches]);

  /** Dấu "đã quét kiểm" cho mọi dòng lệnh của một lô. */
  const makeCheckDispatches = (wipId: string, label: string, dong: readonly ExportItem[], method: LotDispatch["method"]): LotDispatch[] => {
    const luc = new Date().toISOString();
    return dong.map((d) => ({
      id: newId(), lotKind: "W", lotId: wipId, lotLabel: label, docKind: "export_item", docId: d.id,
      quantityKg: d.quantityKg || null, method, operator: recordedBy, recordedAt: luc,
    }));
  };

  const checkLot = (text: string, method: "scan" | "typed") => {
    const ma = parseQrCode(text);
    if (!ma) return;
    const items = findLots(ma, {
      shipments: [], imports: [], wips: [...wips], packagings: [], lotInputs: [],
      exportItems: [], exportOrders: [], salesOrders: [], products: [...products], customers: [],
    }).filter((n) => n.kind === "W");
    setTypedCode("");
    if (items.length === 0) {
      notify.error(`"${text.trim()}" không phải tem lô bán thành phẩm.`);
      return;
    }
    const matchedLot = items.find((n) => lotsOfOrder.some((l) => l.wipId === n.id));
    if (matchedLot) {
      if (checked.has(matchedLot.id)) {
        notify.warning(`Lô ${matchedLot.label} đã kiểm rồi.`);
        return;
      }
      saveLotDispatches([...lotDispatches, ...makeCheckDispatches(matchedLot.id, matchedLot.label, orderItems.filter((d) => d.wipId === matchedLot.id), method)]);
      notify.saved(`Đúng lô ${matchedLot.label} — đã ghi kiểm.`);
      return;
    }
    // Lô ngoài lệnh: cùng mặt hàng × quy cách với một lô CHƯA quét, đủ tồn ⇒ đề nghị thay.
    const n = items[0]!;
    const w = wips.find((x) => x.id === n.id);
    const cho = w ? lotsOfOrder.find((l) => !checked.has(l.wipId) && l.productId === w.productId && l.spec === w.spec) : undefined;
    const remaining = stock.find((t) => t.wipId === n.id)?.remainingKg ?? 0;
    if (!w || !cho) {
      notify.error(`Lô ${n.label} KHÔNG thuộc lệnh xuất này${w ? " và khác mặt hàng các lô còn chờ" : ""} — đừng xếp lên xe.`);
      return;
    }
    if (w.status !== "stocked" || remaining < cho.kg) {
      notify.error(
        `Lô ${n.label} cùng mặt hàng nhưng ${w.status !== "stocked" ? "chưa duyệt nhập kho" : `chỉ còn ${kg(Math.max(0, remaining))}, không đủ thay ${kg(cho.kg)}`} — đừng xếp lên xe.`
      );
      return;
    }
    setProposal({ current: cho, replacement: n });
  };

  const thayLo = () => {
    if (!proposal) return;
    const { current: oldLot, replacement: replacementLot } = proposal;
    const prevRows = [...allExportItems];
    const prevDispatches = lotDispatches;
    const doi = (d: ExportItem) => d.exportId === order.id && d.wipId === oldLot.wipId;
    const updatedItems = allExportItems.map((d) => (doi(d) ? { ...d, wipId: replacementLot.id } : d));
    onSaveExportItems(updatedItems);
    saveLotDispatches([...lotDispatches, ...makeCheckDispatches(replacementLot.id, replacementLot.label, updatedItems.filter((d) => d.exportId === order.id && d.wipId === replacementLot.id), "scan")]);
    setProposal(null);
    notify.saved(`Đã thay lô ${oldLot.label} bằng ${replacementLot.label} trong lệnh xuất — đã ghi kiểm.`, () => {
      onSaveExportItems(prevRows);
      saveLotDispatches(prevDispatches);
    });
  };

  const du = lotsOfOrder.length > 0 && checked.size === lotsOfOrder.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Kiểm lô bằng quét tem</DialogTitle>
          <DialogDescription className="text-base">
            Lệnh xuất {formatDateVN(order.exportDate)} · {lotsOfOrder.length} lô. Quét tem từng block khi xếp hàng — đúng lô thì ghi
            kiểm, sai lô app báo ngay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button
              title={isScanning ? "Tắt camera." : "Bật camera quét tem QR trên block."}
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsScanning((v) => !v)}
            >
              {isScanning ? <CameraOff /> : <Camera />}
              {isScanning ? "Tắt camera" : "Quét tem"}
            </Button>
            <Field label="Hoặc gõ mã lô trên tem" className="min-w-0 flex-1">
              <Input value={typedCode} onChange={(e) => setTypedCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && checkLot(typedCode, "typed")} />
            </Field>
            <Button title="Kiểm lô theo mã vừa gõ." variant="outline" className="w-full sm:w-auto" onClick={() => checkLot(typedCode, "typed")}>
              <Search />
              Kiểm
            </Button>
          </div>
          {isScanning && <QrScanner onScan={(t) => checkLot(t, "scan")} />}

          <p className="font-semibold">
            Đã kiểm <span className="tnum">{checked.size}</span> / {lotsOfOrder.length} lô{" "}
            {du && <Tag variant="xong">Đủ lô</Tag>}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {lotsOfOrder.map((l) => (
              <li key={l.wipId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="tnum mr-2 font-semibold">{l.label}</span>
                  {productNameOf(l.productId)}
                  <span className="text-muted-foreground">
                    {" "}
                    · <span className="tnum">{kg(l.kg)}</span>
                    {l.block ? ` · ${l.block} block` : ""}
                  </span>
                </span>
                {checked.has(l.wipId) ? <Tag variant="xong">Đã quét</Tag> : <Tag variant="cho">Chưa quét</Tag>}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Kết quả kiểm được lưu — đóng hộp mở lại vẫn còn. Lô ngoài lệnh mà cùng mặt hàng, còn đủ tồn thì app hỏi thay lô.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmAction
        open={proposal !== null}
        onOpenChange={(o) => !o && setProposal(null)}
        title={proposal ? `Thay lô ${proposal.current.label} bằng ${proposal.replacement.label}?` : ""}
        description="Lô vừa quét không có trong lệnh nhưng cùng mặt hàng và quy cách với một lô chưa quét. Thay thì lệnh xuất trỏ sang lô đang xếp lên xe: tồn kho trừ lô mới, lô cũ trả về kho, hồ sơ thu hồi ghi đúng lô thật. Còn nút Hoàn tác."
        detail={proposal ? `${productNameOf(proposal.current.productId)} · ${kg(proposal.current.kg)}${proposal.current.block ? ` · ${proposal.current.block} block` : ""}` : undefined}
        confirmLabel="Thay lô"
        icon={ArrowLeftRight}
        onConfirm={thayLo}
      />
    </Dialog>
  );
}
