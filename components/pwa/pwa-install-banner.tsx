"use client";

import { useEffect, useState } from "react";
import { Download, Bell, BellOff, Share, Smartphone, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    const checkStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // Listen for Chrome/Android install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check notification permission status
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      checkExistingSubscription();
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const checkExistingSubscription = async () => {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const togglePushNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      alert("Push notifications are not supported by this browser.");
      return;
    }

    setLoading(true);
    try {
      if (isSubscribed) {
        // Unsubscribe
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setIsSubscribed(false);
      } else {
        // Request Permission & Subscribe
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission === "granted") {
          let vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) {
            try {
              const keyRes = await fetch("/api/push/public-key");
              const keyData = await keyRes.json();
              vapidKey = keyData.publicKey;
            } catch (e) {
              console.error("Failed to fetch VAPID public key from API:", e);
            }
          }

          if (!vapidKey) {
            alert("VAPID public key is missing.");
            setLoading(false);
            return;
          }

          const reg = await navigator.serviceWorker.ready;
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });

          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
          });

          setIsSubscribed(true);
        } else if (permission === "denied") {
          alert("Notification permissions were blocked. Please enable them in your browser settings.");
        }
      }
    } catch (err) {
      console.error("Error toggling notifications:", err);
      alert("Failed to configure push notifications.");
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      setTestSent(false);
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Daily Report Alert 🚀",
          message: "Push notifications are working cleanly on your device!",
          url: "/reports",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
      }
    } catch (e) {
      console.error("Failed to send test push:", e);
    }
  };

  return (
    <Card className="p-4 bg-zinc-900 border-zinc-800 text-zinc-100 shadow-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">App Installation & Push Alerts</h3>
            {isStandalone ? (
              <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30">Installed App</Badge>
            ) : (
              <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30">Web App</Badge>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Install on PC/Phone & enable notifications for instant daily report updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isStandalone && (deferredPrompt || isIOS) && (
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
            >
              <Download className="w-4 h-4" />
              Install App
            </Button>
          )}

          <Button
            onClick={togglePushNotifications}
            disabled={loading}
            size="sm"
            variant={isSubscribed ? "outline" : "default"}
            className={
              isSubscribed
                ? "border-zinc-700 hover:bg-zinc-800 text-zinc-200 gap-1.5"
                : "bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
            }
          >
            {isSubscribed ? <BellOff className="w-4 h-4 text-emerald-400" /> : <Bell className="w-4 h-4" />}
            {isSubscribed ? "Notifications Enabled" : "Enable Notifications"}
          </Button>

          {isSubscribed && (
            <Button
              onClick={sendTestNotification}
              size="sm"
              variant="ghost"
              className="text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5"
            >
              {testSent ? <Check className="w-4 h-4 text-emerald-400" /> : <Send className="w-4 h-4 text-blue-400" />}
              {testSent ? "Notification Sent!" : "Test Alert"}
            </Button>
          )}
        </div>
      </div>

      {/* iOS Instructions Banner/Modal */}
      {showIOSModal && (
        <div className="mt-3 p-3 rounded-lg bg-zinc-800/90 border border-zinc-700 text-xs text-zinc-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-100 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-indigo-400" /> How to Install on iOS (iPhone / iPad)
            </span>
            <button
              onClick={() => setShowIOSModal(false)}
              className="text-zinc-400 hover:text-zinc-100 font-bold"
            >
              ✕
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-zinc-300">
            <li>Open this website in <strong>Safari</strong> on your iPhone/iPad.</li>
            <li>Tap the <strong>Share</strong> button <Share className="inline w-3.5 h-3.5 mx-0.5 text-blue-400" /> at the bottom menu.</li>
            <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</li>
            <li>Open the installed icon from your Home Screen to enable Push Notifications!</li>
          </ol>
        </div>
      )}
    </Card>
  );
}
