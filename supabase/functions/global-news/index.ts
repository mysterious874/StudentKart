const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const cache = new Map<string, { at: number; articles: any[] }>();
const CACHE_TTL = 60_000;
const rateBuckets = new Map<string, { started: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const clientKey = (req: Request) => req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

const cleanXml = (value: string) => String(value || "")
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/<[^>]*>/g, "")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

const parseGoogleNewsRss = (xml: string) => {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.map((block) => {
    const getTag = (tag: string) => {
      const m = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i"));
      return m ? cleanXml(m[1]) : "";
    };
    const imageMatch = block.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/i);
    const descriptionRaw = getTag("description");
    const descriptionImage = block.match(/<description>[\\s\\S]*?<img[^>]+src=["']([^"']+)["']/i);
    const image = cleanXml(imageMatch?.[1] || descriptionImage?.[1] || "");
    return { title:getTag("title"), url:getTag("link"), source:getTag("source")||"Google News", date:getTag("pubDate"), image, description:descriptionRaw };
  }).filter((item) => item.title && item.url);
};

const fetchGoogleNews = async (query: string) => {
  const key = query.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.articles;

  const rssUrl = "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=en-IN&gl=IN&ceid=IN:en";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(rssUrl, { signal:controller.signal, headers:{ "Accept":"application/rss+xml, application/xml, text/xml, */*", "User-Agent":"GlobeDisc/1.0" } });
    if (!response.ok) throw new Error("Google News HTTP " + response.status);
    const articles = parseGoogleNewsRss(await response.text())
      .sort((a,b)=>new Date(b.date||0).getTime()-new Date(a.date||0).getTime()).slice(0,80);
    cache.set(key,{at:Date.now(),articles});
    return articles;
  } finally { clearTimeout(timeout); }
};

const fetchGdeltBackup = async (query: string) => {
  const gdeltUrl = "https://api.gdeltproject.org/api/v2/doc/doc?query=" + encodeURIComponent(query) + "&mode=artlist&maxrecords=60&timespan=24h&format=json&sort=datedesc";
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),4500);
  try {
    const response = await fetch(gdeltUrl,{signal:controller.signal,headers:{"Accept":"application/json","User-Agent":"GlobeDisc/1.0"}});
    if(!response.ok) throw new Error("GDELT HTTP "+response.status);
    const data=await response.json();
    return (Array.isArray(data?.articles)?data.articles:[]).map((a:any)=>({
      title:String(a?.title||"").trim(),url:String(a?.url||"").trim(),source:String(a?.domain||a?.sourcecountry||"News").trim(),
      date:String(a?.seendate||"").trim(),image:String(a?.socialimage||"").trim(),description:String(a?.snippet||"").trim()
    })).filter((a:any)=>a.title&&a.url);
  } finally { clearTimeout(timeout); }
};

Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  const key=clientKey(req); const now=Date.now(); const bucket=rateBuckets.get(key);
  if(!bucket || now-bucket.started>=RATE_WINDOW_MS) rateBuckets.set(key,{started:now,count:1});
  else { bucket.count+=1; if(bucket.count>RATE_LIMIT) return new Response(JSON.stringify({articles:[],provider:"rate-limited",sourceCount:0,error:"Too many requests. Please try again shortly."}),{status:429,headers:{...corsHeaders,"Content-Type":"application/json","Retry-After":"60"}}); }
  const url=new URL(req.url);
  const query=url.searchParams.get("q")||"(world OR international OR global OR technology OR science OR AI OR space OR business OR economy OR markets OR sports OR entertainment OR culture)";
  try {
    const articles=await fetchGoogleNews(query);
    if(!articles.length) throw new Error("Google News returned no articles");
    return new Response(JSON.stringify({articles,provider:"google-news",sourceCount:new Set(articles.map(a=>a.source)).size}),{
      status:200,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"public, max-age=30"}
    });
  } catch(error) {
    console.warn("Google News failed, using GDELT:",error);
    try {
      const articles=await fetchGdeltBackup(query);
      return new Response(JSON.stringify({articles:articles.slice(0,60),provider:"gdelt-backup",sourceCount:new Set(articles.map(a=>a.source)).size}),{
        status:200,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"public, max-age=15"}
      });
    } catch(backupError) {
      console.error("global-news backup error:",backupError);
      return new Response(JSON.stringify({articles:[],provider:"none",sourceCount:0,error:"Unable to fetch live news"}),{
        status:200,headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }
  }
});