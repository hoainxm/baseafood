import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NumberField } from "./NumberField";
import { Field } from "./Field";
import { Input } from "@/components/ui/input";

/* Dựng HTML tĩnh (không cần trình duyệt) rồi đọc thuộc tính của thẻ `<input>`. */
const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const theInput = (html: string) => html.match(/<input[^>]*>/)?.[0] ?? "";
const getAttr = (html: string, attr: string) => html.match(new RegExp(`${attr}="([^"]*)"`))?.[1];

describe("NumberField — thuộc tính của Field nằm trên CHÍNH <input>", () => {
  test("nhãn <label for> trỏ đúng id của ô nhập, thẻ bọc không mang id", () => {
    const html = render(<NumberField label="Tỉ giá" unit="đ/USD" value={26000} onChange={() => {}} />);
    const o = theInput(html);
    const id = getAttr(o, "id");
    expect(id).toBeTruthy();
    expect(getAttr(html.match(/<label[^>]*>/)![0], "for")).toBe(id);
    // id chỉ xuất hiện MỘT lần (không còn gắn lên <div> bọc).
    expect(html.split(`id="${id}"`).length - 1).toBe(1);
  });

  test("gợi ý · bắt buộc · lỗi đi vào aria-* của ô nhập", () => {
    const html = render(
      <NumberField label="Số lượng" required hint="Rời ô thêm dấu chấm" error="Chưa nhập" value={null} onChange={() => {}} />
    );
    const o = theInput(html);
    expect(getAttr(o, "aria-required")).toBe("true");
    expect(getAttr(o, "aria-invalid")).toBe("true");
    const items = getAttr(o, "aria-describedby")!.split(" ");
    expect(items).toHaveLength(2);
    for (const x of items) expect(html).toContain(`id="${x}"`);
  });

  test("giấu nhãn (anNhan, ô trong bảng) ⇒ ô nhập mang aria-label", () => {
    const o = theInput(render(<NumberField label="Số kg ngày 21/7" hideLabel value={5} onChange={() => {}} />));
    expect(getAttr(o, "aria-label")).toBe("Số kg ngày 21/7");
  });

  test("có nút −/+ (step) vẫn gắn nhãn vào ô nhập", () => {
    const html = render(<NumberField label="Số thùng" step={1} unit="thùng" value={12} onChange={() => {}} />);
    expect(getAttr(html.match(/<label[^>]*>/)![0], "for")).toBe(getAttr(theInput(html), "id"));
  });
});

describe("Field — con là ô nhập trực tiếp vẫn như cũ", () => {
  test("Input trực tiếp nhận id + aria-required", () => {
    const html = render(
      <Field label="Biển số xe" required>
        <Input value="" onChange={() => {}} />
      </Field>
    );
    const o = theInput(html);
    expect(getAttr(html.match(/<label[^>]*>/)![0], "for")).toBe(getAttr(o, "id"));
    expect(getAttr(o, "aria-required")).toBe("true");
  });
});
