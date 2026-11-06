/**
 * Hộp "Nạp báo cáo Xuất–Nhập–Tồn" của Sổ kho theo tháng: xem trước từng mã của file ↔ dòng sổ,
 * nói rõ mọi chỗ lệch, bắt chọn cách xử từng chỗ rồi mới ghi. Luật nằm ở `lib/nxtStockImport.ts`.
 */
import { Fragment, useMemo, useState } from "react";
import type { MonthlyStockLine } from "@/types";
import {
  CHOICES_OF,
  CHOICE_LABEL,
  MAP_NEW,
  MAP_SKIP,
  STATUS_LABEL,
  applyNxtPlan,
  buildNxtPlan,
  checkNxtReport,
  listNxtBlockers,
  monthOfReport,
  needsChoice,
  tidyItemName,
  type NxtChoice,
  type NxtDecision,
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
  notify,
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

const STATUS_VARIANT: Record<NxtStatus, TagVariant> = {
  match: "done",
  new: "source",
  "opening-diff": "error",
  missing: "error",
  unbalanced: "error",
  skipped: "muted",
};

/** Thứ tự nặng → nhẹ: chỗ phải chọn lên đầu. */
const severity = (it: NxtPlanItem) =>
  needsChoice(it.status) && !it.choice ? 0 : it.warnings.length ? 1 : it.status === "new" ? 2 : it.status === "skipped" ? 4 : 3;

const CHOICE_TITLE: Record<NxtChoice, string> = {
  file: "Ghi theo số của file kế toán. Phần tồn đầu chênh: file nhiều hơn ⇒ thêm dòng điều chỉnh trong tháng; sổ nhiều hơn ⇒ ghi thành xuất điều chỉnh trên lô.",
  ledger: "Giữ tồn đầu trên sổ, chỉ điền nhập / xuất của file. Tồn cuối sổ sẽ khác file.",
  skip: "Không nạp mã này lần này — sổ giữ nguyên.",
};

const SORT_COLUMNS: SortColumnSpec<NxtPlanItem>[] = [
  { key: "status", getValue: severity, sortKind: "number" },
  { key: "code", getValue: (it) => it.code },
  { key: "name", getValue: (it) => it.fileName },
  { key: "fileOpen", numeric: true, getValue: (it) => it.file.openKg },
  { key: "ledgerOpen", numeric: true, getValue: (it) => (it.rowIds.length ? it.ledgerOpenKg : null) },
  { key: "in", numeric: true, getValue: (it) => it.file.inKg },
  { key: "out", numeric: true, getValue: (it) => it.file.outKg },
  { key: "close", numeric: true, getValue: (it) => it.resultCloseKg },
];

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
  const [confirming, setConfirming] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const month = form ? monthOfReport(form.report) : null;
  const issues = useMemo(() => (form ? checkNxtReport(form.report) : []), [form]);
  const plan = useMemo(
    () => (form && month ? buildNxtPlan(lines, form.report, { warehouse: form.warehouse, month, decisions: form.decisions }) : null),
    [form, month, lines]
  );
  const items = useMemo(() => (plan ? [...plan.items].sort((a, b) => severity(a) - severity(b)) : []), [plan]);
  const attention = (it: NxtPlanItem) => it.warnings.length > 0 || it.status === "new" || it.mapSource === "suggest" || it.mapSource === "user";
  const shown = onlyIssues ? items.filter(attention) : items;
  const sort = useTableSort(shown, (it) => it.code, SORT_COLUMNS);

  const counts = useMemo(() => {
    const c = { match: 0, new: 0, "opening-diff": 0, missing: 0, unbalanced: 0, skipped: 0 } as Record<NxtStatus, number>;
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);
  const overwriteCount = items.filter((it) => it.overwrite).length;
  const open = !!form;

  const setDecision = (code: string, patch: Partial<NxtDecision>) => {
    setConfirming(false);
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

  const commit = () => {
    if (!form || !plan || !month) return;
    const blockers = listNxtBlockers(plan, issues);
    if (blockers.length) {
      const codes = plan.items.map((it) => it.code).sort((a, b) => b.length - a.length);
      setErrors(
        blockers.map((text) => {
          const code = codes.find((c) => text.startsWith(`${c}: `));
          return code ? { field: code, message: text.slice(code.length + 2) } : { field: "File", message: text };
        })
      );
      return;
    }
    const sourceNote = `Nạp XNT "${form.fileName}"${form.report.createdText ? ` (${form.report.createdText})` : ""}`;
    const result = applyNxtPlan(plan, { category: form.category, decisions: form.decisions, sourceNote });
    if (!result.updated && !result.added) {
      notify.saved(`Sổ ${formatMonthLabel(month)} · ${form.warehouse} đã đúng với file — không có gì để ghi.`);
      setConfirming(false);
      setErrors([]);
      draft.done();
      return;
    }
    if (!confirming && (overwriteCount > 0 || result.adjusted > 0)) {
      setConfirming(true);
      return;
    }
    const parts = [`cập nhật ${result.updated} dòng`, result.added ? `thêm ${result.added} dòng` : "", result.adjusted ? `điều chỉnh ${result.adjusted} mã` : "", result.skipped ? `bỏ ${result.skipped} mã` : ""].filter(Boolean);
    onCommit(result.lines, `Đã nạp XNT ${formatMonthLabel(month)} · ${form.warehouse}: ${parts.join(", ")}. Sai thì bấm Hoàn tác.`, month, form.warehouse);
    setConfirming(false);
    setErrors([]);
    draft.done();
  };

  const dismiss = () => {
    setConfirming(false);
    setErrors([]);
    draft.dismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="w-full sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Nạp báo cáo Xuất–Nhập–Tồn</DialogTitle>
          <DialogDescription className="text-base">
            So từng mã hàng của báo cáo kế toán với dòng sổ cùng tháng, cùng kho. Chỗ nào lệch đều nói rõ và phải chọn cách xử trước khi nạp.
            Nhập / xuất ghi THAY theo file — nạp lại cùng file không nhân đôi.
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

            {/* Kiểm chính file */}
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
                    {formatMonthLabel(plan.month)} ở {plan.warehouse} chưa mở — khi nạp, app kế thừa tồn cuối {formatMonthLabel(getPrevMonth(plan.month))} làm tồn đầu trước (như "Kế thừa & lưu").
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {(Object.keys(counts) as NxtStatus[])
                    .filter((s) => counts[s] > 0)
                    .map((s) => (
                      <Tag key={s} variant={STATUS_VARIANT[s]}>
                        {STATUS_LABEL[s]}: {counts[s]}
                      </Tag>
                    ))}
                  {overwriteCount > 0 && <Tag variant="warning">Ghi đè số đang có: {overwriteCount}</Tag>}
                  {plan.ledgerOnly.length > 0 && <Tag variant="warning">Sổ có, file không: {plan.ledgerOnly.length}</Tag>}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setOnlyIssues((v) => !v)}
                    title="Bật / tắt: chỉ hiện các mã có chỗ cần xem (lệch, ghép theo gợi ý, mã mới) hay hiện hết."
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
                    Sổ sau khi nạp (các mã trong file): tồn cuối <b className="tnum">{num(totals.resultClose)}</b> kg
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

                <HorizontalScroll>
                  <table className="w-full min-w-[980px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                        <th className="px-2 py-2" aria-sort={sort.ariaSortOf("status")}>{sort.header("status", "Tình trạng")}</th>
                        <th className="px-2 py-2" aria-sort={sort.ariaSortOf("code")}>{sort.header("code", "Mã kế toán")}</th>
                        <th className="px-2 py-2" aria-sort={sort.ariaSortOf("name")}>{sort.header("name", "Tên trên file")}</th>
                        <th className="px-2 py-2">Dòng sổ</th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("fileOpen")}>{sort.header("fileOpen", "Đầu (file)", "right")}</th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("ledgerOpen")}>{sort.header("ledgerOpen", "Đầu (sổ)", "right")}</th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("in")}>{sort.header("in", "Nhập", "right")}</th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("out")}>{sort.header("out", "Xuất", "right")}</th>
                        <th className="px-2 py-2 text-right" aria-sort={sort.ariaSortOf("close")}>{sort.header("close", "Cuối sau nạp", "right")}</th>
                        <th className="px-2 py-2">Xử lý</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sort.rows.map((it) => {
                        const rowLabel = it.rowIds
                          .map((id) => plan.baseLines.find((l) => l.id === id))
                          .filter(Boolean)
                          .map((l) => [l!.itemName, l!.origin].filter(Boolean).join(" · "))
                          .join(" + ");
                        const choices = CHOICES_OF[it.status];
                        const isOpen = attention(it) || expanded.has(it.code);
                        const diffOpen = it.rowIds.length && Math.abs(it.ledgerOpenKg - it.file.openKg) > 0.001;
                        return (
                          <Fragment key={it.code}>
                            <tr className="border-t border-border align-top">
                              <td className="px-2 py-2">
                                <Tag variant={needsChoice(it.status) && !it.choice ? "error" : STATUS_VARIANT[it.status]}>{STATUS_LABEL[it.status]}</Tag>
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 font-mono">{it.code}</td>
                              <td className="px-2 py-2">{it.fileName}</td>
                              <td className="px-2 py-2">
                                {rowLabel || <span className="text-muted-foreground">— chưa có —</span>}
                                {it.mapSource === "suggest" && (
                                  <span className="ml-1">
                                    <Tag variant="warning">gợi ý theo số</Tag>
                                  </span>
                                )}
                              </td>
                              <td className="tnum px-2 py-2 text-right">{num(it.file.openKg)}</td>
                              <td className={`tnum px-2 py-2 text-right ${diffOpen ? "font-semibold text-destructive" : ""}`}>{it.rowIds.length ? num(it.ledgerOpenKg) : "—"}</td>
                              <td className="tnum px-2 py-2 text-right">{num(it.file.inKg)}</td>
                              <td className="tnum px-2 py-2 text-right">{num(it.file.outKg)}</td>
                              <td className={`tnum px-2 py-2 text-right ${it.resultCloseKg < -0.001 ? "font-semibold text-destructive" : ""}`}>{num(it.resultCloseKg)}</td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {choices.map((c) => (
                                    <Button
                                      key={c}
                                      size="sm"
                                      variant={it.choice === c ? "default" : "outline"}
                                      onClick={() => setDecision(it.code, { choice: c })}
                                      title={CHOICE_TITLE[c]}
                                    >
                                      {CHOICE_LABEL[c]}
                                    </Button>
                                  ))}
                                  {!isOpen && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setExpanded((s) => new Set(s).add(it.code))}
                                      title="Đổi dòng sổ ghép với mã này (hoặc thêm dòng mới / bỏ mã)."
                                    >
                                      Đổi ghép
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="bg-muted/20">
                                <td />
                                <td colSpan={9} className="px-2 pb-3">
                                  {it.warnings.length > 0 && (
                                    <ul className="mb-2 space-y-0.5">
                                      {it.warnings.map((w) => (
                                        <li key={w} className={/ÂM|lệch|không có dòng|không cân/i.test(w) ? "text-destructive" : "text-warning"}>
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
                                    {!it.rowIds.length && it.status !== "skipped" && (
                                      <Field label="Tên dòng mới">
                                        <Input
                                          value={form.decisions[it.code]?.newName ?? tidyItemName(it.fileName)}
                                          onChange={(e) => setDecision(it.code, { newName: e.target.value })}
                                        />
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
                          <td colSpan={10} className="px-2 py-4 text-center text-success">
                            Mọi mã đều khớp — bấm "Hiện cả {items.length} mã" để xem chi tiết.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </HorizontalScroll>
              </>
            )}

            <ErrorSummary errors={errors} />
            {confirming && (
              <div className="rounded-lg border border-warning-line bg-warning-surface p-3 text-sm text-warning">
                <p className="font-semibold">Xác nhận trước khi ghi:</p>
                <ul className="ml-5 list-disc">
                  {overwriteCount > 0 && <li>{overwriteCount} mã đang có nhập / xuất trên sổ sẽ bị THAY bằng số của file.</li>}
                  {plan?.items.some((it) => it.choice === "file" && it.status === "opening-diff") && (
                    <li>Mã lệch tồn đầu chọn "Theo file" sẽ có dòng / xuất điều chỉnh kèm ghi chú.</li>
                  )}
                </ul>
                <p>Bấm "Nạp" lần nữa để ghi. Ghi xong vẫn Hoàn tác được.</p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setConfirming(false); setErrors([]); draft.cancel(); }}>
            Hủy
          </Button>
          <Button
            data-tour="monthly-stock-nxt-commit"
            variant="save"
            onClick={commit}
            title="Ghi nhập / xuất theo file vào sổ, lưu mã kế toán lên dòng sổ, thêm dòng mới / dòng điều chỉnh theo lựa chọn. Còn chỗ lệch chưa chọn thì app liệt kê, không ghi."
          >
            <Upload className="mr-1 h-4 w-4" />
            {confirming ? "Nạp (xác nhận)" : "Nạp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
