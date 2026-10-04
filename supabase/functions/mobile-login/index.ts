import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

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

function normalizePhone(raw: unknown) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  return /^\d{10}$/.test(digits) ? "+91" + digits : null;
}

function internalEmail(phone: string) {
  return "account+" + phone.replace(/\D/g, "") + "@banjaraconnect.app";
}

function allowed(req: Request, scope: string, identity?: string) {
  const ip = req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const key = scope === "phone" ? "phone|" + String(identity || "") : "ip|" + ip;
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || now >= current.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!allowed(req, "ip")) return json({ error: "Too many attempts. Try again in a minute." }, 429);

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8_000) return json({ error: "Request too large" }, 413);
    const body = JSON.parse(rawBody);
    const phone = normalizePhone(body?.phone);
    const password = String(body?.password ?? "");

    if (!phone || !/^\d{6}$/.test(password)) {
      return json({ error: "Invalid mobile number or password." }, 400);
    }

    if (!allowed(req, "phone", phone)) return json({ error: "Too many login attempts for this mobile number. Try again in a minute." }, 429);

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email: internalEmail(phone),
      password,
    });

    if (error || !data.session || !data.user) {
      return json({ error: "Mobile number or password is incorrect." }, 401);
    }

    // Session exclusivity is enforced by the application-level active_session_id
    // guard. The Admin Auth "signOut(..., others)" endpoint is not reliable here
    // because it can reject the service-role request as an invalid JWT.
    // Returning the fresh session lets the client register its new session id;
    // existing sessions are then signed out by get-active-session polling.

    return json({
      success: true,
      session: data.session,
      user: data.user,
    });
  } catch (error) {
    console.error("mobile-login failed:", error);
    return json({ error: "Could not complete login." }, 500);
  }
});
