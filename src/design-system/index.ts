/**
 * Baseafood Senior Kit — cửa duy nhất mà màn nghiệp vụ được import.
 *
 * Màn trong src/features/** CHỈ ĐƯỢC import từ "@/design-system".
 * Cấm import thẳng "@/components/ui/*" và cấm viết class cỡ chữ / mã màu tay —
 * đó là cách duy nhất giữ giao diện đồng nhất khi thêm màn mới về sau.
 * Quy tắc đầy đủ: xem src/design-system/README.md
 */

export { Field, RequiredLegend } from "./patterns/Field";
export { useFieldInput, type FieldInputProps } from "./patterns/fieldInput";
export { NumberField } from "./patterns/NumberField";
export { NumberInput } from "./patterns/NumberInput";
export { useNumberInput } from "./patterns/useNumberInput";
export { parseVnNumber, formatNumber, parseNumberOrExpression } from "./patterns/numberExpression";
export { ChoiceGroup, type ChoiceOption } from "./patterns/ChoiceGroup";
export { Combobox, type ComboboxOption } from "./patterns/Combobox";
export {
  DateField,
  DateRangeField,
  isoToDate,
  dateToIso,
  formatWeekdayDate,
  getDatesInRange,
  addDays,
  todayIso,
} from "./patterns/DateField";
export { CatalogCrud, CatalogEditDialog, type CatalogField } from "./patterns/CatalogCrudModal";
export { Logo } from "./patterns/Logo";
export { RecordTable, type RecordTableColumn } from "./patterns/RecordTable";
export {
  EditableGrid,
  type GridColumn,
  type GridRow,
  type GridCellKind,
} from "./patterns/EditableGrid";
export { ConfirmDelete } from "./patterns/ConfirmDelete";
export { ConfirmAction } from "./patterns/ConfirmAction";
export { StepForm, type FormStep } from "./patterns/StepForm";
export { ContextBar, type ContextBarItem } from "./patterns/ContextBar";
export { ErrorSummary, type FieldError } from "./patterns/ErrorSummary";
export { EmptyState } from "./patterns/EmptyState";
export { ReadOnlyBadge } from "./patterns/ReadOnlyBadge";
export { InfoTip } from "./patterns/InfoTip";
export {
  FontSizeQuickPicker,
  DisplaySettingsPanel,
  applyDisplaySettings,
} from "./patterns/DisplaySettings";
export { DataSyncStatus, DataSyncStatusButton } from "./patterns/DataStatusBadge";
export { DisplaySettingsButton, DisplaySettingsDialog } from "./patterns/ThemeToggleButton";
export { GuideButton } from "./patterns/GuideButton";
export { FormDialog, CloseButton } from "./patterns/FormDialog";
export { SummaryTable, type SummaryTableColumn, type TableSelection } from "./patterns/SummaryTable";
export { RowMarkActions, RowMarkToolbar } from "./patterns/RowMarkToolbar";
export { HorizontalScroll } from "./patterns/HorizontalScroll";
export { useTopScrollbar } from "./patterns/topScrollbar";
export {
  RowMarkContext,
  useRowMarkTools,
  useRowSelection,
  MARK_COLORS,
  MARK_SHADES,
  MARK_COLOR_GRID,
  getMarkColorName,
  type MarkColor,
  type MarkStyle,
  type MarkStylePatch,
  type RowMarkSource,
  type RowMarkTools,
} from "./patterns/rowMarkSource";
export { HoverHint, HINT_DELAY_MS } from "./patterns/HoverHint";
export { useMediaQuery, MEDIA_NARROW_SIDEBAR } from "./patterns/mediaQuery";
export { StatCardGrid, type StatCardData } from "./patterns/StatCardGrid";
export { BarChart, type BarChartItem } from "./patterns/BarChart";
export { Tag, channelTone, toneForMaterialGroup, toneForWorkshop, toneByName, type TagVariant, type CategoryTone } from "./patterns/Tag";
export { VerticalBarChart, type VerticalBarChartItem } from "./patterns/VerticalBarChart";
export { ProportionBar, type ProportionSegment } from "./patterns/ProportionBar";
export { PipelineStages, type PipelineStage } from "./patterns/PipelineStages";
export { TimeSeriesChart, type ChartSeries, type SeriesColor } from "./patterns/TimeSeriesChart";
export { PrintSheet, LabelPrintSheet, PrintTh, PrintTd, type PrintLabel } from "./patterns/PrintSheet";
export { ThinkingDots, ProcessingState, TableSkeleton } from "./patterns/Loading";
export { notify } from "./patterns/notify";

/* Primitive được phép dùng lại nguyên bản (đã đè size trong components/ui). */
export { Button } from "@/components/ui/button";
export { Skeleton } from "@/components/ui/skeleton";
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
