"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

import { IconPlaceholder } from "@/components/ui/icon-placeholder"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      /* Thông báo THẢ XUỐNG từ mép trên ở mọi cỡ màn (2026-10-14 — người dùng: "đưa lên
         trên, không để dưới"; ở dưới hay che thanh Lưu dính đáy). Chừa tai thỏ / thanh
         trạng thái iPhone bằng safe-area. Đừng truyền `position` khác ở nơi gắn. */
      position="top-center"
      offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
      richColors
      expand
      closeButton
      visibleToasts={3}
      className="toaster group"
      icons={{
        success: (
          <IconPlaceholder
            lucide="CircleCheckIcon"
            tabler="IconCircleCheck"
            hugeicons="CheckmarkCircle02Icon"
            phosphor="CheckCircleIcon"
            remixicon="RiCheckboxCircleLine"
            className="size-6"
          />
        ),
        info: (
          <IconPlaceholder
            lucide="InfoIcon"
            tabler="IconInfoCircle"
            hugeicons="InformationCircleIcon"
            phosphor="InfoIcon"
            remixicon="RiInformationLine"
            className="size-6"
          />
        ),
        warning: (
          <IconPlaceholder
            lucide="TriangleAlertIcon"
            tabler="IconAlertTriangle"
            hugeicons="Alert02Icon"
            phosphor="WarningIcon"
            remixicon="RiErrorWarningLine"
            className="size-6"
          />
        ),
        error: (
          <IconPlaceholder
            lucide="OctagonXIcon"
            tabler="IconAlertOctagon"
            hugeicons="MultiplicationSignCircleIcon"
            phosphor="XCircleIcon"
            remixicon="RiCloseCircleLine"
            className="size-6"
          />
        ),
        loading: (
          <IconPlaceholder
            lucide="Loader2Icon"
            tabler="IconLoader"
            hugeicons="Loading03Icon"
            phosphor="SpinnerIcon"
            remixicon="RiLoaderLine"
            className="size-6 animate-spin"
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "26rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast !text-sm !gap-3 !p-4 !rounded-xl !border !shadow-lg",
          title: "!text-base !font-semibold !leading-snug",
          description: "!text-sm",
          actionButton:
            "!text-sm !font-semibold !h-9 !px-4 !rounded-lg",
          closeButton: "!size-8",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
