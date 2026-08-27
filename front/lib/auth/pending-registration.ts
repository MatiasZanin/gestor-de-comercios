export type PendingRegistrationNavigation = {
  registrationId?: string;
  email: string;
  source: "signup" | "login";
  attemptId: string;
};

const NAVIGATION_KEY = "pendingRegistrationNavigation";

export function savePendingRegistrationNavigation(
  value: PendingRegistrationNavigation,
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NAVIGATION_KEY, JSON.stringify(value));
}

export function loadPendingRegistrationNavigation(): PendingRegistrationNavigation | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      sessionStorage.getItem(NAVIGATION_KEY) ?? "null",
    ) as Partial<PendingRegistrationNavigation> | null;
    if (!value?.email || !value.source || !value.attemptId) return null;
    return value as PendingRegistrationNavigation;
  } catch {
    return null;
  }
}

export function markAutomaticResendStarted(attemptId: string): boolean {
  if (typeof window === "undefined") return false;
  const key = `confirmationAutoResend:${attemptId}`;
  if (sessionStorage.getItem(key)) return false;
  // Mark before starting the request: Strict Mode, refresh and navigation cannot duplicate it.
  sessionStorage.setItem(key, "started");
  return true;
}

export function clearPendingRegistrationNavigation(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(NAVIGATION_KEY);
}
