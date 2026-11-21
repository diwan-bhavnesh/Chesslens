import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useAuthStore } from "./store/authStore";
import { useGameStore } from "./store/gameStore";
import { Layout } from "./components/layout/Layout";
import { ErrorState } from "./components/ui/ErrorState";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { GameReview } from "./pages/GameReview";
import { ImportGames } from "./pages/ImportGames";
import { AuthCallback } from "./pages/AuthCallback";
import { MyGames } from "./pages/MyGames";
import { Prototype } from "./pages/Prototype";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  // Reads the store that App()'s single useAuth() call already bootstraps —
  // must NOT call useAuth() again here: its effect re-runs the bootstrap
  // (including the guest-mode account-creation call) on every mount, and
  // guest provisioning isn't idempotent like the old token-refresh path was.
  const { user, isLoading, authError } = useAuthStore();
  if (isLoading) return null;
  // Startup couldn't confirm the session (offline / server down): show a retry, not the login page.
  // Reloading re-runs the single bootstrap in useAuth().
  if (!user && authError) {
    return <ErrorState title="Couldn't start Chesslens" message={authError} onRetry={() => window.location.reload()} />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  const { user, isLoading } = useAuth();
  const fetchGames = useGameStore(state => state.fetchGames);

  // Lets the Navbar know whether this session has any games at all, without
  // every page needing its own fetch — the Navbar itself has no fetch of its own.
  useEffect(() => {
    if (!isLoading && user) fetchGames();
  }, [isLoading, user]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/game/:id" element={<PrivateRoute><GameReview /></PrivateRoute>} />
          <Route path="/import" element={<PrivateRoute><ImportGames /></PrivateRoute>} />
          <Route path="/my-games" element={<PrivateRoute><MyGames /></PrivateRoute>} />
          <Route path="/prototype" element={<Prototype />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
