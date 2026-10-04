/* GlobeDisc Discovery Controls — unified interaction layer */
(function(){
"use strict";
function qs(id){return document.getElementById(id)}
function goSearch(){
 const input=qs("heroSearchInput"), q=String(input?.value||"").trim();
 if(!q)return;
 if(typeof window.showSearchResultsPage==="function") window.showSearchResultsPage(q);
 else if(typeof window.performSearch==="function") window.performSearch();
}
function syncFilters(){
 const pairs=[["heroFilterCategory","categoryFilter"],["heroFilterMin","minPrice"],["heroFilterMax","maxPrice"],["heroFilterLocation","locationFilter"],["heroFilterCondition","conditionFilter"],["heroFilterSort","sortFilter"]];
 pairs.forEach(([a,b])=>{const x=qs(a),y=qs(b);if(x&&y)y.value=x.value});
}
function topicLoad(topic){
 const grid=qs("worldNewsGrid"); if(!grid)return;
 if(topic==="All"){ if(typeof window.loadGlobalDiscoveryHomepage==="function") window.loadGlobalDiscoveryHomepage(); return; }
 const map={Religion:"religion faith spirituality temple church mosque festival beliefs",Politics:"India politics government parliament election policy",Business:"India business economy markets finance companies",Technology:"technology AI software smartphones cybersecurity",Science:"science research space NASA health discovery",Health:"health medicine wellness public health",Sports:"India sports cricket football tennis",Entertainment:"India entertainment cinema music streaming",Gaming:"gaming video games esports PlayStation Xbox",Environment:"environment climate pollution sustainability",Education:"India education schools colleges exams",Auto:"India automobiles cars bikes EV",Travel:"India travel tourism destinations flights hotels",Lifestyle:"India lifestyle food fashion wellness",Space:"space NASA astronomy rockets satellites",Trending:"India trending latest news"};
 const query=map[topic]||topic+" latest India news";
 grid.innerHTML='<div class="world-news-empty"><i class="fas fa-spinner fa-spin"></i><h3>Loading '+String(topic).replace(/[&<>"]/g,"")+' news…</h3><p>Fetching the latest stories.</p></div>';
 const base=window.SUPABASE_URL||"https://yymzfjfkmsrymqhpnfqz.supabase.co";
 const key=window.SUPABASE_KEY||"sb_publishable_tEePI-aSGDkt_2S6oiEfPw_Hy_mEXkw";
 const queries=topic==="Religion"?["India religion faith temple mosque church gurdwara festival spirituality latest news","Hindu Muslim Christian Sikh Jain Buddhist religious festivals India latest news"]:[query];
 Promise.allSettled(queries.map(q=>fetch(base+"/functions/v1/global-news?q="+encodeURIComponent(q),{headers:{apikey:key,Accept:"application/json"}})))
 .then(async rs=>{
   const articles=[];
   for(const r of rs)if(r.status==="fulfilled"&&r.value.ok){try{const d=await r.value.json();const a=Array.isArray(d)?d:(d.articles||d.items||d.results||[]);if(Array.isArray(a))articles.push(...a)}catch{}}
   if(!articles.length){grid.innerHTML='<div class="world-news-empty"><i class="fas fa-newspaper"></i><h3>No '+topic+' news found</h3><p>Try another topic or refresh.</p></div>';return}
   const seen=new Set(), unique=articles.filter(a=>{const k=String(a.url||a.link||a.title||"").toLowerCase();if(!k||seen.has(k))return false;seen.add(k);return true}).slice(0,24);
   const renderer=window.renderWorldNewsItems||window.renderNewsItems;
   if(typeof renderer==="function"){renderer(unique,grid);return}
   const esc=s=>String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
   grid.innerHTML='<div class="world-news-card-grid">'+unique.map(a=>'<article class="world-news-card"><a href="'+esc(a.url||a.link||"#")+'" target="_blank" rel="noopener"><img src="'+esc(a.image||a.image_url||a.thumbnail||"")+'" alt=""><div><strong>'+esc(a.title||"News")+'</strong><small>'+esc(a.source||a.publisher||"Web")+'</small></div></a></article>').join("")+'</div>';
 }).catch(()=>{grid.innerHTML='<div class="world-news-empty"><i class="fas fa-triangle-exclamation"></i><h3>News could not be loaded</h3><p>Please try again.</p></div>'});
}
window.selectBanjaraNewsTopic=topicLoad;
function bind(){
 const section=qs("home"); if(!section||section.dataset.discoveryUnified==="1")return;
 section.dataset.discoveryUnified="1";
 section.addEventListener("click",function(e){
   const t=e.target.closest("button,a"); if(!t||!section.contains(t))return;
   const id=t.id, topic=t.dataset.newsTopic;
   if(!id && !topic)return;
   if(id==="heroSearchButton"){e.preventDefault();e.stopImmediatePropagation();goSearch();return}
   if(id==="heroVoiceButton"){e.preventDefault();e.stopImmediatePropagation();location.href="/voice-to-text.html";return}
   if(id==="heroLensButton"){e.preventDefault();e.stopImmediatePropagation();location.href="/globedisc-lens.html";return}
   if(id==="heroFilterButton"){e.preventDefault();e.stopImmediatePropagation();qs("heroFilterPanel")?.classList.toggle("hidden");return}
   if(id==="heroFilterClose"){e.preventDefault();e.stopImmediatePropagation();qs("heroFilterPanel")?.classList.add("hidden");return}
   if(id==="heroFilterApply"){e.preventDefault();e.stopImmediatePropagation();syncFilters();if(typeof window.applyFilters==="function")window.applyFilters();qs("heroFilterPanel")?.classList.add("hidden");return}
   if(id==="heroFilterClear"){e.preventDefault();e.stopImmediatePropagation();["heroFilterCategory","heroFilterCondition","heroFilterSort"].forEach(x=>{const n=qs(x);if(n)n.value=x==="heroFilterSort"?"newest":"all"});["heroFilterMin","heroFilterMax","heroFilterLocation"].forEach(x=>{const n=qs(x);if(n)n.value=""});syncFilters();if(typeof window.applyFilters==="function")window.applyFilters();return}
   if(topic){e.preventDefault();e.stopImmediatePropagation();section.querySelectorAll(".globedisc-news-topic").forEach(x=>x.classList.remove("active"));t.classList.add("active");topicLoad(String(topic));return}
   if(id==="askWithAiButton"){e.preventDefault();e.stopImmediatePropagation();if(typeof window.openGlobeDiscAI==="function")window.openGlobeDiscAI();return}
 });
 const input=qs("heroSearchInput");
 input?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();goSearch()}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
window.addEventListener("load",bind,{once:true});
})();