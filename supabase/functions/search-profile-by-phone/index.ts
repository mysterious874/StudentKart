import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;
const MAX_BODY_BYTES = 4_000;

const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: cors });

function norm(v: unknown) {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  return /^\d{10}$/.test(d) ? "+91" + d : null;
}

function allowed(key: string) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: ue } = await client.auth.getUser(auth.slice(7));
  if (ue || !user) return json({ error: "Unauthorized" }, 401);

  const ip = req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (!allowed("user:" + user.id) || !allowed("ip:" + ip)) {
    return json({ error: "Too many member searches. Try again in a minute." }, 429);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "Request too large." }, 413);
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const phone = norm(body?.phone);
  if (!phone) return json({ error: "Invalid mobile number" }, 400);

  const { data, error } = await client
    .from("profiles")
    .select("id,name,city,state")
    .eq("phone", phone)
    .neq("id", user.id)
    .maybeSingle();

  if (error) return json({ error: "Search failed" }, 500);
  return json({ success: true, profile: data || null });
});
