// ============================================================
// Tên file: src/features/documents/DocumentsScreen.tsx
// Tên tiếng Việt: Tài liệu công ty — quy trình, biểu mẫu, chứng nhận, hồ sơ năng lực
// Description: Company document library (/documents): per-department visibility, revisions
//              (never overwritten), signed PDF + source files on Storage, certificate expiry.
// ============================================================
// Spec: docs/spec/quan-ly-tai-lieu.md · doc: docs/app-map/40-documents.md. Luật ở
// lib/documents.ts (thuần, có test). Máy chủ chặn đọc theo phòng ban ở RLS 0072 — lọc ở đây
// chỉ để giao diện khớp (chạy không đăng nhập thì thấy hết như các màn khác).
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  ChoiceGroup,
  Combobox,
  ConfirmAction,
  ConfirmDelete,
  EmptyState,
  RecordTable,
  StatCardGrid,
  TableSkeleton,
  Tag,
  notify,
  todayIso,
  type ComboboxOption,
  type RecordTableColumn,
  type StatCardData,
  type TagVariant,
} from "@/design-system";
import { useAppRoles, useCompanyDocuments, useDocumentVersions } from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import { useCan, usePermissions } from "@/features/shared/PermissionProvider";
import {
  DEPARTMENTS,
  DOCUMENT_KINDS,
  DOCUMENT_STATE_LABELS,
  activeVersionOf,
  attachVersionFile,
  checkDocumentFile,
  canViewDocument,
  departmentLabel,
  documentKindLabel,
  documentState,
  documentViewerFor,
  expiryOf,
  formatRevision,
  recordPaperVersion,
  type DocumentState,
} from "@/lib/documents";
import { documentFilePath, hasDocumentStorage, removeDocumentFiles, uploadDocumentFile } from "@/lib/documentStorage";
import { formatDateVN } from "@/lib/format";
import type { CompanyDocument, DocumentVersion } from "@/types";
import {
  AlarmClock,
  Archive,
  Eye,
  FileCheck2,
  FilePlus2,
  FileWarning,
  FolderOpen,
} from "lucide-react";
import { DocumentDetailDialog } from "./DocumentDetailDialog";
import { DocumentFormDialog, type DocumentFormTarget } from "./DocumentFormDialog";
import { FilePreviewDialog, type PreviewFile } from "./FilePreviewDialog";
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
  const [onlyMissingFile, setOnlyMissingFile] = useState(false);
  /** Đang hiệu lực mà lần hiện tại chưa có PDF đã ký. */
  const isMissingFile = (d: CompanyDocument) => {
    const v = activeVersionOf(versions, d.id);
    return !d.isWithdrawn && !!v && !v.pdfPath;
  };
  const rows = visibleDocs.filter(
    (d) =>
      (!onlyMissingFile || isMissingFile(d)) &&
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
  const [preview, setPreview] = useState<PreviewFile | null>(null);

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
  const missingFile = inUse.filter(isMissingFile);
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
      subtext: missingFile.length ? "bấm để lọc ra các tài liệu này" : "đang hiệu lực mà chưa đính bản đã ký",
      onSelect: missingFile.length ? () => setOnlyMissingFile(true) : undefined,
      selectHint: "Lọc danh sách: chỉ tài liệu đang hiệu lực mà chưa có PDF đã ký.",
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
      key: "file",
      header: "File",
      render: (d) => {
        const v = activeVersionOf(versions, d.id);
        if (!v) return "—";
        return v.pdfPath ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreview({ path: v.pdfPath, name: v.pdfFileName || `${d.code}.pdf`, caption: `${d.code} · lần ${formatRevision(v.revisionNo)}` })}
            title="Xem bản PDF đang hiệu lực ngay trong app."
          >
            <Eye className="mr-1 h-4 w-4" aria-hidden />
            Xem PDF
          </Button>
        ) : (
          <Tag variant="warning">Chưa có PDF</Tag>
        );
      },
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

      {onlyMissingFile && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-surface px-4 py-2 text-sm">
          <span className="min-w-0 flex-1">Đang lọc: chỉ tài liệu đang hiệu lực mà chưa có PDF đã ký. Mở từng tài liệu để đính file.</span>
          <Button size="sm" variant="outline" onClick={() => setOnlyMissingFile(false)} title="Bỏ lọc, hiện lại mọi tài liệu.">
            Bỏ lọc
          </Button>
        </div>
      )}

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
        onPreview={setPreview}
        onEdit={(d) => setFormTarget({ kind: "edit", document: d })}
        onAddChild={(d) => setFormTarget({ kind: "create", parentId: d.id })}
        onRecordVersion={(d) => setVersionDoc(d)}
        onAttach={attachFile}
        onWithdraw={(d) => setWithdrawing(d)}
        onRestore={(d) => setWithdrawn(d, false)}
        onDelete={(d) => setDeleting(d)}
      />

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />

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
