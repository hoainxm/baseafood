/**
 * MarkdownView — hiện một tài liệu Markdown của repo trong app (sơ đồ workflow `docs/workflows/`, ba-spec 65).
 * Khối ```mermaid vẽ thành sơ đồ (thư viện `mermaid` chỉ tải khi trang có sơ đồ). Nội dung là file của chính repo
 * (đóng gói lúc build), không phải chữ người dùng gõ.
 *
 * Bỏ các dòng kỹ thuật của frontmatter (`covers:` · `last_verified:` · `ttl_days:` · chú thích HTML); link
 * `<id>.md` giữa hai sơ đồ ⇒ `linkFor(id)`; link sang tài liệu khác của repo ⇒ chỉ giữ chữ.
 * Bảng rộng cuộn ngang trong khung riêng (tài liệu đọc, không phải bảng nghiệp vụ — ngoại lệ luật 14).
 */
import * as React from "react";
import { Marked } from "marked";
import { cn } from "@/lib/utils";

const TECH_LINE = /^(covers|tours|guides|last_verified|ttl_days|status):/;

export function stripDocMeta(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    // Dòng dặn người sửa code ("Load khi", luật covers) không dành cho người đọc trên app.
    .filter((l) => !TECH_LINE.test(l) && !l.startsWith("Sửa code trong `covers:`") && !l.startsWith("> Load khi:"))
    .join("\n");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderDocHtml(md: string, linkFor: (id: string) => string): string {
  const marked = new Marked({
    gfm: true,
    renderer: {
      code({ text, lang }) {
        if (lang === "mermaid") return `<div class="md-mermaid" data-src="${escapeHtml(text)}"><pre>${escapeHtml(text)}</pre></div>`;
        return `<pre><code>${escapeHtml(text)}</code></pre>`;
      },
      link({ href, tokens }) {
        const label = this.parser.parseInline(tokens);
        const m = /^([a-z0-9-]+)\.md$/.exec(href ?? "");
        if (m) return `<a href="${escapeHtml(linkFor(m[1]))}">${label}</a>`;
        if (/^https?:\/\//.test(href ?? "")) return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`;
        return label;
      },
      table(token) {
        const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join("");
        const body = token.rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`).join("");
        return `<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
      },
    },
  });
  return marked.parse(stripDocMeta(md), { async: false });
}

let mermaidLoad: Promise<typeof import("mermaid").default> | null = null;
const loadMermaid = () =>
  (mermaidLoad ??= import("mermaid").then((m) => {
    m.default.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "inherit" });
    return m.default;
  }));

let seq = 0;

export function MarkdownView({ markdown, linkFor, className }: { markdown: string; linkFor: (id: string) => string; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const html = React.useMemo(() => renderDocHtml(markdown, linkFor), [markdown, linkFor]);

  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const blocks = [...host.querySelectorAll<HTMLElement>(".md-mermaid")];
    if (!blocks.length) return;
    let cancelled = false;
    void loadMermaid().then(async (mermaid) => {
      for (const b of blocks) {
        if (cancelled) return;
        try {
          const { svg } = await mermaid.render(`md-mermaid-${++seq}`, b.dataset.src ?? "");
          if (!cancelled) b.innerHTML = svg;
        } catch {
          // Sơ đồ lỗi cú pháp ⇒ giữ nguyên chữ của sơ đồ (vẫn đọc được).
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [html]);

  return (
    <div
      ref={ref}
      className={cn(
        "min-w-0 space-y-4 text-base leading-relaxed text-foreground",
        "[&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_blockquote]:rounded-lg [&_blockquote]:bg-muted [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_code]:wrap-anywhere [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-sm",
        "[&_.md-table]:max-w-full [&_.md-table]:overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-top [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        "[&_.md-mermaid]:overflow-x-auto [&_.md-mermaid]:rounded-lg [&_.md-mermaid]:border [&_.md-mermaid]:border-border [&_.md-mermaid]:bg-card [&_.md-mermaid]:p-4 [&_.md-mermaid_svg]:mx-auto [&_.md-mermaid_svg]:h-auto [&_.md-mermaid_svg]:max-w-full [&_pre]:whitespace-pre-wrap [&_pre]:text-sm",
        className,
      )}
      // Tài liệu của chính repo, đóng gói lúc build (không phải chữ người dùng nhập).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
