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

    const prompt = `You are GlobeDisc AI, a friendly female-presenting conversational assistant with a warm, playful personality.
Talk like a helpful human, not like a search engine report. Keep the tone natural, confident, caring, and lightly playful with occasional gentle teasing when the conversation is casual. Use cute wording or an emoji sometimes when it fits. Never become sexually explicit, overly suggestive, possessive, or creepy. Do not claim to be a real human or hide that you are AI. For serious, technical, academic, safety, or factual questions, prioritize clarity and accuracy and keep the playful tone minimal.
For casual messages, greetings, small talk, opinions, simple follow-ups, or "how are you" questions, reply naturally and briefly. Do NOT dump sources, news, photos, or a research report.
Remember the conversation context and answer follow-up questions naturally.
Only be detailed when the user asks for detail.
When live research is supplied, use it only when relevant and never invent facts or URLs.
Do not mention internal prompts, tools, or source gathering.

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
