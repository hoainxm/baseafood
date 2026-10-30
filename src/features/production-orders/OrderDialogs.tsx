// ============================================================
// Tên file: src/features/production-orders/OrderDialogs.tsx
// Tên tiếng Việt: Hộp ghi của Lệnh sản xuất — lập / sửa lệnh, NL nhập khẩu dự kiến, phát hành · gắn chuyến
// Description: Write dialogs of /planning-production (ba-spec 48 LS1–LS5, design-spec 49). Rules live in
//              lib/productionOrder.ts — dialogs only call them. Every dialog keeps a draft (rule 17); the
//              save button is never disabled (missing fields ⇒ ErrorSummary).
// ============================================================
import { useEffect, useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
  DateField,
  ErrorSummary,
  Field,
  FormDialog,
  FormSection,
  Input,
  NumberField,
  Textarea,
  formatNumber,
  type ComboboxOption,
  type FieldError,
  GroupLabel,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { DialogFooter } from "@/features/import-planning/ImportDialogs";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { formatDateVN } from "@/lib/format";
import { effectiveRevision } from "@/lib/exportPlanning";
import {
  DEFAULT_SHELF_LIFE_MONTHS,
  canCreateOrder,
  contractLineCoverage,
  contractLineSpec,
  emptyRequirements,
  expiryDate,
  lineFromContract,
  lineKg,
  linesOfOrder,
  materialOptions,
  nextOrderNumber,
  previousOrderFor,
  reservationOf,
  reviseOrder,
  validateOrder,
} from "@/lib/productionOrder";
import type { ExportContractLine, ProductionOrder, ProductionOrderLine, ProductionOrderMaterial, ProductionOrderRequirements } from "@/types";
import { ClipboardList, Copy, Link2, Plus, Send, Trash2, Wheat } from "lucide-react";
import { shipmentLabel } from "./orderText";
import type { ProductionOrderData } from "./useProductionOrderData";

const NAFI_TESTS = ["Vi sinh", "Kháng sinh", "Kim loại nặng", "Histamine", "Khác"];

/* ---------- Lập / sửa lệnh (LS1, LS5) ---------- */

export type OrderFormTarget = { mode: "create"; contractId?: string; shipmentId?: string } | { mode: "edit"; order: ProductionOrder };

export interface OrderSavePayload {
  order: ProductionOrder;
  lines: ProductionOrderLine[];
  isNew: boolean;
  /** Thay đổi đọc được — ghi nhật ký / toast. */
  changes: string[];
  /** Mở từ bước 2 của chuyến ⇒ gắn sẵn chuyến này khi phát hành. */
  shipmentId: string;
}

interface LineForm {
  id: string;
  contractLineId: string;
  units: number | null;
  /** kg gõ tay — chỉ dùng khi dòng HĐ thiếu kg tịnh/thùng. */
  kg: number | null;
}
interface OrderForm {
  key: string;
  id: string;
  isNew: boolean;
  wasIssued: boolean;
  shipmentId: string;
  contractId: string;
  orderNo: string;
  orderDate: string;
  lotCode: string;
  productionDates: string[];
  deliveryDate: string;
  shelfLifeMonths: number | null;
  market: string;
  lines: LineForm[];
  req: ProductionOrderRequirements;
  note: string;
  revisionReason: string;
  initial: string;
}
const orderSnap = (f: OrderForm) =>
  JSON.stringify([f.contractId, f.orderNo, f.orderDate, f.lotCode, f.productionDates, f.deliveryDate, f.shelfLifeMonths, f.market, f.lines, f.req, f.note, f.revisionReason]);
const blankLine = (): LineForm => ({ id: newId(), contractLineId: "", units: null, kg: null });

export function OrderFormDialog({
  target,
  data,
  today,
  onClose,
  onSave,
}: {
  target: OrderFormTarget | null;
  data: ProductionOrderData;
  today: string;
  onClose: () => void;
  onSave: (p: OrderSavePayload) => boolean;
}) {
  const [form, setForm] = useState<OrderForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "production-order", value: form, setValue: setForm, isEmpty: (f) => orderSnap(f) === f.initial });
  const ex = data.exportData;

  useEffect(() => {
    if (!target) return;
    const o = target.mode === "edit" ? target.order : null;
    const contractId = o?.contractId ?? (target.mode === "create" ? (target.contractId ?? "") : "");
    const customerId = ex.contracts.find((c) => c.id === contractId)?.customerId;
    const f: OrderForm = {
      key: o?.id ?? `new:${contractId}`,
      id: o?.id ?? newId(),
      isNew: !o,
      wasIssued: o?.status === "issued",
      shipmentId: target.mode === "create" ? (target.shipmentId ?? "") : "",
      contractId,
      orderNo: o?.orderNo ?? nextOrderNumber(data.orders, today),
      orderDate: o?.orderDate ?? today,
      lotCode: o?.lotCode ?? ex.shipments.find((s) => target.mode === "create" && s.id === target.shipmentId)?.lotCode ?? "",
      productionDates: o?.productionDates.length ? [...o.productionDates] : [""],
      deliveryDate: o?.deliveryDate ?? "",
      shelfLifeMonths: o?.shelfLifeMonths ?? DEFAULT_SHELF_LIFE_MONTHS,
      market: o?.market ?? data.customers.find((c) => c.id === customerId)?.market ?? "",
      lines: o ? linesOfOrder(data.lines, o.id).map((l) => ({ id: l.id, contractLineId: l.contractLineId, units: l.units, kg: l.netKgPerCarton == null ? l.kg : null })) : [blankLine()],
      req: o ? { ...o.requirements } : emptyRequirements(),
      note: o?.note ?? "",
      revisionReason: "",
      initial: "",
    };
    const fresh = { ...f, initial: orderSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  if (!form)
    return (
      <FormDialog open={false} onOpenChange={() => {}} title="Lệnh sản xuất">
        {null}
      </FormDialog>
    );

  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setReq = <K extends keyof ProductionOrderRequirements>(k: K, v: ProductionOrderRequirements[K]) => setForm((f) => (f ? { ...f, req: { ...f.req, [k]: v } } : f));
  const setLine = (id: string, patch: Partial<LineForm>) => setForm((f) => (f ? { ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : f));

  const contract = ex.contracts.find((c) => c.id === form.contractId);
  const rev = contract ? effectiveRevision(ex, contract.id) : null;
  const customerName = data.customers.find((c) => c.id === contract?.customerId)?.name ?? "";
  const productName = (id = "") => data.products.find((p) => p.id === id)?.name ?? "";
  const contractOptions: ComboboxOption[] = ex.contracts
    .filter((c) => c.id === form.contractId || (c.status === "open" && effectiveRevision(ex, c.id)))
    .map((c) => ({ value: c.id, label: c.contractNo, subLabel: data.customers.find((x) => x.id === c.customerId)?.name ?? "" }));
  const others = data.orders.filter((o) => o.id !== form.id);
  const othersLines = data.lines.filter((l) => l.orderId !== form.id);
  const lineOptions: ComboboxOption[] = (rev?.lines ?? [])
    .filter((l) => l.description.trim() || l.quantity != null)
    .map((l) => {
      const cov = contractLineCoverage(l, rev?.terms.tolerancePct ?? null, others, othersLines);
      return {
        value: l.id,
        label: [productName(l.productId) || l.description, l.size].filter(Boolean).join(" · "),
        subLabel: l.productId ? `HĐ ${formatNumber(cov.contractKg)} kg · đã ra lệnh khác ${formatNumber(cov.orderedKg)} · còn ${formatNumber(cov.remainingKg)}` : "Chưa nối mặt hàng — nối ở hồ sơ hợp đồng trước",
      };
    });
  const contractLine = (id: string): ExportContractLine | undefined => rev?.lines.find((l) => l.id === id);
  const buildLines = (): ProductionOrderLine[] =>
    form.lines.map((lf, i) => {
      const cl = contractLine(lf.contractLineId);
      const base = cl
        ? lineFromContract(cl, productName(cl.productId), { id: lf.id, orderId: form.id, lineNo: i + 1 })
        : ({ id: lf.id, orderId: form.id, lineNo: i + 1, contractLineId: "", productId: "", productName: "", description: "", spec: "", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: null, units: null, kg: null, note: "" } as ProductionOrderLine);
      const withUnits = { ...base, units: lf.units };
      return { ...withUnits, kg: lineKg(withUnits) ?? lf.kg };
    });
  const firstProduct = contractLine(form.lines[0]?.contractLineId ?? "")?.productId ?? "";
  const previous = customerName && firstProduct ? previousOrderFor(data.orders, data.lines, customerName, firstProduct, form.id) : null;
  const expiry = expiryDate(form.productionDates.filter(Boolean), form.shelfLifeMonths ?? 0);

  const save = () => {
    const old = target?.mode === "edit" ? target.order : null;
    const lines = buildLines();
    const order: ProductionOrder = {
      ...(old ?? {
        status: "draft",
        issuedAt: "",
        issuedBy: "",
        revisionNo: 0,
        revisionReason: "",
        cancelReason: "",
        staleAckRevisionId: "",
        staleAckReason: "",
        createdBy: "",
        createdAt: new Date().toISOString(),
      }),
      id: form.id,
      orderNo: form.orderNo.trim(),
      orderDate: form.orderDate,
      contractId: form.contractId,
      contractRevisionId: rev?.id ?? old?.contractRevisionId ?? "",
      contractNo: contract?.contractNo ?? old?.contractNo ?? "",
      customerName: customerName || old?.customerName || "",
      market: form.market.trim(),
      lotCode: form.lotCode.trim(),
      productionDates: [...new Set(form.productionDates.filter(Boolean))].sort(),
      deliveryDate: form.deliveryDate,
      shelfLifeMonths: form.shelfLifeMonths ?? DEFAULT_SHELF_LIFE_MONTHS,
      requirements: form.req,
      note: form.note.trim(),
    } as ProductionOrder;
    const errs: FieldError[] = [];
    if (contract) {
      const gate = canCreateOrder(ex, contract, form.lines.map((l) => l.contractLineId).filter(Boolean));
      if (!gate.ok)
        errs.push({
          field: "Hợp đồng xuất",
          message:
            gate.reason === "line-unmapped"
              ? "Có dòng hàng chưa nối mặt hàng danh mục — nối ở hồ sơ hợp đồng xuất trước"
              : gate.reason === "no-effective-revision"
                ? "Hợp đồng chưa có bản hiệu lực"
                : gate.reason === "contract-cancelled"
                  ? "Hợp đồng đã hủy"
                  : "Hợp đồng đã đóng",
        });
    }
    const v = validateOrder(order, lines, others);
    const LABEL: Record<string, string> = { number: "Số lệnh", contract: "Hợp đồng xuất", productionDates: "Ngày sản xuất", deliveryDate: "Ngày giao hàng", lines: "Dòng hàng" };
    errs.push(...v.errors.map((e) => ({ field: LABEL[e.field] ?? "Dòng hàng", message: e.message })));
    const prev = old ? { order: old, lines: linesOfOrder(data.lines, old.id) } : { order, lines: [] };
    const res = reviseOrder(prev, { order, lines }, form.revisionReason);
    if (!res.ok) errs.push({ field: "Lý do sửa", message: res.message });
    if (form.req.nafiTests.includes("Khác") && !form.req.nafiNote.trim())
      errs.push({ field: "Chỉ tiêu Khác", message: "Đã chọn kiểm Nafi Khác thì ghi rõ chỉ tiêu" });
    setErrors(errs);
    if (errs.length || !res.ok) return;
    if (onSave({ order: res.order, lines, isNew: form.isNew, changes: res.changes, shipmentId: form.shipmentId })) draft.done();
  };

  return (
    <FormDialog
      open
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={form.isNew ? "Lập lệnh sản xuất" : `Sửa lệnh sản xuất ${form.orderNo}`}
      description="Lệnh lấy dòng hàng từ bản hiệu lực của hợp đồng xuất: gõ số thùng, kg tự tính. Lưu xong lệnh ở trạng thái Nháp cho tới khi phát hành."
      icon={ClipboardList}
      size="xl"
      hasRequiredFields
      footer={
        <DialogFooter
          busy={false}
          onCancel={() => {
            draft.cancel();
            onClose();
          }}
          onSave={save}
          label="Lưu lệnh"
          title={form.wasIssued ? "Lưu bản sửa của lệnh đã phát hành (tăng lần sửa, ghi lý do)." : "Lưu lệnh (Nháp). Phát hành ở hồ sơ lệnh."}
        />
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      <div className="grid gap-5 py-2">
        <ErrorSummary errors={errors} />
        <FormSection no={1} title="Lệnh" hint="Số lệnh gợi ý theo tháng; hạn sử dụng tính từ tháng của ngày sản xuất đầu.">
          <Combobox
            label="Hợp đồng xuất"
            required
            value={form.contractId}
            onChange={(v) => setForm((f) => (f ? { ...f, contractId: v, lines: v === f.contractId ? f.lines : [blankLine()] } : f))}
            options={contractOptions}
            hint="Chỉ hợp đồng còn mở và có bản hiệu lực."
            emptyText="Chưa có hợp đồng xuất nào đủ điều kiện."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Số lệnh" required hint={form.isNew ? `Gợi ý số kế tiếp: ${nextOrderNumber(others, form.orderDate || today)}` : undefined}>
              <Input value={form.orderNo} onChange={(e) => set("orderNo", e.target.value)} />
            </Field>
            <DateField label="Ngày lệnh" value={form.orderDate} onChange={(v) => set("orderDate", v)} />
            <Field label="Mã số lô (MSL)">
              <Input value={form.lotCode} onChange={(e) => set("lotCode", e.target.value)} />
            </Field>
          </div>
          {/* Nhãn chuẩn của DateField (không tự dựng nhãn nhóm): ngày 1 là "Ngày sản xuất *", ngày thêm đánh số. */}
          <div className="grid gap-2">
            <div className="grid gap-4 sm:grid-cols-3">
              {form.productionDates.map((d, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <DateField
                      label={i === 0 ? "Ngày sản xuất" : `Ngày sản xuất ${i + 1}`}
                      required={i === 0}
                      value={d}
                      onChange={(v) => set("productionDates", form.productionDates.map((x, j) => (j === i ? v : x)))}
                    />
                  </div>
                  {form.productionDates.length > 1 && (
                    <Button variant="danger" size="icon" onClick={() => set("productionDates", form.productionDates.filter((_, j) => j !== i))} title="Bỏ ngày sản xuất này.">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={() => set("productionDates", [...form.productionDates, ""])} title="Thêm một ngày sản xuất (lệnh làm nhiều ngày).">
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Thêm ngày
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <DateField label="Ngày giao hàng" required value={form.deliveryDate} onChange={(v) => set("deliveryDate", v)} />
            <NumberField label="Hạn sử dụng" unit="tháng" value={form.shelfLifeMonths} onChange={(v) => set("shelfLifeMonths", v)} hint={expiry ? `HSD ${formatDateVN(expiry)}` : "Tính từ tháng của ngày sản xuất đầu"} />
            <Field label="Xuất vào thị trường">
              <Input value={form.market} onChange={(e) => set("market", e.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection no={2} title="Dòng hàng" hint={rev ? "Gõ số thùng (hoặc kiện), kg tự tính theo kg tịnh mỗi thùng của hợp đồng." : "Chọn hợp đồng xuất trước — dòng hàng lấy từ bản hiệu lực của hợp đồng."}>
          {rev &&
            form.lines.map((lf, i) => {
              const cl = contractLine(lf.contractLineId);
              const auto = cl ? lineKg({ units: lf.units, unitKind: cl.unitKind, cartonsPerUnit: cl.cartonsPerUnit, netKgPerCarton: cl.netKgPerCarton }) : null;
              return (
                <div key={lf.id} className="grid gap-3 rounded-lg border border-border bg-background px-3 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Combobox label={`Dòng hàng ${i + 1}`} required value={lf.contractLineId} onChange={(v) => setLine(lf.id, { contractLineId: v })} options={lineOptions} />
                  <NumberField label={cl?.unitKind === "bundle" ? "Số kiện" : "Số thùng"} required value={lf.units} onChange={(v) => setLine(lf.id, { units: v })} />
                  {cl && cl.netKgPerCarton == null ? (
                    <NumberField label="Kg" required unit="kg" value={lf.kg} onChange={(v) => setLine(lf.id, { kg: v })} hint="Hợp đồng chưa có kg tịnh mỗi thùng — gõ kg" />
                  ) : (
                    <Field label="Kg (tự tính)">
                      <p className="tnum py-2">{auto == null ? "—" : `${formatNumber(auto)} kg`}</p>
                    </Field>
                  )}
                  {form.lines.length > 1 ? (
                    <Button variant="danger" size="icon" className="sm:self-end" onClick={() => set("lines", form.lines.filter((x) => x.id !== lf.id))} title="Bỏ dòng này.">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : (
                    <span />
                  )}
                  {/* R17: quy cách + ghi chú dòng chép từ dòng HĐ — xem trước, sửa ở hợp đồng. */}
                  {cl && (contractLineSpec(cl) || cl.note) && (
                    <p className="text-sm break-words text-muted-foreground sm:col-span-4">
                      {contractLineSpec(cl) && <>Quy cách: {contractLineSpec(cl)}</>}
                      {cl.note && <span className="block">Ghi chú: {cl.note}</span>}
                    </p>
                  )}
                </div>
              );
            })}
          {rev && (
            <div>
              <Button variant="outline" size="sm" onClick={() => set("lines", [...form.lines, blankLine()])} title="Thêm một dòng hàng của hợp đồng vào lệnh.">
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Thêm dòng
              </Button>
            </div>
          )}
        </FormSection>

        <FormSection
          no={3}
          title="Yêu cầu bao bì · kiểm Nafi · lưu ý"
          hint="Không bắt buộc. Ô trống thì bản in để trống."
          action={
            previous && (
              <Button variant="outline" size="sm" onClick={() => setForm((f) => (f ? { ...f, req: { ...previous.requirements }, note: f.note || previous.note } : f))} title="Chép yêu cầu bao bì, Nafi, lưu ý từ lệnh gần nhất cùng khách và mặt hàng.">
                <Copy className="mr-1 h-4 w-4" aria-hidden />
                Chép từ lệnh {previous.orderNo}
              </Button>
            )
          }
        >
          <ChoiceGroup
            label="Dự kiến có bao bì"
            hideRequiredMark
            value={form.req.packagingReady}
            onChange={(v) => setReq("packagingReady", v as ProductionOrderRequirements["packagingReady"])}
            options={[
              { value: "ready", label: "Đã có sẵn" },
              { value: "pending", label: "Chưa có" },
              { value: "", label: "Chưa ghi" },
            ]}
            columns={3}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Thùng carton (số lớp, in)">
              <Input value={form.req.cartonLayers} onChange={(e) => setReq("cartonLayers", e.target.value)} />
            </Field>
            <Field label="Đai dây">
              <Input value={form.req.strapNote} onChange={(e) => setReq("strapNote", e.target.value)} />
            </Field>
            <Field label="Bao PE">
              <Input value={form.req.peBagNote} onChange={(e) => setReq("peBagNote", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ghi trên thùng carton (mã lô, NSX, HSD, cách ghi)">
              <Input value={form.req.cartonMarking} onChange={(e) => setReq("cartonMarking", e.target.value)} />
            </Field>
            <Field label="Ghi trên bao PE / rider">
              <Input value={form.req.bagMarking} onChange={(e) => setReq("bagMarking", e.target.value)} />
            </Field>
          </div>
          {/* Nhóm nút chọn nhiều: nhãn cùng khuôn legend của ChoiceGroup (min-h-9, chữ đậm nhỏ) — không tự dựng cỡ chữ khác. */}
          <fieldset className="grid min-w-0 gap-2">
            <GroupLabel as="legend">Kiểm Nafi (chọn nhiều)</GroupLabel>
            <div className="flex flex-wrap gap-2">
              {NAFI_TESTS.map((t) => {
                const on = form.req.nafiTests.includes(t);
                return (
                  <Button
                    key={t}
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    onClick={() => setReq("nafiTests", on ? form.req.nafiTests.filter((x) => x !== t) : [...form.req.nafiTests, t])}
                    title={on ? `Bỏ chỉ tiêu ${t}.` : `Thêm chỉ tiêu ${t}.`}
                  >
                    {t}
                  </Button>
                );
              })}
            </div>
            <Field
              label={form.req.nafiTests.includes("Khác") ? "Chỉ tiêu Khác / lấy kết quả vi sinh" : "Chỉ tiêu thêm / lấy kết quả vi sinh"}
              required={form.req.nafiTests.includes("Khác")}
              hint={form.req.nafiTests.includes("Khác") ? "Đã chọn Khác: ghi rõ chỉ tiêu cần kiểm." : undefined}
            >
              <Input value={form.req.nafiNote} onChange={(e) => setReq("nafiNote", e.target.value)} />
            </Field>
          </fieldset>
          <Field label="Quy trình sản xuất">
            <Input value={form.req.processNote} onChange={(e) => setReq("processNote", e.target.value)} />
          </Field>
          <Field label="Các lưu ý khác">
            <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
          </Field>
        </FormSection>

        {form.wasIssued && (
          <Field label="Lý do sửa" required hint="Lệnh đã phát hành: lý do ghi vào lần sửa, quản đốc và thủ kho thấy dấu Đã sửa.">
            <Textarea value={form.revisionReason} onChange={(e) => set("revisionReason", e.target.value)} rows={2} />
          </Field>
        )}
      </div>
    </FormDialog>
  );
}

/* ---------- NL nhập khẩu dự kiến (LS2) ---------- */

export interface MaterialTarget {
  order: ProductionOrder;
  line: ProductionOrderLine;
}
interface MaterialForm {
  key: string;
  kg: Record<string, number | null>;
  initial: string;
}
/** Khóa một dòng thực nhập = lần nhập + dòng HĐ nhập. */
const matKey = (receiptId: string, importLineId: string) => `${receiptId}|${importLineId}`;

export function MaterialDialog({
  target,
  data,
  onClose,
  onSave,
}: {
  target: MaterialTarget | null;
  data: ProductionOrderData;
  onClose: () => void;
  onSave: (orderLineId: string, rows: ProductionOrderMaterial[]) => boolean;
}) {
  const [form, setForm] = useState<MaterialForm | null>(null);
  const draft = useDialogDraft({ form: "production-order-materials", value: form, setValue: setForm, isEmpty: (f) => JSON.stringify(f.kg) === f.initial });

  useEffect(() => {
    if (!target) return;
    const kg: Record<string, number | null> = {};
    for (const m of data.materials.filter((x) => x.orderLineId === target.line.id)) kg[matKey(m.receiptId, m.importLineId)] = m.kg;
    const fresh: MaterialForm = { key: target.line.id, kg, initial: JSON.stringify(kg) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const productOf = (importLineId: string) => data.importLines.find((l) => l.id === importLineId)?.productId ?? "";
  const options = materialOptions(data.receipts, data.receiptLines).sort(
    (a, b) => Number(productOf(b.contractLineId) === target?.line.productId) - Number(productOf(a.contractLineId) === target?.line.productId),
  );
  const labelOf = (receiptId: string, importLineId: string) => {
    const r = data.receipts.find((x) => x.id === receiptId);
    const il = data.importLines.find((x) => x.id === importLineId);
    return [r && `HĐ nhập ${r.contractNo}`, r?.supplierName, il?.productName, r?.arrivalDate && formatDateVN(r.arrivalDate), r?.containerNo].filter(Boolean).join(" · ");
  };

  const save = () => {
    if (!target || !form) return;
    const existing = data.materials.filter((m) => m.orderLineId === target.line.id);
    const rows: ProductionOrderMaterial[] = Object.entries(form.kg)
      .filter(([, kg]) => kg != null && kg > 0)
      .map(([k, kg]) => {
        const [receiptId, importLineId] = k.split("|");
        const old = existing.find((m) => m.receiptId === receiptId && m.importLineId === importLineId);
        return { id: old?.id ?? newId(), orderId: target.order.id, orderLineId: target.line.id, receiptId, importLineId, label: labelOf(receiptId, importLineId), kg };
      });
    if (onSave(target.line.id, rows)) draft.done();
  };

  return (
    <FormDialog
      open={!!form && !!target}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`NL nhập khẩu dự kiến · ${target?.line.productName || target?.line.description || ""}`}
      description="Ghi số kg NL dự kiến lấy từ từng lần nhập khẩu. Chỉ dành cho lệnh — không trừ kho, không ghi vào Nhập khẩu hay sổ kho. Dành vượt thực nhập vẫn lưu được, có cảnh báo."
      icon={Wheat}
      size="lg"
      footer={
        <DialogFooter
          busy={false}
          onCancel={() => {
            draft.cancel();
            onClose();
          }}
          onSave={save}
          label="Lưu NL dự kiến"
          title="Lưu số kg NL dự kiến của dòng lệnh."
        />
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && target && (
        <div className="grid gap-3 py-2">
          {options.length === 0 && <p className="text-muted-foreground">Chưa có lần nhập khẩu nào đã ghi thực nhập.</p>}
          {options.map((rl) => {
            const k = matKey(rl.receiptId, rl.contractLineId);
            const others = data.materials.filter((m) => m.orderLineId !== target.line.id);
            const mine = form.kg[k] ?? null;
            const r = reservationOf(rl, [...others, ...(mine ? [{ id: "x", orderId: target.order.id, orderLineId: target.line.id, receiptId: rl.receiptId, importLineId: rl.contractLineId, label: "", kg: mine }] : [])], [...data.orders.filter((o) => o.id !== target.order.id), target.order]);
            const same = productOf(rl.contractLineId) === target.line.productId;
            return (
              <div key={rl.id} className="grid gap-2 rounded-lg border border-border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end">
                <div className="grid min-w-0 gap-0.5">
                  <span className="break-words">
                    {labelOf(rl.receiptId, rl.contractLineId)}
                    {same && <span className="text-sm text-success"> · Cùng mặt hàng</span>}
                  </span>
                  <span className={`tnum text-sm ${r.overReceived ? "text-warning" : "text-muted-foreground"}`}>
                    Thực nhập {formatNumber(r.receivedKg)} kg · đã dành {formatNumber(r.reservedKg)} kg{r.overReceived ? ` · vượt ${formatNumber(-r.freeKg)} kg` : ""}
                  </span>
                </div>
                <NumberField label="Kg dự kiến" unit="kg" value={mine} onChange={(v) => setForm((f) => (f ? { ...f, kg: { ...f.kg, [k]: v } } : f))} />
              </div>
            );
          })}
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Phát hành · gắn chuyến (LS3) ---------- */

export interface IssueTarget {
  order: ProductionOrder;
  /** issue = phát hành (kèm chọn chuyến) · link = chỉ đổi chuyến gắn kèm. */
  mode: "issue" | "link";
  preselect?: string[];
}

export function IssueDialog({
  target,
  data,
  onClose,
  onSave,
}: {
  target: IssueTarget | null;
  data: ProductionOrderData;
  onClose: () => void;
  onSave: (order: ProductionOrder, mode: "issue" | "link", shipmentIds: string[]) => boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [forTarget, setForTarget] = useState(target);
  if (forTarget !== target) {
    setForTarget(target);
    setPicked(target ? [...new Set([...(target.preselect ?? []), ...data.links.filter((l) => l.orderId === target.order.id).map((l) => l.shipmentId)])] : []);
  }
  if (!target) return null;
  const o = target.order;
  const lines = linesOfOrder(data.lines, o.id);
  const shipments = data.exportData.shipments.filter((s) => s.contractId === o.contractId && s.status === "open");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const kg = lines.reduce((s, l) => s + (l.kg ?? 0), 0);
  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={target.mode === "issue" ? `Phát hành lệnh ${o.orderNo}` : `Gắn chuyến · lệnh ${o.orderNo}`}
      description={
        target.mode === "issue"
          ? "Phát hành thì Ban quản đốc phân xưởng và Thủ kho đọc được lệnh trên app; Phòng Kỹ thuật nhận bản in. Chuyến gắn kèm xong bước Lệnh sản xuất."
          : "Chọn chuyến xuất của hợp đồng mà lệnh này lo. Chuyến chưa có MSL sẽ nhận MSL của lệnh."
      }
      icon={target.mode === "issue" ? Send : Link2}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="save" onClick={() => onSave(o, target.mode, picked) && onClose()} title={target.mode === "issue" ? "Phát hành lệnh và gắn các chuyến đã chọn." : "Lưu các chuyến gắn với lệnh."}>
            {target.mode === "issue" ? <Send className="mr-2 h-4 w-4" aria-hidden /> : <Link2 className="mr-2 h-4 w-4" aria-hidden />}
            {target.mode === "issue" ? "Phát hành" : "Lưu chuyến gắn"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 py-2">
        {target.mode === "issue" && (
          <dl className="grid gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Dòng hàng</dt>
              <dd className="tnum">
                {lines.length} dòng · {formatNumber(kg)} kg
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">MSL · ngày SX</dt>
              <dd className="tnum">
                {o.lotCode || "—"} · {o.productionDates.map((d) => formatDateVN(d).slice(0, 5)).join(", ")}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Nơi nhận</dt>
              <dd>Ban quản đốc phân xưởng · Thủ kho · Phòng Kỹ thuật (bản in)</dd>
            </div>
          </dl>
        )}
        <fieldset className="grid gap-2">
          <GroupLabel as="legend">Chuyến xuất của hợp đồng {o.contractNo}</GroupLabel>
          {shipments.length === 0 && <p className="text-sm text-muted-foreground">Hợp đồng chưa có chuyến đang mở. Phát hành được, gắn chuyến sau.</p>}
          {shipments.map((s) => (
            <label key={s.id} className="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 py-2">
              <input type="checkbox" className="size-4 accent-primary" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
              <span className="min-w-0 break-words">
                {shipmentLabel(s)}
                <span className="block text-sm text-muted-foreground">{s.lotCode ? `MSL ${s.lotCode}` : o.lotCode ? `Chưa có MSL — sẽ ghi ${o.lotCode}` : "Chưa có MSL"}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </FormDialog>
  );
}
