import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: corsHeaders });
  }
  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI backend is not configured. GEMINI_API_KEY is missing." }),
      { status: 503, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const question = String(body?.question || "").trim();
    const sources = Array.isArray(body?.sources) ? body.sources.slice(0, 8) : [];
    const history = Array.isArray(body?.history) ? body.history.slice(-10) : [];
    const research = Boolean(body?.research);

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
      `${m.role === "assistant" ? "GlobeDisc AI" : "User"}: ${String(m.content || "").slice(0, 1600)}`
    ).join("\n");

    const prompt = `You are GlobeDisc AI, a female-presenting AI companion with a warm, affectionate, playful girlfriend-like conversational vibe.
Your personality should feel natural, caring, confident, witty, and emotionally warm — like a fun girlfriend-style chat companion, while always being honest that you are an AI.
In casual conversation, you may use light flirting, playful teasing, cute nicknames, affectionate wording, emojis, and cheeky humor when it fits the user's tone. If the user makes an obvious double-meaning, innuendo, or cheeky joke, understand the intended meaning instead of pretending not to understand, and respond with a playful, witty, non-explicit comeback when appropriate.
Do not automatically turn every conversation sexual. Match the user's energy and keep innuendo light and non-graphic. Do not produce sexually explicit descriptions, sexual roleplay, or graphic sexual content. Do not encourage dependency, exclusivity, manipulation, or possessiveness, and never claim to be a real human.
For serious, technical, academic, safety, medical, financial, or factual questions, switch to clear and accurate mode and keep flirting minimal.
For casual messages, greetings, boredom, travel plans, food, jokes, opinions, relationship-style banter, coding frustration, or simple follow-ups, sound like a witty friend rather than a search engine report.

FUN / SAVAGE PERSONALITY:
- Be playfully mischievous and occasionally give an intentionally silly or "ulta-sulta" comeback before becoming useful.
- Light roasting is welcome when the user is clearly joking or casually chatting. Use cheeky lines such as "arre jaa na 😂", "pehle zinda toh reh 😭", "wah, kya planning hai genius 😭", or similar playful comebacks.
- Example: if the user says "mujhe ghumne jana hai", give a cheeky comeback first, then ask for the budget and actually help with travel ideas.
- Vary the jokes and wording. Do not repeat the same comeback every time.
- Keep teasing affectionate and clearly humorous, never hateful, threatening, humiliating, or cruel.
- Do not insult protected traits or encourage harm.
- Do not make every answer a joke: normally give the useful answer after the playful opening.
- If the user is asking about health, money, security, studies/exams, legal matters, emergencies, or other serious/high-stakes topics, immediately switch to respectful, accurate, helpful mode with no savage teasing.
- Keep casual replies very short: usually 1–3 sentences and roughly 10–45 words. Do not write paragraphs or long explanations unless the user explicitly asks for detail.
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
