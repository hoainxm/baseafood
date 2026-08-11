// ============================================================
// Tên file cũ: src/features/users/QuanLyNguoiDung.tsx
// Tên tiếng Việt: Màn hình Quản lý Người dùng & Phân quyền Admin
// Description: User Accounts & Access Control Management Screen
// ============================================================
import { useState } from "react";
import type { UserProfile, Role } from "@/types";
import { ROLES, roleLabel, rolesList } from "@/types";
import { useUserProfiles } from "@/lib/catalogRepo";
import { hoTenToUsername } from "@/lib/username";
import type { KetQuaDangNhap } from "@/lib/auth";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  Field,
  Input,
  RecordTable,
  notify,
  type Cot,
  type LoiNhap,
} from "@/design-system";
import { Check, Pencil, Plus, Users } from "lucide-react";

/** Chọn NHIỀU vai trò (chip bật/tắt). Người 45–60t: chip to, bấm là xong. */
function ChonVaiTro({
  chon,
  onDoi,
}: {
  chon: Role[];
  onDoi: (v: Role[]) => void;
}) {
  const bat = (v: Role) =>
    onDoi(chon.includes(v) ? chon.filter((x) => x !== v) : [...chon, v]);
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((r) => {
        const dangChon = chon.includes(r.value);
        return (
          <Button
            key={r.value}
            type="button"
            variant={dangChon ? "default" : "outline"}
            size="lg"
            onClick={() => bat(r.value)}
          >
            {dangChon && <Check className="size-4" />}
            {r.label}
          </Button>
        );
      })}
    </div>
  );
}

interface TaoMoi {
  fullName: string;
  username: string;
  usernameTuSua: boolean;
  matKhau: string;
  roles: Role[];
}
const TAO_RONG: TaoMoi = {
  fullName: "",
  username: "",
  usernameTuSua: false,
  matKhau: "",
  roles: [],
};

/** Màn quản lý người dùng — CHỈ admin. Đăng ký KHÔNG mở tự do: admin tạo tài
 * khoản ngay tại đây, và gán họ tên + vai trò. */
export default function QuanLyNguoiDungScreen({
  taoTaiKhoan,
}: {
  taoTaiKhoan: (
    fullName: string,
    username: string,
    matKhau: string,
    roles: Role[]
  ) => Promise<KetQuaDangNhap>;
}) {
  const [ds, ghi] = useUserProfiles();
  const [dang, setDang] = useState<UserProfile | null>(null);

  const [tao, setTao] = useState<TaoMoi | null>(null);
  const [loiTao, setLoiTao] = useState<LoiNhap[]>([]);
  const [dangTao, setDangTao] = useState(false);

  const luu = () => {
    if (!dang) return;
    ghi(ds.map((n) => (n.id === dang.id ? dang : n)));
    notify.daLuu(`Đã lưu người dùng ${dang.username || dang.id}`);
    setDang(null);
  };

  const doiHoTenTao = (v: string) =>
    setTao((t) =>
      t
        ? { ...t, fullName: v, username: t.usernameTuSua ? t.username : hoTenToUsername(v) }
        : t
    );

  const luuTao = async () => {
    if (!tao) return;
    const ls: LoiNhap[] = [];
    if (!tao.fullName.trim()) ls.push({ truong: "Họ tên", thongBao: "Chưa nhập họ tên" });
    if (!tao.username.trim())
      ls.push({ truong: "Tên đăng nhập", thongBao: "Chưa nhập tên đăng nhập" });
    if (tao.matKhau.length < 6)
      ls.push({ truong: "Mật khẩu", thongBao: "Tối thiểu 6 ký tự" });
    setLoiTao(ls);
    if (ls.length > 0) return;

    setDangTao(true);
    const kq = await taoTaiKhoan(
      tao.fullName,
      tao.username,
      tao.matKhau,
      tao.roles
    );
    setDangTao(false);
    if (!kq.ok) {
      setLoiTao([{ truong: "Tạo tài khoản", thongBao: kq.loi ?? "Thất bại" }]);
      return;
    }
    if (kq.nguoiDung) ghi([...ds, kq.nguoiDung]);
    notify.daLuu(`Đã tạo tài khoản ${tao.username}`);
    setTao(null);
    setLoiTao([]);
  };

  const cols: Cot<UserProfile>[] = [
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
        r.fullName || <span className="text-muted-foreground">Chưa đặt</span>,
      sapXep: (r) => r.fullName,
    },
    {
      key: "vaiTro",
      header: "Vai trò",
      render: (r) => {
        const vt = rolesList(r.roles);
        return vt.length ? (
          <span className="flex flex-wrap gap-1">
            {vt.map((v) => (
              <Badge key={v} variant={v === "admin" ? "default" : "secondary"}>
                {roleLabel([v])}
              </Badge>
            ))}
          </span>
        ) : (
          <Badge variant="outline">Chưa gán</Badge>
        );
      },
      sapXep: (r) => roleLabel(r.roles),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Người dùng</h1>
        </div>
        <Button
          size="lg"
          onClick={() => {
            setTao({ ...TAO_RONG });
            setLoiTao([]);
          }}
        >
          <Plus />
          Tạo tài khoản
        </Button>
      </div>

      {ds.length === 0 ? (
        <EmptyState
          icon={Users}
          tieuDe="Chưa có người dùng nào"
          moTa="Bấm “Tạo tài khoản” để thêm người dùng đầu tiên, rồi gán vai trò."
          action={
            <Button
              size="lg"
              onClick={() => {
                setTao({ ...TAO_RONG });
                setLoiTao([]);
              }}
            >
              <Plus />
              Tạo tài khoản
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={ds}
          getKey={(r) => r.id}
          timKiem={(r) => `${r.username} ${r.fullName} ${roleLabel(r.roles)}`}
          nhanTimKiem="Tìm theo tên đăng nhập / họ tên…"
          actions={(r) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDang({ ...r, roles: rolesList(r.roles) })}
            >
              <Pencil />
              Sửa
            </Button>
          )}
        />
      )}

      {/* Tạo tài khoản (admin) */}
      <Dialog
        open={tao !== null}
        onOpenChange={(o) => {
          if (!o) setTao(null);
        }}
      >
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tạo tài khoản</DialogTitle>
          </DialogHeader>

          {tao && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loiTao} />
              <Field label="Họ tên" required>
                <Input
                  value={tao.fullName}
                  onChange={(e) => doiHoTenTao(e.target.value)}
                  autoFocus
                  placeholder="VD: Nguyễn Văn A"
                />
              </Field>
              <Field
                label="Tên đăng nhập"
                required
                hint="Gợi ý từ họ tên — sửa được. Người dùng dùng tên này để đăng nhập."
              >
                <Input
                  value={tao.username}
                  onChange={(e) =>
                    setTao((t) =>
                      t ? { ...t, username: e.target.value, usernameTuSua: true } : t
                    )
                  }
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Tên đăng nhập"
                />
              </Field>
              <Field label="Mật khẩu" required hint="Tối thiểu 6 ký tự.">
                <Input
                  type="password"
                  value={tao.matKhau}
                  onChange={(e) =>
                    setTao((t) => (t ? { ...t, matKhau: e.target.value } : t))
                  }
                  placeholder="Mật khẩu"
                />
              </Field>
              <Field
                label="Vai trò"
                hint="Chọn một hoặc nhiều. VD Phó giám đốc kiêm Quản đốc xưởng Đông = bấm cả hai. Bỏ trống cũng được, gán sau."
              >
                <ChonVaiTro
                  chon={tao.roles}
                  onDoi={(v) => setTao((t) => (t ? { ...t, roles: v } : t))}
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setTao(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luuTao} disabled={dangTao}>
              {dangTao ? "Đang tạo…" : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sửa họ tên + vai trò */}
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
                  value={dang.fullName}
                  onChange={(e) =>
                    setDang((d) => (d ? { ...d, fullName: e.target.value } : d))
                  }
                  placeholder="Họ tên đầy đủ"
                />
              </Field>
              <Field
                label="Vai trò"
                hint="Chọn một hoặc nhiều. Bấm lại để bỏ. Bỏ hết = Chưa gán."
              >
                <ChonVaiTro
                  chon={dang.roles}
                  onDoi={(v) => setDang((d) => (d ? { ...d, roles: v } : d))}
                />
              </Field>
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
