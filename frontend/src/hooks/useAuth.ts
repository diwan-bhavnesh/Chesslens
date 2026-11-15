import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { fetchMe, clearTokens, guestLogin, saveTokens } from "../services/auth";
import { GUEST_MODE } from "../config";

export function useAuth() {
  const { user, isLoading, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      if (GUEST_MODE) {
        guestLogin()
          .then((pair) => {
            saveTokens(pair);
            return fetchMe();
          })
          .then(setUser)
          .catch(() => clearTokens())
          .finally(() => setLoading(false));
        return;
      }
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
