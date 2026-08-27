"use client";

import { authService, authStateEvents } from "@/lib/auth/cognito";
import { apiClient } from "@/lib/api/client";
import type { AuthState, LoginCredentials } from "@/lib/types/auth";
import type { BillingStatusResponse } from "@/lib/types/api";
import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(
    authService.getAuthState(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [billingStatus, setBillingStatus] =
    useState<BillingStatusResponse | null>(authService.getBillingStatus());
  const [billingStatusLoaded, setBillingStatusLoaded] = useState(
    authService.isBillingStatusLoaded(),
  );

  useEffect(() => {
    const syncAuthState = () => {
      setAuthState(authService.getAuthState());
      setBillingStatus(authService.getBillingStatus());
      setBillingStatusLoaded(authService.isBillingStatusLoaded());
    };

    authStateEvents.addEventListener("change", syncAuthState);
    window.addEventListener("storage", syncAuthState);

    return () => {
      authStateEvents.removeEventListener("change", syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  const refreshBillingStatus = useCallback(
    async (options: { forceRefresh?: boolean } = {}) => {
      if (!authService.isAuthenticated()) {
        return null;
      }

      const status = await apiClient.getBillingStatus(options);
      authService.setBillingStatus(status);
      await authService.forceRefreshToken();
      authService.setBillingStatus(status);
      authService.markBillingRefresh();
      setAuthState(authService.getAuthState());
      setBillingStatus(status);
      setBillingStatusLoaded(true);
      return status;
    },
    [setAuthState],
  );

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setLoading(true);
      setError(null);
      setRequiresNewPassword(false);

      try {
        const newAuthState = await authService.login(credentials);
        setAuthState(newAuthState);
        try {
          await refreshBillingStatus({ forceRefresh: true });
        } catch (refreshError) {
          console.warn(
            "No se pudo sincronizar el estado de suscripción después del login",
            refreshError,
          );
        }
        setAuthState(authService.getAuthState());
        return authService.getAuthState();
      } catch (err: any) {
        if (
          err.code === "NewPasswordRequired" ||
          err.name === "NewPasswordRequired"
        ) {
          setRequiresNewPassword(true);
          setError("Debes cambiar tu contraseña temporal");
          throw err;
        }

        if (
          err.code === "UserNotConfirmedException" ||
          err.name === "UserNotConfirmedException"
        ) {
          setError(null);
          throw err;
        }

        const errorMessage = err.message || "Error al iniciar sesión";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [refreshBillingStatus],
  );

  const completeNewPassword = useCallback(
    async (newPassword: string) => {
      setLoading(true);
      setError(null);

      try {
        const newAuthState = await authService.completeNewPassword(newPassword);
        setAuthState(newAuthState);
        setRequiresNewPassword(false);
        try {
          await refreshBillingStatus({ forceRefresh: true });
        } catch (refreshError) {
          console.warn(
            "No se pudo sincronizar el estado de suscripción después del cambio de contraseña",
            refreshError,
          );
        }
        setAuthState(authService.getAuthState());
        return authService.getAuthState();
      } catch (err: any) {
        const errorMessage = err.message || "Error al cambiar la contraseña";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [refreshBillingStatus],
  );

  const logout = useCallback(() => {
    authService.logout();
    setAuthState(authService.getAuthState());
    setRequiresNewPassword(false);
  }, []);

  return {
    ...authState,
    loading,
    error,
    requiresNewPassword,
    login,
    logout,
    completeNewPassword,
    refreshBillingStatus,
    billingStatus,
    billingStatusLoaded,
  };
}
