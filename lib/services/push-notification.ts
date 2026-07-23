import webpush from "web-push";
import { sql } from "@/lib/db";

// Configure Web Push VAPID credentials
const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BGttiMzrlDrz9C2oMk2GIbB53GgHUAkWLgAGdZqGPfMtny-pJa8Unxa0VX8_VkSKBXuBD-Z0OOdm_nUO365UF6c";
const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY ||
  "pTWxiuJoV4DceZnpAearZH8i3U9TXGbPeRx6y1pPZ7o";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      "mailto:gadmin@multidayamitra.co.id",
      vapidPublicKey,
      vapidPrivateKey
    );
  } catch (e) {
    console.error("Failed to set VAPID details:", e);
  }
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export async function addPushSubscription(
  subscription: PushSubscriptionPayload,
  userId?: string
): Promise<void> {
  try {
    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id)
      VALUES (
        ${subscription.endpoint},
        ${subscription.keys.p256dh},
        ${subscription.keys.auth},
        ${userId || null}
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = ${subscription.keys.p256dh},
        auth = ${subscription.keys.auth},
        user_id = COALESCE(${userId || null}, push_subscriptions.user_id)
    `;
  } catch (err) {
    console.error("Failed to save push subscription to Postgres DB:", err);
  }
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  try {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  } catch (err) {
    console.error("Failed to remove push subscription from Postgres DB:", err);
  }
}

export async function getAllPushSubscriptions(): Promise<PushSubscriptionPayload[]> {
  try {
    const rows = (await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`) as any[];
    return rows.map((r) => ({
      endpoint: r.endpoint,
      keys: {
        p256dh: r.p256dh,
        auth: r.auth,
      },
    }));
  } catch (err) {
    console.error("Failed to load push subscriptions from Postgres DB:", err);
    return [];
  }
}

export async function sendPushNotificationToAll(
  title: string,
  body: string,
  url = "/",
  icon = "/icons/icon-192.png"
): Promise<{ successCount: number; failureCount: number; totalSubscribers: number }> {
  const subscriptions = await getAllPushSubscriptions();
  const payload = JSON.stringify({
    title,
    body,
    url,
    icon,
  });

  let successCount = 0;
  let failureCount = 0;

  const promises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payload
      );
      successCount++;
    } catch (err: any) {
      console.error("Error sending push notification to endpoint:", sub.endpoint, err?.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removePushSubscription(sub.endpoint);
      }
      failureCount++;
    }
  });

  await Promise.all(promises);

  return { successCount, failureCount, totalSubscribers: subscriptions.length };
}
