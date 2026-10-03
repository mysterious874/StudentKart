import webpush from "npm:web-push";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@studentkart.in";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async req => {
  try {
    const payload = await req.json();
    const record = payload?.record || payload?.new || payload;

    if (!record?.receiver_id || !record?.message) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid message payload" }), {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders }
      });
    }

    let body = String(record.message);
    if (body.startsWith("__STUDENTKART_MEDIA__")) {
      try {
        const media = JSON.parse(body.slice("__STUDENTKART_MEDIA__".length));
        body = media.mediaType === "video"
          ? "Sent you a video."
          : "Sent you a photo.";
        if (media.caption) body += " " + media.caption;
      } catch (_) {
        body = "You have received a new media message.";
      }
    }

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, subscription")
      .eq("user_id", record.receiver_id);

    if (error) throw error;

    const results = await Promise.allSettled(
      (subscriptions || []).map(async row => {
        try {
          await webpush.sendNotification(row.subscription, JSON.stringify({
            title: "StudentKart • New message",
            body: body.slice(0, 180),
            icon: "/icons/studentkart-icon.svg",
            badge: "/icons/studentkart-icon.svg",
            tag: "studentkart-chat-" + String(record.inquiry_id || record.id),
            url: "/#chat"
          }));
          return { endpoint: row.endpoint, ok: true };
        } catch (error) {
          const statusCode = error?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", row.id);
          }
          return { endpoint: row.endpoint, ok: false, statusCode };
        }
      })
    );

    return new Response(JSON.stringify({
      ok: true,
      sent: results.filter(r => r.status === "fulfilled" && r.value?.ok).length,
      total: subscriptions?.length || 0
    }), {
      headers: { "content-type": "application/json", ...corsHeaders }
    });
  } catch (error) {
    console.error("send-chat-push error:", error);
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Push failed" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
});
