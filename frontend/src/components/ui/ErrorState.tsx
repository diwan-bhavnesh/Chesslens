/** Full-section "couldn't load" message with a retry button. */
export function ErrorState({ message, onRetry, title = "Couldn't load this" }: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div role="alert" style={{ textAlign: "center", padding: "5rem 2rem" }}>
      <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.75rem" }}>{title}</p>
      <p style={{ fontSize: "0.9rem", color: "#8FA3B8", marginBottom: "1.5rem" }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ background: "#D4A843", color: "#0D1B2A", fontWeight: 700, padding: "0.75rem 2rem", border: "none", cursor: "pointer" }}
        >Try again</button>
      )}
    </div>
  );
}
