// ============================================================
// Tên file: src/features/export-planning/MergeExportDialog.tsx
// Tên tiếng Việt: Hộp "Gộp thành một lần xuất" — nhiều chuyến của các HĐ cùng khách thành một chuyến
// Description: Pick the shipment to keep, same container vs one container each, resolve conflicting fields, see why a
//              shipment can't be merged. Writes nothing itself — the screen saves on confirm (ba-spec 74 GC2).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { Button, ChoiceGroup, FormDialog, formatNumber } from "@/design-system";
import type { ExportShipment } from "@/types";
import { SUB_STEP_LABELS, documentKindLabel, isContainerKind, type EvidenceOptions, type ExportData } from "@/lib/exportPlanning";
import { defaultKeeper, mergeConflicts, mergeGate, type MergeGate, type MergeMode } from "@/lib/exportMergeShipments";

export interface MergeExportTarget {
  shipments: ExportShipment[];
  /** Vì sao gom các chuyến này ("cùng booking SGNGCZ486800" / "cùng ngày đóng 28/11/2026" / chọn tay). */
  reasonText: string;
}

export interface MergeExportChoice {
  keep: ExportShipment;
  drops: ExportShipment[];
  mode: MergeMode;
}

const contractNoOf = (d: ExportData, id: string) => d.contracts.find((c) => c.id === id)?.contractNo ?? "";

/** Lý do không gộp được — lời người dùng (ba-spec 74 §9b). */
export function mergeGateText(d: ExportData, g: Exclude<MergeGate, { ok: true }>): string {
  switch (g.reason) {
    case "both-progress": {
      const [step, kind] = (g.detail ?? "").split(":");
      const name = step === "document" ? documentKindLabel(kind as never, d.documentKinds) : (SUB_STEP_LABELS[step as keyof typeof SUB_STEP_LABELS] ?? step);
      return `mục ${name} đã làm ở cả hai chuyến — gỡ bớt một bên rồi gộp`;
    }
    case "sent-or-paid":
      return "đã ghi gửi chứng từ / tiền về — lần xuất này đã xong chứng từ";
    case "contract-blocked":
      return `HĐ ${contractNoOf(d, g.detail ?? "")} còn thiếu hồ sơ bắt buộc (chuyến đã có file nên phải đủ hồ sơ)`;
    case "no-revision":
      return `HĐ ${contractNoOf(d, g.detail ?? "")} chưa có bản đang dùng`;
    case "customer-mismatch":
      return "khác khách — chỉ gộp chuyến của cùng một khách";
    case "not-container":
      return "Mỗi chuyến một cont chỉ dùng cho chuyến cont lạnh";
    case "not-open":
      return "chuyến hoặc hợp đồng đã đóng / hủy";
    default:
      return "không gộp được";
  }
}

export function MergeExportDialog({
  target,
  data,
  opts,
  shipmentLabel,
  onClose,
  onConfirm,
}: {
  target: MergeExportTarget | null;
  data: ExportData;
  opts: EvidenceOptions;
  shipmentLabel: (s: ExportShipment) => string;
  onClose: () => void;
  onConfirm: (c: MergeExportChoice) => void;
}) {
  const [keepId, setKeepId] = useState("");
  const [mode, setMode] = useState<MergeMode>("same-container");
  useEffect(() => {
    setKeepId(target ? (defaultKeeper(data, target.shipments)?.id ?? "") : "");
    setMode("same-container");
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = target?.shipments ?? [];
  const keep = list.find((s) => s.id === keepId) ?? list[0];
  const drops = list.filter((s) => s.id !== keep?.id);
  const allContainers = list.length > 0 && list.every((s) => isContainerKind(s.kind));
  const conflicts = useMemo(() => (keep ? mergeConflicts(keep, drops, mode) : []), [keep, drops, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocked = keep ? drops.map((s) => ({ s, g: mergeGate(data, keep, s, mode, opts) })).filter((x) => !x.g.ok) : [];
  const totalKg = list.reduce((t, s) => t + (s.plannedKg ?? 0), 0);
  const fileCount = (s: ExportShipment) => data.files.filter((f) => f.shipmentId === s.id).length;

  return (
    <FormDialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title="Gộp thành một lần xuất"
      description={
        target ? `${list.length} chuyến ${target.reasonText} — gộp thành một chuyến. Hoàn tác được ngay sau khi gộp.` : ""
      }
      icon={Layers}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="save"
            onClick={() => keep && onConfirm({ keep, drops, mode })}
            title="Gộp các chuyến này thành một chuyến (một lần xuất). Hoàn tác được ngay sau khi gộp."
          >
            <Layers className="mr-2 h-4 w-4" aria-hidden />
            Gộp {list.length} chuyến
          </Button>
        </>
      }
    >
      {target && keep && (
        <div className="grid min-w-0 gap-4 py-2">
          <p className="text-sm text-muted-foreground">
            Gộp xong: một chuyến chung cho cả lần xuất — hàng của mỗi hợp đồng thành dòng hàng (mỗi hợp đồng vẫn tự tính đã giao); file,
            mục chứng từ, lệnh sản xuất, booking, thông tin xe dùng chung; từ Lệnh sản xuất tới Tiền về làm một lần. Không mất gì: chuyến
            của từng hợp đồng giữ nguyên bản ghi (Đã gộp vào lần xuất), tách lại được từng hợp đồng.
          </p>
          <ChoiceGroup
            label="Hợp đồng chính của lần xuất"
            required
            value={keep.id}
            onChange={setKeepId}
            hint="Chọn sẵn chuyến đã làm nhiều nhất. Chuyến chung dùng thông tin của hợp đồng chính trước; chuyến của hợp đồng kia vẫn giữ bản ghi riêng."
            options={list.map((s) => ({
              value: s.id,
              label: shipmentLabel(s),
              description: [`${formatNumber(s.plannedKg)} kg`, fileCount(s) ? `${fileCount(s)} file` : "chưa có file", s.bookingNo && `booking ${s.bookingNo}`].filter(Boolean).join(" · "),
            }))}
            columns={2}
          />
          {allContainers && list.length > 1 && (
            <ChoiceGroup
              label="Hàng đóng vào"
              value={mode}
              onChange={(v) => setMode(v as MergeMode)}
              options={[
                { value: "same-container", label: "Cùng một cont", description: "Booking 1 cont (VD 1X20RF): số cont, seal, ảnh seal là của một cont." },
                { value: "separate-containers", label: "Mỗi chuyến một cont", description: "Booking nhiều cont: chuyến của hợp đồng kia thành một cont thêm của chuyến chung." },
              ]}
              columns={2}
            />
          )}
          {conflicts.length > 0 ? (
            <div className="grid gap-1 rounded-lg bg-muted px-4 py-3 text-sm">
              <span className="font-semibold">Ô ghi khác nhau — giữ đủ, không bỏ giá trị nào:</span>
              {conflicts.map((c) => (
                <span key={c.key}>
                  {c.label}: {c.options.map((o, i) => `${o.value} (${shipmentLabel(list.find((s) => s.id === o.shipmentId)!).split(" · ")[0]}${i === 0 ? ", chuyến chung dùng" : ""})`).join(" · ")}
                </span>
              ))}
              <span className="text-muted-foreground">Sau gộp, chuyến chung ghi rõ các giá trị này; chọn Dùng giá trị này để đổi khi cần.</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Không có ô nào ghi khác nhau — ô trống của chuyến chung lấy theo chuyến kia.</p>
          )}
          <p className="tnum text-sm">
            Sau gộp: 1 chuyến · {formatNumber(totalKg)} kg kế hoạch · {list.reduce((t, s) => t + fileCount(s), 0)} file
          </p>
          {blocked.length > 0 && (
            <div role="alert" className="grid gap-1 rounded-lg bg-warning-surface px-4 py-3 text-sm">
              <span className="font-semibold">Chưa gộp được:</span>
              {blocked.map(({ s, g }) => (
                <span key={s.id}>
                  {shipmentLabel(s)}: {g.ok ? "" : mergeGateText(data, g)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </FormDialog>
  );
}
