import { cn } from "@/lib/utils";

type ActionMessageProps = {
  message?: string | null;
  tone?: "error" | "success" | "info";
};

export function ActionMessage({
  message,
  tone = "error",
}: ActionMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={cn(
        "app-alert",
        tone === "error" && "app-alert-error",
        tone === "success" && "app-alert-success",
        tone === "info" && "app-alert-info",
      )}
    >
      {message}
    </p>
  );
}
