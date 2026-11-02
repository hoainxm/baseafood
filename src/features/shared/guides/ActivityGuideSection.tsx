// ============================================================
// Tên file: src/features/shared/guides/ActivityGuideSection.tsx
// Tên tiếng Việt: Mục "Nhật ký thao tác" trong hộp "?" — dùng chung các trang có khối nhật ký (ba-spec 56)
// ============================================================
import { GuideList, GuideSection } from "./parts";

export function ActivityGuideSection({ where, what }: { where: string; what: string }) {
  return (
    <GuideSection title="Nhật ký thao tác">
      <GuideList>
        <li>
          {where} có khối <b>Nhật ký thao tác</b>: {what}
        </li>
        <li>Mỗi dòng: giờ · người · việc đã làm, mới nhất trước. Người ghi và giờ ghi do máy chủ đặt; dòng không sửa, không xóa được. Hoàn tác cũng ghi thêm một dòng.</li>
        <li>Ai xem được trang này thì đọc được nhật ký của trang. Admin xem mọi thao tác toàn hệ thống ở trang Nhật ký thao tác (quản trị).</li>
      </GuideList>
    </GuideSection>
  );
}
