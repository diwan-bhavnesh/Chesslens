import { useToastStore } from "../../store/toastStore";

const ACCENT = { error: "#E5484D", success: "#3FB950", info: "#2563EB" } as const;

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: "fixed", bottom: "1.25rem", right: "1.25rem", zIndex: 1000,
        display: "flex", flexDirection: "column", gap: "0.5rem",
        maxWidth: "min(380px, calc(100vw - 2.5rem))",
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          style={{
            background: "#1A2E45", color: "#F5F0E8", fontSize: "0.875rem", lineHeight: 1.45,
            padding: "0.75rem 0.75rem 0.75rem 1rem", borderLeft: `3px solid ${ACCENT[t.kind]}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "flex-start", gap: "0.75rem",
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            style={{ background: "none", border: "none", color: "#8FA3B8", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 0 }}
          >×</button>
        </div>
      ))}
    </div>
  );
}
