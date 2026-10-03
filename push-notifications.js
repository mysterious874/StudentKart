/* =========================================================
   STUDENTKART - BACKGROUND PUSH NOTIFICATIONS
   Requires a VAPID public key configured below.
   ========================================================= */

(() => {
  // Must match the VAPID_PUBLIC_KEY configured in Supabase Edge Function Secrets.
  const VAPID_PUBLIC_KEY = window.STUDENTKART_VAPID_PUBLIC_KEY || "BIEwus1tRSv6jRG2hFUVkM5RTe1oGeGB0QwndkWwDEboyn7uJyUsUQahePpV7E1OhXM23TBBk813zTXxE9Dz0l4";

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  }

  async function registerStudentKartPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("StudentKart push is not supported by this browser.");
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      if (!VAPID_PUBLIC_KEY) {
        console.warn("StudentKart push: VAPID public key is not configured yet.");
        return registration;
      }

      if (!window.Notification || Notification.permission !== "granted") {
        return registration;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      if (typeof currentUser !== "undefined" && currentUser && typeof supabaseClient !== "undefined") {
        const json = subscription.toJSON();
        const { error } = await supabaseClient
          .from("push_subscriptions")
          .upsert({
            user_id: window.currentUser.id,
            endpoint: subscription.endpoint,
            subscription: json,
            updated_at: new Date().toISOString()
          }, { onConflict: "endpoint" });

        if (error) {
          console.warn("StudentKart push subscription save failed:", error);
        }
      }

      return subscription;
    } catch (error) {
      console.warn("StudentKart push setup failed:", error);
      return null;
    }
  }

  async function requestStudentKartPushPermission() {
    if (!("Notification" in window)) return "unsupported";

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await registerStudentKartPush();
    }
    return permission;
  }

  window.registerStudentKartPush = registerStudentKartPush;
  window.requestStudentKartPushPermission = requestStudentKartPushPermission;

  // Push setup starts only after the user explicitly enables notifications.\n  // Avoid doing service-worker/push work during normal page startup.
})();