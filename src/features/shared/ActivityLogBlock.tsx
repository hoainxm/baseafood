// ============================================================
// Tên file: src/features/shared/ActivityLogBlock.tsx
// Tên tiếng Việt: Khối "Nhật ký thao tác" cuối hồ sơ — dùng chung mọi nhóm trang
// Description: Read-only list of a dossier's activity rows (ba-spec 56 AL2): newest first, time · person · sentence,
//              collapsed after 8 rows. Same look as the export contract dossier (parts.tsx ActivityList).
// ============================================================
import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { Button } from "@/design-system";
import { formatDateVN } from "@/lib/format";

const COLLAPSE_AFTER = 8;

export interface ActivityLogRow {
  id: string;
  createdAt: string;
  actor: string;
  summary: string;
}

export function ActivityLogBlock({ entries, title = "Nhật ký thao tác", detail, tourTarget }: { entries: readonly ActivityLogRow[]; title?: string; detail?: (e: ActivityLogRow) => string; tourTarget?: string }) {
  const [showAll, setShowAll] = useState(false);
  const isLong = entries.length > COLLAPSE_AFTER;
  const shown = isLong && !showAll ? entries.slice(0, COLLAPSE_AFTER) : entries;
  return (
    <section data-tour={tourTarget} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      <h3 className="flex items-center gap-2 font-semibold">
        <History className="h-4 w-4" aria-hidden />
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có thao tác nào được ghi nhật ký (nhật ký bắt đầu ghi từ khi có migration 0092).</p>
      ) : (
        <ol className="grid min-w-0 grid-cols-[minmax(0,1fr)] divide-y divide-border rounded-lg border border-border">
          {shown.map((a) => {
            const at = a.createdAt ? new Date(a.createdAt) : null;
            const when = at && !Number.isNaN(at.getTime()) ? `${formatDateVN(a.createdAt.slice(0, 10))} ${at.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "";
            return (
              <li key={a.id} className="grid min-w-0 gap-0.5 px-3 py-2">
                <span className="break-words">{a.summary}</span>
                <span className="tnum text-sm text-muted-foreground">{[when, a.actor, detail?.(a)].filter(Boolean).join(" · ")}</span>
              </li>
            );
          })}
        </ol>
      )}
      {isLong && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)} title={showAll ? `Chỉ hiện ${COLLAPSE_AFTER} dòng mới nhất.` : `Hiện đủ ${entries.length} dòng nhật ký.`}>
            <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} aria-hidden />
            {showAll ? "Thu gọn" : `Hiện tất cả ${entries.length} dòng`}
          </Button>
        </div>
      )}
    </section>
  );
}
