// ============================================================
// Tên file: src/features/export-planning/ShipmentGoods.tsx
// Tên tiếng Việt: Hàng của chuyến xuất — nhập chi tiết từng mặt hàng + số thực đóng của kho
// Description: Shipment goods lines (planner) and loaded counts (warehouse) — ba-spec 63 NV1, NV2
// ============================================================
// Chị Vi (Zalo 2026-11-02): chuyến chỉ ghi tổng thùng ⇒ nhập chi tiết nhiều mặt hàng, chọn từ dòng hàng của
// hợp đồng (đã nối danh mục mặt hàng); kho đóng cont xong điền số thực đóng. Không có giá ở đây — người
// đóng hàng mở được hộp Số thực đóng (R10 ba-spec 41).
import { useEffect, useState } from "react";
import { Button, ErrorSummary, Field, FormDialog, Input, NumberField, Tag, formatNumber, type FieldError } from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { lineNetKg, netKgPerUnit } from "@/lib/exportInvoice";
import { linesFromDraft, type LineDraft, type ShipmentLinesTarget } from "./shipmentGoodsLogic";
import type { ExportShipment, ExportShipmentLine } from "@/types";
import { Boxes, ClipboardCheck, Save } from "lucide-react";

export type { ShipmentLinesTarget } from "./shipmentGoodsLogic";

const unitWord = (l: Pick<ExportShipmentLine, "unitKind">) => (l.unitKind === "bundle" ? "bó" : "thùng");
const lineTitle = (l: Pick<ExportShipmentLine, "description" | "size">) => [l.description, l.size].filter((t) => t.trim()).join(" · ") || "(chưa có tên hàng)";

/** Một dòng hàng của chuyến, chỉ để xem: tên · quy cách · kế hoạch → thực đóng · kg tịnh. */
export function ShipmentLineSummary({ line }: { line: ExportShipmentLine }) {
  const per = netKgPerUnit(line);
  const kg = lineNetKg(line);
  return (
    <div className="grid min-w-0 gap-0.5 border-b border-border py-2 text-sm last:border-b-0">
      <p className="font-medium break-words">{lineTitle(line)}</p>
      <p className="tnum text-muted-foreground break-words">
        {[
          line.packing.trim(),
          per != null ? `${formatNumber(per)} kg/${unitWord(line)}` : "",
          `Kế hoạch ${line.plannedUnits != null ? formatNumber(line.plannedUnits) : "—"} ${unitWord(line)}`,
          line.loadedUnits != null ? `thực đóng ${formatNumber(line.loadedUnits)}` : "chưa điền thực đóng",
          kg != null ? `${formatNumber(kg)} kg` : "",
          line.expiry.trim() ? `HSD ${line.expiry.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

/* ---------- Nhập hàng của chuyến (Phòng KH) ---------- */

interface LinesForm {
  key: string;
  tg: ShipmentLinesTarget;
  rows: LineDraft[];
  initial: string;
}
const linesSnap = (rows: readonly LineDraft[]) => JSON.stringify(rows);

function draftRows(tg: ShipmentLinesTarget): LineDraft[] {
  return tg.contractLines.map((cl) => {
    const own = tg.lines.find((l) => l.contractLineId === cl.id);
    return {
      contractLineId: cl.id,
      lineId: own?.id ?? "",
      description: own?.description ?? cl.description,
      size: own?.size ?? cl.size,
      packing: own?.packing ?? cl.packing,
      plannedUnits: own?.plannedUnits ?? null,
      grossKgPerUnit: own?.grossKgPerUnit ?? null,
      expiry: own?.expiry ?? "",
    };
  });
}

export function ShipmentLinesDialog({
  target,
  onClose,
  onSave,
}: {
  target: ShipmentLinesTarget | null;
  onClose: () => void;
  /** Trả về hàng MỚI của chuyến (thay toàn bộ hàng cũ của chuyến). */
  onSave: (shipment: ExportShipment, lines: ExportShipmentLine[]) => boolean;
}) {
  const [form, setForm] = useState<LinesForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "export-shipment-lines", value: form, setValue: setForm, isEmpty: (f) => linesSnap(f.rows) === f.initial });

  useEffect(() => {
    if (!target) return;
    const rows = draftRows(target);
    const fresh: LinesForm = { key: target.shipment.id, tg: target, rows, initial: linesSnap(rows) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const tg = target ?? form?.tg ?? null;
  const setRow = (i: number, patch: Partial<LineDraft>) => setForm((f) => (f ? { ...f, rows: f.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) } : f));

  const save = () => {
    if (!form || !tg) return;
    const errs: FieldError[] = [];
    form.rows.forEach((r, i) => {
      if (r.plannedUnits != null && r.plannedUnits > 0 && !r.description.trim()) errs.push({ field: `Dòng ${i + 1}`, message: "Ghi tên hàng in trên invoice" });
    });
    // Dòng kho đã điền số thực đóng mà bị bỏ ⇒ mất số của kho: chặn, bảo ghi lại số kiện.
    for (const l of tg.lines) {
      const r = form.rows.find((x) => x.lineId === l.id);
      if (l.loadedUnits != null && (!r || r.plannedUnits == null || r.plannedUnits <= 0))
        errs.push({ field: lineTitle(l), message: "Kho đã điền số thực đóng cho dòng này — giữ số kiện kế hoạch (không bỏ dòng)" });
    }
    setErrors(errs);
    if (errs.length) return;
    if (onSave(tg.shipment, linesFromDraft(tg, form.rows, newId))) draft.done();
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title="Hàng của chuyến"
      description={tg ? `${tg.label} — ghi số kiện đóng vào chuyến này cho từng dòng hàng của hợp đồng. Để trống = không đóng dòng đó.` : ""}
      icon={Boxes}
      size="xl"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={save} title="Lưu hàng của chuyến — invoice, packing list và hộp Số thực đóng của kho dùng danh sách này.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Lưu
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && tg && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          {!form.rows.length && <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">Hợp đồng chưa có dòng hàng — thêm dòng hàng ở hồ sơ hợp đồng trước.</p>}
          {form.rows.map((r, i) => {
            const cl = tg.contractLines.find((c) => c.id === r.contractLineId);
            if (!cl) return null;
            const unit = cl.unitKind === "bundle" ? "bó" : "thùng";
            const other = tg.otherShipmentUnits[cl.id] ?? 0;
            const left = cl.quantity != null ? cl.quantity - other - (r.plannedUnits ?? 0) : null;
            return (
              <section key={r.contractLineId} className="grid min-w-0 gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 font-medium break-words">
                    {i + 1}. {[cl.description, cl.size].filter(Boolean).join(" · ")}
                  </p>
                  <p className="tnum text-sm text-muted-foreground">
                    HĐ {cl.quantity != null ? `${formatNumber(cl.quantity)} ${unit}` : "chưa ghi số lượng"}
                    {other ? ` · chuyến khác ${formatNumber(other)}` : ""}
                    {left != null ? ` · còn ${formatNumber(left)}` : ""}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
                  <NumberField label={`Số ${unit} kế hoạch`} unit={unit} value={r.plannedUnits} onChange={(v) => setRow(i, { plannedUnits: v })} />
                  <NumberField label={`Kg cả bì / ${unit}`} unit="kg" value={r.grossKgPerUnit} onChange={(v) => setRow(i, { grossKgPerUnit: v })} hint="In ở packing list (N.W / G.W)." />
                  <Field label="Hạn dùng" hint="VD 2028.01 — có ⇒ thêm Expiry date list.">
                    <Input value={r.expiry} onChange={(e) => setRow(i, { expiry: e.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Tên hàng trên invoice">
                    <Input value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} />
                  </Field>
                  <Field label="Size">
                    <Input value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} />
                  </Field>
                  <Field label="Quy cách (Packing)">
                    <Input value={r.packing} onChange={(e) => setRow(i, { packing: e.target.value })} />
                  </Field>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Số thực đóng (kho / người đóng hàng) ---------- */

export interface LoadingCountTarget {
  shipment: ExportShipment;
  label: string;
  lines: readonly ExportShipmentLine[];
}

interface CountForm {
  key: string;
  tg: LoadingCountTarget;
  counts: Record<string, number | null>;
  initial: string;
}

export function LoadingCountDialog({
  target,
  recordedBy,
  onClose,
  onSave,
}: {
  target: LoadingCountTarget | null;
  recordedBy: string;
  onClose: () => void;
  onSave: (lines: ExportShipmentLine[]) => boolean;
}) {
  const [form, setForm] = useState<CountForm | null>(null);
  const draft = useDialogDraft({ form: "export-loading-count", value: form, setValue: setForm, isEmpty: (f) => JSON.stringify(f.counts) === f.initial });

  useEffect(() => {
    if (!target) return;
    const counts = Object.fromEntries(target.lines.map((l) => [l.id, l.loadedUnits]));
    const fresh: CountForm = { key: target.shipment.id, tg: target, counts, initial: JSON.stringify(counts) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const tg = target ?? form?.tg ?? null;
  const save = () => {
    if (!form || !tg) return;
    const at = new Date().toISOString();
    const next = tg.lines.map((l) => {
      const v = form.counts[l.id] ?? null;
      return v === l.loadedUnits ? l : { ...l, loadedUnits: v, loadedBy: v == null ? "" : recordedBy, loadedAt: v == null ? "" : at };
    });
    if (onSave(next)) draft.done();
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title="Số lượng thực đóng"
      description={tg ? `${tg.label} — đóng cont xong, ghi số kiện thực đã đóng của từng dòng. Invoice và packing list dùng số này.` : ""}
      icon={ClipboardCheck}
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={save} title="Lưu số kiện thực đóng của chuyến.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Lưu
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && tg && (
        <div className="grid gap-3 py-2">
          {tg.lines.map((l) => (
            <div key={l.id} className="grid min-w-0 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end">
              <div className="grid min-w-0 gap-0.5">
                <p className="font-medium break-words">{lineTitle(l)}</p>
                <p className="tnum text-sm text-muted-foreground">
                  Kế hoạch {l.plannedUnits != null ? formatNumber(l.plannedUnits) : "—"} {unitWord(l)}
                  {l.packing.trim() ? ` · ${l.packing.trim()}` : ""}
                </p>
                {l.loadedBy && (
                  <span>
                    <Tag variant="muted">Đã điền: {l.loadedBy}</Tag>
                  </span>
                )}
              </div>
              <NumberField
                label={`Số ${unitWord(l)} thực đóng`}
                unit={unitWord(l)}
                value={form.counts[l.id] ?? null}
                onChange={(v) => setForm((f) => (f ? { ...f, counts: { ...f.counts, [l.id]: v } } : f))}
              />
            </div>
          ))}
        </div>
      )}
    </FormDialog>
  );
}
