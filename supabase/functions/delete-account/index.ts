import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Authentication required." }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Remove user-owned application data first. Public tables do not rely on
    // an auth.users foreign-key cascade, so deleting the Auth user alone can
    // otherwise leave an orphaned profile and social records.
    const chatMemberships = await admin.from("chat_members").select("chat_id").eq("user_id", user.id);
    const chatIds = (chatMemberships.data || []).map((row: any) => row.chat_id).filter(Boolean);

    if (chatIds.length) {
      await admin.from("messages").delete().eq("sender_id", user.id);
      await admin.from("message_hidden").delete().eq("user_id", user.id);
      await admin.from("message_reactions").delete().eq("user_id", user.id);
      await admin.from("chat_members").delete().eq("user_id", user.id);
    }

    const ownedChats = await admin.from("chats").select("id").eq("created_by", user.id);
    const ownedChatIds = (ownedChats.data || []).map((row: any) => row.id).filter(Boolean);
    if (ownedChatIds.length) {
      await admin.from("messages").delete().in("chat_id", ownedChatIds);
      await admin.from("message_hidden").delete().in("message_id", ownedChatIds);
      await admin.from("chat_members").delete().in("chat_id", ownedChatIds);
      await admin.from("chats").delete().in("id", ownedChatIds);
    }

    const ownedPosts = await admin.from("posts").select("id").eq("author_id", user.id);
    const postIds = (ownedPosts.data || []).map((row: any) => row.id).filter(Boolean);
    if (postIds.length) {
      await admin.from("post_likes").delete().in("post_id", postIds);
      await admin.from("post_saves").delete().in("post_id", postIds);
      await admin.from("comments").delete().in("post_id", postIds);
      await admin.from("post_comments").delete().in("post_id", postIds);
      await admin.from("post_reactions").delete().in("post_id", postIds);
      await admin.from("posts").delete().in("id", postIds);
    }

    const ownedCommunities = await admin.from("communities").select("id").eq("created_by", user.id);
    const communityIds = (ownedCommunities.data || []).map((row: any) => row.id).filter(Boolean);
    if (communityIds.length) {
      await admin.from("community_members").delete().in("community_id", communityIds);
      await admin.from("events").delete().in("community_id", communityIds);
      await admin.from("posts").delete().in("community_id", communityIds);
      await admin.from("communities").delete().in("id", communityIds);
    }

    await admin.from("connections").delete().or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    await admin.from("community_members").delete().eq("user_id", user.id);
    await admin.from("event_attendees").delete().eq("user_id", user.id);
    await admin.from("events").delete().eq("created_by", user.id);
    await admin.from("notifications").delete().eq("user_id", user.id);
    await admin.from("reports").delete().eq("reporter_id", user.id);
    await admin.from("user_blocks").delete().or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    await admin.from("blocked_users").delete().or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    await admin.from("ai_chat_histories").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("id", user.id);

    await admin.auth.admin.signOut(user.id, "global");
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("deleteUser failed:", deleteError.message);
      return json({ error: "Could not delete account." }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("delete-account failed:", error);
    return json({ error: "Could not delete account." }, 500);
  }
});
