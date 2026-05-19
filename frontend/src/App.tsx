import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/layout/Layout";
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
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  useAuth();

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
