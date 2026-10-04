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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    let response;
    try {
      response = await fetch(gdeltUrl, {
        signal: controller.signal,
        headers: { "Accept": "application/json", "User-Agent": "StudentKart/1.0" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error("GDELT HTTP " + response.status);
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
    console.warn("GDELT failed. Falling back to Google News RSS:", error);

    try {
      const rssUrl =
        "https://news.google.com/rss/search?q=" +
        encodeURIComponent(query) +
        "&hl=en-US&gl=US&ceid=US:en";

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let rssResponse;
      try {
        rssResponse = await fetch(rssUrl, {
          signal: controller.signal,
          headers: {
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "User-Agent": "StudentKart/1.0"
          }
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!rssResponse.ok) {
        throw new Error("Google News HTTP " + rssResponse.status);
      }

      const xml = await rssResponse.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

      const articles = items.map((block) => {
        const getTag = (tag) => {
          const match = block.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">", "i"));
          return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, "").trim() : "";
        };

        return {
          title: getTag("title"),
          url: getTag("link"),
          source: getTag("source") || "Google News",
          date: getTag("pubDate"),
          image: "",
          description: getTag("description")
        };
      }).filter((item) => item.title && item.url);

      return new Response(JSON.stringify({
        articles: articles.slice(0, 40),
        provider: "google-news"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (fallbackError) {
      console.error("global-news fallback error:", fallbackError);
      return new Response(JSON.stringify({
        articles: [],
        provider: "none",
        error: "Unable to fetch live news"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
});