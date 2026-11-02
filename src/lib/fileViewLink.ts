// ============================================================
// Tên file: src/lib/fileViewLink.ts
// Tên tiếng Việt: Link trang xem file của app (mở tab mới không bắt tải về)
// Description: Builds / parses the `#/file-view?src=…&path=…&name=…` link that "Mở tab mới" opens for every
//              file kind (ba-spec 61 N2, AC-5) — a signed Storage link to Word / Excel makes the browser download.
// ============================================================
/** Nguồn file — mỗi nguồn một hàm lấy link có hạn theo quyền hiện có (không đổi bucket / RLS). */
export type FileViewSource = "documents" | "export" | "import";

const SOURCES: readonly FileViewSource[] = ["documents", "export", "import"];

export function fileViewHref(source: FileViewSource, path: string, name: string): string {
  const q = new URLSearchParams({ src: source, path, name });
  return `#/file-view?${q.toString()}`;
}

/** Đọc tham số trang xem — nguồn lạ hoặc thiếu đường dẫn ⇒ `null` (trang báo không mở được, không gọi Storage). */
export function parseFileViewParams(params: URLSearchParams): { source: FileViewSource; path: string; name: string } | null {
  const source = params.get("src") as FileViewSource | null;
  const path = params.get("path") ?? "";
  if (!source || !SOURCES.includes(source) || !path) return null;
  return { source, path, name: params.get("name") || path.split("/").pop() || path };
}
