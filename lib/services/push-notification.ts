import webpush from "web-push";

// Configure Web Push VAPID credentials
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:gadmin@multidayamitra.co.id",
    vapidPublicKey,
    vapidPrivateKey
  );
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

// In-memory / persistent subscription store fallback
const activeSubscriptions = new Map<string, PushSubscriptionPayload>();

export function addPushSubscription(subscription: PushSubscriptionPayload): void {
  activeSubscriptions.set(subscription.endpoint, subscription);
}

export function removePushSubscription(endpoint: string): void {
  activeSubscriptions.delete(endpoint);
}

export function getAllPushSubscriptions(): PushSubscriptionPayload[] {
  return Array.from(activeSubscriptions.values());
}

export async function sendPushNotificationToAll(
  title: string,
  body: string,
  url = "/",
  icon = "/icons/icon-192.png"
): Promise<{ successCount: number; failureCount: number }> {
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
      console.error("Error sending push notification to endpoint:", sub.endpoint, err);
      // Remove expired/invalid subscriptions
      if (err.statusCode === 410 || err.statusCode === 404) {
        removePushSubscription(sub.endpoint);
      }
      failureCount++;
    }
  });

  await Promise.all(promises);

  return { successCount, failureCount };
}
