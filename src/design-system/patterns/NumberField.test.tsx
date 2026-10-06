import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NumberField } from "./NumberField";
import { Field } from "./Field";
import { Input } from "@/components/ui/input";

/* Dựng HTML tĩnh (không cần trình duyệt) rồi đọc thuộc tính của thẻ `<input>`. */
const dung = (el: React.ReactElement) => renderToStaticMarkup(el);
const theInput = (html: string) => html.match(/<input[^>]*>/)?.[0] ?? "";
const thuocTinh = (the: string, ten: string) => the.match(new RegExp(`${ten}="([^"]*)"`))?.[1];

describe("NumberField — thuộc tính của Field nằm trên CHÍNH <input>", () => {
  test("nhãn <label for> trỏ đúng id của ô nhập, thẻ bọc không mang id", () => {
    const html = dung(<NumberField label="Tỉ giá" unit="đ/USD" value={26000} onChange={() => {}} />);
    const o = theInput(html);
    const id = thuocTinh(o, "id");
    expect(id).toBeTruthy();
    expect(thuocTinh(html.match(/<label[^>]*>/)![0], "for")).toBe(id);
    // id chỉ xuất hiện MỘT lần (không còn gắn lên <div> bọc).
    expect(html.split(`id="${id}"`).length - 1).toBe(1);
  });

  test("gợi ý · bắt buộc · lỗi đi vào aria-* của ô nhập", () => {
    const html = dung(
      <NumberField label="Số lượng" required hint="Rời ô thêm dấu chấm" error="Chưa nhập" value={null} onChange={() => {}} />
    );
    const o = theInput(html);
    expect(thuocTinh(o, "aria-required")).toBe("true");
    expect(thuocTinh(o, "aria-invalid")).toBe("true");
    const ds = thuocTinh(o, "aria-describedby")!.split(" ");
    expect(ds).toHaveLength(2);
    for (const x of ds) expect(html).toContain(`id="${x}"`);
  });

  test("giấu nhãn (anNhan, ô trong bảng) ⇒ ô nhập mang aria-label", () => {
    const o = theInput(dung(<NumberField label="Số kg ngày 21/7" anNhan value={5} onChange={() => {}} />));
    expect(thuocTinh(o, "aria-label")).toBe("Số kg ngày 21/7");
  });

  test("có nút −/+ (step) vẫn gắn nhãn vào ô nhập", () => {
    const html = dung(<NumberField label="Số thùng" step={1} unit="thùng" value={12} onChange={() => {}} />);
    expect(thuocTinh(html.match(/<label[^>]*>/)![0], "for")).toBe(thuocTinh(theInput(html), "id"));
  });
});

describe("Field — con là ô nhập trực tiếp vẫn như cũ", () => {
  test("Input trực tiếp nhận id + aria-required", () => {
    const html = dung(
      <Field label="Biển số xe" required>
        <Input value="" onChange={() => {}} />
      </Field>
    );
    const o = theInput(html);
    expect(thuocTinh(html.match(/<label[^>]*>/)![0], "for")).toBe(thuocTinh(o, "id"));
    expect(thuocTinh(o, "aria-required")).toBe("true");
  });
});
