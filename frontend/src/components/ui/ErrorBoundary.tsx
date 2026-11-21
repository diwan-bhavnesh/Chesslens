import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Changing this value (e.g. the URL path) clears a previous crash so navigation recovers. */
  resetKey?: string;
}
interface State { hasError: boolean }

/** Catches crashes while rendering so one broken page shows a message instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error caught by ErrorBoundary:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ textAlign: "center", padding: "6rem 2rem", color: "#8FA3B8" }}>
        <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.75rem" }}>
          Something went wrong on this page
        </p>
        <p style={{ fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Your games and data are safe. Reloading usually fixes it.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "#D4A843", color: "#0D1B2A", fontWeight: 700, padding: "0.75rem 2rem", border: "none", cursor: "pointer" }}
        >Reload page</button>
      </div>
    );
  }
}
