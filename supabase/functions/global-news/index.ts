const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const cleanXml = (value: string) =>
  String(value || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const parseGoogleNewsRss = (xml: string) => {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.map((block) => {
    const getTag = (tag: string) => {
      const match = block.match(
        new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i"),
      );
      return match ? cleanXml(match[1]) : "";
    };

    const title = getTag("title");
    const url = getTag("link");
    const source = getTag("source") || "Google News";
    const date = getTag("pubDate");
    const description = getTag("description");

    return { title, url, source, date, image: "", description };
  }).filter((item) => item.title && item.url);
};

const fetchGoogleNews = async (query: string) => {
  const queries = [
    query,
    query + " latest news",
    query + " local regional news",
  ];

  const responses = await Promise.allSettled(
    queries.map(async (q) => {
      const rssUrl =
        "https://news.google.com/rss/search?q=" +
        encodeURIComponent(q) +
        "&hl=en-IN&gl=IN&ceid=IN:en";

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetch(rssUrl, {
          signal: controller.signal,
          headers: {
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "User-Agent": "GlobeDisc/1.0",
          },
        });
        if (!response.ok) throw new Error("Google News HTTP " + response.status);
        return parseGoogleNewsRss(await response.text());
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  const seen = new Set<string>();
  const articles: any[] = [];

  for (const result of responses) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const key = item.url.replace(/[?#].*$/, "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      articles.push(item);
    }
  }

  articles.sort((a, b) =>
    new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  return articles.slice(0, 80);
};

const fetchGdeltBackup = async (query: string) => {
  const gdeltUrl =
    "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
    encodeURIComponent(query) +
    "&mode=artlist&maxrecords=60&timespan=24h&format=json&sort=datedesc";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(gdeltUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "GlobeDisc/1.0",
      },
    });
    if (!response.ok) throw new Error("GDELT HTTP " + response.status);

    const data = await response.json();
    return (Array.isArray(data?.articles) ? data.articles : [])
      .map((article: any) => ({
        title: String(article?.title || "").trim(),
        url: String(article?.url || "").trim(),
        source: String(article?.domain || article?.sourcecountry || "News").trim(),
        date: String(article?.seendate || "").trim(),
        image: String(article?.socialimage || "").trim(),
        description: String(article?.snippet || "").trim(),
      }))
      .filter((item: any) => item.title && item.url);
  } finally {
    clearTimeout(timeout);
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q") ||
    "(world OR international OR global OR technology OR science OR AI OR space OR business OR economy OR markets OR sports OR entertainment OR culture)";

  try {
    const articles = await fetchGoogleNews(query);

    if (!articles.length) {
      throw new Error("Google News returned no articles");
    }

    return new Response(JSON.stringify({
      articles,
      provider: "google-news",
      sourceCount: new Set(articles.map((item) => item.source)).size,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.warn("Google News failed. Falling back to GDELT:", error);

    try {
      const articles = await fetchGdeltBackup(query);
      return new Response(JSON.stringify({
        articles: articles.slice(0, 60),
        provider: "gdelt-backup",
        sourceCount: new Set(articles.map((item) => item.source)).size,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (backupError) {
      console.error("global-news backup error:", backupError);
      return new Response(JSON.stringify({
        articles: [],
        provider: "none",
        sourceCount: 0,
        error: "Unable to fetch live news",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
});
