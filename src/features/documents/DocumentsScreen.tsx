// ============================================================
// Tên file: src/features/documents/DocumentsScreen.tsx
// Tên tiếng Việt: Tài liệu công ty — quy trình, biểu mẫu, chứng nhận, hồ sơ năng lực
// Description: Company document library (/documents): per-department visibility, revisions
//              (never overwritten), signed PDF + source files on Storage, certificate expiry.
// ============================================================
// Spec: docs/spec/quan-ly-tai-lieu.md · doc: docs/app-map/40-documents.md. Luật ở
// lib/documents.ts (thuần, có test). Máy chủ chặn đọc theo phòng ban ở RLS 0072 — lọc ở đây
// chỉ để giao diện khớp (chạy không đăng nhập thì thấy hết như các màn khác).
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  ChoiceGroup,
  Combobox,
  ConfirmAction,
  ConfirmDelete,
  EmptyState,
  FormDialog,
  RecordTable,
  StatCardGrid,
  SummaryTable,
  TableSkeleton,
  Tag,
  notify,
  todayIso,
  type ComboboxOption,
  type RecordTableColumn,
  type StatCardData,
  type SummaryTableColumn,
  type TagVariant,
} from "@/design-system";
import { useAppRoles, useCompanyDocuments, useDocumentVersions } from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import { useCan, usePermissions } from "@/features/shared/PermissionProvider";
import {
  DEPARTMENTS,
  DOCUMENT_KINDS,
  DOCUMENT_STATE_LABELS,
  DOCUMENT_PDF_ACCEPT,
  DOCUMENT_SOURCE_ACCEPT,
  activeVersionOf,
  attachVersionFile,
  canDeleteDocument,
  checkDocumentFile,
  canViewDocument,
  departmentLabel,
  documentKindLabel,
  documentState,
  documentViewerFor,
  expiryOf,
  formatRevision,
  isPastRetention,
  recordPaperVersion,
  versionsOf,
  type DocumentState,
} from "@/lib/documents";
import { documentFilePath, getDocumentFileUrl, hasDocumentStorage, removeDocumentFiles, uploadDocumentFile } from "@/lib/documentStorage";
import { formatDateVN } from "@/lib/format";
import type { CompanyDocument, DocumentVersion } from "@/types";
import {
  AlarmClock,
  Archive,
  ArchiveRestore,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileSignature,
  FileText,
  FileWarning,
  FolderOpen,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react";
import { DocumentFormDialog, type DocumentFormTarget } from "./DocumentFormDialog";
import { VersionFormDialog } from "./VersionFormDialog";

const STATE_TAGS: Record<DocumentState, TagVariant> = {
  active: "done",
  draft: "pending",
  "not-issued": "muted",
  withdrawn: "muted",
};

type StatusFilter = "in-use" | "all" | "withdrawn";
const STATUS_FILTERS = [
  { value: "in-use", label: "Đang dùng" },
  { value: "withdrawn", label: "Hết hiệu lực" },
  { value: "all", label: "Tất cả" },
];
const KIND_FILTERS: ComboboxOption[] = [{ value: "", label: "Mọi loại" }, ...DOCUMENT_KINDS.map((k) => ({ value: k.id, label: k.label }))];
const DEPARTMENT_FILTERS: ComboboxOption[] = [{ value: "", label: "Mọi phòng" }, ...DEPARTMENTS.map((d) => ({ value: d.id, label: d.label }))];

/**
 * Mở file trên tab mới. Mở cửa sổ TRƯỚC khi chờ link (trình duyệt chặn cửa sổ mở sau `await`),
 * rồi trỏ sang link có hạn.
 */
async function openFile(path: string, downloadName?: string) {
  const w = window.open("", "_blank");
  const url = await getDocumentFileUrl(path, 600, downloadName);
  if (!url) {
    w?.close();
    notify.error("Không mở được file — tài khoản không được xem tài liệu này, hoặc file đã bị gỡ khỏi máy chủ.");
    return;
  }
  if (w) {
    w.opener = null;
    w.location.href = url;
  } else window.location.assign(url);
}

export default function DocumentsScreen() {
  const today = todayIso();
  const { profile } = useAuth();
  const permissions = usePermissions();
  const can = useCan("documents");
  const canWrite = can.create || can.update;
  const [searchParams, setSearchParams] = useSearchParams();

  const [documents, saveDocuments, { status }] = useCompanyDocuments();
  const [versions, saveVersions] = useDocumentVersions();
  const [appRoles] = useAppRoles();

  const viewer = useMemo(
    () => documentViewerFor({ roles: profile?.roles ?? [], appRoles, isAdmin: permissions.isAdmin, isOffline: !hasDocumentStorage || !profile }),
    [profile, appRoles, permissions.isAdmin],
  );
  const visibleDocs = useMemo(
    () => documents.filter((d) => canViewDocument(d, viewer)).sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true })),
    [documents, viewer],
  );
  const byId = useMemo(() => new Map(visibleDocs.map((d) => [d.id, d])), [visibleDocs]);

  // ---- Lọc ----
  const [kindFilter, setKindFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("in-use");
  const rows = visibleDocs.filter(
    (d) =>
      (!kindFilter || d.kind === kindFilter) &&
      (!departmentFilter || d.ownerDepartment === departmentFilter || d.visibleDepartments.includes(departmentFilter)) &&
      (statusFilter === "all" || (statusFilter === "withdrawn" ? d.isWithdrawn : !d.isWithdrawn)),
  );

  // ---- Hộp ----
  const detailId = searchParams.get("doc") ?? "";
  const detail = detailId ? byId.get(detailId) : undefined;
  const openDetail = (id: string) =>
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (id) next.set("doc", id);
        else next.delete("doc");
        return next;
      },
      { replace: !id },
    );
  const [formTarget, setFormTarget] = useState<DocumentFormTarget | null>(null);
  const [versionDoc, setVersionDoc] = useState<CompanyDocument | null>(null);
  const [withdrawing, setWithdrawing] = useState<CompanyDocument | null>(null);
  const [deleting, setDeleting] = useState<CompanyDocument | null>(null);

  // ---- Ghi ----
  const saveDocument = (doc: CompanyDocument, isNew: boolean) => {
    const prev = documents;
    if (!saveDocuments(isNew ? [...prev, doc] : prev.map((d) => (d.id === doc.id ? doc : d)))) return;
    notify.saved(isNew ? `Đã thêm tài liệu ${doc.code}` : `Đã lưu thông tin ${doc.code}`, () => saveDocuments(prev));
    setFormTarget(null);
    if (isNew) openDetail(doc.id);
  };

  const saveVersion = (v: Omit<DocumentVersion, "status" | "approvalMode" | "obsoletedOn">): boolean => {
    const prev = versions;
    const { versions: next, version } = recordPaperVersion(prev, v);
    if (!saveVersions(next)) return false;
    const doc = documents.find((d) => d.id === v.documentId);
    notify.saved(`Đã ban hành lần ${formatRevision(version.revisionNo)} của ${doc?.code ?? "tài liệu"} — có hiệu lực từ ${formatDateVN(version.effectiveDate)}`, () =>
      saveVersions(prev),
    );
    setVersionDoc(null);
    return true;
  };

  /** Đính file cho lần ban hành còn thiếu (vd QTI-KH-01 nạp từ bản giấy): tải lên TRƯỚC, ghi dòng SAU. */
  const attachFile = async (v: DocumentVersion, kind: "pdf" | "source", file: File) => {
    const err = checkDocumentFile(file, kind);
    if (err) {
      notify.error(err);
      return;
    }
    const r = await uploadDocumentFile(documentFilePath(v.documentId, v.id, kind, file.name), file);
    if ("error" in r) {
      notify.error(r.error);
      return;
    }
    const prev = versions;
    const next = attachVersionFile(prev, v.id, kind, r.path, file.name);
    if (!next) notify.error("Lần ban hành này đã có file — muốn đổi file thì ghi lần ban hành mới.");
    if (!next || !saveVersions(next)) {
      void removeDocumentFiles([r.path]);
      return;
    }
    notify.saved(`Đã đính ${kind === "pdf" ? "PDF" : "file gốc"} cho lần ${formatRevision(v.revisionNo)}`, () => saveVersions(prev));
  };

  const setWithdrawn = (doc: CompanyDocument, isWithdrawn: boolean) => {
    const prev = documents;
    if (!saveDocuments(prev.map((d) => (d.id === doc.id ? { ...d, isWithdrawn } : d)))) return;
    notify.saved(isWithdrawn ? `Đã thu hồi ${doc.code} — chuyển Hết hiệu lực` : `Đã mở lại ${doc.code}`, () => saveDocuments(prev));
  };

  const removeDocument = (doc: CompanyDocument) => {
    if (documents.some((d) => d.parentId === doc.id)) {
      notify.error(`${doc.code} còn biểu mẫu con — xóa hoặc chuyển biểu mẫu con trước.`);
      return;
    }
    const prevDocs = documents;
    const prevVersions = versions;
    if (!saveDocuments(prevDocs.filter((d) => d.id !== doc.id))) return;
    saveVersions(prevVersions.filter((v) => v.documentId !== doc.id));
    if (detailId === doc.id) openDetail("");
    notify.deleted(`Đã xóa tài liệu ${doc.code}`, () => {
      saveDocuments(prevDocs);
      saveVersions(prevVersions);
    });
  };

  // ---- Thẻ số ----
  const inUse = visibleDocs.filter((d) => !d.isWithdrawn);
  const activeCount = inUse.filter((d) => documentState(d, versions) === "active").length;
  const expiring = inUse.filter((d) => ["expiring", "expired"].includes(expiryOf(d, today).state));
  const missingFile = inUse.filter((d) => {
    const v = activeVersionOf(versions, d.id);
    return !!v && !v.pdfPath;
  });
  const cards: StatCardData[] = [
    { label: "Tài liệu bạn xem được", value: inUse.length, numeric: true, icon: FolderOpen, color: "brand" },
    { label: "Đang hiệu lực", value: activeCount, numeric: true, icon: FileCheck2, color: "success" },
    {
      label: "Chứng nhận sắp hết hạn",
      value: expiring.length,
      numeric: true,
      icon: AlarmClock,
      color: expiring.length ? "warning" : "neutral",
      subtext: "còn ≤ 60 ngày hoặc đã hết hạn",
    },
    {
      label: "Thiếu file PDF",
      value: missingFile.length,
      numeric: true,
      icon: FileWarning,
      color: missingFile.length ? "warning" : "neutral",
      subtext: "đang hiệu lực mà chưa đính bản đã ký",
    },
  ];

  // ---- Bảng ----
  const columns: RecordTableColumn<CompanyDocument>[] = [
    { key: "code", header: "Mã", primary: true, render: (d) => <span className="font-semibold">{d.code}</span>, getSortValue: (d) => d.code },
    { key: "title", header: "Tên tài liệu", render: (d) => d.title, getSortValue: (d) => d.title },
    {
      key: "kind",
      header: "Loại",
      render: (d) => (
        <Tag variant="category" tone={d.kind === "form" ? "teal" : d.kind === "certificate" ? "orange" : d.kind === "capability_profile" ? "purple" : "blue"}>
          {documentKindLabel(d.kind)}
        </Tag>
      ),
      getSortValue: (d) => documentKindLabel(d.kind),
    },
    { key: "owner", header: "Phòng sở hữu", render: (d) => departmentLabel(d.ownerDepartment), getSortValue: (d) => departmentLabel(d.ownerDepartment), hideOnMobile: true },
    {
      key: "revision",
      header: "Lần BH · hiệu lực",
      render: (d) => {
        const v = activeVersionOf(versions, d.id);
        return v ? `${formatRevision(v.revisionNo)} · ${formatDateVN(v.effectiveDate)}` : "—";
      },
    },
    {
      key: "state",
      header: "Trạng thái",
      render: (d) => {
        const st = documentState(d, versions);
        const e = expiryOf(d, today);
        return (
          <div className="flex flex-wrap gap-1">
            <Tag variant={STATE_TAGS[st]}>{DOCUMENT_STATE_LABELS[st]}</Tag>
            {!d.isWithdrawn && e.state === "expired" && <Tag variant="error">Hết hạn {formatDateVN(d.expiresOn)}</Tag>}
            {!d.isWithdrawn && e.state === "expiring" && <Tag variant="warning">{e.daysLeft === 0 ? "Hết hạn hôm nay" : `Còn ${e.daysLeft} ngày`}</Tag>}
          </div>
        );
      },
      getSortValue: (d) => DOCUMENT_STATE_LABELS[documentState(d, versions)],
    },
    {
      key: "parent",
      header: "Thuộc",
      render: (d) => (d.parentId ? (byId.get(d.parentId)?.code ?? "—") : "—"),
      secondary: true,
    },
  ];

  const isLoading = status === "loading" && documents.length === 0;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-base text-muted-foreground">
          Quy trình, biểu mẫu, chứng nhận và hồ sơ năng lực của công ty. Mỗi tài liệu giữ đủ các lần ban hành, bản cũ vẫn mở lại được. Bạn chỉ thấy tài
          liệu của phòng mình và tài liệu được mở cho phòng mình.
        </p>
        {can.create && (
          <Button title="Thêm một tài liệu mới: mã, tên, loại, phòng sở hữu và ai được xem." onClick={() => setFormTarget({ kind: "create" })}>
            <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
            Thêm tài liệu
          </Button>
        )}
      </div>

      {!hasDocumentStorage && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
          Đang chạy không nối máy chủ: xem và ghi được thông tin tài liệu trên máy này, chưa mở / tải được file.
        </p>
      )}

      <StatCardGrid cards={cards} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Combobox label="Loại" hideRequiredMark value={kindFilter} onChange={setKindFilter} options={KIND_FILTERS} clearable={false} />
        <Combobox label="Phòng" hideRequiredMark value={departmentFilter} onChange={setDepartmentFilter} options={DEPARTMENT_FILTERS} clearable={false} />
        <ChoiceGroup
          className="sm:col-span-2"
          label="Trạng thái"
          hideRequiredMark
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={STATUS_FILTERS}
          columns={3}
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : visibleDocs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Chưa có tài liệu nào bạn xem được"
          description={
            can.create
              ? "Bấm Thêm tài liệu để đưa quy trình, biểu mẫu hay chứng nhận đầu tiên lên."
              : "Phòng của bạn chưa có tài liệu nào. Hỏi quản trị viên nếu bạn cần xem tài liệu của phòng khác."
          }
        />
      ) : (
        <RecordTable
          columns={columns}
          rows={rows}
          getKey={(d) => d.id}
          rowMarkKey="documents"
          getSearchText={(d) => `${d.code} ${d.title} ${d.note}`}
          searchLabel="Tìm theo mã hoặc tên tài liệu…"
          emptyText="Không có tài liệu nào khớp bộ lọc."
          actions={(d) => (
            <Button size="sm" variant="outline" onClick={() => openDetail(d.id)} title="Xem chi tiết, các lần ban hành và mở file của tài liệu này.">
              <Eye className="mr-1 h-4 w-4" aria-hidden />
              Xem
            </Button>
          )}
        />
      )}

      <DocumentDetailDialog
        document={detail ?? null}
        isMissing={!!detailId && !detail && status !== "loading"}
        documents={visibleDocs}
        versions={versions}
        today={today}
        can={{ write: canWrite, update: can.update, delete: can.delete, create: can.create }}
        onClose={() => openDetail("")}
        onOpen={openDetail}
        onEdit={(d) => setFormTarget({ kind: "edit", document: d })}
        onAddChild={(d) => setFormTarget({ kind: "create", parentId: d.id })}
        onRecordVersion={(d) => setVersionDoc(d)}
        onAttach={attachFile}
        onWithdraw={(d) => setWithdrawing(d)}
        onRestore={(d) => setWithdrawn(d, false)}
        onDelete={(d) => setDeleting(d)}
      />

      <DocumentFormDialog target={formTarget} documents={documents} onClose={() => setFormTarget(null)} onSave={saveDocument} />

      <VersionFormDialog
        document={versionDoc}
        versions={versions}
        recordedByName={profile?.fullName || profile?.username || "Máy này"}
        onClose={() => setVersionDoc(null)}
        onSave={saveVersion}
      />

      <ConfirmAction
        open={!!withdrawing}
        onOpenChange={(o) => !o && setWithdrawing(null)}
        title={`Thu hồi ${withdrawing?.code ?? ""}?`}
        description="Tài liệu chuyển Hết hiệu lực, không còn ở danh sách Đang dùng. Mọi lần ban hành và file vẫn giữ nguyên, mở lại được."
        detail={withdrawing?.title}
        confirmLabel="Thu hồi tài liệu"
        destructive
        icon={Archive}
        onConfirm={() => {
          if (withdrawing) setWithdrawn(withdrawing, true);
          setWithdrawing(null);
        }}
      />

      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa tài liệu này?"
        confirmLabel="Xóa tài liệu"
        recordDescription={deleting ? `${deleting.code} — ${deleting.title}` : ""}
        onConfirm={() => {
          if (deleting) removeDocument(deleting);
          setDeleting(null);
        }}
      />
    </div>
  );
}

/* ---------- Hộp chi tiết ---------- */

function DocumentDetailDialog({
  document: doc,
  isMissing,
  documents,
  versions,
  today,
  can,
  onClose,
  onOpen,
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
  can: { write: boolean; update: boolean; delete: boolean; create: boolean };
  onClose: () => void;
  onOpen: (id: string) => void;
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
  const active = own.find((v) => v.status === "active");
  const children = documents.filter((d) => d.parentId === doc.id);
  const parent = doc.parentId ? documents.find((d) => d.id === doc.parentId) : undefined;
  const state = documentState(doc, versions);
  const expiry = expiryOf(doc, today);
  // Đính file cho lần còn thiếu: cần quyền ghi + đã nối máy chủ; tài liệu thu hồi thì thôi.
  const canAttach = can.write && hasDocumentStorage && !doc.isWithdrawn;

  const versionColumns: SummaryTableColumn<DocumentVersion>[] = [
    { key: "rev", header: "Lần", render: (v) => <span className="font-semibold">{formatRevision(v.revisionNo)}</span> },
    { key: "date", header: "Hiệu lực", render: (v) => (v.effectiveDate ? formatDateVN(v.effectiveDate) : "—") },
    {
      key: "status",
      header: "Trạng thái",
      render: (v) => (
        <div className="flex flex-wrap gap-1">
          {v.status === "active" ? (
            <Tag variant="done">Đang hiệu lực</Tag>
          ) : v.status === "obsolete" ? (
            <Tag variant="muted">Hết hiệu lực{v.obsoletedOn ? ` ${formatDateVN(v.obsoletedOn)}` : ""}</Tag>
          ) : (
            <Tag variant="pending">Dự thảo</Tag>
          )}
          {isPastRetention(v, doc.retentionYears, today) && <Tag variant="warning">Quá hạn lưu</Tag>}
        </div>
      ),
    },
    {
      key: "people",
      header: "Soạn · xem xét · phê duyệt",
      render: (v) => (
        <div className="min-w-0 text-sm">
          {[v.preparedByName, v.reviewedByName, v.approvedByName].filter(Boolean).join(" · ") || "—"}
          {v.changeSummary && <div className="text-muted-foreground">{v.changeSummary}</div>}
        </div>
      ),
    },
    {
      key: "files",
      header: "File",
      render: (v) => (
        <div className="flex flex-wrap gap-2">
          {v.pdfPath ? (
            <Button size="sm" variant="outline" onClick={() => void openFile(v.pdfPath)} title="Mở bản PDF đã ký của lần ban hành này trên tab mới.">
              <FileText className="mr-1 h-4 w-4" aria-hidden />
              Mở PDF
            </Button>
          ) : canAttach ? (
            <AttachFileButton label="Đính PDF" accept={DOCUMENT_PDF_ACCEPT} onPick={(f) => onAttach(v, "pdf", f)} title="Chọn bản PDF đã ký từ máy để đính vào lần ban hành này (lần này chưa có file)." />
          ) : (
            <Tag variant="warning">Chưa có PDF</Tag>
          )}
          {!v.sourcePath && canAttach && v.status !== "draft" && (
            <AttachFileButton
              label="Đính file gốc"
              accept={DOCUMENT_SOURCE_ACCEPT}
              onPick={(f) => onAttach(v, "source", f)}
              title="Chọn file Word / Excel gốc từ máy để đính vào lần ban hành này (không bắt buộc)."
              outline
            />
          )}
          {v.sourcePath && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void openFile(v.sourcePath, v.sourceFileName || undefined)}
              title="Tải file gốc (Word / Excel) của lần ban hành này về máy."
            >
              <Download className="mr-1 h-4 w-4" aria-hidden />
              Tải file gốc
            </Button>
          )}
        </div>
      ),
    },
  ];

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
      <button key="parent" type="button" className="font-semibold text-primary underline" onClick={() => onOpen(parent.id)}>
        {parent.code} · {parent.title}
      </button>,
    ]);
  if (doc.note) info.push(["Ghi chú", doc.note]);

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${doc.code} · ${doc.title}`}
      description={
        active
          ? `Đang hiệu lực: lần ${formatRevision(active.revisionNo)} từ ${formatDateVN(active.effectiveDate)}`
          : DOCUMENT_STATE_LABELS[state]
      }
      icon={FolderOpen}
      size="xl"
    >
      <div className="grid min-w-0 gap-5 py-2">
        <div className="flex flex-wrap gap-2">
          {can.write && !doc.isWithdrawn && (
            <Button onClick={() => onRecordVersion(doc)} title="Ghi một lần ban hành mới đã ký giấy: ngày hiệu lực, người duyệt, PDF đã ký.">
              <FileSignature className="mr-2 h-4 w-4" aria-hidden />
              Ghi lần ban hành
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

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          {info.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="grid min-w-0 gap-2">
          <h3 className="font-semibold text-foreground">Các lần ban hành ({own.length})</h3>
          {own.length ? (
            <SummaryTable rows={own} columns={versionColumns} getKey={(v) => v.id} />
          ) : (
            <p className="text-sm text-muted-foreground">Chưa ban hành lần nào{can.write ? " — bấm Ghi lần ban hành." : "."}</p>
          )}
        </section>

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
                      <span className="text-sm text-muted-foreground"> {v ? `· lần ${formatRevision(v.revisionNo)}` : "· chưa ban hành"}</span>
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
}: {
  label: string;
  accept: string;
  title: string;
  onPick: (file: File) => Promise<void>;
  outline?: boolean;
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
      <Button size="sm" variant={outline ? "outline" : "default"} onClick={() => !isUploading && ref.current?.click()} title={title}>
        <Paperclip className="mr-1 h-4 w-4" aria-hidden />
        {isUploading ? "Đang tải file…" : label}
      </Button>
    </>
  );
}
