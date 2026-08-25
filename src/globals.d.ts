// Mã bản build (git SHA hoặc mốc thời gian) — Vite nhúng lúc build qua `define`.
// App so mã này với version.json trên máy chủ để biết có bản deploy mới hay chưa.
declare const __BUILD_ID__: string;
