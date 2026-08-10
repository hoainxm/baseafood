import { Link } from "react-router-dom";
import { Button } from "@/design-system";

export default function NotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
      <h2 className="text-8xl font-extrabold text-primary">404</h2>
      <p className="mt-4 text-2xl font-bold text-foreground">Không tìm thấy trang</p>
      <p className="mt-2 text-base text-muted-foreground max-w-md">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi. Vui lòng kiểm tra lại.
      </p>
      <Link to="/imports" className="mt-6">
        <Button size="lg">Quay lại trang chủ</Button>
      </Link>
    </div>
  );
}
