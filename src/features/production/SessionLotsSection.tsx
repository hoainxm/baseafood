// ============================================================
// Tên file: src/features/production/SessionLotsSection.tsx
// Tên tiếng Việt: Khối "Lô nguyên liệu dùng cho phiên" (/wip — truy xuất QR đợt 2b)
// ============================================================
// Tổ trưởng khai MỘT lần các lô NL đem ra chế biến trong phiên (quét tem / gõ mã /
// chọn), thay vì gắn từng mẻ sau khi lưu. Lưu phiên ⇒ `assignSessionLots` (lib/lotTraceability)
// gắn lô cho thành phẩm đúng LOẠI NL (mặt hàng đã gắn loại NL ở Danh mục), không thì cùng
// LOÀI, và dòng bán nội địa đúng loại NL; kg để trống. Mỗi loại NL của chuyến là một lô.
// Mẻ nào cần sửa riêng vẫn mở "Gắn lô NL" ở sổ. Lô ở đây chỉ là danh sách chọn
// (không phải danh mục) ⇒ không có thêm mới / bút chì (CLAUDE.md quy tắc 7 ngoại lệ).
import { useMemo, useState } from "react";
import type { LotInput, Workshop } from "@/types";
import { TRACE_KIND_LABELS, parseQrCode, listSelectableMaterialLots, explainMultipleLots, buildLotNode, findLots, type TraceData, type LotNode } from "@/lib/lotTraceability";
import { Button, Combobox, Field, Input, Tag, notify } from "@/design-system";
import { QrScanner } from "@/features/shared";
import { Camera, CameraOff, Link2, Plus, X } from "lucide-react";
import { kg, formatDateVN } from "@/lib/format";

export interface SessionLot {
  node: LotNode;
  method: LotInput["method"];
}

export function SessionLotsSection({
  traceData,
  workshop,
  date,
  sessionLots,
  onChange,
}: {
  traceData: TraceData;
  workshop: Workshop;
  /** Ngày sản xuất của phiên — mốc lọc lô gần đây. */
  date: string;
  sessionLots: SessionLot[];
  onChange: (items: SessionLot[]) => void;
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [choices, setChoices] = useState<LotNode[]>([]);
  const [pickPrompt, setPickPrompt] = useState("");

  const candidates = useMemo(
    () => listSelectableMaterialLots(traceData, workshop, date).filter((n) => !sessionLots.some((l) => l.node.id === n.id)),
    [traceData, workshop, date, sessionLots]
  );
  const describeLot = (n: LotNode) =>
    [n.description, n.date && formatDateVN(n.date), n.details.find((c) => c.label === "Đại lý")?.value, n.kg ? kg(n.kg) : ""].filter(Boolean).join(" · ");

  const addLot = (n: LotNode, method: LotInput["method"]) => {
    if (n.kind !== "S") {
      notify.warning(`"${n.label}" là ${TRACE_KIND_LABELS[n.kind].toLowerCase()}, không phải lô nguyên liệu.`);
      return;
    }
    if (sessionLots.some((l) => l.node.id === n.id)) {
      notify.warning(`Lô ${n.label} đã có trong phiên.`);
      return;
    }
    // Khai lô cho phiên = nháp chưa lưu ⇒ không toast (luật 13); lưu phiên mới ghi.
    onChange([...sessionLots, { node: n, method }]);
    setTypedCode("");
    setChoices([]);
  };

  const handleCode = (text: string, method: "scan" | "typed") => {
    const ma = parseQrCode(text);
    if (!ma) return;
    if ("kind" in ma && ma.kind !== "S") {
      notify.warning(`Tem này là ${TRACE_KIND_LABELS[ma.kind].toLowerCase()}, không phải lô nguyên liệu.`);
      return;
    }
    const result = findLots(ma, traceData).filter((n) => n.kind === "S");
    if (!result.length) {
      notify.warning(`Không tìm thấy lô nguyên liệu "${text}". Kiểm tra lại mã, hoặc chọn trong danh sách.`);
      return;
    }
    if (result.length === 1) addLot(result[0]!, method);
    else {
      // Gõ mã chuyến ⇒ ra các loại NL của chuyến: việc thường ngày, chọn ở danh sách dưới,
      // không cần toast. Chỉ mã cũ trùng thật mới cảnh báo.
      const ld = explainMultipleLots(text, result, traceData);
      setChoices(result);
      setPickPrompt(ld.message);
      if (!ld.sameShipment) notify.warning(`${ld.message} bên dưới.`);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-border p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Link2 className="size-icon shrink-0" aria-hidden />
          Lô nguyên liệu dùng cho phiên này
        </p>
        <p className="text-sm text-muted-foreground">
          Quét tem các loại nguyên liệu đem ra chế biến (mỗi loại của chuyến một tem). Lưu vào sổ là tự gắn lô
          cho thành phẩm đúng loại NL (chưa gắn loại thì theo loài) và dòng bán nội địa cùng loại — khỏi gắn từng mẻ.
        </p>
      </div>

      {sessionLots.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {sessionLots.map((l) => (
            <li key={l.node.id} className="flex max-w-full items-center gap-2 rounded-md border-2 border-primary/40 bg-accent/40 py-1 pl-3 pr-1">
              <span className="min-w-0">
                <span className="tnum font-semibold">{l.node.label}</span>{" "}
                <span className="text-muted-foreground">{describeLot(l.node)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                title={`Bỏ lô ${l.node.label} khỏi phiên (chưa lưu nên chưa gắn vào đâu).`}
                aria-label={`Bỏ lô ${l.node.label}`}
                onClick={() => onChange(sessionLots.filter((x) => x.node.id !== l.node.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <Button
          type="button"
          className="w-full sm:w-auto"
          variant={isScanning ? "outline" : "default"}
          title={isScanning ? "Tắt camera." : "Mở camera quét tem QR trên sọt / thùng nguyên liệu."}
          onClick={() => setIsScanning((v) => !v)}
        >
          {isScanning ? <CameraOff aria-hidden /> : <Camera aria-hidden />} {isScanning ? "Tắt camera" : "Quét tem NL"}
        </Button>
        <Field label="Hoặc gõ mã lô" className="min-w-0 flex-1 sm:min-w-48">
          <Input value={typedCode} onChange={(e) => setTypedCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCode(typedCode, "typed")} />
        </Field>
        <Button type="button" variant="outline" className="w-full sm:w-auto" title="Tìm lô theo mã vừa gõ rồi thêm vào phiên." onClick={() => handleCode(typedCode, "typed")}>
          <Plus aria-hidden /> Thêm
        </Button>
      </div>
      {isScanning && (
        <QrScanner
          onScan={(t) => {
            setIsScanning(false);
            handleCode(t, "scan");
          }}
        />
      )}

      {choices.length > 0 && (
        <p className="font-medium">{pickPrompt}:</p>
      )}
      {choices.length > 0 && (
        <ul className="space-y-1">
          {choices.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <span className="min-w-0">
                <span className="font-medium">{n.label}</span> <span className="text-muted-foreground">{describeLot(n)}</span>
              </span>
              <Button type="button" size="sm" title={`Thêm đúng lô ${n.label} này vào phiên.`} onClick={() => addLot(n, "typed")}>
                Chọn lô này
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Combobox
        label="Hoặc chọn lô nguyên liệu"
        hint={`Mỗi loại NL của chuyến là một lô. Lô về gần đây của xưởng ${workshop} (mới trước), sau đó lô cũ còn dở — NL cấp đông đem xả.`}
        value=""
        onChange={(id) => {
          const n = candidates.find((u) => u.id === id) ?? (id ? buildLotNode("S", id, traceData) : undefined);
          if (n) addLot(n, "picked");
        }}
        // Mỗi loại NL của chuyến là một lô cùng mã chuyến ⇒ nhãn ghép loại NL cho phân biệt được.
        options={candidates.map((n) => ({
          value: n.id,
          label: `${n.label} · ${n.description}`,
          phu: [n.date && formatDateVN(n.date), n.details.find((c) => c.label === "Đại lý")?.value, n.kg ? kg(n.kg) : ""].filter(Boolean).join(" · ") || undefined,
        }))}
        placeholder={candidates.length ? "— Chọn lô —" : "Không có lô gợi ý"}
        emptyText="Không thấy lô này — quét tem hoặc gõ mã lô ở trên."
      />

      {sessionLots.length === 0 && (
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Tag variant="cho">Chưa khai lô</Tag>
          Lưu mà chưa khai thì mẻ chưa có lô — chốt ngày sẽ hỏi gắn lô hoặc lý do.
        </p>
      )}
    </div>
  );
}
