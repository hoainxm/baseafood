// ============================================================
// Tên file: src/design-system/patterns/AbbrHint.tsx
// Tên tiếng Việt: Chú thích từ viết tắt — nút "?" cạnh nhãn + chữ gạch chấm trong câu / tiêu đề cột
// Description: Abbreviation hints: a small "?" button next to a label, and an inline dotted term
// ============================================================
import * as React from "react";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { abbreviationHint, abbreviationText, findAbbreviation } from "@/lib/abbreviations";
import { cn } from "@/lib/utils";

/**
 * Rê chuột ⇒ `title` hiện qua HoverHint (150 ms); chạm / bấm ⇒ popover (điện thoại không có rê).
 * Chữ chú thích lấy từ bảng `lib/abbreviations.ts` — màn không tự viết câu giải thích.
 */
function HintPopover({ text, trigger }: { text: string; trigger: React.ReactElement }) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="grid w-80 max-w-[calc(100vw-2rem)] gap-1 text-sm leading-snug">
        {text.split("\n").map((line) => (
          <p key={line}>{line}</p>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Nút "?" cạnh nhãn: tự dò chữ viết tắt trong `label` (ETD, L/C, B/L…). Nhãn không có chữ nào
 * trong bảng ⇒ không vẽ gì. Field / DateField / Combobox / NumberField đã gắn sẵn.
 */
export function AbbrHint({ label, className }: { label: string; className?: string }) {
  const text = abbreviationHint(label);
  if (!text) return null;
  return (
    <HintPopover
      text={text}
      trigger={
        <button
          type="button"
          title={text}
          aria-label={`Chú thích từ viết tắt: ${text}`}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground press-feedback hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className,
          )}
        >
          <CircleHelp className="size-4" aria-hidden />
        </button>
      }
    />
  );
}

/**
 * Một chữ viết tắt trong câu / tiêu đề cột / thẻ: gạch chấm dưới, rê xem nghĩa, chạm mở chú thích.
 * Không có trong bảng ⇒ trả chữ thường.
 */
export function Abbr({ term, children, className }: { term: string; children?: React.ReactNode; className?: string }) {
  const a = findAbbreviation(term);
  if (!a) return <>{children ?? term}</>;
  const text = abbreviationText(a);
  return (
    <HintPopover
      text={text}
      trigger={
        <button
          type="button"
          title={text}
          aria-label={`${term} — ${a.full}`}
          className={cn("cursor-help underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring", className)}
          onClick={(e) => e.stopPropagation()}
        >
          {children ?? term}
        </button>
      }
    />
  );
}
