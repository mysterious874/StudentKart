import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async req => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
        status: 405, headers: { "content-type": "application/json" }
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "Authentication required" }), {
        status: 401, headers: { "content-type": "application/json" }
      });
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid or expired session" }), {
        status: 401, headers: { "content-type": "application/json" }
      });
    }

    const userId = userData.user.id;
    const payload = await req.json().catch(() => ({}));
    if (payload?.confirmation !== "DELETE") {
      return new Response(JSON.stringify({ ok: false, error: "Deletion confirmation required" }), {
        status: 400, headers: { "content-type": "application/json" }
      });
    }

    // Remove application data owned by or directly connected to this account.
    const deletions = [
      ["messages", "sender_id", userId],
      ["messages", "receiver_id", userId],
      ["inquiries", "buyer_id", userId],
      ["inquiries", "seller_id", userId],
      ["wishlists", "user_id", userId],
      ["products", "user_id", userId],
      ["hidden_chats", "user_id", userId],
      ["notifications", "user_id", userId],
      ["push_subscriptions", "user_id", userId],
      ["profiles", "id", userId]
    ];

    for (const [table, column, value] of deletions) {
      const { error } = await admin.from(table).delete().eq(column, value);
      // Some installations may not have an optional table/column. Continue
      // so one optional cleanup failure does not prevent Auth deletion.
      if (error) console.warn("Optional cleanup failed:", table, column, error.message);
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  } catch (error) {
    console.error("delete-account error:", error);
    return new Response(JSON.stringify({
      ok: false,
      error: error?.message || "Account deletion failed"
    }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }
});