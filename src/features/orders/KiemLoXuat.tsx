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
import { KhungQuetQr } from "@/features/shared";
import { useAuth } from "@/lib/auth";
import { useLotDispatches } from "@/lib/catalogRepo";
import type { LotStock } from "@/lib/inventory";
import { newId } from "@/lib/store";
import { kg, formatDateVN } from "@/lib/format";
import { docMaQr, formatWipLotLabel, findLots, type LotNode } from "@/lib/lotTraceability";
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
  nhan: string;
  productId: string;
  spec: string;
  kg: number;
  block: number;
}

export function KiemLoXuat({
  lenh,
  dongLenh,
  tatCaDongLenh,
  onLuuDongLenh,
  ton,
  sanXuat,
  matHang,
  onClose,
}: {
  lenh: ExportOrder;
  /** Các dòng của RIÊNG lệnh này. */
  dongLenh: readonly ExportItem[];
  /** Mọi dòng lệnh xuất (để ghi khi thay lô). */
  tatCaDongLenh: readonly ExportItem[];
  onLuuDongLenh: (rows: ExportItem[]) => void;
  /** Tồn từng lô hiện tại (đã trừ mọi lệnh xuất, kể cả lệnh này). */
  ton: readonly LotStock[];
  sanXuat: readonly WipProductionItem[];
  matHang: readonly Product[];
  onClose: () => void;
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [lotDispatches, saveLotDispatches] = useLotDispatches();
  const { nguoiDung } = useAuth();
  const recordedBy = nguoiDung?.fullName || nguoiDung?.username || "";
  /** Đề nghị thay lô đang chờ xác nhận. */
  const [deNghi, setDeNghi] = useState<{ cu: OrderLot; moi: LotNode } | null>(null);

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
  // Gom dòng lệnh theo lô (một lô có thể tách nhiều dòng).
  const lotsOfOrder = useMemo(() => {
    const m = new Map<string, OrderLot>();
    for (const d of dongLenh) {
      const w = sanXuat.find((x) => x.id === d.wipId);
      const prev = m.get(d.wipId);
      m.set(d.wipId, {
        wipId: d.wipId,
        nhan: w ? formatWipLotLabel(w) : d.wipId,
        productId: d.productId,
        spec: d.spec,
        kg: (prev?.kg ?? 0) + (d.quantityKg || 0),
        block: (prev?.block ?? 0) + (d.blocksCount || 0),
      });
    }
    return [...m.values()];
  }, [dongLenh, sanXuat]);

  /** Lô đã quét kiểm = có dấu export_item cho mọi dòng của lô đó trong lệnh. */
  const checked = useMemo(() => {
    const s = new Set<string>();
    for (const l of lotsOfOrder) {
      const dong = dongLenh.filter((d) => d.wipId === l.wipId);
      if (dong.every((d) => lotDispatches.some((x) => x.docKind === "export_item" && x.docId === d.id && x.lotId === l.wipId)))
        s.add(l.wipId);
    }
    return s;
  }, [lotsOfOrder, dongLenh, lotDispatches]);

  /** Dấu "đã quét kiểm" cho mọi dòng lệnh của một lô. */
  const makeCheckDispatches = (wipId: string, label: string, dong: readonly ExportItem[], cach: LotDispatch["method"]): LotDispatch[] => {
    const luc = new Date().toISOString();
    return dong.map((d) => ({
      id: newId(), lotKind: "W", lotId: wipId, lotLabel: label, docKind: "export_item", docId: d.id,
      quantityKg: d.quantityKg || null, method: cach, operator: recordedBy, recordedAt: luc,
    }));
  };

  const checkLot = (text: string, cach: "quet" | "go") => {
    const ma = docMaQr(text);
    if (!ma) return;
    const ds = findLots(ma, {
      shipments: [], imports: [], wips: [...sanXuat], packagings: [], lotInputs: [],
      exportItems: [], exportOrders: [], salesOrders: [], products: [...matHang], customers: [],
    }).filter((n) => n.kind === "W");
    setTypedCode("");
    if (ds.length === 0) {
      notify.error(`"${text.trim()}" không phải tem lô bán thành phẩm.`);
      return;
    }
    const trung = ds.find((n) => lotsOfOrder.some((l) => l.wipId === n.id));
    if (trung) {
      if (checked.has(trung.id)) {
        notify.warning(`Lô ${trung.nhan} đã kiểm rồi.`);
        return;
      }
      saveLotDispatches([...lotDispatches, ...makeCheckDispatches(trung.id, trung.nhan, dongLenh.filter((d) => d.wipId === trung.id), cach)]);
      notify.saved(`Đúng lô ${trung.nhan} — đã ghi kiểm.`);
      return;
    }
    // Lô ngoài lệnh: cùng mặt hàng × quy cách với một lô CHƯA quét, đủ tồn ⇒ đề nghị thay.
    const n = ds[0]!;
    const w = sanXuat.find((x) => x.id === n.id);
    const cho = w ? lotsOfOrder.find((l) => !checked.has(l.wipId) && l.productId === w.productId && l.spec === w.spec) : undefined;
    const remaining = ton.find((t) => t.wipId === n.id)?.conLai ?? 0;
    if (!w || !cho) {
      notify.error(`Lô ${n.nhan} KHÔNG thuộc lệnh xuất này${w ? " và khác mặt hàng các lô còn chờ" : ""} — đừng xếp lên xe.`);
      return;
    }
    if (w.status !== "da-nhap" || remaining < cho.kg) {
      notify.error(
        `Lô ${n.nhan} cùng mặt hàng nhưng ${w.status !== "da-nhap" ? "chưa duyệt nhập kho" : `chỉ còn ${kg(Math.max(0, remaining))}, không đủ thay ${kg(cho.kg)}`} — đừng xếp lên xe.`
      );
      return;
    }
    setDeNghi({ cu: cho, moi: n });
  };

  const thayLo = () => {
    if (!deNghi) return;
    const { cu, moi } = deNghi;
    const prevRows = [...tatCaDongLenh];
    const prevDispatches = lotDispatches;
    const doi = (d: ExportItem) => d.exportId === lenh.id && d.wipId === cu.wipId;
    const updatedItems = tatCaDongLenh.map((d) => (doi(d) ? { ...d, wipId: moi.id } : d));
    onLuuDongLenh(updatedItems);
    saveLotDispatches([...lotDispatches, ...makeCheckDispatches(moi.id, moi.nhan, updatedItems.filter((d) => d.exportId === lenh.id && d.wipId === moi.id), "quet")]);
    setDeNghi(null);
    notify.saved(`Đã thay lô ${cu.nhan} bằng ${moi.nhan} trong lệnh xuất — đã ghi kiểm.`, () => {
      onLuuDongLenh(prevRows);
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
            Lệnh xuất {formatDateVN(lenh.exportDate)} · {lotsOfOrder.length} lô. Quét tem từng block khi xếp hàng — đúng lô thì ghi
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
              <Input value={typedCode} onChange={(e) => setTypedCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && checkLot(typedCode, "go")} />
            </Field>
            <Button title="Kiểm lô theo mã vừa gõ." variant="outline" className="w-full sm:w-auto" onClick={() => checkLot(typedCode, "go")}>
              <Search />
              Kiểm
            </Button>
          </div>
          {isScanning && <KhungQuetQr onQuet={(t) => checkLot(t, "quet")} />}

          <p className="font-semibold">
            Đã kiểm <span className="tnum">{checked.size}</span> / {lotsOfOrder.length} lô{" "}
            {du && <Tag variant="xong">Đủ lô</Tag>}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {lotsOfOrder.map((l) => (
              <li key={l.wipId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="tnum mr-2 font-semibold">{l.nhan}</span>
                  {tenMH(l.productId)}
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
        open={deNghi !== null}
        onOpenChange={(o) => !o && setDeNghi(null)}
        title={deNghi ? `Thay lô ${deNghi.cu.nhan} bằng ${deNghi.moi.nhan}?` : ""}
        description="Lô vừa quét không có trong lệnh nhưng cùng mặt hàng và quy cách với một lô chưa quét. Thay thì lệnh xuất trỏ sang lô đang xếp lên xe: tồn kho trừ lô mới, lô cũ trả về kho, hồ sơ thu hồi ghi đúng lô thật. Còn nút Hoàn tác."
        detail={deNghi ? `${tenMH(deNghi.cu.productId)} · ${kg(deNghi.cu.kg)}${deNghi.cu.block ? ` · ${deNghi.cu.block} block` : ""}` : undefined}
        confirmLabel="Thay lô"
        icon={ArrowLeftRight}
        onConfirm={thayLo}
      />
    </Dialog>
  );
}
