// ============================================================
// Tên file: src/features/documents/DocumentDetailDialog.tsx
// Tên tiếng Việt: Hộp chi tiết tài liệu — bản đang hiệu lực, file, lịch sử ban hành, biểu mẫu con
// Description: Document detail: current revision first with view / attach file actions,
//              revision history as stacked cards (no horizontal overflow), child forms.
// ============================================================
// Bố cục (sửa 2026-10-20 — chủ dự án mở ra "không có chỗ gắn PDF, chỗ xem PDF"): bảng lần ban
// hành cũ rộng quá nên cột File trôi ra ngoài khung, người không có quyền ghi thì không thấy
// nút nào và không biết vì sao. Nay: khối "Bản đang hiệu lực" đứng đầu, file là nút to, thiếu
// file thì nói rõ ai đính được; lịch sử là các thẻ xếp dọc.
import { useRef, useState, type ReactNode } from "react";
import { Button, FormDialog, Tag } from "@/design-system";
import {
  DOCUMENT_PDF_ACCEPT,
  DOCUMENT_SOURCE_ACCEPT,
  DOCUMENT_STATE_LABELS,
  activeVersionOf,
  canDeleteDocument,
  departmentLabel,
  documentKindLabel,
  documentState,
  expiryOf,
  formatRevision,
  isPastRetention,
  versionsOf,
} from "@/lib/documents";
import { hasDocumentStorage } from "@/lib/documentStorage";
import { formatDateVN } from "@/lib/format";
import type { CompanyDocument, DocumentVersion } from "@/types";
import { Archive, ArchiveRestore, Download, Eye, FilePlus2, FileSignature, FileWarning, FolderOpen, Paperclip, Pencil, Trash2 } from "lucide-react";
import type { PreviewFile } from "./FilePreviewDialog";
import { openDocumentFile } from "./openDocumentFile";

export interface DocumentPermissions {
  /** Thêm hoặc Sửa — ghi lần ban hành, đính file. */
  write: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

/** Ai đính được file khi người đang xem không có quyền (nói rõ thay vì ẩn nút trong im lặng). */
const NO_WRITE_HINT = "Người có quyền ghi tài liệu (hiện là quản trị viên) đính được file. Quyền này cấp ở Vai trò & quyền → Tài liệu công ty.";

export function DocumentDetailDialog({
  document: doc,
  isMissing,
  documents,
  versions,
  today,
  can,
  onClose,
  onOpen,
  onPreview,
  onEdit,
  onAddChild,
  onRecordVersion,
  onAttach,
  onWithdraw,
  onRestore,
  onDelete,
}: {
  document: CompanyDocument | null;
  /** Link `?doc=` trỏ tới tài liệu không có / không được xem. */
  isMissing: boolean;
  documents: readonly CompanyDocument[];
  versions: readonly DocumentVersion[];
  today: string;
  can: DocumentPermissions;
  onClose: () => void;
  onOpen: (id: string) => void;
  onPreview: (f: PreviewFile) => void;
  onEdit: (d: CompanyDocument) => void;
  onAddChild: (d: CompanyDocument) => void;
  onRecordVersion: (d: CompanyDocument) => void;
  onAttach: (v: DocumentVersion, kind: "pdf" | "source", file: File) => Promise<void>;
  onWithdraw: (d: CompanyDocument) => void;
  onRestore: (d: CompanyDocument) => void;
  onDelete: (d: CompanyDocument) => void;
}) {
  if (isMissing)
    return (
      <FormDialog open onOpenChange={(o) => !o && onClose()} title="Không mở được tài liệu" icon={FileWarning} size="sm">
        <p className="py-2">Tài liệu này không còn, hoặc không thuộc phòng của bạn.</p>
      </FormDialog>
    );
  if (!doc) return null;

  const own = versionsOf(versions, doc.id);
  const active = activeVersionOf(versions, doc.id);
  const history = own.filter((v) => v.id !== active?.id);
  const children = documents.filter((d) => d.parentId === doc.id);
  const parent = doc.parentId ? documents.find((d) => d.id === doc.parentId) : undefined;
  const state = documentState(doc, versions);
  const expiry = expiryOf(doc, today);
  // Đính file: cần quyền ghi + đã nối máy chủ; tài liệu thu hồi thì thôi.
  const canAttach = can.write && hasDocumentStorage && !doc.isWithdrawn;
  const caption = (v: DocumentVersion) => `${doc.code} · lần ${formatRevision(v.revisionNo)}`;

  const info: [string, ReactNode][] = [
    ["Loại", documentKindLabel(doc.kind)],
    ["Phòng sở hữu", departmentLabel(doc.ownerDepartment)],
    [
      "Ai được xem",
      doc.visibility === "company"
        ? "Cả công ty"
        : [departmentLabel(doc.ownerDepartment), ...doc.visibleDepartments.map(departmentLabel), "Ban giám đốc"].join(" · "),
    ],
    ["Thời hạn lưu bản cũ", doc.retentionYears > 0 ? `${doc.retentionYears} năm` : "Không đặt"],
  ];
  if (doc.expiresOn)
    info.push([
      "Hết hạn",
      <span key="exp" className="flex flex-wrap items-center gap-2">
        {formatDateVN(doc.expiresOn)}
        {expiry.state === "expired" && <Tag variant="error">Đã hết hạn</Tag>}
        {expiry.state === "expiring" && <Tag variant="warning">{expiry.daysLeft === 0 ? "Hết hạn hôm nay" : `Còn ${expiry.daysLeft} ngày`}</Tag>}
      </span>,
    ]);
  if (parent)
    info.push([
      "Thuộc",
      <button key="parent" type="button" className="text-left font-semibold text-primary underline" onClick={() => onOpen(parent.id)}>
        {parent.code} · {parent.title}
      </button>,
    ]);
  if (doc.note) info.push(["Ghi chú", doc.note]);

  /** Khối file của một lần ban hành: xem / tải nếu có, đính nếu thiếu và có quyền, không thì nói rõ. */
  const fileActions = (v: DocumentVersion, isCurrent: boolean) => (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {v.pdfPath ? (
          <>
            <Button
              size={isCurrent ? "default" : "sm"}
              variant={isCurrent ? "default" : "outline"}
              onClick={() => onPreview({ path: v.pdfPath, name: v.pdfFileName || `${doc.code}.pdf`, caption: caption(v) })}
              title="Xem bản PDF đã ký ngay trong app."
            >
              <Eye className="mr-2 h-4 w-4" aria-hidden />
              Xem PDF
            </Button>
            <Button
              size={isCurrent ? "default" : "sm"}
              variant="outline"
              onClick={() => void openDocumentFile(v.pdfPath, v.pdfFileName || undefined)}
              title="Tải bản PDF đã ký về máy."
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Tải PDF
            </Button>
          </>
        ) : canAttach ? (
          <AttachFileButton
            label="Đính PDF đã ký"
            accept={DOCUMENT_PDF_ACCEPT}
            onPick={(f) => onAttach(v, "pdf", f)}
            title="Chọn bản PDF đã ký từ máy để đính vào lần ban hành này."
            size={isCurrent ? "default" : "sm"}
          />
        ) : (
          <Tag variant="warning">Chưa có PDF</Tag>
        )}
        {v.sourcePath ? (
          <Button
            size={isCurrent ? "default" : "sm"}
            variant="outline"
            onClick={() => void openDocumentFile(v.sourcePath, v.sourceFileName || undefined)}
            title="Tải file gốc (Word / Excel) của lần ban hành này về máy."
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Tải file gốc
          </Button>
        ) : (
          canAttach && (
            <AttachFileButton
              label="Đính file gốc"
              accept={DOCUMENT_SOURCE_ACCEPT}
              onPick={(f) => onAttach(v, "source", f)}
              title="Chọn file Word / Excel gốc từ máy để đính vào lần ban hành này (không bắt buộc)."
              size={isCurrent ? "default" : "sm"}
              outline
            />
          )
        )}
      </div>
      {!v.pdfPath && !canAttach && isCurrent && (
        <p className="text-sm text-muted-foreground">
          {!hasDocumentStorage ? "Đang chạy không nối máy chủ — chưa lưu / mở được file." : doc.isWithdrawn ? "Tài liệu đã thu hồi." : NO_WRITE_HINT}
        </p>
      )}
    </div>
  );

  const people = (v: DocumentVersion) =>
    [
      ["Soạn", v.preparedByName],
      ["Xem xét", v.reviewedByName],
      ["Phê duyệt", v.approvedByName],
    ].filter(([, name]) => name);

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${doc.code} · ${doc.title}`}
      description={active ? `Đang hiệu lực: lần ${formatRevision(active.revisionNo)} từ ${formatDateVN(active.effectiveDate)}` : DOCUMENT_STATE_LABELS[state]}
      icon={FolderOpen}
      size="lg"
    >
      <div className="grid min-w-0 gap-6 py-2">
        {(can.write || can.create || can.update || can.delete) && (
          <div className="flex flex-wrap gap-2">
            {can.write && !doc.isWithdrawn && (
              <Button onClick={() => onRecordVersion(doc)} title="Ghi một lần ban hành MỚI đã ký giấy (lần hiện tại sẽ chuyển Hết hiệu lực).">
                <FileSignature className="mr-2 h-4 w-4" aria-hidden />
                Ghi lần ban hành mới
              </Button>
            )}
            {can.update && (
              <Button variant="edit" onClick={() => onEdit(doc)} title="Sửa mã, tên, phòng sở hữu, ai được xem, thời hạn của tài liệu.">
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                Sửa thông tin
              </Button>
            )}
            {can.create && (doc.kind === "procedure" || doc.kind === "instruction") && (
              <Button variant="outline" onClick={() => onAddChild(doc)} title="Thêm một biểu mẫu thuộc quy trình này (mặc định cùng phòng, cùng phạm vi xem).">
                <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
                Thêm biểu mẫu con
              </Button>
            )}
            {can.update &&
              (doc.isWithdrawn ? (
                <Button variant="edit" onClick={() => onRestore(doc)} title="Đưa tài liệu đã thu hồi về danh sách Đang dùng.">
                  <ArchiveRestore className="mr-2 h-4 w-4" aria-hidden />
                  Mở lại tài liệu
                </Button>
              ) : (
                <Button variant="danger" onClick={() => onWithdraw(doc)} title="Thu hồi cả tài liệu: chuyển Hết hiệu lực, giữ nguyên mọi lần ban hành và file.">
                  <Archive className="mr-2 h-4 w-4" aria-hidden />
                  Thu hồi
                </Button>
              ))}
            {can.delete && canDeleteDocument(doc.id, versions) && (
              <Button variant="danger" onClick={() => onDelete(doc)} title="Xóa tài liệu chưa từng ban hành (ghi nhầm). Tài liệu đã ban hành chỉ thu hồi được.">
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Xóa
              </Button>
            )}
          </div>
        )}

        <section className="grid min-w-0 gap-3 rounded-xl border-2 border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground">Bản đang hiệu lực</h3>
            {active && (
              <span className="flex flex-wrap items-center gap-2">
                <Tag variant="done">Lần {formatRevision(active.revisionNo)}</Tag>
                <span className="text-sm text-muted-foreground">từ {formatDateVN(active.effectiveDate)}</span>
              </span>
            )}
          </div>
          {active ? (
            <>
              {people(active).length > 0 && (
                <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)]">
                  {people(active).map(([k, name]) => (
                    <div key={k} className="contents">
                      <dt className="text-sm text-muted-foreground">{k}</dt>
                      <dd className="min-w-0 break-words">{name}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {active.changeSummary && <p className="text-sm text-muted-foreground">{active.changeSummary}</p>}
              {fileActions(active, true)}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {doc.isWithdrawn ? "Tài liệu đã thu hồi." : "Chưa ban hành lần nào."}
              {can.write && !doc.isWithdrawn ? " Bấm Ghi lần ban hành mới để đưa bản đã ký lên." : ""}
            </p>
          )}
        </section>

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          {info.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>

        {history.length > 0 && (
          <section className="grid min-w-0 gap-2">
            <h3 className="font-semibold text-foreground">Các lần ban hành trước ({history.length})</h3>
            <ul className="grid gap-2">
              {history.map((v) => (
                <li key={v.id} className="grid min-w-0 gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>Lần {formatRevision(v.revisionNo)}</b>
                    <span className="text-sm text-muted-foreground">{v.effectiveDate ? `từ ${formatDateVN(v.effectiveDate)}` : ""}</span>
                    {v.status === "obsolete" ? (
                      <Tag variant="muted">Hết hiệu lực{v.obsoletedOn ? ` ${formatDateVN(v.obsoletedOn)}` : ""}</Tag>
                    ) : (
                      <Tag variant="pending">Dự thảo</Tag>
                    )}
                    {isPastRetention(v, doc.retentionYears, today) && <Tag variant="warning">Quá hạn lưu</Tag>}
                  </div>
                  {(people(v).length > 0 || v.changeSummary) && (
                    <p className="min-w-0 break-words text-sm text-muted-foreground">
                      {people(v)
                        .map(([k, name]) => `${k}: ${name}`)
                        .join(" · ")}
                      {v.changeSummary ? `${people(v).length ? " — " : ""}${v.changeSummary}` : ""}
                    </p>
                  )}
                  {fileActions(v, false)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {children.length > 0 && (
          <section className="grid min-w-0 gap-2">
            <h3 className="font-semibold text-foreground">Biểu mẫu thuộc tài liệu này ({children.length})</h3>
            <ul className="grid gap-2">
              {children.map((c) => {
                const v = activeVersionOf(versions, c.id);
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="min-w-0">
                      <b>{c.code}</b> · {c.title}
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        {v ? `· lần ${formatRevision(v.revisionNo)}${v.pdfPath ? "" : " · chưa có PDF"}` : "· chưa ban hành"}
                      </span>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => onOpen(c.id)} title="Mở chi tiết biểu mẫu này.">
                      <Eye className="mr-1 h-4 w-4" aria-hidden />
                      Xem
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </FormDialog>
  );
}

/** Nút chọn file từ máy rồi đính ngay (input file ẩn). Đang tải ⇒ đổi chữ, bấm thêm không chạy lại. */
function AttachFileButton({
  label,
  accept,
  title,
  onPick,
  outline,
  size = "sm",
}: {
  label: string;
  accept: string;
  title: string;
  onPick: (file: File) => Promise<void>;
  outline?: boolean;
  size?: "sm" | "default";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file || isUploading) return;
    setIsUploading(true);
    try {
      await onPick(file);
    } finally {
      setIsUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => void pick(e.target.files?.[0])} />
      <Button size={size} variant={outline ? "outline" : "default"} onClick={() => !isUploading && ref.current?.click()} title={title}>
        <Paperclip className="mr-2 h-4 w-4" aria-hidden />
        {isUploading ? "Đang tải file…" : label}
      </Button>
    </>
  );
}
