import { NextRequest, NextResponse } from "next/server";
import { sendPushNotificationToUser, sendPushNotificationToAll } from "@/lib/services/push-notification";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json().catch(() => ({}));
    const title = body.title || "Daily Report Alert 🚀";
    const message = body.message || "Test push notification from Daily Report app!";
    const url = body.url || "/reports";

    const userId = session?.user_id || session?.email;
    let result;

    if (userId) {
      // Send test alert ONLY to the current user's registered devices
      result = await sendPushNotificationToUser(userId, title, message, url);
    } else {
      // Fallback
      result = await sendPushNotificationToAll(title, message, url);
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("Error triggering push notification:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
