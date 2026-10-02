export const USERNAME_REMINDER_DISMISS_KEY = "flixverse-username-reminder-dismissed";

export function clearUsernameReminderDismiss(): void {
  try {
    sessionStorage.removeItem(USERNAME_REMINDER_DISMISS_KEY);
  } catch {
    // ignore
  }
}

export function isUsernameReminderDismissed(): boolean {
  try {
    return sessionStorage.getItem(USERNAME_REMINDER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissUsernameReminder(): void {
  try {
    sessionStorage.setItem(USERNAME_REMINDER_DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}
