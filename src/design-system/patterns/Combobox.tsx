import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InfoTip } from "./InfoTip";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

export interface MucChon {
  value: string;
  label: string;
  /** Dòng phụ: mã, quy cách, ghi chú… */
  phu?: string;
}

/**
 * Combobox — chọn từ danh mục có sẵn, TẠO MỚI ngay tại chỗ nếu chưa có.
 *
 * Thay cho ô nhập tự do (loại nguyên liệu, đại lý, mặt hàng, khách hàng).
 * Nhập tự do là nguồn sai số liệu lớn nhất: cùng một đại lý gõ "H.Phú",
 * "H Phu", "Hphú" → ba dòng khác nhau khi tổng hợp cuối kỳ.
 *
 * Luật:
 *  - Nút luôn ghi rõ cách dùng ("Gõ để tìm hoặc thêm mới"), không bắt đoán.
 *  - Danh sách CÓ THANH CUỘN NHÌN THẤY ĐƯỢC, dòng cao 48px.
 *  - Không tìm thấy → nút "Thêm mới «...»" ngay trong danh sách.
 *  - Đã chọn thì có dấu ✓ và nút xóa lựa chọn (không phải xóa bản ghi).
 */
export function Combobox({
  label,
  value,
  onChange,
  options,
  onCreate,
  required,
  hint,
  info,
  error,
  placeholder,
  emptyText = "Không tìm thấy mục nào khớp.",
  choPhepXoa = true,
  anNhanBatBuoc = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: MucChon[];
  /** Có hàm này → cho phép tạo mới tại chỗ. Trả về value của mục vừa tạo. */
  onCreate?: (ten: string) => string;
  required?: boolean;
  hint?: string;
  /** Câu hướng dẫn dài → nút ⓘ cạnh nhãn (không đẩy chiều cao ô, canh đều lưới). */
  info?: React.ReactNode;
  error?: string;
  placeholder?: string;
  emptyText?: string;
  /** Cho phép bỏ lựa chọn về rỗng. Tắt khi ô bắt buộc phải có giá trị. */
  choPhepXoa?: boolean;
  /** Ẩn nhãn "Bắt buộc / (không bắt buộc)" — dùng khi đây là BỘ LỌC, không phải ô nhập. */
  anNhanBatBuoc?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [tim, setTim] = React.useState("");
  const id = React.useId();

  const daChon = options.find((o) => o.value === value);

  const timSach = tim.trim();
  const trungTen = options.some(
    (o) => o.label.trim().toLowerCase() === timSach.toLowerCase()
  );
  const choPhepTao = Boolean(onCreate) && timSach.length > 0 && !trungTen;

  const cachDung = onCreate
    ? "Gõ để tìm — chưa có thì thêm mới ngay"
    : "Gõ để tìm trong danh sách";

  const taoMoi = () => {
    if (!onCreate) return;
    const v = onCreate(timSach);
    onChange(v);
    setTim("");
    setOpen(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {anNhanBatBuoc ? null : required ? (
          <span className="rounded bg-secondary px-2 py-0.5 text-sm font-semibold text-secondary-foreground">
            Bắt buộc
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">(không bắt buộc)</span>
        )}
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </div>
      {hint && <p className="text-base text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-start gap-2 text-base font-semibold text-destructive">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              data-slot="combobox-trigger"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={error ? true : undefined}
              className="h-12 min-w-0 flex-1 justify-between border-2 px-3.5 text-base font-medium"
            >
              <span className={cn("truncate", !daChon && "text-muted-foreground")}>
                {daChon?.label ?? placeholder ?? cachDung}
              </span>
              <ChevronsUpDown className="shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-(--radix-popover-trigger-width) min-w-72 gap-0 p-0"
            align="start"
          >
            <Command shouldFilter>
              <CommandInput
                placeholder={
                  onCreate ? "Gõ tên để tìm hoặc thêm mới…" : "Gõ để tìm…"
                }
                value={tim}
                onValueChange={setTim}
              />

              <p className="border-b border-border px-3 py-2 text-sm text-muted-foreground">
                {options.length} mục trong danh mục
                {onCreate && " · gõ tên chưa có để thêm mới"}
              </p>

              <CommandList>
                <CommandEmpty>
                  {choPhepTao ? (
                    <button
                      type="button"
                      onClick={taoMoi}
                      className="mx-auto flex min-h-12 items-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground"
                    >
                      <Plus className="size-5" />
                      Thêm mới “{timSach}”
                    </button>
                  ) : (
                    emptyText
                  )}
                </CommandEmpty>

                <CommandGroup>
                  {options.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={`${o.label} ${o.phu ?? ""}`}
                      onSelect={() => {
                        onChange(o.value);
                        setTim("");
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "size-5 shrink-0 text-primary",
                          o.value === value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1">
                        {o.label}
                        {o.phu && (
                          <span className="block text-sm text-muted-foreground">
                            {o.phu}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {/* Vẫn cho tạo mới khi danh sách có kết quả gần đúng nhưng không trùng tên */}
                {choPhepTao && (
                  <CommandGroup>
                    <CommandItem value={`__tao__${timSach}`} onSelect={taoMoi}>
                      <Plus className="size-5 shrink-0 text-primary" />
                      <span className="font-semibold text-primary">
                        Thêm mới “{timSach}”
                      </span>
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {choPhepXoa && daChon && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Bỏ chọn ${label}`}
            title="Bỏ chọn"
            onClick={() => onChange("")}
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
