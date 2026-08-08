import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { apDungCaiDatHienThi } from "@/design-system";
import { migrateOldLocalStorage } from "@/lib/db";

// Di trú dữ liệu local storage cũ nếu có sang tiếng Anh
migrateOldLocalStorage();

// Nạp cỡ chữ / tương phản người dùng đã chọn trước khi vẽ màn đầu tiên.
apDungCaiDatHienThi();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
