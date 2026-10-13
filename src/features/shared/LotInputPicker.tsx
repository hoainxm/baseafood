// ============================================================
// Hộp GẮN LÔ — mối nối của chuỗi truy xuất (docs/spec/qr-truy-xuat-lo.md).
//   • LotInputPicker: đầu ra (mẻ SX BTP · phiếu đóng gói TP) đã dùng lô nào
//     ⇒ bảng lot_inputs (Transformation Event của EPCIS, mig 0046).
//   • LotDispatchPicker:   hàng ra (dòng bán lẻ · bán nội địa NL) lấy từ lô nào
//     ⇒ bảng lot_dispatches (mig 0056).
//
// Ba đường nhập NGANG HÀNG — hàng đông hay bong tem, không để việc tắc vì tem hỏng:
//   1. QUÉT tem QR bằng camera
//   2. GÕ mã lô in trên tem
//   3. CHỌN từ danh sách lô gợi ý
// kg là TÙY CHỌN (chưa cân thì để trống, bổ sung sau) — gắn lô quan trọng hơn.
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import type { LotDispatch, LotDispatchDoc, LotInput, LotKind, Workshop } from "@/types";
import { useAuth } from "@/lib/auth";
import { kg as kgChu, formatDateVN } from "@/lib/format";
import {
  TRACE_KIND_LABELS,
  buildLotStockIndex,
  computeLotMassBalance,
  parseQrCode,
  explainMultipleLots,
  listSelectableWipLots,
  listSelectableMaterialLots,
  buildLotNode,
  findLots,
  getLotStockKg,
  type TraceData,
  type LotNode,
} from "@/lib/lotTraceability";
import { Button, EmptyState, Field, FormDialog, Input, Tag, NumberField, CloseButton, notify } from "@/design-system";
import { Camera, CameraOff, Link2, Plus, Trash2 } from "lucide-react";
import { QrScanner } from "./QrScanner";
import { useTraceData } from "./useTraceData";

const METHOD_NAMES: Record<LotInput["method"] | LotDispatch["method"], string> = { quet: "quét", go: "gõ", chon: "chọn", fifo: "máy chọn" };

/** Một mối nối đã gắn, hiện trong mục "Đã gắn". */
interface LinkedInput {
  id: string;
  label: string;
  description: string;
  kg: number | null;
  method: LotInput["method"] | LotDispatch["method"];
  operator: string;
}

/**
 * Lõi dùng chung: quét / gõ / chọn lô, kg tùy chọn, danh sách đã gắn (bỏ được,
 * có Hoàn tác). Bên gọi quyết định ghi vào bảng nào qua `onThem` / `onBo`.
 */
function LotInputDialog({
  title,
  description,
  inputKind,
  inputLabel,
  dl,
  linkedInputs,
  candidates,
  candidatesTitle,
  validateNode: checkNode,
  onAdd,
  onBo,
  onClose,
}: {
  title: string;
  description: string;
  inputKind: LotKind;
  inputLabel: string;
  dl: TraceData;
  linkedInputs: LinkedInput[];
  candidates: LotNode[];
  candidatesTitle: string;
  /** Kiểm thêm (VD đúng mặt hàng). Trả câu cảnh báo để chặn, hoặc null. */
  validateNode?: (n: LotNode) => string | null;
  onAdd: (node: LotNode, method: LotInput["method"], kg: number | null) => void;
  onBo: (id: string) => void;
  onClose: () => void;
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [inputKg, setInputKg] = useState<number | null>(null);
  const [choices, setChoices] = useState<LotNode[]>([]); // một mã nhiều lô ⇒ cho người chọn
  const [pickPrompt, setPickPrompt] = useState("");
  // Sổ tồn theo lô dựng MỘT lần cho cả danh sách — tính lại từng dòng là O(n²).
  const lotStockTable = useMemo(() => buildLotStockIndex(dl), [dl]);

  const addLot = (node: LotNode, method: LotInput["method"]) => {
    if (node.kind !== inputKind) {
      notify.warning(`"${node.nhan}" là ${TRACE_KIND_LABELS[node.kind].toLowerCase()}, không phải ${inputLabel}.`);
      return;
    }
    const blockReason = checkNode?.(node); // gồm cả "đã gắn rồi" — bên gọi biết id lô của mối nối
    if (blockReason) {
      notify.warning(blockReason);
      return;
    }
    if (inputKg != null && !(inputKg > 0)) {
      notify.warning("Số kg phải là số dương, hoặc để trống nếu chưa cân.");
      return;
    }
    onAdd(node, method, inputKg);
    setTypedCode("");
    setInputKg(null);
    setChoices([]);
  };

  /** Mã quét/gõ → lô. Trùng nhiều lô (tem cũ) ⇒ hiện danh sách cho chọn, KHÔNG tự chọn. */
  const handleCode = (text: string, method: "quet" | "go") => {
    const ma = parseQrCode(text);
    if (!ma) return;
    const result = findLots(ma, dl);
    if (!result.length) {
      notify.warning(`Không tìm thấy lô "${text}". Kiểm tra lại mã, hoặc chọn trong danh sách bên dưới.`);
      return;
    }
    if (result.length === 1) addLot(result[0]!, method);
    else {
      // Mã chuyến ⇒ các loại NL của chuyến (việc thường ngày, không toast); mã cũ trùng thật ⇒ cảnh báo.
      const ld = explainMultipleLots(text, result, dl);
      setChoices(result);
      setPickPrompt(ld.cau);
      if (!ld.cungChuyen) notify.warning(`${ld.cau} bên dưới.`);
    }
  };

  const lotRow = (n: LotNode, node: ReactNode) => {
    const cb = computeLotMassBalance(n.kind, n.id, dl);
    const lotStock = getLotStockKg(n.kind, n.id, dl, lotStockTable);
    return (
      <li key={`${n.kind}:${n.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
        <div className="min-w-0">
          <div className="font-medium">{n.nhan}</div>
          <div className="text-muted-foreground">
            {[n.moTa, n.ngay && formatDateVN(n.ngay), n.chiTiet.find((c) => c.nhan === "Đại lý")?.giaTri, n.kg ? kgChu(n.kg) : ""]
              .filter(Boolean)
              .join(" · ")}
            {lotStock != null ? ` · tồn kho ${kgChu(lotStock)}` : cb && cb.ra.length > 0 ? ` · còn ${kgChu(cb.con)}` : ""}
          </div>
        </div>
        {node}
      </li>
    );
  };

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} icon={Link2} title={title} description={description} size="rong" footer={<CloseButton />}>
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="font-semibold">Đã gắn ({linkedInputs.length})</h3>
          {linkedInputs.length ? (
            <ul className="space-y-2">
              {linkedInputs.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <span className="font-medium">{g.label}</span> <Tag variant="nguon">{METHOD_NAMES[g.method]}</Tag>
                    <div className="text-muted-foreground">
                      {[g.description, g.kg != null ? kgChu(g.kg) : "chưa ghi kg", g.operator].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" title={`Bỏ lô ${g.label}. Còn nút Hoàn tác.`} onClick={() => onBo(g.id)}>
                    <Trash2 aria-hidden /> Bỏ
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={`Chưa gắn ${inputLabel} nào`} description="Chưa gắn thì hộ chiếu lô không truy được đoạn này." />
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Thêm lô</h3>
          <NumberField label="Số kg" hint="Để trống nếu chưa cân — bổ sung sau cũng được." unit="kg" value={inputKg} onChange={setInputKg} />

          <div className="flex flex-wrap gap-2">
            <Button
              className="w-full sm:w-auto"
              variant={isScanning ? "outline" : "default"}
              title={isScanning ? "Tắt camera." : "Mở camera để quét tem QR trên thùng hàng. Quét xong là tự gắn lô."}
              onClick={() => setIsScanning((v) => !v)}
            >
              {isScanning ? <CameraOff aria-hidden /> : <Camera aria-hidden />} {isScanning ? "Tắt camera" : "Quét tem QR"}
            </Button>
          </div>
          {isScanning && (
            <QrScanner
              onScan={(t) => {
                setIsScanning(false);
                handleCode(t, "quet");
              }}
            />
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Hoặc gõ mã lô in trên tem" className="min-w-0 flex-1">
              <Input value={typedCode} onChange={(e) => setTypedCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCode(typedCode, "go")} />
            </Field>
            <Button variant="outline" className="w-full sm:w-auto" title="Tìm lô theo mã vừa gõ rồi gắn vào." onClick={() => handleCode(typedCode, "go")}>
              <Plus aria-hidden /> Gắn
            </Button>
          </div>

          {choices.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium">{pickPrompt}:</p>
              <ul className="space-y-2">
                {choices.map((n) =>
                  lotRow(
                    n,
                    <Button size="sm" title={`Gắn đúng lô ${n.nhan} này.`} onClick={() => addLot(n, "go")}>
                      Chọn lô này
                    </Button>
                  )
                )}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">
            {candidatesTitle} ({candidates.length})
          </h3>
          {candidates.length ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {candidates.map((n) =>
                lotRow(
                  n,
                  <Button size="sm" variant="outline" title={`Gắn ${inputLabel} ${n.nhan}.`} onClick={() => addLot(n, "chon")}>
                    Chọn
                  </Button>
                )
              )}
            </ul>
          ) : (
            <EmptyState title="Không có lô gợi ý" description="Quét tem hoặc gõ mã lô ở trên." />
          )}
        </section>
      </div>
    </FormDialog>
  );
}

/** Họ tên người đang đăng nhập — ghi vào mối nối (KDE "Ai"). */
function useRecorder() {
  const { nguoiDung: profile } = useAuth();
  return profile?.fullName || profile?.username || "";
}

export function LotInputPicker({
  outputKind,
  outputId,
  outputLabel,
  workshop,
  date,
  productId,
  onClose,
}: {
  /** W = mẻ SX BTP (ăn lô NL) · P = phiếu đóng gói (ăn lô BTP) */
  outputKind: "W" | "P";
  outputId: string;
  outputLabel: string;
  workshop: Workshop;
  /** Ngày của đầu ra (yyyy-mm-dd) — mốc lọc danh sách lô gần đây. */
  date: string;
  /** Đóng gói: lô BTP phải cùng mặt hàng BTP tiêu hao (để sổ tồn trừ đúng lô). */
  productId?: string;
  onClose: () => void;
}) {
  const { dl, lotInputs, luuLotInputs: saveLotInputs } = useTraceData();
  const recordedBy = useRecorder();
  const inputKind: "S" | "W" = outputKind === "W" ? "S" : "W";
  const inputLabel = outputKind === "W" ? "lô nguyên liệu" : "lô bán thành phẩm";

  const assigned = useMemo(
    () => lotInputs.filter((l) => l.outputKind === outputKind && l.outputId === outputId),
    [lotInputs, outputKind, outputId]
  );
  const candidates = useMemo(
    () =>
      (outputKind === "W" ? listSelectableMaterialLots(dl, workshop, date) : listSelectableWipLots(dl, workshop, date, 120, productId)).filter(
        (n) => !assigned.some((l) => l.inputId === n.id)
      ),
    [dl, outputKind, workshop, date, productId, assigned]
  );

  return (
    <LotInputDialog
      title={`Gắn ${inputLabel} — ${outputLabel}`}
      description={`Ghi ${outputKind === "W" ? "mẻ sản xuất này" : "phiếu đóng gói này"} đã dùng ${inputLabel} nào. Quét tem, gõ mã, hoặc chọn trong danh sách. Số kg có thể để trống nếu chưa cân.`}
      inputKind={inputKind}
      inputLabel={inputLabel}
      dl={dl}
      linkedInputs={assigned.map((l) => ({ id: l.id, label: l.inputLabel, description: l.material, kg: l.quantityKg, method: l.method, operator: l.operator }))}
      candidates={candidates}
      candidatesTitle={`Hoặc chọn ${inputLabel} — xưởng ${workshop}`}
      validateNode={(n) => {
        if (assigned.some((l) => l.inputId === n.id)) return `Lô ${n.nhan} đã gắn rồi.`;
        if (outputKind === "P" && productId) {
          const w = dl.wips.find((x) => x.id === n.id);
          if (w && w.productId !== productId)
            return `Lô ${n.nhan} là "${n.moTa}", khác mặt hàng BTP của phiếu. Đổi mặt hàng BTP tiêu hao của phiếu trước, hoặc chọn đúng lô.`;
        }
        return null;
      }}
      onAdd={(node, method, kg) => {
        const created: LotInput = {
          id: crypto.randomUUID(),
          outputKind,
          outputId,
          inputKind,
          inputId: node.id,
          inputLabel: node.nhan,
          material: node.moTa,
          quantityKg: kg,
          method,
          operator: recordedBy,
          recordedAt: new Date().toISOString(),
        };
        saveLotInputs([...lotInputs, created]);
        notify.saved(`Đã gắn ${inputLabel} ${node.nhan}${kg != null ? ` · ${kgChu(kg)}` : ""}.`);
      }}
      onBo={(id) => {
        const prevRows = lotInputs;
        const l = lotInputs.find((x) => x.id === id);
        saveLotInputs(lotInputs.filter((x) => x.id !== id));
        notify.deleted(`Đã bỏ lô ${l?.inputLabel ?? ""}.`, () => saveLotInputs(prevRows));
      }}
      onClose={onClose}
    />
  );
}

/**
 * Gắn lô cho HÀNG RA: dòng bán lẻ (block thô ⇒ lô BTP `W` · đóng gói ⇒ lô TP `P`)
 * hoặc dòng bán nội địa NL (⇒ lô NL `S`). Ghi `lot_dispatches` (mig 0056). Lô
 * phải cùng mặt hàng với dòng bán để sổ tồn trừ đúng lô.
 */
export function LotDispatchPicker({
  docKind,
  docId,
  docLabel,
  lotKind,
  workshop,
  date,
  productId,
  onClose,
}: {
  docKind: Exclude<LotDispatchDoc, "export_item">;
  docId: string;
  docLabel: string;
  lotKind: LotKind;
  workshop: Workshop;
  date: string;
  /** Mặt hàng của dòng bán (bán lẻ) — lô phải cùng mặt hàng. */
  productId?: string;
  onClose: () => void;
}) {
  const { dl, lotDispatches, luuLotDispatches: saveLotDispatches } = useTraceData();
  const recordedBy = useRecorder();
  const inputLabel = lotKind === "S" ? "lô nguyên liệu" : lotKind === "W" ? "lô bán thành phẩm" : "lô thành phẩm";

  const assigned = useMemo(
    () => lotDispatches.filter((d) => d.docKind === docKind && d.docId === docId),
    [lotDispatches, docKind, docId]
  );
  const productOf = (n: LotNode) =>
    n.kind === "W" ? dl.wips.find((w) => w.id === n.id)?.productId : n.kind === "P" ? dl.packagings.find((p) => p.id === n.id)?.toProductId : undefined;

  /** Gợi ý: lô cùng mặt hàng còn tồn, lô cũ trước (FIFO). NL: như khi gắn cho mẻ SX. */
  const candidates = useMemo(() => {
    const isUnassigned = (n: LotNode) => !assigned.some((d) => d.lotId === n.id);
    if (lotKind === "S") return listSelectableMaterialLots(dl, workshop, date).filter(isUnassigned);
    const lotStockTable = buildLotStockIndex(dl); // một lượt cho mọi lô ứng viên
    const items =
      lotKind === "W"
        ? dl.wips.filter((w) => w.status === "da-nhap" && (!productId || w.productId === productId)).map((w) => buildLotNode("W", w.id, dl))
        : dl.packagings.filter((p) => !productId || p.toProductId === productId).map((p) => buildLotNode("P", p.id, dl));
    return items
      .filter((n) => isUnassigned(n) && (getLotStockKg(n.kind, n.id, dl, lotStockTable) ?? 0) > 0)
      .sort((a, b) => a.ngay.localeCompare(b.ngay));
  }, [dl, lotKind, workshop, date, productId, assigned]);

  return (
    <LotInputDialog
      title={`Gắn ${inputLabel} — ${docLabel}`}
      description="Ghi hàng này lấy từ lô nào để truy xuất tới được khách. Quét tem trên thùng, gõ mã, hoặc chọn lô còn tồn. Số kg có thể để trống nếu chưa cân."
      inputKind={lotKind}
      inputLabel={inputLabel}
      dl={dl}
      linkedInputs={assigned.map((d) => ({ id: d.id, label: d.lotLabel, description: "", kg: d.quantityKg, method: d.method, operator: d.operator }))}
      candidates={candidates}
      candidatesTitle={lotKind === "S" ? `Hoặc chọn lô NL — xưởng ${workshop}` : "Hoặc chọn lô còn tồn — cũ trước"}
      validateNode={(n) => {
        if (assigned.some((d) => d.lotId === n.id)) return `Lô ${n.nhan} đã gắn rồi.`;
        const product = productOf(n);
        if (productId && product && product !== productId) return `Lô ${n.nhan} là "${n.moTa}", khác mặt hàng của dòng bán.`;
        return null;
      }}
      onAdd={(node, method, kg) => {
        const created: LotDispatch = {
          id: crypto.randomUUID(),
          lotKind,
          lotId: node.id,
          lotLabel: node.nhan,
          docKind,
          docId,
          quantityKg: kg,
          method,
          operator: recordedBy,
          recordedAt: new Date().toISOString(),
        };
        saveLotDispatches([...lotDispatches, created]);
        notify.saved(`Đã gắn ${inputLabel} ${node.nhan}${kg != null ? ` · ${kgChu(kg)}` : ""}.`);
      }}
      onBo={(id) => {
        const prevRows = lotDispatches;
        const d = lotDispatches.find((x) => x.id === id);
        saveLotDispatches(lotDispatches.filter((x) => x.id !== id));
        notify.deleted(`Đã bỏ lô ${d?.lotLabel ?? ""}.`, () => saveLotDispatches(prevRows));
      }}
      onClose={onClose}
    />
  );
}
