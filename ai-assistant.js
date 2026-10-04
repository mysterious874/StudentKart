/* GlobeDisc AI assistant */
(function(){
"use strict";
const SUPABASE_URL="https://yymzfjfkmsrymqhpnfqz.supabase.co";
const SUPABASE_KEY="sb_publishable_tEePI-aSGDkt_2S6oiEfPw_Hy_mEXkw";
const $=id=>document.getElementById(id);
const AI_HISTORY_KEY="globedisc_ai_chat_history_v1";
const AI_HISTORY_BACKUP_KEY="globedisc_ai_chat_history_backup_v1";
let history=loadAIHistory();
let aiHasOpenedOnce=false;
const AI_REOPEN_MESSAGES=[
  "There you are 😌 I was wondering when you’d come back. What are we talking about this time? ✨",
  "Back already? I’m not complaining 😉 Tell me what’s on your mind.",
  "Look who’s back 💫 Come on, tell me everything. I’m listening.",
  "You came back… cute 😏 Now, what shall we get curious about together?",
  "Missed our little chats already? 😌 Come here, ask me something."
];
function loadAIHistory(){try{const saved=localStorage.getItem(AI_HISTORY_KEY)||sessionStorage.getItem(AI_HISTORY_BACKUP_KEY);const parsed=saved?JSON.parse(saved):[];return Array.isArray(parsed)?parsed.slice(-20):[];}catch(_){return [];}}
function saveAIHistory(){const value=JSON.stringify(history.slice(-20));try{localStorage.setItem(AI_HISTORY_KEY,value);}catch(_){} try{sessionStorage.setItem(AI_HISTORY_BACKUP_KEY,value);}catch(_){} }

let aiUserNearBottom=true;
function scrollAIToBottom(behavior="auto"){
 const box=$("aiAssistantMessages"); if(!box)return;
 box.scrollTo({top:box.scrollHeight,behavior});
}
function updateAIViewport(){
 const page=$("aiAssistantPage");
 const vv=window.visualViewport;
 if(!page||!vv)return;
 const keyboardOffset=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
 page.style.setProperty("--ai-keyboard-offset",keyboardOffset+"px");
 page.style.setProperty("--ai-visual-height",vv.height+"px");
 if(aiUserNearBottom) requestAnimationFrame(()=>scrollAIToBottom("auto"));
}
function addMessage(role,text){
 const box=$("aiAssistantMessages"); if(!box)return null;
 $("aiAssistantWelcome")?.classList.add("hidden");
 const item=document.createElement("div");
 item.className="ai-assistant-message "+(role==="user"?"is-user":"is-ai");
 if(role!=="user"){
  const avatar=document.createElement("span");
  avatar.className="ai-assistant-message-avatar";
  avatar.innerHTML='<img src="/icons/globedisc-icon-v2.svg" alt="GlobeDisc AI">';
  item.appendChild(avatar);
 }
 const bubble=document.createElement("div"); bubble.className="ai-assistant-message-bubble"; bubble.textContent=String(text||"");
 item.appendChild(bubble); box.appendChild(item);
 requestAnimationFrame(()=>scrollAIToBottom("auto"));
 return item;
}
function renderSavedAIHistory(){
 const box=$("aiAssistantMessages"); if(!box)return;
 box.innerHTML="";
 if(!history.length){
  box.innerHTML='<div id="aiAssistantWelcome" class="ai-assistant-welcome"><div class="ai-assistant-welcome-icon"><img src="/icons/globedisc-icon-v2.svg" alt="GlobeDisc"></div><h1>What can I help you with?</h1><p>Ask anything. GlobeDisc AI will bring together answers and useful sources.</p></div>';
  return;
 }
 history.forEach(m=>addMessage(m.role==="assistant"?"assistant":"user",m.content));
 requestAnimationFrame(()=>scrollAIToBottom("auto"));
}
function openAI(){
 const p=$("aiAssistantPage"); if(!p)return;
 p.classList.remove("hidden"); document.body.classList.add("ai-assistant-open","ai-assistant-page-active");
 history.replaceState({globediscAIBase:true},""); history.pushState({globediscAI:true},"");
 renderSavedAIHistory();
 if(aiHasOpenedOnce) addMessage("assistant",AI_REOPEN_MESSAGES[Math.floor(Math.random()*AI_REOPEN_MESSAGES.length)]);
 aiHasOpenedOnce=true;
 document.querySelectorAll(".mobile-bottom-nav,.bottom-floating-nav,.floating-bottom-nav,.floating-bar,.floating-nav").forEach(nav=>{nav.style.setProperty("display","none","important");nav.style.setProperty("visibility","hidden","important");nav.style.setProperty("pointer-events","none","important");});
 window.scrollTo({top:0,behavior:"auto"});
 const input=$("aiAssistantInput");
 if(input){setTimeout(()=>{input.focus({preventScroll:true});updateAIViewport();},80);}

}
function closeAI(){
 const page=$("aiAssistantPage");
 if(page)page.classList.add("hidden");
 document.body.classList.remove("ai-assistant-open","ai-assistant-page-active");
 document.querySelectorAll(".mobile-bottom-nav,.bottom-floating-nav,.floating-bottom-nav,.floating-bar,.floating-nav").forEach(nav=>{nav.style.removeProperty("display");nav.style.removeProperty("visibility");nav.style.removeProperty("pointer-events");});
 const homeSection=document.getElementById("home");
 if(homeSection){
  homeSection.classList.remove("hidden");
  homeSection.style.removeProperty("display");
 }
 document.documentElement.classList.remove("ai-assistant-open");
 document.body.classList.remove("ai-assistant-page-active");
 window.scrollTo({top:0,behavior:"auto"});
}
async function ask(question){
 const q=String(question||"").trim(); if(!q)return;
 const send=$("aiAssistantSend"),input=$("aiAssistantInput");
 if(send)send.disabled=true;if(input)input.readOnly=true;
 addMessage("user",q);const pending=addMessage("assistant","Thinking…");
 try{
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),30000); const response=await fetch(SUPABASE_URL+"/functions/v1/ai-chat",{method:"POST",signal:controller.signal,headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({question:q,history,research:false})});
  const data=await response.json().catch(()=>({})); clearTimeout(timeout);
  if(!response.ok||!data.answer)throw new Error(data.error||"AI service is temporarily unavailable.");
  const bubble=pending?.querySelector(".ai-assistant-message-bubble");if(bubble)bubble.textContent=data.answer;
  if (String(data.answer).length > 700 && document.activeElement === input) {
   input.blur();
   window.scrollTo({top:0,behavior:"auto"});
  }
  history.push({role:"user",content:q},{role:"assistant",content:data.answer});history=history.slice(-20);saveAIHistory();
 }catch(error){
  const bubble=pending?.querySelector(".ai-assistant-message-bubble");if(bubble)bubble.textContent=error?.name==="AbortError"?"AI is taking too long. Please try again.":(error?.message||"Could not get an AI answer.");
 }finally{
  if(send)send.disabled=false;if(input){
   input.readOnly=false;
   input.value="";
   setTimeout(()=>{input.focus({preventScroll:true});updateAIViewport();scrollAIToBottom("smooth");},40);
  }
 }
}
function bindAIControls(){
 const button=$("askWithAiButton");
 if(button && button.dataset.aiBound!=="1"){
  button.dataset.aiBound="1";
  button.addEventListener("click",function(event){
   event.preventDefault();
   event.stopPropagation();
   openAI();
  });
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 bindAIControls();
 const box=$("aiAssistantMessages");
 box?.addEventListener("scroll",()=>{
  aiUserNearBottom=(box.scrollHeight-box.scrollTop-box.clientHeight)<100;
 });
 if(window.visualViewport){
  window.visualViewport.addEventListener("resize",updateAIViewport);
  window.visualViewport.addEventListener("scroll",updateAIViewport);
 }
 window.addEventListener("resize",updateAIViewport);
 updateAIViewport();
 $("aiAssistantBack")?.addEventListener("click",closeAI);
 $("aiAssistantNewChat")?.addEventListener("click",()=>{
  history=[];try{localStorage.removeItem(AI_HISTORY_KEY);}catch(_){} try{sessionStorage.removeItem(AI_HISTORY_BACKUP_KEY);}catch(_){} const box=$("aiAssistantMessages");
  if(box)box.innerHTML='<div id="aiAssistantWelcome" class="ai-assistant-welcome"><div class="ai-assistant-welcome-icon"><img src="/icons/globedisc-icon-v2.svg" alt="GlobeDisc"></div><h1>What can I help you with?</h1><p>Ask anything. GlobeDisc AI will bring together answers and useful sources.</p></div>';
  const input=$("aiAssistantInput");
  if(input){setTimeout(()=>{input.focus({preventScroll:true});updateAIViewport();},50);}
 });
 $("aiAssistantForm")?.addEventListener("submit",e=>{e.preventDefault();ask($("aiAssistantInput")?.value);});
});
})();
window.openGlobeDiscAI=openAI;
window.closeGlobeDiscAI=closeAI;
window.addEventListener("load",bindAIControls,{once:true});
