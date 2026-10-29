// ============================================================
// Tên file: src/features/my-tasks/MyTasksScreen.tsx
// Tên tiếng Việt: Việc của tôi — việc cần làm của người đang đăng nhập
// Description: Personal to-do list: tasks assigned to me, tasks my permissions cover,
//              tasks I delegated. Overdue warnings + one click to the exact screen/day.
// ============================================================
// Doc: docs/app-map/39-my-tasks.md. Luật tính việc ở lib/myTasks.ts (thuần, có test);
// màn này chỉ nạp sổ, ghép quyền + phạm vi của người dùng, và ghi bảng giao việc.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  ChoiceGroup,
  ConfirmAction,
  EmptyState,
  StatCardGrid,
  SummaryTable,
  Tag,
  notify,
  todayIso,
  toneForWorkshop,
  type StatCardData,
  type SummaryTableColumn,
  type TagVariant,
} from "@/design-system";
import {
  useBalancingInputs,
  useBalancingOutputs,
  useBalancingPeriods,
  useAppRoles,
  useCompanyDocuments,
  useDailyLocks,
  useFinishedGoodsOpeningStock,
  useMaterialOpeningStock,
  useProductionLocks,
  useScraps,
  useTaskAssignments,
  useUserProfiles,
} from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import { useTraceData } from "@/features/shared/useTraceData";
import { useCan, usePermissions, useScopeContext } from "@/features/shared/PermissionProvider";
import { buildChainWarnings, type DataFlowInput } from "@/lib/dataFlow";
import { buildDocumentWarnings, documentViewerFor } from "@/lib/documents";
import { hasDocumentStorage } from "@/lib/documentStorage";
import { TASKS_START_DATE, buildMyTasks, findResolvedAssignments, type MyTaskItem, type TaskUrgency } from "@/lib/myTasks";
import { formatDateVN } from "@/lib/format";
import { callName, recordName } from "@/lib/personName";
import type { TaskAssignment } from "@/types";
import { AlarmClock, ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, Pencil, Send, UserPlus, Users, XCircle } from "lucide-react";
import { AssignTaskDialog, type AssignTarget } from "./AssignTaskDialog";
import { usePageTour } from "@/features/shared/PageTourProvider";
import { buildMyTasksTour } from "./myTasksTour";

const URGENCY_TAGS: Record<TaskUrgency, (x: MyTaskItem) => { text: string; variant: TagVariant }> = {
  overdue: (x) => ({ text: `Quá hạn ${x.overdueDays} ngày`, variant: "error" }),
  today: () => ({ text: "Hạn hôm nay", variant: "warning" }),
  upcoming: (x) => ({ text: `Hạn ${formatDateVN(x.dueDate)}`, variant: "pending" }),
  info: () => ({ text: "Để biết", variant: "muted" }),
};

type UrgencyFilter = "todo" | "overdue" | "today" | "info" | "all";
const FILTERS: { value: UrgencyFilter; label: string }[] = [
  { value: "todo", label: "Cần làm" },
  { value: "overdue", label: "Quá hạn" },
  { value: "today", label: "Hôm nay" },
  { value: "info", label: "Để biết" },
  { value: "all", label: "Tất cả" },
];
const matchesFilter = (x: MyTaskItem, f: UrgencyFilter) =>
  f === "all" ||
  (f === "todo" ? x.urgency !== "info" || (x.bucket === "delegated" && x.assignment?.status === "open" && !x.isResolved) : x.urgency === f);

function Section({ id, title, description, tour, children }: { id: string; title: string; description?: ReactNode; tour?: string; children: ReactNode }) {
  return (
    <section id={id} data-tour={tour} className="grid min-w-0 scroll-mt-header grid-cols-[minmax(0,1fr)] content-start gap-4 rounded-xl border-2 border-border bg-card p-5">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function MyTasksScreen() {
  const navigate = useNavigate();
  const today = todayIso();
  const { profile } = useAuth();
  const permissions = usePermissions();
  const scopeContext = useScopeContext();
  const canAssign = useCan("my-tasks");
  // Chạy không đăng nhập (chỉ máy này) ⇒ một "người dùng" cố định của máy.
  const userId = profile?.id ?? "local";
  // Người giao việc ghi sổ bằng họ tên (ba-spec 47 R1); lời chào gọi bằng tên gọi (R2).
  const userName = recordName(profile, "Máy này");
  const greetName = callName(profile, "Máy này");

  // ---- Nạp sổ (giống Tổng quan — cùng bộ tính cảnh báo) ----
  const { traceData, isReady: isTraceReady } = useTraceData();
  const [scraps, , { status: scrapStatus }] = useScraps();
  const [dailyLocks, , { status: dailyLockStatus }] = useDailyLocks();
  const [productionLocks, , { status: productionLockStatus }] = useProductionLocks();
  const [periods, , { status: periodStatus }] = useBalancingPeriods();
  const [balancingInputs] = useBalancingInputs();
  const [balancingOutputs] = useBalancingOutputs();
  const [materialOpening] = useMaterialOpeningStock();
  const [finishedOpening] = useFinishedGoodsOpeningStock();
  const [assignments, saveAssignments, { status: assignmentStatus }] = useTaskAssignments();
  const [profiles] = useUserProfiles();
  // Chứng nhận / hồ sơ năng lực sắp hết hạn (lib/documents.ts) — chỉ tài liệu mình xem được.
  const [documents, , { status: documentStatus }] = useCompanyDocuments();
  const [appRoles] = useAppRoles();

  const d: DataFlowInput = useMemo(
    () => ({ ...traceData, scraps, dailyLocks, productionLocks, periods, balancingInputs, balancingOutputs, materialOpening, finishedOpening }),
    [traceData, scraps, dailyLocks, productionLocks, periods, balancingInputs, balancingOutputs, materialOpening, finishedOpening],
  );
  const documentViewer = useMemo(
    () => documentViewerFor({ roles: profile?.roles ?? [], appRoles, isAdmin: permissions.isAdmin, isOffline: !hasDocumentStorage || !profile }),
    [profile, appRoles, permissions.isAdmin],
  );
  const warnings = useMemo(
    () => [
      ...buildChainWarnings(d, { fromDate: TASKS_START_DATE, toDate: today }, today, undefined, { includeToday: true, approvalWaitDays: 0 }),
      ...buildDocumentWarnings(documents, today, documentViewer),
    ],
    [d, today, documents, documentViewer],
  );
  const wipOperators = useMemo(() => new Map(d.wips.map((w) => [w.id, w.operator ?? ""])), [d.wips]);
  const tasks = useMemo(
    () => buildMyTasks({ warnings, assignments, userId, permissions, scopeContext, wipOperators, today }),
    [warnings, assignments, userId, permissions, scopeContext, wipOperators, today],
  );

  // ---- Việc máy đã giao mà sổ đã sửa xong ⇒ tự đóng (ghi "Xong"). CHỈ khi mọi sổ đã nạp
  // xong từ máy chủ (đang tải dở thì sổ trống ⇒ tưởng đã sửa hết ⇒ đóng nhầm). Không toast:
  // không phải thao tác của người dùng; dòng hiện "Đã xong — sổ đã sửa" ở mục Tôi đã giao.
  const isAllReady =
    isTraceReady && [scrapStatus, dailyLockStatus, productionLockStatus, periodStatus, assignmentStatus, documentStatus].every((s) => s === "ready");
  const closedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!isAllReady) return;
    const mine = assignments.filter((a) => a.assigneeId === userId || a.assignedById === userId);
    const resolved = findResolvedAssignments(mine, warnings).filter((a) => !closedRef.current.has(a.id));
    if (!resolved.length) return;
    for (const a of resolved) closedRef.current.add(a.id);
    const ids = new Set(resolved.map((a) => a.id));
    const doneAt = new Date().toISOString();
    saveAssignments(assignments.map((a) => (ids.has(a.id) ? { ...a, status: "done", doneAt, note: a.note || "Tự xong — sổ đã sửa" } : a)));
  }, [isAllReady, assignments, warnings, userId, saveAssignments]);

  // ---- Giao việc / sửa / xong / thu hồi ----
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [revoking, setRevoking] = useState<TaskAssignment | null>(null);
  const [filter, setFilter] = useState<UrgencyFilter>("todo");

  // Hướng dẫn thao tác (ba-spec 43): chỉ dẫn, không ghi; chờ bảng giao việc nạp xong.
  const tour = useMemo(() => buildMyTasksTour({ can: { assign: canAssign.create, editAssigned: canAssign.update } }), [canAssign.create, canAssign.update]);
  usePageTour(assignmentStatus === "loading" ? null : tour);

  const upsert = (row: TaskAssignment, message: string) => {
    const prev = assignments;
    const exists = prev.some((a) => a.id === row.id);
    if (!saveAssignments(exists ? prev.map((a) => (a.id === row.id ? row : a)) : [...prev, row])) return;
    notify.saved(message, () => saveAssignments(prev));
  };
  const markDone = (a: TaskAssignment) => upsert({ ...a, status: "done", doneAt: new Date().toISOString() }, `Đã xong: ${a.title}`);
  const revoke = (a: TaskAssignment) => {
    const prev = assignments;
    if (!saveAssignments(prev.map((x) => (x.id === a.id ? { ...x, status: "cancelled", doneAt: new Date().toISOString() } : x)))) return;
    notify.deleted(`Đã thu hồi việc giao cho ${a.assigneeName}`, () => saveAssignments(prev));
  };

  // ---- Cột bảng ----
  const columns = (bucket: MyTaskItem["bucket"]): SummaryTableColumn<MyTaskItem>[] => [
    {
      key: "due",
      header: "Hạn",
      // Sắp theo NGÀY HẠN (hạn sớm / quá hạn lên đầu), không theo chữ "Quá hạn 3 ngày".
      sortValue: (r) => r.dueDate,
      sortKind: "date",
      render: (r) => {
        if (r.isResolved || r.assignment?.status === "done") return <Tag variant="done">Đã xong</Tag>;
        if (r.assignment?.status === "cancelled") return <Tag variant="muted">Đã thu hồi</Tag>;
        const t = URGENCY_TAGS[r.urgency](r);
        return <Tag variant={t.variant}>{t.text}</Tag>;
      },
    },
    {
      key: "task",
      header: "Việc",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.title}</div>
          <div className="text-sm text-muted-foreground">
            {r.kindLabel}
            {r.detail ? ` · ${r.detail}` : ""}
          </div>
          {r.assignment && (
            <div className="text-sm text-muted-foreground">
              {bucket === "delegated" ? `Giao cho ${r.assignment.assigneeName}` : `Giao bởi ${r.assignment.assignedByName || "—"}`}
              {r.assignment.note ? ` · ${r.assignment.note}` : ""}
            </div>
          )}
        </div>
      ),
    },
    { key: "date", header: "Ngày", render: (r) => (r.date ? formatDateVN(r.date) : "—") },
    {
      key: "workshop",
      header: "Xưởng",
      render: (r) => (r.workshop ? <Tag variant="category" tone={toneForWorkshop(r.workshop)}>{r.workshop}</Tag> : "—"),
    },
    {
      key: "actions",
      header: "",
      render: (r) => {
        const a = r.assignment;
        const isOpen = !a || (a.status === "open" && !r.isResolved);
        return (
          <div className="flex flex-wrap justify-end gap-2">
            {r.path && (
              <Button title="Mở đúng màn và đúng ngày để làm việc này." variant={bucket === "delegated" ? "outline" : "default"} size="sm" onClick={() => navigate(r.path)}>
                Mở việc
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            )}
            {bucket === "mine" && canAssign.create && (
              <Button title="Giao việc này cho một người cụ thể, có hạn — người khác sẽ không thấy để khỏi làm trùng." variant="outline" size="sm" onClick={() => setAssignTarget({ kind: "system", task: r })}>
                <UserPlus className="mr-1 h-4 w-4" aria-hidden />
                Giao
              </Button>
            )}
            {bucket === "assigned" && a?.source === "manual" && a.status === "open" && (
              <Button title="Báo đã làm xong việc được giao — người giao sẽ thấy." variant="save" size="sm" onClick={() => markDone(a)}>
                <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden />
                Xong
              </Button>
            )}
            {bucket === "delegated" && a && isOpen && canAssign.update && (
              <Button title="Sửa người nhận, hạn hoặc ghi chú của việc đã giao." variant="edit" size="sm" onClick={() => setAssignTarget({ kind: "edit", assignment: a })}>
                <Pencil className="mr-1 h-4 w-4" aria-hidden />
                Sửa
              </Button>
            )}
            {bucket === "delegated" && a && isOpen && (canAssign.delete || a.assignedById === userId) && (
              <Button title="Thu hồi việc đã giao — việc máy phát hiện quay về danh sách chung theo quyền." variant="danger" size="sm" onClick={() => setRevoking(a)}>
                <XCircle className="mr-1 h-4 w-4" aria-hidden />
                Thu hồi
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const assigned = tasks.assigned.filter((x) => matchesFilter(x, filter));
  const mine = tasks.mine.filter((x) => matchesFilter(x, filter));
  const delegated = tasks.delegated.filter((x) => matchesFilter(x, filter));
  const openDelegated = tasks.delegated.filter((x) => x.assignment?.status === "open" && !x.isResolved);
  const showDelegated = canAssign.create || tasks.delegated.length > 0;

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const cards: StatCardData[] = [
    {
      label: "Quá hạn",
      value: tasks.overdueCount,
      subtext: "việc của tôi đã qua hạn",
      numeric: true,
      icon: AlarmClock,
      color: tasks.overdueCount > 0 ? "danger" : "success",
      onSelect: () => setFilter("overdue"),
      selectHint: "Chỉ hiện các việc đã quá hạn.",
    },
    {
      label: "Hạn hôm nay",
      value: tasks.todayCount,
      subtext: "làm trong hôm nay",
      numeric: true,
      icon: CalendarCheck,
      color: tasks.todayCount > 0 ? "warning" : "neutral",
      onSelect: () => setFilter("today"),
      selectHint: "Chỉ hiện các việc có hạn hôm nay.",
    },
    {
      label: "Được giao cho tôi",
      value: tasks.assigned.length,
      subtext: "đang mở",
      numeric: true,
      icon: ClipboardList,
      color: "brand",
      onSelect: () => scrollTo("assigned"),
      selectHint: "Tới mục việc được giao cho tôi.",
    },
    ...(showDelegated
      ? [
          {
            label: "Tôi đã giao",
            value: openDelegated.length,
            subtext: `${openDelegated.filter((x) => x.urgency === "overdue").length} việc người nhận để quá hạn`,
            numeric: true,
            icon: Users,
            color: "neutral" as const,
            onSelect: () => scrollTo("delegated"),
            selectHint: "Tới mục việc tôi đã giao để đốc.",
          },
        ]
      : []),
  ];

  const table = (bucket: MyTaskItem["bucket"], rows: MyTaskItem[], empty: string) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <SummaryTable rows={rows} columns={columns(bucket)} getKey={(r) => r.id} rowMarkKey={`my-tasks|${bucket}`} />
    );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-base text-muted-foreground">
          Việc cần làm của <b className="text-foreground">{greetName}</b>: việc được giao, và việc máy tự phát hiện mà bạn có quyền làm (ngày chưa
          chốt, BTP chờ duyệt, chưa gắn lô, kỳ chưa chốt…). Sổ sửa xong thì việc tự hết. Tính từ {formatDateVN(TASKS_START_DATE)}.
        </p>
        {canAssign.create && (
          <Button data-tour="my-tasks-assign-new" title="Giao một việc tay cho một người: tiêu đề, hạn và màn cần mở." onClick={() => setAssignTarget({ kind: "manual" })}>
            <Send className="mr-2 h-4 w-4" aria-hidden />
            Giao việc mới
          </Button>
        )}
      </div>

      <div data-tour="my-tasks-stats">
        <StatCardGrid cards={cards} />
      </div>

      <div data-tour="my-tasks-filter">
        <ChoiceGroup label="Lọc theo hạn" hideRequiredMark value={filter} onChange={(v) => setFilter(v as UrgencyFilter)} options={FILTERS} columns={4} />
      </div>

      <Section id="assigned" tour="my-tasks-assigned" title={`Được giao cho tôi (${assigned.length})`} description="Việc người khác giao riêng cho bạn — làm theo hạn người giao đặt.">
        {table("assigned", assigned, "Không có việc nào được giao cho bạn.")}
      </Section>

      <Section
        id="mine"
        tour="my-tasks-mine"
        title={`Việc theo quyền của tôi (${mine.length})`}
        description="Việc máy phát hiện thuộc phần việc của bạn (theo quyền và xưởng của bạn) mà chưa giao riêng cho ai. Bấm Mở việc để tới đúng ngày cần sửa."
      >
        {tasks.mine.length === 0 && tasks.assigned.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Không còn việc tồn" description="Các ngày đã chốt, lô đã gắn, không có BTP chờ duyệt thuộc phần việc của bạn." />
        ) : (
          table("mine", mine, "Không có việc nào khớp bộ lọc.")
        )}
      </Section>

      {showDelegated && (
        <Section id="delegated" tour="my-tasks-delegated" title={`Tôi đã giao (${delegated.length})`} description="Việc bạn đã giao cho người khác — để đốc. Việc đã xong hiện thêm 7 ngày.">
          {table("delegated", delegated, "Chưa giao việc nào cho người khác.")}
        </Section>
      )}

      <AssignTaskDialog
        target={assignTarget}
        onClose={() => setAssignTarget(null)}
        profiles={profiles}
        currentUser={{ id: userId, name: userName }}
        onSave={(row, message) => {
          upsert(row, message);
          setAssignTarget(null);
        }}
      />

      <ConfirmAction
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Thu hồi việc giao cho ${revoking?.assigneeName ?? ""}?`}
        description="Người nhận không còn thấy việc này. Việc máy phát hiện (nếu chưa sửa xong) quay về danh sách chung của những người có quyền."
        detail={revoking?.title}
        confirmLabel="Thu hồi"
        destructive
        icon={XCircle}
        onConfirm={() => {
          if (revoking) revoke(revoking);
          setRevoking(null);
        }}
      />
    </div>
  );
}
