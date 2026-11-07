import { notification } from 'antd';

/** The `message` of a caught value, or undefined when it has none. */
export function errorMessage(err: unknown): string | undefined {
  return (err as { message?: string } | null | undefined)?.message;
}

/**
 * Shows the standard "action failed" error notification: `message` as the title and the
 * error's own message as the description, falling back to `fallbackDescription`.
 */
export function notifyError(message: string, err?: unknown, fallbackDescription?: string): void {
  const description = errorMessage(err) || fallbackDescription;
  notification.error({ message, description });
}
