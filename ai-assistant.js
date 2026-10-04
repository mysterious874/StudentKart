/* GlobeDisc AI assistant */
(function(){
"use strict";
const SUPABASE_URL="https://yymzfjfkmsrymqhpnfqz.supabase.co";
const SUPABASE_KEY="sb_publishable_tEePI-aSGDkt_2S6oiEfPw_Hy_mEXkw";
const $=id=>document.getElementById(id);
let history=[];
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
function openAI(){
 const p=$("aiAssistantPage"); if(!p)return;
 p.classList.remove("hidden"); document.body.classList.add("ai-assistant-open"); const globalNav=document.querySelector(".mobile-bottom-nav"); if(globalNav){globalNav.style.setProperty("display","none","important");globalNav.style.setProperty("visibility","hidden","important");globalNav.style.setProperty("pointer-events","none","important");}
 window.scrollTo({top:0,behavior:"auto"});
 const input=$("aiAssistantInput");
 if(input){setTimeout(()=>{input.focus({preventScroll:true});updateAIViewport();},80);}

}
function closeAI(){
 const page=$("aiAssistantPage");
 if(page)page.classList.add("hidden");
 document.body.classList.remove("ai-assistant-open");
 const globalNav=document.querySelector(".mobile-bottom-nav");
 if(globalNav){
  globalNav.style.removeProperty("display");
  globalNav.style.removeProperty("visibility");
  globalNav.style.removeProperty("pointer-events");
 }
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
 if(send)send.disabled=true;if(input)input.disabled=true;
 addMessage("user",q);const pending=addMessage("assistant","Thinking…");
 try{
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),30000); const response=await fetch(SUPABASE_URL+"/functions/v1/ai-chat",{method:"POST",signal:controller.signal,headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({question:q,history,research:false})});
  const data=await response.json().catch(()=>({})); clearTimeout(timeout);
  if(!response.ok||!data.answer)throw new Error(data.error||"AI service is temporarily unavailable.");
  const bubble=pending?.querySelector(".ai-assistant-message-bubble");if(bubble)bubble.textContent=data.answer;
  history.push({role:"user",content:q},{role:"assistant",content:data.answer});history=history.slice(-20);
 }catch(error){
  const bubble=pending?.querySelector(".ai-assistant-message-bubble");if(bubble)bubble.textContent=error?.name==="AbortError"?"AI is taking too long. Please try again.":(error?.message||"Could not get an AI answer.");
 }finally{
  if(send)send.disabled=false;if(input){
   input.disabled=false;
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
  history=[];const box=$("aiAssistantMessages");
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
