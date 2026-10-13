// ============================================================
// Tên file: src/design-system/patterns/fieldInput.ts
// Tên tiếng Việt: Thuộc tính ô nhập mà Field truyền xuống ô LỒNG bên trong
// Description: Field → nested input props (id / aria-* / unit padding) via context
// ============================================================
import * as React from "react";

/**
 * Thuộc tính `Field` phải gắn lên ĐÚNG thẻ `<input>`: `id` (nhãn `<label for>` trỏ
 * tới), `aria-*` (gợi ý · lỗi · bắt buộc · tên ô khi giấu nhãn) và khoảng chừa
 * bên phải cho chữ đơn vị (README §12 — đơn vị nằm TRONG ô).
 */
export interface FieldInputProps {
  id: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
  style?: React.CSSProperties;
}

export const FieldInputContext = React.createContext<FieldInputProps | null>(null);

/**
 * Ô nhập nằm LỒNG trong thẻ bọc (VD `NumberField`: `<div>` bọc `<Input>` + dòng xem
 * trước biểu thức) lấy thuộc tính của `Field` qua hook này rồi trải lên `<input>`.
 * `Field` phải khai `nestedInput` — không thì nó gắn thẳng lên thẻ bọc (thẻ div nhận
 * id ⇒ nhãn không trỏ tới ô nào, đơn vị lòi ra ngoài viền ô).
 */
export function useFieldInput(): FieldInputProps | null {
  return React.useContext(FieldInputContext);
}
