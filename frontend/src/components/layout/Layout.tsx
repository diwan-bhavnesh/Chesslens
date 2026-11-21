import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { Toaster } from "../ui/Toaster";

export function Layout() {
  const { pathname } = useLocation();
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0D1B2A" }}>
      <Navbar />
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* resetKey: navigating to another page clears a crashed page */}
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Toaster />
    </div>
  );
}
