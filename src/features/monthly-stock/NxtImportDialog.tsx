/**
 * Hộp "Nạp báo cáo Xuất–Nhập–Tồn" của Sổ kho theo tháng (ba-spec 75): mỗi mã của file hiện thành
 * DÒNG SẼ GHI theo ô của sổ (mặt hàng · size · ngày nhập · invoice · kg/kiện · tồn đầu · nhập · xuất)
 * cạnh dòng sổ đang có; chỗ lệch nói rõ và phải chọn; nạp TỪNG DÒNG hoặc NẠP TẤT CẢ dòng sẵn sàng.
 * Luật nằm ở `lib/nxtStockImport.ts`.
 */
import { Fragment, useMemo, useState } from "react";
import type { MonthlyStockLine } from "@/types";
import {
  FIELD_LABEL,
  MAP_NEW,
  MAP_SKIP,
  STATUS_LABEL,
  applyNxtPlan,
  buildNxtPlan,
  checkNxtReport,
  choiceLabelFor,
  choicesOf,
  itemBlockers,
  listNxtBlockers,
  monthOfReport,
  needsChoice,
  pendingCodes,
  type NxtChoice,
  type NxtDecision,
  type NxtField,
  type NxtPlanItem,
  type NxtReport,
  type NxtStatus,
} from "@/lib/nxtStockImport";
import { formatMonthLabel, getPrevMonth } from "@/lib/monthlyStock";
import { num, formatDateVN } from "@/lib/format";
import { useDialogDraft } from "@/lib/formDraft";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorSummary,
  Field,
  HorizontalScroll,
  Input,
  Tag,
  useTableSort,
  type ComboboxOption,
  type FieldError,
  type SortColumnSpec,
  type TagVariant,
} from "@/design-system";
import { AlertTriangle, CheckCircle2, FileText, Upload } from "lucide-react";

export interface NxtImportForm {
  fileName: string;
  report: NxtReport;
  warehouse: string;
  /** Nhóm hàng cho dòng mới / dòng điều chỉnh. */
  category: string;
  decisions: Record<string, NxtDecision>;
}

/** Trạng thái hộp + nháp (quy tắc 17): đóng ngang giữ lựa chọn, mở lại đúng file thì lấy lại. */
export function useNxtImportForm() {
  const [form, setForm] = useState<NxtImportForm | null>(null);
  const draft = useDialogDraft({
    form: "monthly-stock-nxt-import",
    value: form,
    setValue: setForm,
    isEmpty: (f) => Object.keys(f.decisions).length === 0,
  });
  const open = (fileName: string, report: NxtReport, warehouse: string, category: string) => {
    const kept = draft.takeKept();
    const same = kept && kept.fileName === fileName && kept.report.dateFrom === report.dateFrom && kept.report.dateTo === report.dateTo;
    setForm(same ? { ...kept, report } : { fileName, report, warehouse, category, decisions: {} });
  };
  return { form, setForm, draft, open };
}

type RowState = NxtStatus | "done";

const STATE_VARIANT: Record<RowState, TagVariant> = {
  match: "pending",
  new: "source",
  "opening-diff": "error",
  missing: "error",
  unbalanced: "error",
  skipped: "muted",
  done: "done",
};
const STATE_LABEL: Record<RowState, string> = { ...STATUS_LABEL, done: "Đã nạp" };

const CHOICE_TITLE: Record<NxtChoice, string> = {
  "prior-in":
    "Sổ đã tính phần nhập trong tháng vào tồn đầu: nhập ghi = nhập của file trừ phần sổ thừa, xuất đúng file. Tồn cuối khớp file, không phồng nhập / xuất.",
  file: "Ghi theo số của file kế toán. File nhiều hơn ⇒ thêm dòng điều chỉnh tồn đầu trong tháng; sổ nhiều hơn ⇒ ghi phần thừa thành xuất điều chỉnh trên lô.",
  ledger: "Giữ tồn đầu trên sổ, chỉ điền nhập / xuất của file. Tồn cuối sổ sẽ khác file.",
  skip: "Không nạp mã này lần này — sổ giữ nguyên.",
};

export function NxtImportDialog({
  state,
  lines,
  warehouseOptions,
  categoryOptions,
  onCommit,
}: {
  state: ReturnType<typeof useNxtImportForm>;
  lines: MonthlyStockLine[];
  warehouseOptions: ComboboxOption[];
  categoryOptions: ComboboxOption[];
  onCommit: (next: MonthlyStockLine[], message: string, month: string, warehouse: string) => void;
}) {
  const { form, setForm, draft } = state;
  const [errors, setErrors] = useState<FieldError[]>([]);
  /** Bước xác nhận ghi đè: mã đang chờ xác nhận, hoặc "*" = nạp tất cả. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const month = form ? monthOfReport(form.report) : null;
  const issues = useMemo(() => (form ? checkNxtReport(form.report) : []), [form]);
  const fileBlocked = issues.some((i) => i.level === "error");
  const plan = useMemo(
    () => (form && month ? buildNxtPlan(lines, form.report, { warehouse: form.warehouse, month, decisions: form.decisions }) : null),
    [form, month, lines]
  );
  const sourceNote = form ? `Nạp XNT "${form.fileName}"${form.report.createdText ? ` (${form.report.createdText})` : ""}` : "";
  const applyOpts = useMemo(() => ({ category: form?.category ?? "", decisions: form?.decisions ?? {}, sourceNote }), [form, sourceNote]);
  const pending = useMemo(() => (plan ? pendingCodes(plan, applyOpts) : new Set<string>()), [plan, applyOpts]);
  const blockers = useMemo(() => (plan ? itemBlockers(plan) : new Map<string, string[]>()), [plan]);

  const stateOf = (it: NxtPlanItem): RowState => {
    if (it.status === "skipped" || it.choice === "skip") return "skipped";
    const ready = !blockers.has(it.code) && (it.status === "match" || it.status === "new" || !!it.choice);
    if (ready && !pending.has(it.code) && it.rowIds.length) return "done";
    return it.status;
  };
  const severity = (it: NxtPlanItem) => {
    const s = stateOf(it);
    return needsChoice(it.status) && !it.choice ? 0 : s === "done" ? 4 : s === "skipped" ? 5 : it.warnings.length ? 1 : 2;
  };
  const items = useMemo(() => (plan ? [...plan.items].sort((a, b) => severity(a) - severity(b)) : []), [plan, pending, blockers]); // eslint-disable-line react-hooks/exhaustive-deps
  const attention = (it: NxtPlanItem) => stateOf(it) !== "done" && (it.warnings.length > 0 || it.status === "new" || it.mapSource === "suggest" || it.mapSource === "user");
  const shown = onlyIssues ? items.filter(attention) : items;
  const sortColumns: SortColumnSpec<NxtPlanItem>[] = [
    { key: "status", getValue: severity, sortKind: "number" },
    { key: "code", getValue: (it) => it.code },
    { key: "item", getValue: (it) => it.fields.itemName },
    { key: "size", getValue: (it) => it.fields.size },
    { key: "date", getValue: (it) => it.fields.importDate || null, sortKind: "date" },
    { key: "invoice", getValue: (it) => it.fields.origin },
    { key: "fileOpen", numeric: true, getValue: (it) => it.file.openKg },
    { key: "ledgerOpen", numeric: true, getValue: (it) => (it.rowIds.length ? it.ledgerOpenKg : null) },
    { key: "in", numeric: true, getValue: (it) => it.file.inKg },
    { key: "out", numeric: true, getValue: (it) => it.file.outKg },
    { key: "close", numeric: true, getValue: (it) => it.resultCloseKg },
  ];
  const sort = useTableSort(shown, (it) => it.code, sortColumns);

  const counts = useMemo(() => {
    const c = new Map<RowState, number>();
    for (const it of items) c.set(stateOf(it), (c.get(stateOf(it)) ?? 0) + 1);
    return c;
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = !!form;

  const setDecision = (code: string, patch: Partial<NxtDecision>) => {
    setConfirming(null);
    setErrors([]);
    setForm((f) => (f ? { ...f, decisions: { ...f.decisions, [code]: { ...f.decisions[code], ...patch } } } : f));
  };

  const totals = useMemo(() => {
    const t = { fileOpen: 0, fileIn: 0, fileOut: 0, fileClose: 0, resultClose: 0 };
    for (const it of items) {
      t.fileOpen += it.file.openKg;
      t.fileIn += it.file.inKg;
      t.fileOut += it.file.outKg;
      t.fileClose += it.file.closeKg;
      t.resultClose += it.resultCloseKg;
    }
    return t;
  }, [items]);

  const rowOptions = (it: NxtPlanItem): ComboboxOption[] => {
    if (!plan) return [];
    const mine = it.rowIds.map((id) => plan.baseLines.find((l) => l.id === id)).filter((l): l is MonthlyStockLine => !!l);
    const seen = new Set<string>();
    const opts: ComboboxOption[] = [];
    for (const l of mine) {
      seen.add(l.id);
      opts.push({ value: l.id, label: [l.itemName, l.size, l.origin].filter(Boolean).join(" · "), subLabel: `tồn đầu ${num(l.openKg)} kg` });
    }
    for (const c of plan.candidates) if (!seen.has(c.id)) opts.push({ value: c.id, label: c.label });
    opts.push({ value: MAP_NEW, label: "➕ Thêm dòng mới cho mã này" }, { value: MAP_SKIP, label: "Bỏ mã này (không nạp)" });
    return opts;
  };
  const targetOf = (it: NxtPlanItem) => form?.decisions[it.code]?.target ?? it.rowIds[0] ?? MAP_NEW;

  /** Ghi các mã `codes` (một dòng, hoặc mọi dòng sẵn sàng). */
  const commit = (codes: string[], key: string) => {
    if (!form || !plan || !month) return;
    if (fileBlocked) {
      setErrors(issues.filter((i) => i.level === "error").map((i) => ({ field: "File", message: i.text })));
      return;
    }
    if (!codes.length) {
      const why = listNxtBlockers(plan, []);
      setErrors(
        why.length
          ? why.map((text) => {
              const it = plan.items.find((x) => text.startsWith(`${x.code}: `));
              return it ? { field: it.code, message: text.slice(it.code.length + 2) } : { field: "Sổ", message: text };
            })
          : [{ field: "Sổ", message: "Không còn dòng nào cần nạp — mọi mã đã khớp với sổ." }]
      );
      return;
    }
    const overwrites = plan.items.filter((it) => codes.includes(it.code) && (it.overwrite || (it.status === "opening-diff" && it.choice !== "ledger")));
    if (overwrites.length && confirming !== key) {
      setConfirming(key);
      return;
    }
    const result = applyNxtPlan(plan, { ...applyOpts, codes });
    const parts = [
      `cập nhật ${result.updated} dòng`,
      result.added ? `thêm ${result.added} dòng` : "",
      result.adjusted ? `điều chỉnh ${result.adjusted} mã` : "",
    ].filter(Boolean);
    const what = codes.length === 1 ? `mã ${codes[0]}` : `${codes.length} mã`;
    onCommit(result.lines, `Đã nạp ${what} · ${formatMonthLabel(month)} · ${form.warehouse}: ${parts.join(", ")}. Sai thì bấm Hoàn tác.`, month, form.warehouse);
    setConfirming(null);
    setErrors([]);
    // Nạp tất cả mà còn mã chưa sẵn sàng ⇒ giữ hộp mở, liệt kê; hết việc ⇒ đóng.
    const remaining = plan.items.filter((it) => !codes.includes(it.code) && stateOf(it) !== "done" && stateOf(it) !== "skipped");
    if (key === "*" && !remaining.length) draft.done();
    else if (key === "*" && remaining.length)
      setErrors(remaining.map((it) => ({ field: it.code, message: `chưa nạp — ${(blockers.get(it.code)?.[0] ?? STATE_LABEL[stateOf(it)]).replace(`${it.code}: `, "")}` })));
  };

  const dismiss = () => {
    setConfirming(null);
    setErrors([]);
    draft.dismiss();
  };

  /** Ô mô tả: giá trị sẽ ghi; lấy từ file ⇒ chấm xanh; khác file ⇒ cảnh báo. */
  /** Một ô mô tả viết gọn trong dòng phụ dưới tên mặt hàng (giữ dấu • lấy từ file, ⚠ sổ khác file). */
  const fieldMeta = (it: NxtPlanItem, f: NxtField) => {
    const v = it.fields[f];
    const text = v == null || v === "" ? "—" : f === "importDate" ? formatDateVN(String(v)) : f === "kgPerCtn" ? num(Number(v)) : String(v);
    const conflict = it.fields.conflicts.find((c) => c.field === f);
    const filled = it.fields.filled.includes(f);
    return (
      <span
        key={f}
        className={`whitespace-nowrap ${f === "kgPerCtn" ? "tnum" : ""} ${conflict ? "font-semibold text-warning" : ""}`}
        title={`${FIELD_LABEL[f]}${conflict ? `: sổ "${conflict.ledger}" · file "${conflict.file}" — giữ sổ` : filled ? " lấy từ file" : ""}`}
      >
        {conflict && <AlertTriangle className="mr-0.5 inline h-3.5 w-3.5" />}
        <span className="text-muted-foreground">{FIELD_LABEL[f]}:</span> {text}
        {filled && <span className="ml-0.5 text-info">•</span>}
      </span>
    );
  };

  const readyCodes = plan ? plan.items.filter((it) => pending.has(it.code)).map((it) => it.code) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="w-full sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Nạp báo cáo Xuất–Nhập–Tồn</DialogTitle>
          <DialogDescription className="text-base">
            Mỗi mã của báo cáo hiện thành dòng sẽ ghi vào sổ (mặt hàng · size · ngày nhập · invoice · kg/kiện · số kg) cạnh dòng sổ đang có. Soát,
            chọn cách xử chỗ lệch, rồi nạp từng dòng hoặc nạp tất cả dòng sẵn sàng. Nhập / xuất ghi THAY theo file — nạp lại không nhân đôi.
          </DialogDescription>
        </DialogHeader>
        {form && (
          <div className="space-y-4 py-2">
            <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <FileText className="h-4 w-4" />
                {form.fileName}
              </span>
              <span>{form.report.source === "pdf" ? "PDF" : "Excel"}</span>
              {form.report.warehouseText && <span>Chi nhánh trên file: {form.report.warehouseText}</span>}
              {form.report.dateFrom && (
                <span>
                  {formatDateVN(form.report.dateFrom)} → {formatDateVN(form.report.dateTo)}
                </span>
              )}
              {form.report.createdText && <span>{form.report.createdText}</span>}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Combobox
                label="Nạp vào kho"
                value={form.warehouse}
                onChange={(v) => setForm((f) => (f ? { ...f, warehouse: v, decisions: {} } : f))}
                options={warehouseOptions}
                onCreate={(t) => t}
                hint="Đúng kho của báo cáo — sai kho là tạo bản sao ở kho khác."
              />
              <Field label="Tháng (theo khoảng ngày của file)">
                <Input value={month ? formatMonthLabel(month) : "— không phải trọn một tháng —"} readOnly />
              </Field>
              <Combobox
                label="Nhóm cho dòng mới"
                value={form.category}
                onChange={(v) => setForm((f) => (f ? { ...f, category: v } : f))}
                options={categoryOptions}
                onCreate={(t) => t}
              />
            </div>

            {issues.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                {issues.map((i) => (
                  <p key={i.text} className={i.level === "error" ? "font-semibold text-destructive" : "text-warning"}>
                    <AlertTriangle className="mr-1 inline h-4 w-4" />
                    {i.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-success">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                Đọc {form.report.rows.length} mã · mọi dòng cân (đầu + nhập − xuất = cuối)
                {form.report.declared ? " · tổng khớp dòng \"SL mặt hàng\" in trên file" : " · file Excel không có dòng tổng để đối chiếu"}.
              </p>
            )}

            {plan && (
              <>
                {plan.opensMonth && (
                  <p className="text-sm text-muted-foreground">
                    {formatMonthLabel(plan.month)} ở {plan.warehouse} chưa mở — lần nạp đầu kế thừa tồn cuối {formatMonthLabel(getPrevMonth(plan.month))} làm
                    tồn đầu trước (như "Kế thừa &amp; lưu").
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {[...counts].map(([s, n]) => (
                    <Tag key={s} variant={STATE_VARIANT[s]}>
                      {STATE_LABEL[s]}: {n}
                    </Tag>
                  ))}
                  {plan.ledgerOnly.length > 0 && <Tag variant="warning">Sổ có, file không: {plan.ledgerOnly.length}</Tag>}
                  <span className="text-muted-foreground">
                    <span className="text-info">•</span> = ô lấy từ file (sổ đang trống) · <AlertTriangle className="inline h-3.5 w-3.5 text-warning" /> = sổ khác file, giữ sổ
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setOnlyIssues((v) => !v)}
                    title="Bật / tắt: chỉ hiện các mã còn chỗ cần xem (lệch, ghép theo gợi ý, mã mới, ô khác file) hay hiện hết."
                  >
                    {onlyIssues ? `Hiện cả ${items.length} mã` : "Chỉ hiện chỗ cần xem"}
                  </Button>
                </div>

                <div className="grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-2">
                  <p>
                    File: tồn đầu <b className="tnum">{num(totals.fileOpen)}</b> · nhập <b className="tnum">{num(totals.fileIn)}</b> · xuất{" "}
                    <b className="tnum">{num(totals.fileOut)}</b> · tồn cuối <b className="tnum">{num(totals.fileClose)}</b> kg
                  </p>
                  <p className={Math.abs(totals.resultClose - totals.fileClose) > 0.001 ? "font-semibold text-warning" : "text-success"}>
                    Sổ sau khi nạp hết (các mã trong file): tồn cuối <b className="tnum">{num(totals.resultClose)}</b> kg
                    {Math.abs(totals.resultClose - totals.fileClose) > 0.001
                      ? ` — khác file ${num(totals.resultClose - totals.fileClose)} kg (mã bỏ qua / giữ sổ / chưa chọn).`
                      : " — khớp file."}
                  </p>
                </div>

                {plan.ledgerOnly.length > 0 && (
                  <div className="rounded-lg border border-warning-line bg-warning-surface p-3 text-sm text-warning">
                    <p className="font-semibold">Sổ có mã mà file KHÔNG có — không đổi gì, kiểm lại có phải file thiếu không:</p>
                    <ul className="ml-5 list-disc">
                      {plan.ledgerOnly.map((l) => (
                        <li key={l.rowId}>
                          {l.code} · {l.itemName} · tồn cuối {num(l.closeKg)} kg
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 7 cột (gộp mô tả vào dòng phụ, tồn đầu file / sổ chồng nhau) ⇒ vừa khung hộp từ ~1.000 px, không phải cuộn ngang
                    để đối chiếu; màn hẹp hơn vẫn cuộn ngang có thanh trên + dưới (QT 14). */}
                <HorizontalScroll>
                  <table className="w-full min-w-[58rem] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[11rem]" />
                      <col />
                      <col className="w-[8rem]" />
                      <col className="w-[6rem]" />
                      <col className="w-[6rem]" />
                      <col className="w-[6.5rem]" />
                      <col className="w-[14.5rem]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left align-bottom text-muted-foreground">
                        <th className="px-2 py-2" aria-sort={sort.ariaSortOf("code")}>
                          <span className="block">{sort.header("code", "Mã kế toán")}</span>
                          <span className="block">{sort.header("status", "Tình trạng")}</span>
                        </th>
                        <th className="px-2 py-2" aria-sort={sort.ariaSortOf("item")}>
                          <span className="block">{sort.header("item", "Mặt hàng (sẽ ghi)")}</span>
                          <span className="flex flex-wrap gap-x-3 font-normal">
                            {sort.header("size", "Size")}
                            {sort.header("date", "Ngày nhập")}
                            {sort.header("invoice", "Invoice")}
                          </span>
                        </th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("fileOpen")}>
                          <span className="block">Tồn đầu</span>
                          <span className="block">{sort.header("fileOpen", "File", "right")}</span>
                          <span className="block">{sort.header("ledgerOpen", "Sổ", "right")}</span>
                        </th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("in")}>{sort.header("in", "Nhập", "right")}</th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("out")}>{sort.header("out", "Xuất", "right")}</th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("close")}>{sort.header("close", "Cuối sau nạp", "right")}</th>
                        <th className="px-2 py-2">Xử lý</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sort.rows.map((it) => {
                        const st = stateOf(it);
                        const diff = it.file.openKg - it.ledgerOpenKg;
                        const choices = choicesOf(it);
                        const isOpen = (attention(it) && st !== "done") || expanded.has(it.code);
                        const diffOpen = it.rowIds.length > 0 && Math.abs(diff) > 0.001;
                        const rowLabel = it.rowIds
                          .map((id) => plan.baseLines.find((l) => l.id === id))
                          .filter(Boolean)
                          .map((l) => `${[l!.itemName, l!.size, l!.origin].filter(Boolean).join(" · ")} (${num(l!.openKg)})`)
                          .join(" + ");
                        return (
                          <Fragment key={it.code}>
                            <tr className="border-t border-border align-top">
                              <td className="px-2 py-2">
                                <span className="block break-words font-mono" title={it.fileName}>
                                  {it.code}
                                </span>
                                <span className="mt-1 block [&>*]:max-w-full [&>*]:whitespace-normal">
                                  <Tag variant={needsChoice(it.status) && !it.choice ? "error" : STATE_VARIANT[st]}>{STATE_LABEL[st]}</Tag>
                                </span>
                              </td>
                              <td className="min-w-0 px-2 py-2">
                                <span className="block break-words font-medium">
                                  {it.fields.itemName}
                                  {!it.rowIds.length && st !== "skipped" && <span className="ml-1 font-normal text-info">(dòng mới)</span>}
                                </span>
                                <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                                  {fieldMeta(it, "size")}
                                  {fieldMeta(it, "importDate")}
                                  {fieldMeta(it, "origin")}
                                  {fieldMeta(it, "kgPerCtn")}
                                </span>
                              </td>
                              <td className="tnum px-2 py-2 text-right">
                                <span className="block" title="Tồn đầu trên file kế toán">
                                  <span className="text-sm text-muted-foreground">File </span>
                                  {num(it.file.openKg)}
                                </span>
                                <span className={`block ${diffOpen ? "font-semibold text-destructive" : ""}`} title="Tồn đầu trên sổ kho tháng">
                                  <span className="text-sm font-normal text-muted-foreground">Sổ </span>
                                  {it.rowIds.length ? num(it.ledgerOpenKg) : "—"}
                                </span>
                                {diffOpen && <span className="block text-sm font-semibold text-destructive">lệch {num(diff)}</span>}
                              </td>
                              <td className="tnum px-2 py-2 text-right">{num(it.file.inKg)}</td>
                              <td className="tnum px-2 py-2 text-right">{num(it.file.outKg)}</td>
                              <td className={`tnum px-2 py-2 text-right ${it.resultCloseKg < -0.001 ? "font-semibold text-destructive" : ""}`}>{num(it.resultCloseKg)}</td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {choices.map((c) => (
                                    <Button key={c} size="sm" variant={it.choice === c ? "default" : "outline"} onClick={() => setDecision(it.code, { choice: c })} title={CHOICE_TITLE[c]}>
                                      {choiceLabelFor(c, diff)}
                                    </Button>
                                  ))}
                                  {pending.has(it.code) && (
                                    <Button
                                      size="sm"
                                      variant="save"
                                      onClick={() => commit([it.code], it.code)}
                                      title="Ghi riêng mã này vào sổ ngay (nhập / xuất theo file, điền ô mô tả đang trống, lưu mã kế toán). Các mã khác giữ nguyên."
                                    >
                                      <Upload className="mr-1 h-3.5 w-3.5" />
                                      {confirming === it.code ? "Xác nhận" : "Nạp dòng"}
                                    </Button>
                                  )}
                                  {!isOpen && st !== "done" && (
                                    <Button size="sm" variant="ghost" onClick={() => setExpanded((s) => new Set(s).add(it.code))} title="Xem dòng sổ đang ghép, đổi ghép (dòng khác / thêm dòng mới / bỏ mã).">
                                      Đổi ghép
                                    </Button>
                                  )}
                                </div>
                                {confirming === it.code && <p className="mt-1 text-warning">Sẽ thay số đang có trên sổ — chọn Xác nhận để ghi.</p>}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="bg-muted/20">
                                <td />
                                <td colSpan={6} className="px-2 pb-3">
                                  <p className="mb-1 text-muted-foreground">Tên trên file: {it.fileName}</p>
                                  {rowLabel && <p className="mb-1 text-muted-foreground">Dòng sổ đang ghép: {rowLabel}</p>}
                                  {it.warnings.length > 0 && (
                                    <ul className="mb-2 space-y-0.5">
                                      {it.warnings.map((w) => (
                                        <li key={w} className={/ÂM|lệch|Chưa ghép|không cân/i.test(w) ? "text-destructive" : "text-warning"}>
                                          <AlertTriangle className="mr-1 inline h-4 w-4" />
                                          {w}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <Combobox
                                      label={`Ghép mã ${it.code} với dòng sổ`}
                                      value={targetOf(it)}
                                      onChange={(v) => setDecision(it.code, { target: v, choice: undefined })}
                                      options={rowOptions(it)}
                                    />
                                    {!it.rowIds.length && st !== "skipped" && (
                                      <Field label="Tên dòng mới">
                                        <Input value={form.decisions[it.code]?.newName ?? it.fields.itemName} onChange={(e) => setDecision(it.code, { newName: e.target.value })} />
                                      </Field>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {!sort.rows.length && (
                        <tr>
                          <td colSpan={7} className="px-2 py-4 text-center text-success">
                            Không còn chỗ cần xem — chọn "Hiện cả {items.length} mã" để xem chi tiết.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </HorizontalScroll>
              </>
            )}

            <ErrorSummary errors={errors} />
            {confirming === "*" && (
              <div className="rounded-lg border border-warning-line bg-warning-surface p-3 text-sm text-warning">
                <p className="font-semibold">Xác nhận trước khi ghi:</p>
                <p>Có mã sẽ thay số nhập / xuất đang có, hoặc có dòng / phần điều chỉnh tồn đầu. Chọn "Nạp tất cả" lần nữa để ghi. Ghi xong vẫn Hoàn tác được.</p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setConfirming(null); setErrors([]); draft.cancel(); }}>
            Hủy
          </Button>
          <Button
            data-tour="monthly-stock-nxt-commit"
            variant="save"
            onClick={() => commit(readyCodes, "*")}
            title="Ghi một lần mọi mã đã sẵn sàng (khớp, mã mới, hoặc đã chọn cách xử). Mã còn lệch chưa chọn được bỏ qua và liệt kê lại."
          >
            <Upload className="mr-1 h-4 w-4" />
            {confirming === "*" ? `Nạp tất cả (xác nhận)` : `Nạp tất cả (${readyCodes.length} dòng sẵn sàng)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
