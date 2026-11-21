import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { fetchMe, clearTokens, guestLogin, saveTokens } from "../services/auth";
import { GUEST_MODE } from "../config";
import { getErrorMessage, isAuthRejection } from "../utils/errors";

export function useAuth() {
  const { user, isLoading, setUser, setLoading, setAuthError, logout } = useAuthStore();

  useEffect(() => {
    // Only a real "your login is invalid" answer ends the session. A network drop or
    // server error leaves the saved tokens alone (in guest mode they ARE the user's
    // identity and games) and shows a retry screen instead of the login page.
    const onStartupError = (err: unknown) => {
      if (isAuthRejection(err)) {
        clearTokens();
        if (GUEST_MODE) setAuthError("Your session expired. Please reload the page.");
      } else {
        setAuthError(getErrorMessage(err, "We couldn't start Chesslens. Please try again."));
      }
    };

    const token = localStorage.getItem("access_token");
    if (!token) {
      if (GUEST_MODE) {
        guestLogin()
          .then((pair) => {
            saveTokens(pair);
            return fetchMe();
          })
          .then(setUser)
          .catch(onStartupError)
          .finally(() => setLoading(false));
        return;
      }
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(onStartupError)
      .finally(() => setLoading(false));
  }, []);

  return { user, isLoading, logout };
}
