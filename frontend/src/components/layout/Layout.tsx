import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";

export function Layout() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0D1B2A" }}>
      <Navbar />
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
