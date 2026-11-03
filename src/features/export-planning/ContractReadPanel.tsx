// ============================================================
// Tên file: src/features/export-planning/ContractReadPanel.tsx
// Tên tiếng Việt: Khối "Đọc file hợp đồng" trong hộp Lập / sửa / ghi bản sửa HĐ xuất và HĐ nhập
// Description: Pick a contract / annex file (Word .docx / .doc or PDF with text — not scans), the dialog fills
//              the EMPTY fields from it (lib/contractReader.ts), this block reports what was filled,
//              lists fields that differ (one-click "use the file value"), catalog misses and warnings.
//              Chosen file can be attached to the contract or kept "read only". Never saves (ba-spec 66).
// ============================================================
import { useRef, useState } from "react";
import { Button, ChoiceGroup, Tag, formatNumber } from "@/design-system";
import { formatDateVN } from "@/lib/format";
import type { ContractFill, ContractReadResult, ContractRole, FillConflict, ReadContract } from "@/lib/contractReader";
import { readContractFile } from "@/lib/contractFileReader";
import { FileSearch } from "lucide-react";
import { FilePicker } from "./parts";

export type ContractFillReport = Omit<ContractFill<unknown>, "values">;

interface ReadState {
  file: File;
  /** null = đang đọc. */
  result: ContractReadResult | null;
  report: ContractFillReport | null;
}

const ACCEPT = ".docx,.pdf,.doc";

export function ContractReadPanel({
  role,
  canAttach,
  canSeePrice,
  attach,
  onAttachChange,
  onFill,
  onApply,
  tourId,
}: {
  role: ContractRole;
  /** Có kho file (nối máy chủ) ⇒ đính được file vừa đọc vào HĐ; không ⇒ file chỉ để đọc. */
  canAttach: boolean;
  canSeePrice: boolean;
  /** File đọc đang được đính vào HĐ khi Lưu (R13). */
  attach: boolean;
  onAttachChange: (file: File | null) => void;
  /** Điền form từ kết quả đọc; `force` = U1 xác nhận dùng phụ lục của HĐ khác (R9). Trả báo cáo điền. */
  onFill: (read: ReadContract, force: boolean) => ContractFillReport | null;
  /** Áp ô U1 chọn dùng giá trị trên file. */
  onApply: (picks: FillConflict[]) => void;
  tourId?: string;
}) {
  const [state, setState] = useState<ReadState | null>(null);
  const [wantAttach, setWantAttach] = useState(canAttach);
  /** Lần đọc mới nhất — kết quả về muộn của file cũ thì bỏ. */
  const latest = useRef<File | null>(null);

  const pick = async (files: File[]) => {
    const f = files[0];
    latest.current = f ?? null;
    if (!f) {
      // "Bỏ file": bỏ kết quả đọc + không đính; ô đã điền vẫn giữ (Hủy hộp mới bỏ hết).
      setState(null);
      onAttachChange(null);
      return;
    }
    setState({ file: f, result: null, report: null });
    const result = await readContractFile(f, f.name, role);
    if (latest.current !== f) return;
    const report = result.ok ? onFill(result.contract, false) : null;
    setState({ file: f, result, report });
    onAttachChange(canAttach && wantAttach ? f : null);
  };
  const setAttach = (v: boolean) => {
    setWantAttach(v);
    if (state?.result) onAttachChange(v ? state.file : null);
  };
  const force = () => {
    if (!state?.result?.ok) return;
    setState({ ...state, report: onFill(state.result.contract, true) });
  };
  const apply = (picks: FillConflict[]) => {
    if (!state?.report) return;
    onApply(picks);
    const done = new Set(picks.map((p) => p.path));
    setState({ ...state, report: { ...state.report, conflicts: state.report.conflicts.filter((c) => !done.has(c.path)) } });
  };

  const result = state?.result;
  const c = result?.ok ? result.contract : null;
  const report = state?.report;
  const conflicts = (report?.conflicts ?? []).filter((x) => canSeePrice || !x.isPrice);
  const review = c ? [...(report?.notes ?? []), ...c.warnings, ...(canSeePrice ? c.priceWarnings : [])] : [];
  const partyLabel = role === "export" ? "Khách" : "Đối tác";

  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-border p-3 sm:p-4" aria-label="Đọc file hợp đồng" data-tour={tourId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FileSearch className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="font-semibold">Đọc file hợp đồng</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Chọn file Word (.docx, .doc) hoặc PDF có chữ của hợp đồng / phụ lục: app điền sẵn các ô còn trống, ô đang có giá trị khác thì liệt kê để chọn. App không tự
        lưu, không tự thêm khách hay mặt hàng vào danh mục. Bản scan (ảnh) không đọc — đọc bản Word rồi đính bản scan đã ký ở mục File.
      </p>
      <div className="flex min-w-0 flex-wrap items-end gap-4">
        <FilePicker files={state ? [state.file] : []} onChange={(fs) => void pick(fs)} multiple={false} accept={ACCEPT} label={state ? "Chọn file khác để đọc" : "Chọn file để đọc"} />
      </div>
      {canAttach ? (
        <ChoiceGroup
          label="File vừa đọc"
          hideRequiredMark
          value={wantAttach ? "attach" : "read-only"}
          onChange={(v) => setAttach(v === "attach")}
          options={[
            { value: "attach", label: "Đính vào hợp đồng khi Lưu", description: "Làm file hợp đồng của bản này (như chọn ở mục File)" },
            { value: "read-only", label: "Chỉ để đọc", description: "VD bản Word nháp — đính bản đã ký sau" },
          ]}
          columns={2}
        />
      ) : (
        <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">Đang chạy không nối máy chủ: file chọn ở đây chỉ để đọc, không được lưu.</p>
      )}

      {state && !result && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang đọc {state.file.name}…
        </p>
      )}
      {result && !result.ok && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
          {state?.file.name}: {result.message}
        </p>
      )}

      {c && state && (
        <>
          <p role="status" className="tnum text-sm">
            Đọc từ <span className="font-medium">{state.file.name}</span>:{" "}
            {c.isAnnex ? `phụ lục${c.annexNo ? ` số ${c.annexNo}` : ""}${c.annexDate ? ` ngày ${formatDateVN(c.annexDate)}` : ""} của ` : ""}HĐ {c.contractNo || "(không rõ số)"}
            {c.signedOn ? ` ký ${formatDateVN(c.signedOn)}` : ""}
            {c.partnerName ? ` · ${partyLabel} ${c.partnerName}` : ""} · {c.lines.length} dòng hàng
            {c.lines.some((l) => l.kg != null) ? ` · ${formatNumber(c.lines.reduce((s, l) => s + (l.kg ?? 0), 0))} kg` : ""}
          </p>

          {report?.blocked ? (
            <div className="grid gap-2 rounded-lg bg-warning-surface px-4 py-3 text-sm" role="status">
              <p className="font-medium">{report.blocked} Chưa điền ô nào.</p>
              <div>
                <Button size="sm" variant="outline" onClick={force} title="Vẫn điền form bằng file này dù số hợp đồng trên file khác hợp đồng đang mở (chưa ghi — bấm Lưu mới ghi).">
                  Vẫn dùng file này
                </Button>
              </div>
            </div>
          ) : (
            report && (
              <p className="text-sm text-muted-foreground">
                {report.filledCells > 0
                  ? `Đã điền ${formatNumber(report.filledCells)} ô còn trống (${report.filled.join(", ")}). Soát lại rồi bấm Lưu để ghi.`
                  : "Không có ô trống nào để điền từ file này."}
                {report.lines.matched > 0 || report.lines.notOnFile.length > 0
                  ? ` Dòng hàng: nối ${report.lines.matched} dòng theo size, thêm ${report.lines.added} dòng mới.`
                  : ""}
              </p>
            )
          )}

          {report && report.lines.notOnFile.length > 0 && (
            <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
              Không có trên file (vẫn giữ — xóa tay nếu bỏ): {report.lines.notOnFile.join("; ")}.
            </p>
          )}

          {conflicts.length > 0 && (
            <div className="grid gap-2 rounded-lg bg-warning-surface px-4 py-3 text-sm" role="status">
              <p className="font-medium">Ô đang có giá trị khác file (chưa đổi):</p>
              <ul className="tnum grid gap-1.5">
                {conflicts.map((x) => (
                  <li key={x.path} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1 break-words">
                      {x.label}: đang ghi {x.current || "(trống)"} — file {x.file}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => apply([x])} title={`Thay ô ${x.label} bằng giá trị trên file (chưa ghi — bấm Lưu mới ghi).`}>
                      Dùng giá trị file
                    </Button>
                  </li>
                ))}
              </ul>
              {conflicts.length > 1 && (
                <div>
                  <Button size="sm" onClick={() => apply(conflicts)} title="Thay mọi ô đang khác bằng giá trị trên file (chưa ghi — bấm Lưu mới ghi).">
                    Dùng hết giá trị trên file
                  </Button>
                </div>
              )}
            </div>
          )}

          {review.length > 0 && (
            <ul className="grid gap-1 rounded-lg bg-warning-surface px-4 py-3 text-sm" aria-label="Chỗ cần xem lại">
              {review.map((w) => (
                <li key={w} className="break-words">
                  {w}
                </li>
              ))}
            </ul>
          )}

          {attach && <Tag variant="source">Sẽ đính {state.file.name} vào hợp đồng khi Lưu</Tag>}
        </>
      )}
    </section>
  );
}
