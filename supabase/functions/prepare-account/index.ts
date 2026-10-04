import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;
const requests = new Map<string, { count: number; resetAt: number }>();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

function normalizePhone(raw: unknown) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (!/^\d{10}$/.test(digits)) return null;
  return "+91" + digits;
}

function internalEmail(phone: string) {
  return `account+${phone.replace(/\D/g, "")}@globedisc.app`;
}

function allowedRequest(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const key = forwarded.split(",")[0].trim() || "anonymous";
  const now = Date.now();
  const current = requests.get(key);
  if (!current || now >= current.resetAt) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!allowedRequest(req)) return json({ error: "Too many attempts. Try again in a minute." }, 429);

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 16_000) return json({ error: "Request too large" }, 413);

    const body = await req.json();
    const phone = normalizePhone(body?.phone);
    const password = String(body?.password ?? "");

    if (!phone) return json({ error: "Enter a valid 10-digit mobile number." }, 400);
    if (!/^\d{6}$/.test(password)) return json({ error: "Password must be exactly 6 digits." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = internalEmail(phone);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        phone,
        auth_phone: phone,
      },
    });

    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (message.includes("already") || message.includes("registered") || message.includes("duplicate")) {
        return json({ error: "An account already exists for this mobile number." }, 409);
      }
      console.error("createUser failed:", error);
      return json({ error: "Could not create account." }, 400);
    }

    return json({ success: true, user_id: data.user?.id || null });
  } catch (error) {
    console.error("prepare-account failed:", error);
    return json({ error: "Could not create account." }, 500);
  }
});
