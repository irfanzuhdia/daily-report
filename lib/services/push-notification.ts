import webpush from "web-push";
import fs from "fs";
import path from "path";

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

// Persistent file storage path
const STORE_PATH = path.join(process.cwd(), ".push-subscriptions.json");

function loadSubscriptions(): Map<string, PushSubscriptionPayload> {
  const map = new Map<string, PushSubscriptionPayload>();
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((sub) => {
          if (sub && sub.endpoint) {
            map.set(sub.endpoint, sub);
          }
        });
      }
    }
  } catch (err) {
    console.error("Failed to read push subscriptions file:", err);
  }
  return map;
}

function saveSubscriptions(map: Map<string, PushSubscriptionPayload>): void {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(STORE_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save push subscriptions file:", err);
  }
}

export function addPushSubscription(subscription: PushSubscriptionPayload): void {
  const map = loadSubscriptions();
  map.set(subscription.endpoint, subscription);
  saveSubscriptions(map);
}

export function removePushSubscription(endpoint: string): void {
  const map = loadSubscriptions();
  map.delete(endpoint);
  saveSubscriptions(map);
}

export function getAllPushSubscriptions(): PushSubscriptionPayload[] {
  const map = loadSubscriptions();
  return Array.from(map.values());
}

export async function sendPushNotificationToAll(
  title: string,
  body: string,
  url = "/",
  icon = "/icons/icon-192.png"
): Promise<{ successCount: number; failureCount: number; totalSubscribers: number }> {
  const subscriptions = getAllPushSubscriptions();
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
        removePushSubscription(sub.endpoint);
      }
      failureCount++;
    }
  });

  await Promise.all(promises);

  return { successCount, failureCount, totalSubscribers: subscriptions.length };
}
