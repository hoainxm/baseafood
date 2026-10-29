// ============================================================
// Tên file: src/features/shared/guides/FlowGuideBlocks.tsx
// Tên tiếng Việt: Khối minh họa của hộp hướng dẫn — việc của bạn · quy trình · trạng thái · ai làm gì
// Description: Visual building blocks for flow-style page guides (ba-spec 43 v5 R18–R21): numbered
//              step timeline with who-does-it chips and done condition, state chain with the same
//              tags as the page, actor cards, and a "your work" box from the viewer's real permissions.
// ============================================================
import { ArrowRight, CircleCheck, UserCheck, Users } from "lucide-react";
import { Tag } from "@/design-system";
import { can } from "@/lib/permissions";
import { usePermissions } from "../PermissionProvider";
import { stepsForViewer, stepsOfActor, type GuideActor, type GuideFlowStep, type GuideState } from "./flowGuide";

function useViewerSteps(steps: readonly GuideFlowStep[]): Set<string> {
  const perms = usePermissions();
  return new Set(stepsForViewer(steps, (r, a) => can(perms, r, a)));
}

const actorNames = (actors: readonly GuideActor[], ids: readonly string[]) =>
  ids.map((id) => actors.find((a) => a.id === id)?.name ?? id).join(" · ");

/** Ô đầu hộp: những bước tài khoản đang đăng nhập làm được trên trang này. */
export function GuideYourWork({ steps }: { steps: readonly GuideFlowStep[] }) {
  const perms = usePermissions();
  const mine = useViewerSteps(steps);
  const list = steps.map((s, i) => ({ no: i + 1, s })).filter((x) => mine.has(x.s.id));
  return (
    <div className="flex gap-3 rounded-lg border border-primary/40 bg-accent/40 px-3 py-3 sm:px-4">
      <UserCheck className="mt-0.5 hidden size-5 shrink-0 text-primary sm:block" aria-hidden />
      <div className="min-w-0 space-y-1.5">
        <p className="font-semibold">Việc của bạn trên trang này</p>
        {list.length === 0 ? (
          <p className="text-sm">Tài khoản của bạn chỉ xem trang này. Các bước bên dưới do người khác làm.</p>
        ) : (
          <>
            <p className="flex flex-wrap gap-1.5">
              {list.map((x) => (
                <span key={x.s.id} className="inline-flex max-w-full items-start gap-1.5 rounded-md border border-border bg-background px-2.5 py-0.5 text-sm">
                  <b className="tnum">{x.no}</b>
                  {x.s.title}
                </span>
              ))}
            </p>
            <p className="text-sm text-muted-foreground">
              {perms.isAdmin ? "Tài khoản quản trị làm được mọi bước." : "Theo quyền của tài khoản đang đăng nhập. Các bước đó có dấu Việc của bạn bên dưới."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Quy trình: các bước có số, nối bằng đường dọc; mỗi bước ghi ai làm, làm gì, khi nào xong. */
export function GuideFlow({ steps, actors }: { steps: readonly GuideFlowStep[]; actors: readonly GuideActor[] }) {
  const mine = useViewerSteps(steps);
  return (
    <ol className="grid">
      {steps.map((s, i) => {
        const isMine = mine.has(s.id);
        return (
          <li key={s.id} className="grid pb-3 last:pb-0 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-3">
            {/* Màn hẹp: bỏ cột số (số vào dòng tiêu đề) để thẻ trạng thái đủ chỗ ở chữ 130 %. */}
            <div className="hidden flex-col items-center sm:flex">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground tnum">{i + 1}</span>
              {i < steps.length - 1 && <span className="mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
            </div>
            <div className={`min-w-0 space-y-1.5 rounded-lg border px-3 py-2.5 ${isMine ? "border-primary bg-accent/40" : "border-border"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground tnum sm:hidden">{i + 1}</span>
                <b>{s.title}</b>
                {isMine && (
                  <Tag variant="done" icon={UserCheck}>
                    Việc của bạn
                  </Tag>
                )}
              </div>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0">{actorNames(actors, s.actors)}</span>
              </p>
              <p>{s.text}</p>
              {(s.done || s.result) && (
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                  {s.done && (
                    <p className="flex min-w-0 items-start gap-1.5">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <span className="min-w-0">{s.done}</span>
                    </p>
                  )}
                  {s.result && (
                    <p className="flex min-w-0 max-w-full items-center gap-1.5">
                      {/* Màn hẹp: bỏ mũi tên để thẻ trạng thái đủ chỗ, không bị cắt chữ. */}
                      <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
                      <Tag variant={s.result.tone}>{s.result.label}</Tag>
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Chuỗi trạng thái (đường chính nối mũi tên, trạng thái nhánh đứng sau) + nghĩa và việc tiếp của từng trạng thái. */
export function GuideStates({ states, side = [] }: { states: readonly GuideState[]; side?: readonly GuideState[] }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Thứ tự trạng thái">
        {states.map((st, i) => (
          <span key={st.label} className="inline-flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            <Tag variant={st.tone}>{st.label}</Tag>
          </span>
        ))}
        {side.map((st) => (
          <span key={st.label} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            hoặc <Tag variant={st.tone}>{st.label}</Tag>
          </span>
        ))}
      </div>
      <dl className="grid gap-1.5">
        {[...states, ...side].map((st) => (
          <div key={st.label} className="grid gap-1 rounded-md bg-muted/50 px-3 py-2 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-3">
            <dt>
              <Tag variant={st.tone}>{st.label}</Tag>
            </dt>
            <dd className="min-w-0 text-sm">
              {st.meaning}
              {st.next && <span className="block text-muted-foreground">Việc tiếp: {st.next}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Ai làm gì: mỗi nhóm người dùng một thẻ, kê các bước của nhóm (lấy từ quy trình — không viết tay lần hai). */
export function GuideActors({ steps, actors }: { steps: readonly GuideFlowStep[]; actors: readonly GuideActor[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {actors.map((a) => {
        const own = stepsOfActor(steps, a.id);
        return (
          <div key={a.id} className="min-w-0 space-y-1 rounded-lg border border-border px-3 py-2.5">
            <p className="font-semibold">{a.name}</p>
            {a.note && <p className="text-sm text-muted-foreground">{a.note}</p>}
            {a.viewOnly || own.length === 0 ? (
              <p className="text-sm">Chỉ xem, không ghi.</p>
            ) : (
              <ul className="space-y-0.5 text-sm">
                {own.map((x) => (
                  <li key={x.no} className="flex gap-1.5">
                    <b className="tnum">{x.no}.</b>
                    <span className="min-w-0">{x.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Mẫu thanh tiến độ của chuyến (cùng màu với thanh thật trên trang Xuất khẩu): 3 xong · 1 đang làm · còn lại chưa làm. */
export function GuideProgressSample({ titles }: { titles: readonly string[] }) {
  const tone = titles.map((_, i) => (i < 3 ? "bg-success" : i === 3 ? "bg-warning" : "bg-border"));
  return (
    <div className="space-y-2 rounded-lg border border-border px-3 py-3">
      <div className="grid auto-cols-fr grid-flow-col gap-1" aria-hidden>
        {tone.map((t, i) => (
          <span key={i} className={`h-2.5 rounded-full ${t}`} />
        ))}
      </div>
      <ol className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-3">
        {titles.map((t, i) => (
          <li key={t} className="flex min-w-0 gap-1.5">
            <b className="tnum">{i + 1}</b>
            <span className="min-w-0">{t}</span>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success" aria-hidden />Xong</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warning" aria-hidden />Đang làm</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-border" aria-hidden />Chưa làm</span>
      </p>
    </div>
  );
}
