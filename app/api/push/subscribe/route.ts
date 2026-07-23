import { NextRequest, NextResponse } from "next/server";
import {
  addPushSubscription,
  removePushSubscription,
  PushSubscriptionPayload,
} from "@/lib/services/push-notification";

export async function POST(req: NextRequest) {
  try {
    const body: PushSubscriptionPayload = await req.json();

    if (!body || !body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: "Invalid push subscription object" },
        { status: 400 }
      );
    }

    await addPushSubscription(body);

    return NextResponse.json({
      success: true,
      message: "Push subscription saved successfully",
    });
  } catch (error) {
    console.error("Failed to subscribe push notification:", error);
    return NextResponse.json(
      { error: "Failed to process push subscription" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (endpoint) {
      await removePushSubscription(endpoint);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
}
