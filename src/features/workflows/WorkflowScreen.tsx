// ============================================================
// Tên file: src/features/workflows/WorkflowScreen.tsx
// Tên tiếng Việt: Trang Quy trình — xem sơ đồ workflow của từng khu ngay trong app
// Description: In-app viewer of docs/workflows/*.md (ba-spec 65) — same files the pre-commit hook keeps in sync with code
// ============================================================
// Mở từ hộp "?" của mọi trang ("Xem sơ đồ quy trình") hoặc thẳng `#/workflows?module=<id>`. Chỉ đọc; nội dung là
// đúng file trong repo (đóng gói lúc build) ⇒ sửa code mà quên sơ đồ thì commit bị chặn, app luôn hiện bản khớp code.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Combobox, EmptyState, MarkdownView, Tabs, TabsList, TabsTrigger, ThinkingDots } from "@/design-system";
import { WORKFLOW_MODULES } from "@/lib/workflowDocs";
import { Workflow } from "lucide-react";

const DOCS = import.meta.glob<string>("../../../docs/workflows/*.md", { query: "?raw", import: "default" });
const docLoader = (path: string | null) => (path ? DOCS[`../../../${path}`] : undefined);
const MODULES = WORKFLOW_MODULES.filter((m) => m.doc);

export default function WorkflowScreen() {
  const [params, setParams] = useSearchParams();
  const wanted = params.get("module") ?? "";
  const current = MODULES.find((m) => m.id === wanted) ?? MODULES[0];
  const [text, setText] = useState<{ id: string; md: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = docLoader(current?.doc ?? null);
    if (!load) return;
    void load().then((md) => alive && setText({ id: current.id, md }));
    return () => {
      alive = false;
    };
  }, [current]);

  const select = useCallback((id: string) => setParams({ module: id }, { replace: true }), [setParams]);
  const linkFor = useCallback((id: string) => `#/workflows?module=${id === "README" ? MODULES[0].id : id}`, []);

  if (!current) return <EmptyState icon={Workflow} title="Chưa có sơ đồ quy trình" description="Sơ đồ nằm ở docs/workflows/ của repo." />;
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Quy trình — sơ đồ workflow theo khu</h1>
      {/* Máy tính: hàng tab các khu; điện thoại: ô chọn. */}
      <div className="max-lg:hidden">
        <Tabs value={current.id} onValueChange={select}>
          <TabsList className="h-auto flex-wrap justify-start">
            {MODULES.map((m) => (
              <TabsTrigger key={m.id} value={m.id} title={`Xem sơ đồ quy trình khu ${m.title}.`}>
                {m.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="lg:hidden">
        <Combobox
          label="Khu"
          hideRequiredMark
          clearable={false}
          value={current.id}
          onChange={(v) => v && select(v)}
          options={MODULES.map((m) => ({ value: m.id, label: m.title }))}
        />
      </div>
      <div className="rounded-xl border-2 border-border bg-card p-4 sm:p-6">
        {text?.id === current.id ? <MarkdownView markdown={text.md} linkFor={linkFor} /> : <ThinkingDots />}
      </div>
    </div>
  );
}
