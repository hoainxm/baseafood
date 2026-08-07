import { useState } from "react";
import type { NguoiDung, VaiTro } from "@/types";
import { VAI_TRO } from "@/types";
import { useNguoiDung } from "@/lib/danhMuc";
import { hoTenToUsername, usernameToEmail } from "@/lib/username";
import {
  Badge,
  Button,
  Card,
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  RecordTable,
  notify,
  type Cot,
} from "@/design-system";
import { Pencil, Users } from "lucide-react";

const nhanVaiTro = (v: VaiTro) =>
  VAI_TRO.find((x) => x.value === v)?.label ?? "Chưa gán";

/** Màn quản lý người dùng — CHỈ admin. Tài khoản đăng nhập tạo ở Supabase
 * Dashboard; ở đây admin gán họ tên + vai trò cho hồ sơ đã đăng nhập. */
export default function QuanLyNguoiDungScreen() {
  const [ds, ghi] = useNguoiDung();
  const [dang, setDang] = useState<NguoiDung | null>(null);

  // Công cụ sinh username từ họ tên (để biết đặt email gì khi tạo TK ở Dashboard)
  const [hoTenThu, setHoTenThu] = useState("");
  const usernameThu = hoTenToUsername(hoTenThu);

  const luu = () => {
    if (!dang) return;
    ghi(ds.map((n) => (n.id === dang.id ? dang : n)));
    notify.daLuu(`Đã lưu người dùng ${dang.username || dang.id}`);
    setDang(null);
  };

  const cols: Cot<NguoiDung>[] = [
    {
      key: "username",
      header: "Tên đăng nhập",
      chinh: true,
      render: (r) => r.username || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.username,
    },
    {
      key: "hoTen",
      header: "Họ tên",
      render: (r) =>
        r.hoTen || <span className="text-muted-foreground">Chưa đặt</span>,
      sapXep: (r) => r.hoTen,
    },
    {
      key: "vaiTro",
      header: "Vai trò",
      render: (r) =>
        r.vaiTro ? (
          <Badge variant={r.vaiTro === "admin" ? "default" : "secondary"}>
            {nhanVaiTro(r.vaiTro)}
          </Badge>
        ) : (
          <Badge variant="outline">Chưa gán</Badge>
        ),
      sapXep: (r) => r.vaiTro,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Người dùng</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Gán vai trò (và sửa họ tên) cho tài khoản. Người dùng tự đăng ký từ màn
          đăng nhập; hồ sơ hiện ở đây với vai trò trống tới khi bạn gán.
        </p>
      </div>

      {/* Công cụ tham chiếu: họ tên → tên đăng nhập (khớp quy tắc màn đăng ký) */}
      <Card className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">Xem tên đăng nhập từ họ tên</h2>
        <Field
          label="Họ tên"
          hint="Quy tắc: chữ đầu mỗi từ + từ cuối đầy đủ (bỏ dấu). Màn đăng ký tự gợi ý theo quy tắc này."
        >
          <Input
            value={hoTenThu}
            onChange={(e) => setHoTenThu(e.target.value)}
            placeholder="VD: Phan Nguyễn Hoài Nam"
          />
        </Field>
        {usernameThu && (
          <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-muted px-4 py-3 text-base">
            <span>
              Tên đăng nhập:{" "}
              <span className="font-semibold text-foreground">
                {usernameThu}
              </span>
            </span>
            <span>
              Email tổng hợp (dùng ngầm):{" "}
              <span className="font-semibold text-foreground">
                {usernameToEmail(usernameThu)}
              </span>
            </span>
          </div>
        )}
      </Card>

      {ds.length === 0 ? (
        <EmptyState
          icon={Users}
          tieuDe="Chưa có người dùng nào"
          moTa="Người dùng tự đăng ký ở màn đăng nhập (Chưa có tài khoản? Đăng ký). Đăng ký xong hồ sơ hiện ở đây để bạn gán vai trò."
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={ds}
          getKey={(r) => r.id}
          timKiem={(r) => `${r.username} ${r.hoTen} ${nhanVaiTro(r.vaiTro)}`}
          nhanTimKiem="Tìm theo tên đăng nhập / họ tên…"
          actions={(r) => (
            <Button variant="outline" size="sm" onClick={() => setDang({ ...r })}>
              <Pencil />
              Sửa
            </Button>
          )}
        />
      )}

      <Dialog
        open={dang !== null}
        onOpenChange={(o) => {
          if (!o) setDang(null);
        }}
      >
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Sửa người dùng {dang?.username}
            </DialogTitle>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <Field label="Họ tên">
                <Input
                  value={dang.hoTen}
                  onChange={(e) =>
                    setDang((d) => (d ? { ...d, hoTen: e.target.value } : d))
                  }
                  placeholder="Họ tên đầy đủ"
                />
              </Field>
              <Combobox
                label="Vai trò"
                choPhepXoa={false}
                value={dang.vaiTro}
                onChange={(v) =>
                  setDang((d) => (d ? { ...d, vaiTro: v as VaiTro } : d))
                }
                options={[
                  { value: "", label: "Chưa gán" },
                  ...VAI_TRO.map((x) => ({ value: x.value, label: x.label })),
                ]}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDang(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luu}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
