import { notification } from 'antd';

/**
 * Shows the standard "action failed" error notification: `message` as the title and the
 * error's own message as the description, falling back to `fallbackDescription`.
 */
export function notifyError(message: string, err?: unknown, fallbackDescription?: string): void {
  const description = (err as { message?: string } | undefined)?.message || fallbackDescription;
  notification.error({ message, description });
}
