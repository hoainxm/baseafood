// ============================================================
// Tên file: src/features/export-planning/ShipmentGoods.tsx
// Tên tiếng Việt: Hàng của chuyến xuất — nhập chi tiết từng mặt hàng + số thực đóng của kho
// Description: Shipment goods lines (planner) and loaded counts (warehouse) — ba-spec 63 NV1, NV2
// ============================================================
// Chị Vi (Zalo 2026-11-02): chuyến chỉ ghi tổng thùng ⇒ nhập chi tiết nhiều mặt hàng, chọn từ dòng hàng của
// hợp đồng (đã nối danh mục mặt hàng); kho đóng cont xong điền số thực đóng. Không có giá ở đây — người
// đóng hàng mở được hộp Số thực đóng (R10 ba-spec 41).
import { useEffect, useState } from "react";
import { Button, ChoiceGroup, ErrorSummary, Field, FormDialog, InlineConfirmDelete, Input, NumberField, Tag, formatNumber, type FieldError } from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { applyLoadingCounts, isDraftLoadingLine, lineNetKg, loadingCountRows, netKgPerUnit } from "@/lib/exportInvoice";
import { draftRowsOf, groupLines, linesFromDraft, splitRow, type ContractLineGroup, type LineDraft, type ShipmentLinesTarget } from "./shipmentGoodsLogic";
import { containerLabel, linesByContainer, type ContainerView } from "@/lib/exportContainers";
import type { ExportContractLine, ExportShipment, ExportShipmentLine } from "@/types";

/** Nhóm duy nhất khi chuyến một cont — không hiện tiêu đề cont. */
const ONE_CONT: ContainerView = { id: "", no: 1, kind: "40RF", containerNo: "", sealNo: "", loadingDate: "" };
import { Boxes, ClipboardCheck, Plus, Save } from "lucide-react";

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
  /** HĐ đang có dòng trong hộp — thêm HĐ khác ⇒ thêm nhóm (ba-spec 70). */
  groups: ContractLineGroup[];
  rows: LineDraft[];
  /** Id dòng đã lưu bấm Xóa trong hộp (audit B5) — Lưu mới xóa thật, có Hoàn tác. */
  removed: string[];
  initial: string;
}
const linesSnap = (rows: readonly LineDraft[]) => JSON.stringify(rows);

const draftRows = (tg: ShipmentLinesTarget): LineDraft[] => tg.groups.flatMap((g) => draftRowsOf(g, tg.lines));

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
    const fresh: LinesForm = { key: target.shipment.id, tg: target, groups: [...target.groups], rows, removed: [], initial: linesSnap(rows) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? { ...kept, removed: kept.removed ?? [] } : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const tg = target ?? form?.tg ?? null;
  const setRow = (i: number, patch: Partial<LineDraft>) => setForm((f) => (f ? { ...f, rows: f.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) } : f));
  const addGroup = (g: ContractLineGroup) =>
    setForm((f) => (f && !f.groups.some((x) => x.contractId === g.contractId) ? { ...f, groups: [...f.groups, g], rows: [...f.rows, ...draftRowsOf(g, f.tg.lines)] } : f));
  const allLines = form ? groupLines(form.groups) : [];
  const multi = (form?.groups.length ?? 0) > 1;
  // ba-spec 73: chuyến ≥ 2 cont ⇒ mỗi dòng chọn cont; dòng đi hai cont thì chia dòng.
  const conts = tg?.containers ?? [];
  const multiCont = conts.length > 1;
  const contOptions = conts.map((c) => ({ value: c.id || "first", label: c.label }));
  const split = (i: number) => setForm((f) => (f ? { ...f, rows: splitRow(f.rows, i, conts.map((c) => c.id)) } : f));
  const removeRow = (i: number) => setForm((f) => (f ? { ...f, rows: f.rows.filter((_, k) => k !== i) } : f));
  /** Xóa dòng đã lưu (audit B5): hàng đầu của dòng HĐ thành ô trống (dòng HĐ vẫn chọn lại được), bản chia thì bỏ hẳn. */
  const removeSaved = (i: number, isSplit: boolean) =>
    setForm((f) => {
      if (!f) return f;
      const r = f.rows[i];
      if (!r?.lineId) return f;
      const rows = isSplit ? f.rows.filter((_, k) => k !== i) : f.rows.map((x, k) => (k === i ? { ...x, lineId: "", plannedUnits: null, grossKgPerUnit: null, expiry: "" } : x));
      return { ...f, rows, removed: [...f.removed, r.lineId] };
    });

  const save = () => {
    if (!form || !tg) return;
    const errs: FieldError[] = [];
    form.rows.forEach((r, i) => {
      if (r.plannedUnits != null && r.plannedUnits > 0 && !r.description.trim()) errs.push({ field: `Dòng ${i + 1}`, message: "Ghi tên hàng in trên invoice" });
    });
    // Dòng đóng cont đã điền số thực đóng: để trống kế hoạch vẫn GIỮ dòng (linesFromDraft, ba-spec 63 R4 — đóng cont
    // có thể tự tạo dòng không kế hoạch, mig 0098). Chỉ chặn khi dòng không còn trong hộp (dòng HĐ đã bị bỏ khỏi bản HĐ).
    for (const l of tg.lines) {
      if (l.loadedUnits != null && !form.rows.some((x) => x.lineId === l.id) && !form.removed.includes(l.id))
        errs.push({ field: lineTitle(l), message: "Đóng cont đã điền số thực đóng cho dòng này nhưng dòng hàng không còn trong hợp đồng — báo người lập HĐ" });
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
      description={tg ? `${tg.label} — ghi số kiện đóng vào chuyến này cho từng dòng hàng của hợp đồng. Để trống = không đóng dòng đó. Cont chở hàng của nhiều hợp đồng cùng khách ⇒ thêm hàng của hợp đồng khác.` : ""}
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
          {tg.removeLines?.blockedText && tg.lines.length > 0 && (
            <p className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">Không xóa được dòng hàng: {tg.removeLines.blockedText}</p>
          )}
          {form.removed.length > 0 && (
            <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
              {form.removed.length} dòng hàng sẽ bị xóa khi Lưu (cả số thực đóng của dòng đó). Lưu xong vẫn Hoàn tác được; chọn Hủy để giữ nguyên.
            </p>
          )}
          {!form.rows.length && <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">Hợp đồng chưa có dòng hàng — thêm dòng hàng ở hồ sơ hợp đồng trước.</p>}
          {form.rows.map((r, i) => {
            const cl = allLines.find((c) => c.id === r.contractLineId);
            if (!cl) return null;
            const group = form.groups.find((g) => g.contractId === r.contractId);
            const firstOfGroup = form.rows.findIndex((x) => x.contractId === r.contractId) === i;
            const unit = cl.unitKind === "bundle" ? "bó" : "thùng";
            const other = tg.otherShipmentUnits[cl.id] ?? 0;
            const sameLine = form.rows.filter((x) => x.contractLineId === r.contractLineId);
            const here = sameLine.reduce((t, x) => t + (x.plannedUnits ?? 0), 0);
            const left = cl.quantity != null ? cl.quantity - other - here : null;
            // Bản chia (không phải hàng đầu của dòng HĐ) bỏ được; hàng đầu thì để trống số kiện như cũ.
            const isSplit = sameLine.indexOf(r) > 0;
            const saved = r.lineId ? tg.lines.find((l) => l.id === r.lineId) : undefined;
            const canRemoveSaved = !!saved && !!tg.removeLines && !tg.removeLines.blockedText;
            return (
              <section key={`${r.contractLineId}-${r.lineId || i}`} className="grid min-w-0 gap-3 rounded-lg border border-border p-3">
                {multi && firstOfGroup && group && (
                  <p className="text-sm font-semibold text-primary break-words">Hợp đồng {group.contractNo || "(chưa có số)"}</p>
                )}
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 font-medium break-words">
                    {i + 1}. {[cl.description, cl.size].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="tnum text-sm text-muted-foreground">
                      HĐ {cl.quantity != null ? `${formatNumber(cl.quantity)} ${unit}` : "chưa ghi số lượng"}
                      {other ? ` · chuyến khác ${formatNumber(other)}` : ""}
                      {left != null ? ` · còn ${formatNumber(left)}` : ""}
                      {saved?.loadedUnits != null ? ` · thực đóng ${formatNumber(saved.loadedUnits)}` : ""}
                    </p>
                    {canRemoveSaved && saved && (
                      <InlineConfirmDelete
                        recordDescription={`${lineTitle(saved)}${saved.loadedUnits != null ? ` — thực đóng ${formatNumber(saved.loadedUnits)} ${unit}` : ""}`}
                        title="Xóa dòng hàng này khỏi chuyến (ghi nhầm, kể cả dòng bộ phận đóng cont thêm nhầm) — số thực đóng của dòng cũng bỏ. Hỏi lại trước; bấm Lưu mới xóa, có Hoàn tác."
                        onConfirm={() => removeSaved(i, isSplit)}
                      />
                    )}
                  </div>
                </div>
                {multiCont && (
                  <div className="flex min-w-0 flex-wrap items-end gap-2" data-tour="export-shipment-line-container">
                    <div className="min-w-0 flex-1">
                      <ChoiceGroup
                        label="Đi cont"
                        value={r.containerId || "first"}
                        onChange={(v) => setRow(i, { containerId: v === "first" ? "" : v })}
                        options={contOptions}
                        columns={Math.min(3, contOptions.length) as 2 | 3}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => split(i)} title="Dòng hàng này đi cả cont khác: thêm một dòng cùng mặt hàng cho cont khác, chia số kiện.">
                      <Plus className="mr-1 h-4 w-4" aria-hidden />
                      Chia sang cont khác
                    </Button>
                    {isSplit && !canRemoveSaved && <InlineConfirmDelete recordDescription={`${cl.description} (bản chia)`} title="Bỏ dòng chia này (số kiện của dòng này cũng bỏ)." onConfirm={() => removeRow(i)} />}
                  </div>
                )}
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
          {tg.addable.some((g) => !form.groups.some((x) => x.contractId === g.contractId)) && (
            <div className="grid gap-2 rounded-lg border border-dashed border-border p-3" data-tour="export-shipment-add-contract">
              <p className="text-sm text-muted-foreground">Cont chở cả hàng của hợp đồng khác cùng khách? Thêm hàng của hợp đồng đó vào chuyến này — mỗi hợp đồng tự tính đã giao, còn phải giao.</p>
              <div className="flex flex-wrap gap-2">
                {tg.addable
                  .filter((g) => !form.groups.some((x) => x.contractId === g.contractId))
                  .map((g) => (
                    <Button key={g.contractId} variant="outline" size="sm" onClick={() => addGroup(g)} title={`Thêm các dòng hàng của hợp đồng ${g.contractNo} vào chuyến này`}>
                      <Plus className="mr-1 h-4 w-4" aria-hidden />
                      Hàng của HĐ {g.contractNo || "(chưa có số)"}
                    </Button>
                  ))}
              </div>
            </div>
          )}
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
  /** Dòng hàng của bản HĐ đang dùng — dòng chưa có trong chuyến hiện thành dòng TẠM để đóng cont tự điền. */
  contractLines: readonly ExportContractLine[];
  /** Chuyến gộp nhiều HĐ: id dòng HĐ → id HĐ (ba-spec 70). */
  lineContract?: Readonly<Record<string, string>>;
  /** Cont của chuyến (ba-spec 73) — ≥ 2 cont ⇒ dòng nhóm theo cont để người đóng hàng biết dòng nào vào cont nào. */
  containers?: readonly ContainerView[];
}

interface CountForm {
  key: string;
  tg: LoadingCountTarget;
  /** Dòng đã có + dòng TẠM từ HĐ (`loadingCountRows`). */
  rows: ExportShipmentLine[];
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
  onSave: (shipment: ExportShipment, lines: ExportShipmentLine[]) => boolean;
}) {
  const [form, setForm] = useState<CountForm | null>(null);
  const draft = useDialogDraft({ form: "export-loading-count", value: form, setValue: setForm, isEmpty: (f) => JSON.stringify(f.counts) === f.initial });

  useEffect(() => {
    if (!target) return;
    const rows = loadingCountRows(target.lines, target.contractLines, { shipmentId: target.shipment.id, contractId: target.shipment.contractId, lineContract: target.lineContract });
    const counts = Object.fromEntries(rows.map((l) => [l.id, l.loadedUnits]));
    const fresh: CountForm = { key: target.shipment.id, tg: target, rows, counts, initial: JSON.stringify(counts) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const tg = target ?? form?.tg ?? null;
  const [errors, setErrors] = useState<FieldError[]>([]);
  const save = () => {
    if (!form || !tg) return;
    const next = applyLoadingCounts(form.rows, form.counts, { by: recordedBy, at: new Date().toISOString(), newId });
    if (!next.length && !form.rows.some((l) => !isDraftLoadingLine(l))) {
      setErrors([{ field: "loading-count", message: "Chưa điền số kiện nào — điền số thực đóng của ít nhất một dòng hàng." }]);
      return;
    }
    setErrors([]);
    if (onSave(tg.shipment, next)) draft.done();
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
      description={tg ? `${tg.label} — đóng cont xong, ghi số kiện thực đã đóng của từng dòng. Hàng không đóng vào chuyến này thì để trống. Chứng từ lấy số này làm invoice và packing list.` : ""}
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
      <ErrorSummary errors={errors} />
      {form && tg && (
        <div className="grid gap-3 py-2">
          {!form.rows.length && <p className="text-sm text-muted-foreground">Hợp đồng chưa có dòng hàng — Phòng KH nhập dòng hàng ở hợp đồng trước.</p>}
          {linesByContainer(tg.containers && tg.containers.length > 1 ? tg.containers : [ONE_CONT], form.rows).map(({ container, lines }) => (
            <div key={container.id || "first"} className="grid min-w-0 gap-3">
              {tg.containers && tg.containers.length > 1 && (
                <p className="text-sm font-semibold text-primary break-words" data-tour="export-loading-container">
                  {containerLabel(container)}
                  {container.sealNo ? ` · seal ${container.sealNo}` : ""} — {lines.length} dòng
                </p>
              )}
          {lines.map((l) => (
            <div key={l.id} className="grid min-w-0 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end">
              <div className="grid min-w-0 gap-0.5">
                <p className="font-medium break-words">{lineTitle(l)}</p>
                <p className="tnum text-sm text-muted-foreground">
                  {l.plannedUnits != null ? `Kế hoạch ${formatNumber(l.plannedUnits)} ${unitWord(l)}` : "Dòng hàng của hợp đồng"}
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
          ))}
        </div>
      )}
    </FormDialog>
  );
}
