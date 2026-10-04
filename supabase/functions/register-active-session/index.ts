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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const token = authHeader.slice(7);
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const sessionId = String(body?.session_id || "").trim();
    const phone = String(body?.phone || "").replace(/\D/g, "");

    if (!/^[A-Za-z0-9_-]{20,128}$/.test(sessionId)) {
      return json({ error: "Invalid session id." }, 400);
    }

    const normalizedPhone = phone.length === 12 && phone.startsWith("91") ? phone.slice(2) : phone;
    if (!/^\d{10}$/.test(normalizedPhone)) return json({ error: "Invalid mobile number." }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle();

    const payload = {
      id: authData.user.id,
      phone: "+91" + normalizedPhone,
      active_session_id: sessionId,
      updated_at: new Date().toISOString(),
      ...(existing ? {} : { name: String(authData.user.user_metadata?.name || "Banjara Member") }),
    };

    const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) {
      console.error("register-active-session profile upsert failed:", error.message);
      return json({ error: "Could not prepare account." }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("register-active-session failed:", error);
    return json({ error: "Could not prepare account." }, 500);
  }
});
