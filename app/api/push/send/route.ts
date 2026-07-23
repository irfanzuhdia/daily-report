import { NextRequest, NextResponse } from "next/server";
import { sendPushNotificationToAll } from "@/lib/services/push-notification";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = body.title || "MDM Daily Report";
    const message = body.message || "Test push notification from Daily Report app!";
    const url = body.url || "/reports";

    const result = await sendPushNotificationToAll(title, message, url);

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
