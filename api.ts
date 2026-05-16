/**
 * notification_app_fe/lib/api.ts
 * Notifications API client — authenticated with Bearer token.
 */

import { Log } from "../../logging_middleware/index";
import { getAuthToken, clearToken } from "./auth";
import { type Notification, type FilterType } from "./utils";

const BASE_URL = "http://4.224.186.213/evaluation-service/notifications";

export interface FetchParams {
  limit?: number;
  page?: number;
  notification_type?: FilterType;
}

export async function fetchNotifications(params: FetchParams = {}): Promise<Notification[]> {
  const url = new URL(BASE_URL);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.page)  url.searchParams.set("page",  String(params.page));
  if (params.notification_type && params.notification_type !== "All") {
    url.searchParams.set("notification_type", params.notification_type);
  }

  await Log("frontend", "info", "api", `GET ${url.toString()}`);

  try {
    const token = await getAuthToken();

    const res = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${token}` },
      cache: "no-store",
    });

    // Auto-retry on token expiry
    if (res.status === 401) {
      await Log("frontend", "warn", "auth", "Token expired — refreshing and retrying");
      clearToken();
      const newToken = await getAuthToken();
      const retry = await fetch(url.toString(), {
        headers: { "Authorization": `Bearer ${newToken}` },
        cache: "no-store",
      });
      if (!retry.ok) {
        await Log("frontend", "error", "api", `Retry failed — HTTP ${retry.status}`);
        throw new Error(`API Error: ${retry.status}`);
      }
      const retryData = await retry.json();
      await Log("frontend", "info", "api", `Retry success — ${retryData.notifications?.length ?? 0} items`);
      return retryData.notifications as Notification[];
    }

    if (!res.ok) {
      await Log("frontend", "error", "api", `Notifications API error — HTTP ${res.status}`);
      throw new Error(`API Error: ${res.status}`);
    }

    const data = await res.json();
    const count = data.notifications?.length ?? 0;
    await Log("frontend", "info", "api", `Fetched ${count} notifications successfully`);
    return (data.notifications ?? []) as Notification[];

  } catch (err) {
    await Log("frontend", "error", "api", `fetchNotifications failed: ${String(err)}`);
    throw err;
  }
}
