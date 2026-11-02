// ============================================================
// Tên file: src/features/shared/FileViewer.tsx
// Tên tiếng Việt: Khung xem file đính kèm ngay trong app — PDF, ảnh, Word (.docx / .doc), Excel, văn bản
// Description: One viewer for every attachment (ba-spec 61). PDF / images render from the signed link; Word,
//              Excel and text are fetched as bytes and rendered in the browser (docx-preview, .doc piece-table
//              text, SheetJS). Nothing is sent to an outside viewer (R2). Display only, never writes data.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { DocxPreview, HorizontalScroll, ProcessingState, Tabs, TabsList, TabsTrigger } from "@/design-system";
import { filePreviewKind } from "@/lib/documents";
import { readLegacyWordBlocks, type WordBlock } from "@/lib/legacyWordText";
import { readSheetPreview, type SheetPreview } from "@/lib/sheetPreview";
import { cn } from "@/lib/utils";

/** Khung cao theo màn — đủ chỗ đọc, chừa đầu / chân hộp thoại (README § Xem / mở file). */
const FRAME_HEIGHT = "h-[min(75dvh,calc(100dvh-16rem))] min-h-80";

type Loaded =
  | { kind: "url"; url: string }
  | { kind: "docx"; bytes: Uint8Array }
  | { kind: "doc"; blocks: WordBlock[] }
  | { kind: "sheet"; sheets: SheetPreview[] }
  | { kind: "text"; text: string };

/**
 * `fileKey` đổi ⇒ nạp lại (đường dẫn file). `getUrl` lấy link có hạn theo quyền hiện có; trả null = không được xem / file đã gỡ.
 * `fullPage` = trang xem ở tab mới: khung cao theo cả màn.
 */
export function FileViewer({
  fileKey,
  name,
  getUrl,
  fullPage = false,
}: {
  fileKey: string;
  name: string;
  getUrl: () => Promise<string | null>;
  fullPage?: boolean;
}) {
  const kind = filePreviewKind(name || fileKey);
  // Kết quả của ĐÚNG file đang mở; khác file ⇒ coi như đang tải (không setState đồng bộ trong effect).
  const [result, setResult] = useState<{ key: string; loaded?: Loaded; error?: string } | null>(null);
  // getUrl đổi tham chiếu mỗi lần màn gọi vẽ lại — giữ bản mới nhất, chỉ nạp lại khi đổi file.
  const getUrlRef = useRef(getUrl);
  useEffect(() => {
    getUrlRef.current = getUrl;
  });

  useEffect(() => {
    if (kind === "download") return;
    let isCancelled = false;
    const done = (r: { loaded?: Loaded; error?: string }) => !isCancelled && setResult({ key: fileKey, ...r });
    void (async () => {
      const url = await getUrlRef.current();
      if (!url) return done({ error: "Tài khoản không được xem file này, hoặc file đã bị gỡ khỏi máy chủ." });
      if (kind === "pdf" || kind === "image") return done({ loaded: { kind: "url", url } });
      try {
        const res = await fetch(url);
        if (!res.ok) return done({ error: `Máy chủ trả lỗi ${res.status} khi tải file.` });
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (kind === "docx") return done({ loaded: { kind: "docx", bytes } });
        if (kind === "doc") return done({ loaded: { kind: "doc", blocks: await readLegacyWordBlocks(bytes) } });
        if (kind === "sheet") return done({ loaded: { kind: "sheet", sheets: await readSheetPreview(bytes) } });
        return done({ loaded: { kind: "text", text: new TextDecoder("utf-8").decode(bytes) } });
      } catch (e) {
        done({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [fileKey, kind]);

  const frame = fullPage ? "h-[calc(100dvh-12rem)] min-h-96" : FRAME_HEIGHT;

  if (kind === "download") {
    return (
      <p className="rounded-lg bg-muted px-4 py-3">
        Loại file này không xem được trong trình duyệt. Bấm <b>Tải về</b> để mở bằng phần mềm trên máy.
      </p>
    );
  }
  const current = result && result.key === fileKey ? result : null;
  if (!current) return <ProcessingState text="Đang mở file…" />;
  if (current.error || !current.loaded) {
    return (
      <p role="alert" className="rounded-lg bg-destructive-surface px-4 py-3">
        Không mở được file: {current.error ?? "lỗi không rõ"} Vẫn có thể bấm Tải về.
      </p>
    );
  }

  const loaded = current.loaded;
  if (loaded.kind === "url" && kind === "pdf") {
    return (
      <div className="grid gap-2">
        <iframe title={name} src={loaded.url} className={cn(frame, "w-full rounded-lg border border-border bg-muted")} />
        <p className="text-sm text-muted-foreground">Trên iPhone / iPad khung có thể chỉ hiện trang đầu — chọn {fullPage ? "Mở file gốc" : "Mở tab mới"} để xem đủ các trang.</p>
      </div>
    );
  }
  if (loaded.kind === "url") {
    return <img src={loaded.url} alt={name} className={cn("mx-auto max-w-full rounded-lg border border-border object-contain", fullPage ? "max-h-[calc(100dvh-12rem)]" : "max-h-[min(75dvh,calc(100dvh-16rem))]")} />;
  }
  if (loaded.kind === "docx") return <DocxPreview file={loaded.bytes} className={frame} />;
  if (loaded.kind === "doc") return <LegacyWordView blocks={loaded.blocks} className={frame} />;
  if (loaded.kind === "sheet") return <SheetView sheets={loaded.sheets} className={frame} />;
  return <pre className={cn(frame, "overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted p-4 text-sm")}>{loaded.text}</pre>;
}

/** Word đời cũ: chữ + bảng, không giữ định dạng (ba-spec 61 R4). Dòng bảng liền nhau gom thành một bảng. */
function LegacyWordView({ blocks, className }: { blocks: WordBlock[]; className?: string }) {
  const groups: (WordBlock | { type: "table"; rows: string[][] })[] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (b.type === "row" && last?.type === "table") last.rows.push(b.cells);
    else if (b.type === "row") groups.push({ type: "table", rows: [b.cells] });
    else groups.push(b);
  }
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        File Word đời cũ (.doc): đang hiện chữ và bảng trích từ file, không giữ định dạng, hình. Muốn xem đúng trình bày — bấm Tải về.
      </p>
      <div className={cn(className, "overflow-auto rounded-lg border border-border bg-card p-4")}>
        {groups.length === 0 && <p className="text-muted-foreground">File không có chữ.</p>}
        <div className="mx-auto grid max-w-3xl gap-3 leading-relaxed">
          {groups.map((g, i) =>
            g.type === "table" ? (
              <HorizontalScroll key={i}>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {g.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci} className="whitespace-pre-wrap border border-border px-2 py-1 align-top">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </HorizontalScroll>
            ) : g.type === "paragraph" ? (
              <p key={i} className="whitespace-pre-wrap">
                {g.text}
              </p>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

/** Excel: mỗi sheet một tab, ô hiện chữ như Excel; quá trần dòng thì nói rõ (ba-spec 61 R5). */
function SheetView({ sheets, className }: { sheets: SheetPreview[]; className?: string }) {
  const [active, setActive] = useState(0);
  const sheet = sheets[Math.min(active, sheets.length - 1)];
  if (!sheet) return <p className="rounded-lg bg-muted px-4 py-3">File Excel không có sheet nào.</p>;
  return (
    <div className="grid gap-2">
      {sheets.length > 1 && (
        <Tabs value={String(active)} onValueChange={(v) => setActive(Number(v))}>
          <TabsList className="flex-wrap justify-start group-data-horizontal/tabs:h-auto">
            {sheets.map((s, i) => (
              <TabsTrigger key={s.name} value={String(i)} title={`Xem sheet "${s.name}" (${s.total.toLocaleString("vi-VN")} dòng).`}>
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {sheet.total > sheet.rows.length && (
        <p className="text-sm text-muted-foreground">
          Đang hiện {sheet.rows.length.toLocaleString("vi-VN")} / {sheet.total.toLocaleString("vi-VN")} dòng — tải về để xem đủ.
        </p>
      )}
      <div className={cn(className, "overflow-auto rounded-lg border border-border bg-card")}>
        {sheet.rows.length === 0 ? (
          <p className="p-4 text-muted-foreground">Sheet trống.</p>
        ) : (
          <table className="tnum border-collapse text-sm">
            <tbody>
              {sheet.rows.map((r, ri) => (
                <tr key={ri}>
                  <th scope="row" className="sticky left-0 border border-border bg-muted px-2 py-1 text-right font-normal text-muted-foreground">
                    {ri + 1}
                  </th>
                  {r.map((c, ci) => (
                    <td key={ci} className="max-w-80 whitespace-pre-wrap border border-border px-2 py-1 align-top">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
