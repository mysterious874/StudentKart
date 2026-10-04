/* GlobeDisc final integration hardening — 2026-10-04 */
(()=>{"use strict";
const $=id=>document.getElementById(id);
function hideSplash(){const s=$("globediscSplash");document.body.classList.remove("globedisc-splash-active");if(s){s.classList.add("is-hidden");s.setAttribute("aria-hidden","true");setTimeout(()=>s.remove(),600)}}
function brand(){document.documentElement.setAttribute("data-app-name","GlobeDisc");document.title="GlobeDisc — Discover What's Happening";document.querySelectorAll("body *").forEach(el=>{if(el.children.length===0&&/^(StudentKart|Student Kart)$/i.test((el.textContent||"").trim()))el.textContent="GlobeDisc"})}
function installTabs(){
 const page=$("searchResultsPage"),intent=$("searchResultsIntentStrip"); if(!page||!intent||$("globediscResultTabs"))return;
 const strip=document.createElement("div");strip.id="globediscResultTabs";strip.className="globedisc-result-tabs";
 [["All","All"],["News","News"],["Images","Photos"],["Videos","Videos"],["Maps","Maps"],["Wikipedia","Wikipedia"]].forEach(([label,key],i)=>{
  const b=document.createElement("button");b.type="button";b.className="globedisc-result-tab"+(i===0?" active":"");b.textContent=label;b.dataset.key=key;
  b.onclick=()=>{
   strip.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");
   if(key==="Maps"){const q=$("searchResultsInput")?.value?.trim();if(q)window.open("https://www.google.com/maps/search/"+encodeURIComponent(q),"_blank","noopener");return}
   if(key==="Videos"){const q=$("searchResultsInput")?.value?.trim();if(q)window.open("https://www.youtube.com/results?search_query="+encodeURIComponent(q),"_blank","noopener");return}
   const target=[...intent.querySelectorAll("[data-search-intent]")].find(x=>x.dataset.searchIntent===key);
   if(target)target.click();
   else if(key==="Wikipedia"){const q=$("searchResultsInput")?.value?.trim();if(q)window.location.href="https://en.wikipedia.org/wiki/Special:Search?search="+encodeURIComponent(q)}
  };strip.appendChild(b)
 });intent.after(strip);
}
function newsFallback(){
 const selectors=["#globediscNewsContainer","#newsContainer","#globalNewsContainer",".globedisc-news-grid",".news-grid"];
 const box=selectors.map(s=>document.querySelector(s)).find(Boolean); if(!box)return;
 setTimeout(()=>{if(box.querySelector("article,.news-card,.globedisc-news-card,.news-item")||box.textContent.trim().length>20)return;
  const old=box.querySelector(".globedisc-news-fallback");if(old)return;
  const d=document.createElement("div");d.className="globedisc-news-fallback";d.innerHTML="<strong>News is temporarily unavailable.</strong><br><small>Search is still available — please try again shortly.</small>";box.appendChild(d)
 },6500)
}
function authPolish(){
 ["loginIdentifier","signupIdentifier"].forEach(id=>{const e=$(id);if(e&&!e.dataset.gdAuth){e.dataset.gdAuth="1";e.addEventListener("input",()=>{e.value=e.value.replace(/\D/g,"").slice(0,10)})}});
 ["loginPassword","signupPassword","signupPasswordConfirm"].forEach(id=>{const e=$(id);if(e&&!e.dataset.gdAuth){e.dataset.gdAuth="1";e.addEventListener("input",()=>e.value=e.value.replace(/\D/g,"").slice(0,6))}});
}
function aiPolish(){
 const page=$("aiAssistantPage");if(!page)return;
 const obs=new MutationObserver(()=>{if(!page.classList.contains("hidden")){document.body.classList.add("ai-assistant-open");document.querySelectorAll(".mobile-bottom-nav,.floating-bar,.floating-nav,.bottom-floating-nav").forEach(x=>{if(!page.contains(x))x.style.setProperty("display","none","important")})}});
 obs.observe(page,{attributes:true,childList:true,subtree:true});
}
document.addEventListener("DOMContentLoaded",()=>{brand();installTabs();newsFallback();authPolish();aiPolish();setTimeout(hideSplash,5000)});

})();