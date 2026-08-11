/**
 * Baseafood Senior Kit — cửa duy nhất mà màn nghiệp vụ được import.
 *
 * Màn trong src/features/** CHỈ ĐƯỢC import từ "@/design-system".
 * Cấm import thẳng "@/components/ui/*" và cấm viết class cỡ chữ / mã màu tay —
 * đó là cách duy nhất giữ giao diện đồng nhất khi thêm màn mới về sau.
 * Quy tắc đầy đủ: xem src/design-system/README.md
 */

export { Field } from "./patterns/Field";
export { NumberField, parseSo, dinhDangSo } from "./patterns/NumberField";
export { ChoiceGroup, type LuaChon } from "./patterns/ChoiceGroup";
export { Combobox, type MucChon } from "./patterns/Combobox";
export {
  DateField,
  DateRangeField,
  isoToDate,
  dateToIso,
  viNgay,
  ngayTrongKhoang,
  congNgay,
  homNay,
} from "./patterns/DateField";
export { DanhMucCrud, type TruongDanhMuc } from "./patterns/CatalogCrudModal";
export { Logo } from "./patterns/Logo";
export { RecordTable, type Cot } from "./patterns/RecordTable";
export { ConfirmDelete } from "./patterns/ConfirmDelete";
export { StepForm, type BuocNhap } from "./patterns/StepForm";
export { ContextBar, type MucNguCanh } from "./patterns/ContextBar";
export { ErrorSummary, type LoiNhap } from "./patterns/ErrorSummary";
export { EmptyState } from "./patterns/EmptyState";
export { InfoTip } from "./patterns/InfoTip";
export {
  CoChuNhanh,
  CaiDatHienThi,
  apDungCaiDatHienThi,
} from "./patterns/DisplaySettings";
export { TrangThaiDuLieu, NutTrangThai } from "./patterns/DataStatusBadge";
export { NutGiaoDien } from "./patterns/ThemeToggleButton";
export { NutHuongDan } from "./patterns/GuideButton";
export { FormDialog, NutDong } from "./patterns/FormDialog";
export { BangTong, type CotTong } from "./patterns/SummaryTable";
export { ThongKe, type TheThongTin } from "./patterns/ThongKe";
export { BieuDoCot, type CotBieuDo } from "./patterns/BarChart";
export { StatusChip, type TrangThaiSX } from "./patterns/StatusChip";
export { DuLieuMau } from "./patterns/MockPatternData";
export { BieuDoCotDoc, type CotBieuDoDoc } from "./patterns/VerticalBarChart";
export { notify } from "./patterns/notify";

/* Primitive được phép dùng lại nguyên bản (đã đè size trong components/ui). */
export { Button } from "@/components/ui/button";
export { Input } from "@/components/ui/input";
export { Textarea } from "@/components/ui/textarea";
export { Label } from "@/components/ui/label";
export { Badge } from "@/components/ui/badge";
export { Separator } from "@/components/ui/separator";
export { Toaster } from "@/components/ui/sonner";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
