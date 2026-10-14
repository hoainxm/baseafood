import { useState } from "react";
import {
  Button,
  DisplaySettingsPanel,
  Card,
  ChoiceGroup,
  Combobox,
  ConfirmDelete,
  ContextBar,
  DateField,
  DateRangeField,
  EmptyState,
  ErrorSummary,
  Field,
  Input,
  NumberField,
  RecordTable,
  StepForm,
  todayIso,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import { Fish, Lock, Pencil, Plus, Save, Trash2 } from "lucide-react";

/**
 * Trang duyệt bộ giao diện + cấu hình hiển thị.
 *
 * Đưa tablet cho tổ trưởng ở xưởng bấm thử TRƯỚC khi nhân bản ra màn nghiệp vụ.
 * Sửa cỡ chữ / nhãn ở đây rẻ hơn sửa sau gấp nhiều lần.
 */

interface DemoRow {
  id: string;
  materialType: string;
  supplierName: string;
  quantityKg: number;
  unitPrice: number;
}

const DEMO: DemoRow[] = [
  {
    id: "1",
    materialType: "Bạch tuộc 2 da",
    supplierName: "H.Phú",
    quantityKg: 1250,
    unitPrice: 92000,
  },
  {
    id: "2",
    materialType: "Mực ống 7cm",
    supplierName: "Tân Phước",
    quantityKg: 430.5,
    unitPrice: 145000,
  },
  {
    id: "3",
    materialType: "Cá nục",
    supplierName: "Bảy Lành",
    quantityKg: 2010,
    unitPrice: 21500,
  },
];

const SPECIES_OPTIONS = [
  { value: "bt", label: "Bạch tuộc" },
  { value: "muc", label: "Mực" },
  { value: "ca", label: "Cá" },
  { value: "ghe", label: "Ghẹ" },
];

/** Danh sách dài để thử thanh cuộn của dropdown. */
const LONG_PRODUCT_LIST: ComboboxOption[] = Array.from({ length: 40 }, (_, i) => ({
  value: `mh-${i}`,
  label: `Mặt hàng mẫu số ${i + 1}`,
  subLabel: `Mã MH${String(i + 1).padStart(3, "0")}`,
}));

export default function KitPage() {
  const [kind, setKind] = useState("bt");
  const [sl, setSl] = useState<number | null>(1250);
  const [supplier, setSupplier] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [rows, setRows] = useState(DEMO);
  const [date, setDate] = useState(todayIso());
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<ComboboxOption[]>([
    { value: "H.Phú", label: "H.Phú", subLabel: "0913 123 456" },
    { value: "Tân Phước", label: "Tân Phước" },
    { value: "Bảy Lành", label: "Bảy Lành" },
  ]);

  const cols: RecordTableColumn<DemoRow>[] = [
    {
      key: "loai",
      header: "Loại nguyên liệu",
      primary: true,
      render: (r) => r.materialType,
      getSortValue: (r) => r.materialType,
    },
    {
      key: "daiLy",
      header: "Đại lý",
      render: (r) => r.supplierName,
      getSortValue: (r) => r.supplierName,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      numeric: true,
      render: (r) => r.quantityKg.toLocaleString("vi-VN"),
      getSortValue: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      numeric: true,
      render: (r) => r.unitPrice.toLocaleString("vi-VN"),
      getSortValue: (r) => r.unitPrice,
    },
  ];

  const remove = (r: DemoRow) => {
    const prevRows = rows;
    setRows((v) => v.filter((x) => x.id !== r.id));
    notify.deleted(`Đã xóa "${r.materialType}"`, () => setRows(prevRows));
  };

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-semibold text-foreground">
          Bộ giao diện Baseafood
        </h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Chỉnh cấu hình hiển thị ở mục 1, phần còn lại là mẫu các thành phần
          dùng trong toàn hệ thống. Chữ nền 18px, ô nhập 48px, mọi cặp màu đạt
          tương phản WCAG 2.2 AA.
        </p>
      </header>

      <Section
        title="1. Cài đặt hiển thị"
        note="Áp ngay cho toàn hệ thống và nhớ lại ở lần mở sau"
      >
        <DisplaySettingsPanel />
      </Section>

      <Section
        title="2. Nút bấm"
        note="Vùng chạm: thường 48px · chính 56px · nhỏ nhất 44px"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">
            <Plus />
            Ghi vào sổ
          </Button>
          <Button variant="outline">Quay lại</Button>
          <Button variant="secondary">Xem bảng</Button>
          <Button variant="ghost">Bỏ qua</Button>
        </div>
        {/* Màu theo CHỨC NĂNG (README § 8b) — chọn theo ý nghĩa nút, không chọn theo màu */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="save">
            <Save />
            Lưu
          </Button>
          <Button variant="edit">
            <Pencil />
            Sửa
          </Button>
          <Button variant="danger">
            <Trash2 />
            Xóa
          </Button>
          <Button variant="destructive">
            <Trash2 />
            Xóa dòng (xác nhận)
          </Button>
          <Button variant="lock">
            <Lock />
            Chốt ngày
          </Button>
        </div>
      </Section>

      <Section
        title="3. Ô nhập"
        note="Nhãn luôn ở trên ô · ô bắt buộc ghi chữ, không dùng dấu *"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="Đại lý"
            required
            hint="Tên đại lý giao chuyến hàng này"
            error={supplier.trim() === "x" ? "Tên đại lý quá ngắn" : undefined}
          >
            <Input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="VD: H.Phú"
            />
          </Field>

          <NumberField
            label="Số lượng"
            required
            unit="kg"
            value={sl}
            onChange={setSl}
            hint="Rời ô sẽ tự thêm dấu chấm phần nghìn"
          />

          <NumberField
            label="Số thùng"
            unit="thùng"
            step={1}
            value={12}
            onChange={() => {}}
            hint="Có nút − / + cho ai không quen gõ số"
          />
        </div>
      </Section>

      <Section
        title="4. Chọn 1 trong N"
        note="≤ 6 lựa chọn → nút to, thấy hết. Nhiều hơn tự chuyển sang danh sách có ô tìm."
      >
        <ChoiceGroup
          label="Loài"
          required
          value={kind}
          onChange={setKind}
          options={SPECIES_OPTIONS}
          columns={4}
        />
      </Section>

      <Section
        title="5. Chọn ngày"
        note="Một ngày, hoặc khoảng ngày với hai ô riêng Từ / Đến"
      >
        <div className="space-y-6">
          <div className="sm:max-w-md">
            <DateField
              label="Ngày nhập hàng"
              required
              value={date}
              onChange={setDate}
            />
          </div>
          <DateRangeField
            label="Khoảng ngày tiếp nhận"
            startDate={fromDate}
            endDate={toDate}
            onChange={(fromDate, toDate) => {
              setFromDate(fromDate);
              setToDate(toDate);
            }}
          />
        </div>
      </Section>

      <Section
        title="6. Chọn từ danh mục, thiếu thì tạo ngay"
        note="Gõ để tìm; chưa có thì thêm mới ngay trong danh sách. Danh sách dài thì cuộn được."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Combobox
            label="Đại lý giao hàng"
            required
            value={selectedSupplier}
            onChange={setSelectedSupplier}
            options={supplierOptions}
            onCreate={(name) => {
              setSupplierOptions((v) => [...v, { value: name, label: name }]);
              notify.saved(`Đã thêm đại lý "${name}" vào danh mục`);
              return name;
            }}
            hint="Thử gõ một tên chưa có, VD: Sáu Tèo."
          />
          <Combobox
            label="Mặt hàng (danh sách 40 mục)"
            value={selectedProduct}
            onChange={setSelectedProduct}
            options={LONG_PRODUCT_LIST}
            hint="Kéo trong danh sách để thấy thanh cuộn."
          />
        </div>
      </Section>

      <Section
        title="7. Gộp lỗi đầu form"
        note="Nút Lưu không bao giờ mờ đi — bấm khi thiếu thì hiện hộp này"
      >
        <ErrorSummary errors={errors} />
        <Button
          className="mt-4"
          onClick={() =>
            setErrors(
              errors.length
                ? []
                : [
                    { field: "Đại lý", message: "Chưa nhập tên đại lý" },
                    { field: "Số lượng", message: "Phải lớn hơn 0" },
                  ]
            )
          }
        >
          {errors.length ? "Ẩn lỗi" : "Bấm lưu khi còn thiếu"}
        </Button>
      </Section>

      <Section
        title="8. Thanh ngữ cảnh"
        note="Luôn dính trên đầu: đang xem ngày nào, xưởng nào"
      >
        <ContextBar
          items={[
            { label: "Đang xem", value: "05/08/2026" },
            { label: "Phân xưởng", value: "Đông" },
            { label: "Đã nhập", value: "3.690,5 kg", numeric: true },
          ]}
        />
      </Section>

      <Section
        title="9. Bảng dữ liệu"
        note="Bấm tiêu đề cột để sắp xếp · có ô tìm · điện thoại tự đổi sang thẻ"
      >
        <RecordTable
          columns={cols}
          rows={rows}
          getKey={(r) => r.id}
          getSearchText={(r) => `${r.materialType} ${r.supplierName}`}
          actions={(r) => (
            <ConfirmDelete
              recordDescription={`${r.materialType} — ${r.quantityKg.toLocaleString("vi-VN")} kg — đại lý ${r.supplierName}`}
              onConfirm={() => remove(r)}
            />
          )}
          emptyText="Chưa có dòng nhập nào cho ngày này."
        />
        {rows.length < DEMO.length && (
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setRows(DEMO)}
          >
            Nạp lại dữ liệu mẫu
          </Button>
        )}
      </Section>

      <Section
        title="10. Phản hồi sau thao tác"
        note="Hiện 8 giây, luôn kèm nút Hoàn tác"
      >
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => notify.saved("Đã ghi 1.250 kg vào sổ", () => {})}
          >
            Bắn báo đã lưu
          </Button>
          <Button
            variant="outline"
            onClick={() => notify.error("Mất kết nối, chưa lưu được")}
          >
            Bắn báo lỗi
          </Button>
        </div>
      </Section>

      <Section
        title="11. Màn trống"
        note="Phải nói việc tiếp theo, không chỉ báo 'không có dữ liệu'"
      >
        <EmptyState
          icon={Fish}
          title="Chưa có chuyến hàng nào hôm nay"
          description="Bấm nút dưới để ghi chuyến đầu tiên của ngày."
          action={
            <Button size="lg">
              <Plus />
              Ghi chuyến hàng
            </Button>
          }
        />
      </Section>

      <Section
        title="12. Form chia bước"
        note="Form quá 5 ô mà ít khi nhập thì chia bước. Bước cuối luôn là xem lại."
      >
        <Card className="p-6">
          <StepForm
            steps={[
              {
                title: "Ai giao hàng?",
                description: "Ghi tên đại lý theo đúng sổ tay.",
                content: (
                  <Field label="Đại lý" required>
                    <Input placeholder="VD: H.Phú" />
                  </Field>
                ),
                validate: () => [],
              },
              {
                title: "Hàng gì, bao nhiêu?",
                content: (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <ChoiceGroup
                      label="Loài"
                      required
                      value={kind}
                      onChange={setKind}
                      options={SPECIES_OPTIONS}
                      columns={2}
                    />
                    <NumberField
                      label="Số lượng"
                      required
                      unit="kg"
                      value={sl}
                      onChange={setSl}
                    />
                  </div>
                ),
                validate: () =>
                  sl && sl > 0
                    ? []
                    : [{ field: "Số lượng", message: "Phải lớn hơn 0" }],
              },
            ]}
            review={
              <dl className="space-y-3 text-base">
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Loài</dt>
                  <dd className="font-semibold">
                    {SPECIES_OPTIONS.find((l) => l.value === kind)?.label}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Số lượng</dt>
                  <dd className="tnum font-semibold">
                    {(sl ?? 0).toLocaleString("vi-VN")} kg
                  </dd>
                </div>
              </dl>
            }
            onSubmit={() => notify.saved("Đã ghi vào sổ", () => {})}
          />
        </Card>
      </Section>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        {note && <p className="mt-1 text-base text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}
