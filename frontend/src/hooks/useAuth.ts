import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { fetchMe, clearTokens } from "../services/auth";

export function useAuth() {
  const { user, isLoading, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  return { user, isLoading, logout };
}
