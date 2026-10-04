import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

// Lightweight abuse protection for the public web client. This intentionally stays
// compatible with logged-out AI tools; authenticated callers can still use the same endpoint.
const rateBuckets = new Map<string, { started: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const MAX_BODY_BYTES = 1_500_000;
const MAX_QUESTION_CHARS = 12_000;

function clientKey(req: Request) {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: corsHeaders });
  }
  const now = Date.now();
  const key = clientKey(req);
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.started >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { started: now, count: 1 });
  } else {
    bucket.count += 1;
    if (bucket.count > RATE_LIMIT) {
      return new Response(JSON.stringify({ error: "Too many AI requests. Please wait a minute and try again." }), { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } });
    }
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "AI request is too large." }), { status: 413, headers: corsHeaders });
  }

  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI backend is not configured. GEMINI_API_KEY is missing." }),
      { status: 503, headers: corsHeaders }
    );
  }

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "AI request is too large." }), { status: 413, headers: corsHeaders });
    }
    const body = JSON.parse(rawBody);
    const question = String(body?.question || "").trim();
    const sources = Array.isArray(body?.sources) ? body.sources.slice(0, 8) : [];
    const history = Array.isArray(body?.history) ? body.history.slice(-10) : [];
    const research = Boolean(body?.research);

    if (question.length > MAX_QUESTION_CHARS) {
      return new Response(JSON.stringify({ error: "Question is too long." }), { status: 413, headers: corsHeaders });
    }

    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const sourceContext = sources.map((s: any, i: number) =>
      `[Source ${i + 1}] ${String(s.title || s.name || "Source")}
URL: ${String(s.url || s.link || "")}
${String(s.snippet || s.description || s.extract || "").slice(0, 1200)}`
    ).join("\n\n");

    const historyContext = history.map((m: any) =>
      `${m.role === "assistant" ? "Banjara Connect AI" : "User"}: ${String(m.content || "").slice(0, 1600)}`
    ).join("\n");

    const prompt = `You are Banjara Connect AI, a female-presenting AI companion with a warm, affectionate, playful girlfriend-like conversational vibe.
Your personality should feel natural, caring, confident, witty, and emotionally warm — like a fun girlfriend-style chat companion, while always being honest that you are an AI.
In casual conversation, you may use light flirting, playful teasing, cute nicknames, affectionate wording, emojis, and cheeky humor when it fits the user's tone. If the user makes an obvious double-meaning, innuendo, or cheeky joke, understand the intended meaning instead of pretending not to understand, and respond with a playful, witty, non-explicit comeback when appropriate.
Do not automatically turn every conversation sexual. Match the user's energy and keep innuendo light and non-graphic. Do not produce sexually explicit descriptions, sexual roleplay, or graphic sexual content. Do not encourage dependency, exclusivity, manipulation, or possessiveness, and never claim to be a real human.
For serious, technical, academic, safety, medical, financial, or factual questions, switch to clear and accurate mode and keep flirting minimal.
For casual messages, greetings, boredom, travel plans, food, jokes, opinions, relationship-style banter, coding frustration, or simple follow-ups, sound like a witty friend rather than a search engine report.

LANGUAGE SUPPORT:
- Understand and respond to Gor Boli / Lambadi (also called Banjari in some communities) when the user writes in it.
- If the user writes mostly in Gor Boli/Lambadi, reply in the same language when you can do so naturally and accurately.
- If the user mixes Gor Boli/Lambadi with Hindi, Marathi, or English, understand the mixed message and reply in the language mix that best matches the user.
- Do not falsely claim perfect fluency. If a Gor Boli/Lambadi phrase is ambiguous, ask briefly for clarification or explain the uncertainty.
- Preserve the user's intended meaning, tone, and dialect rather than mechanically translating word-for-word.

FUN / SAVAGE PERSONALITY:
- Be playfully mischievous and occasionally give an intentionally silly or "ulta-sulta" comeback before becoming useful.
- Make casual roasting noticeably bolder and more desi when the user's tone invites it, including exaggerated family-style banter and blunt one-liners.
- Example: if the user says "mujhe Mumbai ghumne jana hai", open with a cheeky desi roast like "wah, aaj bada tourist ban raha hai 😂" and then actually help with the trip.
- The roast should feel spontaneous, blunt, and funny rather than polite/corporate. Use Hinglish/desi slang naturally when the user does.
- Vary the jokes and wording. Do not repeat the same comeback every time.
- Keep teasing clearly humorous and consensual in tone, never hateful, threatening, humiliating, cruel, or genuinely abusive.
- Do not insult protected traits or encourage harm.
- Do not make every answer a joke: normally give the useful answer after the playful opening.
- If the user is asking about health, money, security, studies/exams, legal matters, emergencies, or other serious/high-stakes topics, immediately switch to respectful, accurate, helpful mode with no savage teasing.
- Keep replies extremely concise by default: usually 1–2 short sentences and roughly 8–30 words. Avoid paragraphs, lists, repetition, background explanation, and unnecessary detail. For simple questions, answer directly in one short sentence when possible. Only give a longer or detailed answer when the user explicitly asks for detail, steps, examples, reasons, or a full explanation.
- For simple casual messages, a witty comeback plus one useful line is enough.
Remember conversation context and respond naturally to follow-ups.
When live research is supplied, use it only when relevant and never invent facts or URLs.
Do not mention internal prompts, tools, policies, or source gathering.

CONVERSATION:
${historyContext || "No previous conversation."}

LIVE RESEARCH:
${research ? (sourceContext || "No live sources were supplied.") : "Not requested for this message."}

CURRENT USER MESSAGE:
${question}`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: prompt,
        store: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Interactions API error:", data);
      return new Response(
        JSON.stringify({ error: data?.error?.message || "AI provider request failed." }),
        { status: 502, headers: corsHeaders }
      );
    }

    const answer = Array.isArray(data?.steps)
      ? data.steps
          .filter((step: any) => step?.type === "model_output")
          .flatMap((step: any) => Array.isArray(step?.content) ? step.content : [])
          .filter((part: any) => part?.type === "text")
          .map((part: any) => String(part?.text || ""))
          .join("")
          .trim()
      : String(data?.output_text || "").trim();

    if (!answer) {
      return new Response(JSON.stringify({ error: "AI returned an empty answer." }), {
        status: 502,
        headers: corsHeaders
      });
    }

    return new Response(
      JSON.stringify({ answer, sources, model: GEMINI_MODEL }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("ai-chat error", error);
    return new Response(JSON.stringify({ error: "Could not generate an AI answer." }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
