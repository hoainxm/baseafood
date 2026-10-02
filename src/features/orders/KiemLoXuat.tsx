// ============================================================
// KIỂM LÔ LỆNH XUẤT bằng quét tem (đợt 2 truy xuất QR).
// Lệnh xuất chọn lô BTP theo FIFO (SalesOrderScreen.taoLenhXuat) — máy biết phải
// xuất lô nào, nhưng người xếp container có thể bốc nhầm block. Hộp này liệt kê
// đúng các lô của lệnh; thủ kho quét tem từng block: đúng lô thì đánh dấu ✓, sai
// lô thì cảnh báo ngay để KHÔNG xếp lên xe. Chỉ kiểm tại chỗ — không ghi sổ, không
// đổi lệnh (lệnh xuất đã trừ tồn; sửa lệnh là việc khác).
// Thiết kế: docs/spec/qr-truy-xuat-lo.md §6c
// ============================================================
import { useMemo, useState } from "react";
import type { ExportItem, ExportOrder, Product, WipProductionItem } from "@/types";
import { KhungQuetQr } from "@/features/shared";
import { kg, viDate } from "@/lib/format";
import { docMaQr, nhanLoBtp, timLo } from "@/lib/truyXuatLo";
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
  Nhan,
  notify,
} from "@/design-system";
import { Camera, CameraOff, Search } from "lucide-react";

export function KiemLoXuat({
  lenh,
  dongLenh,
  sanXuat,
  matHang,
  onClose,
}: {
  lenh: ExportOrder;
  /** Các dòng của RIÊNG lệnh này. */
  dongLenh: readonly ExportItem[];
  sanXuat: readonly WipProductionItem[];
  matHang: readonly Product[];
  onClose: () => void;
}) {
  const [dangQuet, setDangQuet] = useState(false);
  const [maGo, setMaGo] = useState("");
  const [daKiem, setDaKiem] = useState<Set<string>>(new Set());

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
  // Gom dòng lệnh theo lô (một lô có thể tách nhiều dòng).
  const loCuaLenh = useMemo(() => {
    const m = new Map<string, { wipId: string; nhan: string; productId: string; kg: number; block: number }>();
    for (const d of dongLenh) {
      const w = sanXuat.find((x) => x.id === d.wipId);
      const cu = m.get(d.wipId);
      m.set(d.wipId, {
        wipId: d.wipId,
        nhan: w ? nhanLoBtp(w) : d.wipId,
        productId: d.productId,
        kg: (cu?.kg ?? 0) + (d.quantityKg || 0),
        block: (cu?.block ?? 0) + (d.blocksCount || 0),
      });
    }
    return [...m.values()];
  }, [dongLenh, sanXuat]);

  const kiem = (text: string) => {
    const ma = docMaQr(text);
    if (!ma) return;
    const ds = timLo(ma, {
      shipments: [], imports: [], wips: [...sanXuat], packagings: [], lotInputs: [],
      exportItems: [], exportOrders: [], salesOrders: [], products: [...matHang], customers: [],
    }).filter((n) => n.kind === "W");
    setMaGo("");
    if (ds.length === 0) {
      notify.loi(`"${text.trim()}" không phải tem lô bán thành phẩm.`);
      return;
    }
    const trung = ds.find((n) => loCuaLenh.some((l) => l.wipId === n.id));
    if (!trung) {
      notify.loi(`Lô ${ds[0]!.nhan} KHÔNG thuộc lệnh xuất này — đừng xếp lên xe.`);
      return;
    }
    if (daKiem.has(trung.id)) {
      notify.canhBao(`Lô ${trung.nhan} đã kiểm rồi.`);
      return;
    }
    setDaKiem((cu) => new Set(cu).add(trung.id));
    notify.daLuu(`Đúng lô ${trung.nhan}`);
  };

  const du = loCuaLenh.length > 0 && daKiem.size === loCuaLenh.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Kiểm lô bằng quét tem</DialogTitle>
          <DialogDescription className="text-base">
            Lệnh xuất {viDate(lenh.exportDate)} · {loCuaLenh.length} lô. Quét tem từng block khi xếp hàng — sai lô app báo ngay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button
              title={dangQuet ? "Tắt camera." : "Bật camera quét tem QR trên block."}
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDangQuet((v) => !v)}
            >
              {dangQuet ? <CameraOff /> : <Camera />}
              {dangQuet ? "Tắt camera" : "Quét tem"}
            </Button>
            <Field label="Hoặc gõ mã lô trên tem" className="min-w-0 flex-1">
              <Input value={maGo} onChange={(e) => setMaGo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && kiem(maGo)} />
            </Field>
            <Button title="Kiểm lô theo mã vừa gõ." variant="outline" className="w-full sm:w-auto" onClick={() => kiem(maGo)}>
              <Search />
              Kiểm
            </Button>
          </div>
          {dangQuet && <KhungQuetQr onQuet={kiem} />}

          <p className="font-semibold">
            Đã kiểm <span className="tnum">{daKiem.size}</span> / {loCuaLenh.length} lô{" "}
            {du && <Nhan loai="xong">Đủ lô</Nhan>}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {loCuaLenh.map((l) => (
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
                {daKiem.has(l.wipId) ? <Nhan loai="xong">Đã quét</Nhan> : <Nhan loai="cho">Chưa quét</Nhan>}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">Kiểm tại chỗ, không lưu — đóng hộp là làm lại từ đầu.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
