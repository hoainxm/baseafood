// ============================================================
// Tên file: supabase/functions/ocr-import-slip/index.ts
// Tên tiếng Việt: Đọc ảnh phiếu nhập bằng OpenAI (phía máy chủ)
// Description: Edge Function — nhận ảnh phiếu + danh mục, gọi OpenAI vision, trả bản nháp
// ============================================================
//
// Vì sao chạy ở máy chủ: key OpenAI KHÔNG được nằm trong bundle trình duyệt (biến
// VITE_* bị nhúng thẳng vào JS). Key đặt ở Supabase → Edge Functions → Secrets:
//   OPENAI_API_KEY   (bắt buộc)
//   OPENAI_MODEL     (tuỳ chọn, mặc định gpt-4.1-mini — cần model đọc được ảnh)
// Chỉ người đã đăng nhập VÀ có vai trò (`co_vai_tro()`, mig 0057) mới gọi được —
// người tự đăng ký không đốt tiền key. Hàm KHÔNG ghi bảng nào, không lưu ảnh, không log
// ảnh: ảnh phiếu đã lưu riêng ở Storage bucket `qc` (lib/storage.ts).
// Kết quả là NHÁP: app vẫn bắt người soát lại từng ô (docs/app-map/30-nhap-hang.md).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Ảnh base64 tối đa ~8 MB (app đã nén về ≤1600px JPEG, thường < 500 KB). */
const MAX_IMAGE_CHARS = 8_000_000;
const MAX_CATALOG_ITEMS = 2000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Khuôn JSON bắt OpenAI trả đúng hình (structured outputs, strict). */
const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text", "date", "supplier", "licensePlate", "driverName", "workshop", "lines"],
  properties: {
    text: { type: "string", description: "Toàn văn chữ trên phiếu, giữ xuống dòng theo hàng." },
    date: { type: ["string", "null"], description: "Ngày hàng về dạng yyyy-mm-dd, null nếu không thấy." },
    supplier: { type: ["string", "null"], description: "Tên đại lý ĐÚNG Y một mục trong danh mục, null nếu không chắc." },
    licensePlate: { type: ["string", "null"], description: "Biển số xe chở hàng, null nếu phiếu không ghi." },
    driverName: { type: ["string", "null"], description: "Tên tài xế, null nếu phiếu không ghi." },
    workshop: { type: ["string", "null"], description: "Xưởng nhận hàng: ĐÚNG Y một mục trong danh sách xưởng, null nếu không ghi." },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["materialType", "kg", "unitPrice"],
        properties: {
          materialType: { type: "string", description: "Tên loại NL ĐÚNG Y một mục trong danh mục." },
          kg: { type: "number", description: "Khối lượng kg của dòng đó." },
          unitPrice: { type: ["number", "null"], description: "Đơn giá đồng/kg của dòng đó, null nếu phiếu không ghi." },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `Bạn đọc ảnh PHIẾU NHẬP NGUYÊN LIỆU thủy sản viết tay/in của xí nghiệp Baseafood (Việt Nam).
Nhiệm vụ: chép lại chữ trên phiếu và bóc các ô để điền form nhập hàng: đại lý, ngày, biển số xe, tài xế, xưởng, và từng dòng loại nguyên liệu + kg + đơn giá.
Quy tắc:
- "text": chép nguyên văn mọi hàng chữ đọc được, mỗi hàng một dòng.
- "date": ngày hàng về (thường ghi dd/mm hoặc dd/mm/yyyy); đổi sang yyyy-mm-dd. Thiếu năm thì dùng năm hiện tại được cho. Không thấy ⇒ null.
- "supplier": CHỈ chọn một nhãn có trong DANH MỤC ĐẠI LÝ, chép y nhãn đó (khớp theo mã số đứng trước dấu "·", tên tắt, hoặc tên hóa đơn trong ngoặc). Không chắc ⇒ null. Không tự bịa tên.
- "licensePlate": biển số xe (dạng "72C-166.03"). Nếu gần giống một biển trong danh sách XE ĐÃ GHI thì chép y biển đó. Không có ⇒ null.
- "driverName": tên tài xế / người giao (dòng "Tài xế", "Lái xe", "TX"). Nếu gần giống một tên trong danh sách TÀI XẾ ĐÃ GHI thì chép y tên đó. Không có ⇒ null.
- "workshop": xưởng nhận hàng nếu phiếu có ghi, chép y một mục trong danh sách XƯỞNG. Không ghi ⇒ null, đừng đoán theo loại hàng.
- "lines": mỗi dòng hàng = một loại nguyên liệu + số kg. "materialType" PHẢI là một tên có trong DANH MỤC LOẠI NL (khớp gần đúng chữ viết tay/viết tắt thì chọn tên danh mục gần nhất). Số kg kiểu Việt Nam: "1.234" là một nghìn hai trăm ba mươi tư, "12,5" là mười hai phẩy năm. Dòng có nhiều lần cân thì lấy TỔNG nếu phiếu ghi tổng, không thì cộng các lần cân. Không đọc được số ⇒ bỏ dòng. "unitPrice" là đơn giá ĐỒNG trên 1 kg của dòng đó; phiếu hay ghi tắt theo nghìn ("85", "85k", "85.000") đều là 85000; cột "thành tiền" không phải đơn giá (nếu chỉ có thành tiền thì đơn giá = thành tiền ÷ kg). Không ghi giá ⇒ null.
- Không đoán bừa: thà bỏ trống còn hơn sai, người dùng sẽ soát lại.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Chặn người không có vai trò (cổng JWT của Supabase đã chặn người chưa đăng nhập).
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: hasRole, error: roleError } = await sb.rpc("co_vai_tro");
  if (roleError || hasRole !== true) return json(403, { error: "forbidden" });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json(503, { error: "missing_key", message: "Chưa đặt OPENAI_API_KEY ở Supabase secrets." });

  let body: {
    image?: unknown;
    suppliers?: unknown;
    materialTypes?: unknown;
    knownPlates?: unknown;
    knownDrivers?: unknown;
    workshops?: unknown;
    year?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const image = typeof body.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(image) || image.length > MAX_IMAGE_CHARS)
    return json(400, { error: "bad_image" });
  const asList = (v: unknown) =>
    (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").slice(0, MAX_CATALOG_ITEMS);
  const suppliers = asList(body.suppliers);
  const materialTypes = asList(body.materialTypes);
  const knownPlates = asList(body.knownPlates);
  const knownDrivers = asList(body.knownDrivers);
  const workshops = asList(body.workshops);
  const year = typeof body.year === "number" && body.year > 2000 && body.year < 2100 ? body.year : new Date().getFullYear();

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  const userText =
    `Năm hiện tại: ${year}.\n\nDANH MỤC ĐẠI LÝ (mã · tên):\n${suppliers.join("\n") || "(trống)"}\n\n` +
    `DANH MỤC LOẠI NL:\n${materialTypes.join("\n") || "(trống)"}\n\n` +
    `XƯỞNG: ${workshops.join(", ") || "(không có)"}\n\n` +
    `XE ĐÃ GHI:\n${knownPlates.join("\n") || "(trống)"}\n\n` +
    `TÀI XẾ ĐÃ GHI:\n${knownDrivers.join("\n") || "(trống)"}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "import_slip", strict: true, schema: RESULT_SCHEMA } },
    }),
  });
  if (!res.ok) {
    // Không trả nguyên văn lỗi OpenAI (có thể lộ thông tin tài khoản) — chỉ mã.
    console.error("openai_error", res.status);
    return json(502, { error: "openai_error", status: res.status });
  }
  const completion = await res.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return json(502, { error: "empty_result" });
  try {
    return json(200, { ...JSON.parse(content), model });
  } catch {
    return json(502, { error: "bad_result" });
  }
});
