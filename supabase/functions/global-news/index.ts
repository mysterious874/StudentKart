const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") ||
      "(world OR international OR global OR technology OR science OR AI OR space OR business OR economy OR markets OR sports OR entertainment OR culture)";

    const gdeltUrl =
      "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
      encodeURIComponent(query) +
      "&mode=artlist&maxrecords=40&timespan=24h&format=json&sort=datedesc";

    const response = await fetch(gdeltUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({
        articles: [],
        error: "News provider returned HTTP " + response.status
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    const articles = (Array.isArray(data?.articles) ? data.articles : [])
      .map((article) => ({
        title: String(article?.title || "").trim(),
        url: String(article?.url || "").trim(),
        source: String(article?.domain || article?.sourcecountry || "News").trim(),
        date: String(article?.seendate || "").trim(),
        image: String(article?.socialimage || "").trim(),
        description: String(article?.snippet || "").trim()
      }))
      .filter((item) => item.title && item.url);

    return new Response(JSON.stringify({ articles }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("global-news error:", error);
    return new Response(JSON.stringify({
      articles: [],
      error: "Unable to fetch live news"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});