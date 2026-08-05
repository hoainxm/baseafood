import { useState } from "react";
import {
  Button,
  CaiDatHienThi,
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
  homNay,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { Fish, Plus } from "lucide-react";

/**
 * Trang duyệt bộ giao diện + cấu hình hiển thị.
 *
 * Đưa tablet cho tổ trưởng ở xưởng bấm thử TRƯỚC khi nhân bản ra màn nghiệp vụ.
 * Sửa cỡ chữ / nhãn ở đây rẻ hơn sửa sau gấp nhiều lần.
 */

interface DongDemo {
  id: string;
  loai: string;
  daiLy: string;
  soLuongKg: number;
  donGia: number;
}

const DEMO: DongDemo[] = [
  {
    id: "1",
    loai: "Bạch tuộc 2 da",
    daiLy: "H.Phú",
    soLuongKg: 1250,
    donGia: 92000,
  },
  {
    id: "2",
    loai: "Mực ống 7cm",
    daiLy: "Tân Phước",
    soLuongKg: 430.5,
    donGia: 145000,
  },
  {
    id: "3",
    loai: "Cá nục",
    daiLy: "Bảy Lành",
    soLuongKg: 2010,
    donGia: 21500,
  },
];

const LOAI = [
  { value: "bt", label: "Bạch tuộc" },
  { value: "muc", label: "Mực" },
  { value: "ca", label: "Cá" },
  { value: "ghe", label: "Ghẹ" },
];

/** Danh sách dài để thử thanh cuộn của dropdown. */
const MAT_HANG_DAI: MucChon[] = Array.from({ length: 40 }, (_, i) => ({
  value: `mh-${i}`,
  label: `Mặt hàng mẫu số ${i + 1}`,
  phu: `Mã MH${String(i + 1).padStart(3, "0")}`,
}));

export default function KitPage() {
  const [loai, setLoai] = useState("bt");
  const [sl, setSl] = useState<number | null>(1250);
  const [daiLy, setDaiLy] = useState("");
  const [loi, setLoi] = useState<LoiNhap[]>([]);
  const [rows, setRows] = useState(DEMO);
  const [ngay, setNgay] = useState(homNay());
  const [tuNgay, setTuNgay] = useState(homNay());
  const [denNgay, setDenNgay] = useState(homNay());
  const [daiLyChon, setDaiLyChon] = useState("");
  const [matHangChon, setMatHangChon] = useState("");
  const [daiLyList, setDaiLyList] = useState<MucChon[]>([
    { value: "H.Phú", label: "H.Phú", phu: "0913 123 456" },
    { value: "Tân Phước", label: "Tân Phước" },
    { value: "Bảy Lành", label: "Bảy Lành" },
  ]);

  const cols: Cot<DongDemo>[] = [
    {
      key: "loai",
      header: "Loại nguyên liệu",
      chinh: true,
      render: (r) => r.loai,
      sapXep: (r) => r.loai,
    },
    {
      key: "daiLy",
      header: "Đại lý",
      render: (r) => r.daiLy,
      sapXep: (r) => r.daiLy,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => r.soLuongKg.toLocaleString("vi-VN"),
      sapXep: (r) => r.soLuongKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      so: true,
      render: (r) => r.donGia.toLocaleString("vi-VN"),
      sapXep: (r) => r.donGia,
    },
  ];

  const xoa = (r: DongDemo) => {
    const truoc = rows;
    setRows((v) => v.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa "${r.loai}"`, () => setRows(truoc));
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
        <CaiDatHienThi />
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
          <Button>Lưu</Button>
          <Button variant="outline">Quay lại</Button>
          <Button variant="secondary">Xem bảng</Button>
          <Button variant="destructive">Xóa dòng</Button>
          <Button variant="ghost">Bỏ qua</Button>
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
            error={daiLy.trim() === "x" ? "Tên đại lý quá ngắn" : undefined}
          >
            <Input
              value={daiLy}
              onChange={(e) => setDaiLy(e.target.value)}
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
          value={loai}
          onChange={setLoai}
          options={LOAI}
          cot={4}
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
              value={ngay}
              onChange={setNgay}
            />
          </div>
          <DateRangeField
            label="Khoảng ngày tiếp nhận"
            tuNgay={tuNgay}
            denNgay={denNgay}
            onChange={(tu, den) => {
              setTuNgay(tu);
              setDenNgay(den);
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
            value={daiLyChon}
            onChange={setDaiLyChon}
            options={daiLyList}
            onCreate={(ten) => {
              setDaiLyList((v) => [...v, { value: ten, label: ten }]);
              notify.daLuu(`Đã thêm đại lý "${ten}" vào danh mục`);
              return ten;
            }}
            hint="Thử gõ một tên chưa có, VD: Sáu Tèo."
          />
          <Combobox
            label="Mặt hàng (danh sách 40 mục)"
            value={matHangChon}
            onChange={setMatHangChon}
            options={MAT_HANG_DAI}
            hint="Kéo trong danh sách để thấy thanh cuộn."
          />
        </div>
      </Section>

      <Section
        title="7. Gộp lỗi đầu form"
        note="Nút Lưu không bao giờ mờ đi — bấm khi thiếu thì hiện hộp này"
      >
        <ErrorSummary loi={loi} />
        <Button
          className="mt-4"
          onClick={() =>
            setLoi(
              loi.length
                ? []
                : [
                    { truong: "Đại lý", thongBao: "Chưa nhập tên đại lý" },
                    { truong: "Số lượng", thongBao: "Phải lớn hơn 0" },
                  ]
            )
          }
        >
          {loi.length ? "Ẩn lỗi" : "Bấm lưu khi còn thiếu"}
        </Button>
      </Section>

      <Section
        title="8. Thanh ngữ cảnh"
        note="Luôn dính trên đầu: đang xem ngày nào, xưởng nào"
      >
        <ContextBar
          items={[
            { nhan: "Đang xem", giaTri: "05/08/2026" },
            { nhan: "Phân xưởng", giaTri: "Đông" },
            { nhan: "Đã nhập", giaTri: "3.690,5 kg", so: true },
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
          timKiem={(r) => `${r.loai} ${r.daiLy}`}
          actions={(r) => (
            <ConfirmDelete
              moTaBanGhi={`${r.loai} — ${r.soLuongKg.toLocaleString("vi-VN")} kg — đại lý ${r.daiLy}`}
              onConfirm={() => xoa(r)}
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
            onClick={() => notify.daLuu("Đã ghi 1.250 kg vào sổ", () => {})}
          >
            Bắn báo đã lưu
          </Button>
          <Button
            variant="outline"
            onClick={() => notify.loi("Mất kết nối, chưa lưu được")}
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
          tieuDe="Chưa có chuyến hàng nào hôm nay"
          moTa="Bấm nút dưới để ghi chuyến đầu tiên của ngày."
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
                tieuDe: "Ai giao hàng?",
                moTa: "Ghi tên đại lý theo đúng sổ tay.",
                noiDung: (
                  <Field label="Đại lý" required>
                    <Input placeholder="VD: H.Phú" />
                  </Field>
                ),
                kiemTra: () => [],
              },
              {
                tieuDe: "Hàng gì, bao nhiêu?",
                noiDung: (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <ChoiceGroup
                      label="Loài"
                      required
                      value={loai}
                      onChange={setLoai}
                      options={LOAI}
                      cot={2}
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
                kiemTra: () =>
                  sl && sl > 0
                    ? []
                    : [{ truong: "Số lượng", thongBao: "Phải lớn hơn 0" }],
              },
            ]}
            xemLai={
              <dl className="space-y-3 text-base">
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Loài</dt>
                  <dd className="font-semibold">
                    {LOAI.find((l) => l.value === loai)?.label}
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
            onSubmit={() => notify.daLuu("Đã ghi vào sổ", () => {})}
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
