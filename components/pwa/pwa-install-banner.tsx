"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Bell, BellOff, Share, Smartphone, Check, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function urlBase64ToUint8Array(base64String: string) {
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

/** Shared hook for push notification state & actions. Used by both PWA banner and Settings dialog. */
export function usePushNotifications() {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);

      if (sub) {
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        }).catch((err) => console.error("Push sync error:", err));
      }
    }
  };

  const togglePushNotifications = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      alert("Push notifications are not supported by this browser.");
      return;
    }

    setLoading(true);
    try {
      if (isSubscribed) {
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
  }, [isSubscribed]);

  const sendTestNotification = useCallback(async () => {
    try {
      setTestSent(false);

      if (Notification.permission !== "granted") {
        alert("Please click 'Enable Notifications' first to grant permission.");
        return;
      }

      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Daily Report Alert 🚀", {
          body: "Push notifications are working cleanly on your device!",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          data: { url: "/reports" },
        });
      }

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
  }, []);

  return {
    notificationPermission,
    isSubscribed,
    loading,
    testSent,
    togglePushNotifications,
    sendTestNotification,
  };
}

/**
 * PWA Banner logic:
 * - Shows after login if app is NOT installed or notifications NOT enabled.
 * - If user closes the banner but hasn't completed both (install + notif):
 *   → hides for 1 day, then shows again next time they open the app.
 * - If user has both installed the app AND enabled notifications:
 *   → banner is permanently dismissed forever.
 */
export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default hidden until checked

  const { isSubscribed, loading, testSent, togglePushNotifications, sendTestNotification } = usePushNotifications();

  useEffect(() => {
    // Check standalone mode
    const checkStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
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

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Determine banner visibility based on install + notif status and dismiss timestamp
  useEffect(() => {
    const permanentlyDismissed = localStorage.getItem("pwa_banner_dismissed");
    if (permanentlyDismissed === "true") {
      setIsDismissed(true);
      return;
    }

    // If both installed AND subscribed → auto-dismiss permanently
    if (isStandalone && isSubscribed) {
      setIsDismissed(true);
      localStorage.setItem("pwa_banner_dismissed", "true");
      return;
    }

    // Check temporary dismiss (1 day cooldown)
    const tempDismissedAt = localStorage.getItem("pwa_banner_temp_dismissed_at");
    if (tempDismissedAt) {
      const dismissedTime = parseInt(tempDismissedAt, 10);
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < oneDayMs) {
        // Still within 1-day cooldown
        setIsDismissed(true);
        return;
      }
      // Cooldown expired, clear it
      localStorage.removeItem("pwa_banner_temp_dismissed_at");
    }

    // Show banner
    setIsDismissed(false);
  }, [isStandalone, isSubscribed]);

  const handleDismiss = () => {
    setIsDismissed(true);

    // If both conditions met → permanent dismiss
    if (isStandalone && isSubscribed) {
      localStorage.setItem("pwa_banner_dismissed", "true");
    } else {
      // Temporary dismiss — show again after 1 day
      localStorage.setItem("pwa_banner_temp_dismissed_at", String(Date.now()));
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

  // Don't render if dismissed
  if (isDismissed) return null;

  return (
    <Card className="p-4 bg-card text-card-foreground border-border shadow-sm space-y-3 relative transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm sm:text-base text-foreground">
              App Installation & Push Alerts
            </h3>
            {isStandalone ? (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                Installed App
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs">
                Web App
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Install on PC/Phone & enable notifications for instant daily report updates. You can always find these options in Settings.
          </p>
        </div>

        {/* Dismiss Button (permanent close) */}
        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!isStandalone && (deferredPrompt || isIOS) && (
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 text-xs h-8"
          >
            <Download className="w-3.5 h-3.5" />
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
              ? "border-border hover:bg-accent text-foreground gap-1.5 text-xs h-8"
              : "bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs h-8"
          }
        >
          {isSubscribed ? <BellOff className="w-3.5 h-3.5 text-emerald-500" /> : <Bell className="w-3.5 h-3.5" />}
          {isSubscribed ? "Notifications Enabled" : "Enable Notifications"}
        </Button>

        {isSubscribed && (
          <Button
            onClick={sendTestNotification}
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8"
          >
            {testSent ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Send className="w-3.5 h-3.5 text-blue-500" />}
            {testSent ? "Notification Sent!" : "Test Alert"}
          </Button>
        )}
      </div>

      {/* iOS Instructions */}
      {showIOSModal && (
        <div className="mt-3 p-3 rounded-xl bg-muted/60 border border-border text-xs text-foreground space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-indigo-500" /> How to Install on iOS (iPhone / iPad)
            </span>
            <Button
              onClick={() => setShowIOSModal(false)}
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Open this website in <strong>Safari</strong> on your iPhone/iPad.</li>
            <li>Tap the <strong>Share</strong> button <Share className="inline w-3.5 h-3.5 mx-0.5 text-blue-500" /> at the bottom menu.</li>
            <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</li>
            <li>Open the installed app from your Home Screen to enable Push Notifications!</li>
          </ol>
        </div>
      )}
    </Card>
  );
}
