// ============================================================
// Tên file: src/features/shared/guides/flowGuide.ts
// Tên tiếng Việt: Dữ liệu hộp hướng dẫn dạng quy trình — bước, ai làm, quyền cần, trạng thái
// Description: Pure types + helpers for flow-style page guides (ba-spec 43 v5 R18–R21). The guide
//              declares steps with the permission each needs and the actors who do it; the box
//              highlights the viewer's steps from real permissions; tests check actors ⇄ matrix.
// ============================================================
import type { TagVariant } from "@/design-system";
import type { PermissionAction } from "@/lib/permissions";
import type { Role } from "@/types";

/** Một nhóm người dùng của trang (gọi theo chức danh, không theo mã vai trò). */
export interface GuideActor {
  id: string;
  /** "Nhân viên Kế hoạch", "Thủ kho"… */
  name: string;
  /** Dòng phụ: chức danh cụ thể trong nhóm (VD "Thủ kho, Quản đốc, Phó quản đốc"). */
  note?: string;
  /** Vai trò hệ thống thuộc nhóm — test đối chiếu với ma trận quyền (R20). */
  roles: readonly Role[];
  /** Nhóm chỉ xem trang (không làm bước nào). */
  viewOnly?: boolean;
}

/** Một bước của quy trình. */
export interface GuideFlowStep {
  id: string;
  title: string;
  /** Quyền cần để làm bước — hộp dùng để đánh dấu "Việc của bạn", test dùng để soát `actors`. */
  needs: readonly [resource: string, action: PermissionAction];
  /** Id các nhóm làm bước (phải đúng bằng các nhóm có quyền `needs` — R20). */
  actors: readonly string[];
  /** Làm gì — 1–2 câu ngắn, gọi đúng tên nút. */
  text: string;
  /** Khi nào bước xong / điều kiện sang bước sau. */
  done?: string;
  /** Trạng thái sau khi xong (nhãn đúng như trên trang). */
  result?: { label: string; tone: TagVariant };
}

/** Một trạng thái người đọc gặp trên trang. */
export interface GuideState {
  label: string;
  tone: TagVariant;
  meaning: string;
  /** Việc tiếp theo · ai làm. Trống = trạng thái cuối. */
  next?: string;
}

/** Bước người đang xem làm được (theo quyền thật, không theo tên vai trò). */
export function stepsForViewer(steps: readonly GuideFlowStep[], can: (resource: string, action: PermissionAction) => boolean): string[] {
  return steps.filter((s) => can(s.needs[0], s.needs[1])).map((s) => s.id);
}

/** Bước của một nhóm, theo thứ tự quy trình (số bước bắt đầu từ 1). */
export function stepsOfActor(steps: readonly GuideFlowStep[], actorId: string): { no: number; title: string }[] {
  return steps.flatMap((s, i) => (s.actors.includes(actorId) ? [{ no: i + 1, title: s.title }] : []));
}
