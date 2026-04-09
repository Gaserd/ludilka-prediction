"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  variant?: "primary" | "outline" | "dark" | "error";
  block?: boolean;
};

export function SubmitButton({
  children,
  className,
  pendingLabel = "Сохраняем...",
  variant = "primary",
  block = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cn(
        "button app-submit-button",
        variant === "primary" && "primary",
        variant === "outline" && "outline",
        variant === "dark" && "dark",
        variant === "error" && "error",
        block && "app-full-width",
        className,
      )}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
