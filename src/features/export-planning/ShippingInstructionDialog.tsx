// ============================================================
// Tên file: src/features/export-planning/ShippingInstructionDialog.tsx
// Tên tiếng Việt: Hộp Lập SI (Shipping Instruction) của chuyến xuất — xuất Excel theo mẫu SI FORM
// Description: ba-spec 72 NV3: linked fields (booking, vessel, ports, container / seal) shown read-only; customer
//              fields carried from the latest SI of the same customer; goods rows with packages + gross (pre-computed,
//              editable); CBM typed. "Lưu & xuất SI" saves the content (composed_documents) and hands the file back.
// ============================================================
import { Fragment, useEffect, useMemo, useState } from "react";
import { Button, ChoiceGroup, DateField, ErrorSummary, Field, FormDialog, FormSection, Input, NumberField, Tag, Textarea, formatNumber, notify, type FieldError } from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useCompanyProfileStore, useComposedDocuments } from "@/lib/catalogRepo";
import { todayISO } from "@/lib/format";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import {
  BL_RELEASES,
  BL_TYPES,
  PAYMENT_TERMS,
  SHIPPING_INSTRUCTION_DOC,
  initialSi,
  newSiDocument,
  previousSiOf,
  siGoodsRows,
  siLinked,
  siPartiesFromContract,
  siToValues,
  siTotals,
  siWarnings,
  type SiContractParties,
  type SiForm,
} from "@/lib/shippingInstruction";
import { downloadXlsx, loadShippingInstructionTemplate, shippingInstructionBytes } from "@/lib/shippingInstructionExcel";
import { safeFileName } from "@/lib/documents";
import type { ExportContractLine, ExportShipment, ExportShipmentLine } from "@/types";
import type { ContainerView } from "@/lib/exportContainers";
import { FileSpreadsheet, RotateCcw, Save } from "lucide-react";

export interface ShippingInstructionTarget {
  shipment: ExportShipment;
  contractNo: string;
  customer: { name: string; address?: string };
  /** Dòng HĐ của mọi HĐ có hàng trên chuyến (tra tên tiếng Anh + HS code). */
  contractLines: readonly ExportContractLine[];
  shipmentLines: readonly ExportShipmentLine[];
  label: string;
  /** Cont của chuyến (ba-spec 73 R9) — ≥ 2 cont ⇒ SI kê từng cont. */
  containers?: readonly ContainerView[];
  /** Người nhận hàng + Notify ghi ở HĐ — SI mới lấy theo đây; nút Lấy theo hợp đồng điền lại. */
  parties?: SiContractParties;
}

interface SiDraft {
  key: string;
  form: SiForm;
  initial: string;
}

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

export function ShippingInstructionDialog({
  target,
  by,
  onClose,
  onExported,
}: {
  target: ShippingInstructionTarget | null;
  by: string;
  onClose: () => void;
  /** File SI vừa xuất — màn lưu làm file mục SI (R13). Trả false nếu không lưu được. */
  onExported: (shipment: ExportShipment, file: Uint8Array, fileName: string) => Promise<boolean>;
}) {
  const [docs, saveDocs] = useComposedDocuments();
  const { profile } = useCompanyProfileStore();
  const [value, setValue] = useState<SiDraft | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-shipping-instruction", value, setValue, isEmpty: (d) => JSON.stringify(d.form) === d.initial });

  const goods = useMemo(() => (target ? siGoodsRows(target.shipment.id, target.shipmentLines, target.contractLines).rows : []), [target]);

  useEffect(() => {
    if (!target) return;
    const s = target.shipment;
    const saved = docs.find((d) => d.docType === SHIPPING_INSTRUCTION_DOC && d.sourceId === s.id) ?? null;
    const form = initialSi({ saved, previous: previousSiOf(docs, target.customer.name, s.id), customer: target.customer, goods, today: todayISO(), parties: target.parties });
    const fresh: SiDraft = { key: s.id, form, initial: JSON.stringify(form) };
    const kept = draft.takeKept();
    setValue(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const linked = target ? siLinked(target.shipment, profile, target.containers ? { containers: target.containers, lines: target.shipmentLines } : undefined) : null;
  const f = value?.form;
  const set = <K extends keyof SiForm>(k: K, v: SiForm[K]) => setValue((d) => (d ? { ...d, form: { ...d.form, [k]: v } } : d));
  const setGoods = (i: number, k: "packages" | "grossKg", v: number | null) =>
    setValue((d) => (d ? { ...d, form: { ...d.form, goods: d.form.goods.map((g, j) => (j === i ? { ...g, [k]: v } : g)) } } : d));
  const warnings =
    linked && f
      ? [...siWarnings(linked, f), ...f.goods.flatMap((g, i) => (g.grossKg == null ? [`Dòng ${i + 1} (${g.description || "chưa có tên"}): chưa có gross — gõ tay.`] : []))]
      : [];
  const totals = f ? siTotals(f.goods) : { packages: 0, grossKg: 0 };

  const save = async () => {
    if (!target || !f || !linked || busy) return;
    const errs: FieldError[] = [];
    if (!f.consignee.trim()) errs.push({ field: "Consignee", message: "Ghi tên + địa chỉ người nhận hàng" });
    if (!f.goods.length) errs.push({ field: "Hàng", message: "Chuyến chưa có hàng — nhập Hàng của chuyến trước" });
    if (f.payment === "3rd COUNTRY" && !f.paymentPlace.trim()) errs.push({ field: "Nơi trả cước", message: "Ghi rõ nơi trả ở nước thứ ba" });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      const at = new Date().toISOString();
      const existing = docs.find((d) => d.docType === SHIPPING_INSTRUCTION_DOC && d.sourceId === target.shipment.id);
      const values = siToValues(f);
      const doc = existing
        ? { ...existing, values, customerKey: target.customer.name.trim(), updatedBy: by, updatedAt: at }
        : newSiDocument(target.shipment, [target.contractNo, target.shipment.lotCode && `lô ${target.shipment.lotCode}`].filter(Boolean).join(" · "), target.customer.name, values, { id: newId(), by, at });
      if (!saveDocs([...docs.filter((d) => d.id !== doc.id), doc])) return;
      const bytes = await shippingInstructionBytes(await loadShippingInstructionTemplate(), linked, f);
      const fileName = safeFileName(`SI-${linked.bookingNo || target.shipment.lotCode || "chuyen"}-${f.date.replace(/-/g, "")}.xlsx`);
      downloadXlsx(bytes, fileName);
      if (!(await onExported(target.shipment, bytes, fileName))) return;
      draft.done();
    } catch (e) {
      notify.error(`Chưa xuất được SI: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const fact = (label: string, v: string) => (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{v || "—"}</dd>
    </div>
  );

  return (
    <FormDialog
      open={!!value}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Lập SI${target ? ` · ${target.label}` : ""}`}
      description="Shipping Instruction gửi hãng tàu để ra B/L. Ô theo booking / cont lấy từ chuyến; ô của khách nhớ theo SI lần trước. Xuất file là mục SI Xong."
      icon={FileSpreadsheet}
      size="lg"
      hasRequiredFields
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
          <Button variant="save" onClick={() => void save()} title="Lưu SI và tải file Excel theo mẫu SI FORM; file lưu vào mục SI của chuyến.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? "Đang xuất…" : "Lưu & xuất SI"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {f && linked && target && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          {warnings.length > 0 && (
            <div className="grid gap-1 text-sm" role="status">
              {warnings.map((w) => (
                <p key={w} className="text-warning">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}
          <FormSection title="Theo booking và cont" hint="Sửa ở Cập nhật booking / Sửa chuyến.">
            <dl data-tour="si-linked" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3 text-sm">
              {fact("Booking No.", linked.bookingNo)}
              {fact("Vessel", linked.vessel)}
              {fact("Voy No", linked.voyage)}
              {fact("Place of Receipt", linked.placeOfReceipt)}
              {fact("Port of Loading", linked.portOfLoading)}
              {fact("Port of Discharge", linked.portOfDischarge)}
              {fact("Place of Delivery", linked.placeOfDelivery)}
              {linked.containers ? (
                // ba-spec 73 R9: mỗi cont một dòng — số / seal · loại · số kiện · gross của cont.
                linked.containers.map((c, i) => (
                  <Fragment key={i}>
                  {fact(
                    `Cont ${i + 1}`,
                    [[c.containerNo, c.sealNo].filter(Boolean).join(" / ") || "chưa có số", c.sizeType, c.packages != null && `${formatNumber(c.packages)} kiện`, c.grossKg != null && `${formatNumber(c.grossKg)} kg gross`]
                      .filter(Boolean)
                      .join(" · "),
                  )}
                  </Fragment>
                ))
              ) : (
                <>
                  {fact("Container / Seal", [linked.containerNo, linked.sealNo].filter(Boolean).join(" / "))}
                  {fact("Size / Type", linked.sizeType)}
                </>
              )}
            </dl>
          </FormSection>
          <FormSection title="Người gửi, người nhận" hint="Consignee, Notify theo hợp đồng; ô còn lại nhớ theo SI gần nhất của cùng khách.">
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField label="Date" value={f.date} onChange={(v) => set("date", v)} />
              <Field label="Attn">
                <Input value={f.attn} onChange={(e) => set("attn", e.target.value)} />
              </Field>
              <Field label="Customers contact" hint="Tên / điện thoại / email nhận draft B/L">
                <Textarea rows={2} value={f.customerContact} onChange={(e) => set("customerContact", e.target.value)} />
              </Field>
              <Field label="Other requests">
                <Textarea rows={2} value={f.otherRequests} onChange={(e) => set("otherRequests", e.target.value)} />
              </Field>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:col-span-2">
                <p className="text-sm text-muted-foreground">
                  Consignee và Notify party lấy theo Người nhận hàng / Notify ghi ở hợp đồng; sửa tay ở đây cho riêng chuyến này. Hãng tàu ra vận đơn theo SI.
                </p>
                {target && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const p = siPartiesFromContract(target.customer, target.parties ?? {});
                      setValue((d) => (d ? { ...d, form: { ...d.form, consignee: p.consignee, ...(p.notifyParty != null ? { notifyParty: p.notifyParty } : {}) } } : d));
                    }}
                    title="Điền lại Consignee và Notify party theo hợp đồng (hợp đồng chưa ghi người nhận hàng thì lấy khách hàng)."
                  >
                    <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
                    Lấy theo hợp đồng
                  </Button>
                )}
              </div>
              <Field label="Consignee" required hint="Tên + địa chỉ đầy đủ, mỗi dòng một hàng">
                <Textarea rows={3} value={f.consignee} onChange={(e) => set("consignee", e.target.value)} />
              </Field>
              <Field label="Notify party" hint="Tùy khách yêu cầu">
                <Textarea rows={3} value={f.notifyParty} onChange={(e) => set("notifyParty", e.target.value)} />
              </Field>
              <Field label="Also notify party">
                <Textarea rows={2} value={f.alsoNotifyParty} onChange={(e) => set("alsoNotifyParty", e.target.value)} />
              </Field>
              <Field label="Shipping marks">
                <Textarea rows={2} value={f.shippingMarks} onChange={(e) => set("shippingMarks", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChoiceGroup label="Bill of lading type" value={f.blType} onChange={(v) => set("blType", v)} options={opts(BL_TYPES)} columns={2} />
              <ChoiceGroup label="Phát hành B/L" value={f.blRelease} onChange={(v) => set("blRelease", v)} options={opts(BL_RELEASES)} columns={3} />
            </div>
          </FormSection>
          <FormSection title="Hàng" hint="Số kiện theo thực đóng (chưa có thì kế hoạch); gross = kg cả bì × số kiện, sửa được.">
            <div data-tour="si-goods" className="grid gap-3">
              {f.goods.map((g, i) => (
                <div key={i} className="grid gap-2 border-b border-border pb-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
                  <p className="min-w-0 text-sm">
                    <span className="font-medium">{g.description || "—"}</span>
                    {g.hsCode && <span className="text-muted-foreground"> · HS {g.hsCode}</span>}
                  </p>
                  <NumberField label="Số kiện" unit="kiện" value={g.packages} onChange={(v) => setGoods(i, "packages", v)} />
                  <NumberField label="Gross" value={g.grossKg} onChange={(v) => setGoods(i, "grossKg", v)} />
                </div>
              ))}
              <p className="flex flex-wrap items-center gap-2 text-sm tnum">
                <Tag variant="muted">Tổng</Tag>
                {totals.packages.toLocaleString("vi-VN")} kiện · {totals.grossKg.toLocaleString("vi-VN")} kg gross
              </p>
              <Field label="Measurement (CBM)" hint="Gõ tay, VD 28,5">
                <Input inputMode="decimal" className="tnum" value={f.cbm} onChange={(e) => set("cbm", e.target.value)} />
              </Field>
            </div>
          </FormSection>
          <FormSection title="Payment terms">
            <ChoiceGroup label="Cước" value={f.payment} onChange={(v) => set("payment", v)} options={opts(PAYMENT_TERMS)} columns={3} />
            {f.payment === "3rd COUNTRY" && (
              <Field label="Nơi trả cước" required>
                <Input value={f.paymentPlace} onChange={(e) => set("paymentPlace", e.target.value)} />
              </Field>
            )}
          </FormSection>
        </div>
      )}
    </FormDialog>
  );
}
