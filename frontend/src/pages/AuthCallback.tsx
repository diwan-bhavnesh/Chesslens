import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveTokens, fetchMe } from "../services/auth";
import { useAuthStore } from "../store/authStore";

export function AuthCallback() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const error = params.get("error");

    if (error || !access_token || !refresh_token) {
      navigate("/login?error=oauth_failed", { replace: true });
      return;
    }

    saveTokens({ access_token, refresh_token, token_type: "bearer" });

    fetchMe()
      .then((user) => {
        setUser(user);
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        navigate("/login?error=oauth_failed", { replace: true });
      });
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: "#F5F0E8" }}>
      Signing you in…
    </div>
  );
}
