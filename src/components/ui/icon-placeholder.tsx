import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

/**
 * Shim cho registry shadcn.
 *
 * Registry phát ra <IconPlaceholder lucide="XIcon" tabler=... /> và CLI sẽ thay
 * bằng icon thật. Repo này lấy component trực tiếp từ registry (CLI bị chặn bởi
 * lỗi quyền thư mục Windows), nên map tay ở đây. Chỉ khai báo icon thật sự dùng
 * để giữ tree-shaking.
 */
const MAP = {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
} as const;

export type IconName = keyof typeof MAP;

export function IconPlaceholder({
  lucide,
  // Các bộ icon khác của registry — không dùng, nhận vào để không vỡ props.
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  ...props
}: LucideProps & {
  lucide: IconName;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
}) {
  const Icon = MAP[lucide] ?? InfoIcon;
  return <Icon aria-hidden {...props} />;
}
