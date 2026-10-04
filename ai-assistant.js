/* GlobeDisc AI assistant */
(function(){
"use strict";
const SUPABASE_URL="https://yymzfjfkmsrymqhpnfqz.supabase.co";
const SUPABASE_KEY="sb_publishable_tEePI-aSGDkt_2S6oiEfPw_Hy_mEXkw";
const $=id=>document.getElementById(id);
let history=[];
function addMessage(role,text){
 const box=$("aiAssistantMessages"); if(!box)return null;
 $("aiAssistantWelcome")?.classList.add("hidden");
 const item=document.createElement("div");
 item.className="ai-assistant-message "+(role==="user"?"is-user":"is-ai");
 const bubble=document.createElement("div"); bubble.className="ai-assistant-message-bubble"; bubble.textContent=String(text||"");
 item.appendChild(bubble); box.appendChild(item); box.scrollTop=box.scrollHeight; return item;
}
function openAI(){
 const p=$("aiAssistantPage"); if(!p)return;
 p.classList.remove("hidden"); document.body.classList.add("ai-assistant-open"); const globalNav=document.querySelector(".mobile-bottom-nav"); if(globalNav){globalNav.style.setProperty("display","none","important");globalNav.style.setProperty("visibility","hidden","important");globalNav.style.setProperty("pointer-events","none","important");}
 window.scrollTo({top:0,behavior:"auto"}); $("aiAssistantInput")?.focus();
}
function closeAI(){ $("aiAssistantPage")?.classList.add("hidden"); document.body.classList.remove("ai-assistant-open"); const globalNav=document.querySelector(".mobile-bottom-nav"); if(globalNav){globalNav.style.removeProperty("display");globalNav.style.removeProperty("visibility");globalNav.style.removeProperty("pointer-events");} }
async function ask(question){
 const q=String(question||"").trim(); if(!q)return;
 const send=$("aiAssistantSend"),input=$("aiAssistantInput");
 if(send)send.disabled=true;if(input)input.disabled=true;
 addMessage("user",q);const pending=addMessage("assistant","Thinking…");
 try{
  const response=await fetch(SUPABASE_URL+"/functions/v1/ai-chat",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({question:q,history,research:false})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.answer)throw new Error(data.error||"AI service is temporarily unavailable.");
  const bubble=pending?.querySelector(".ai-assistant-message-bubble");if(bubble)bubble.textContent=data.answer;
  history.push({role:"user",content:q},{role:"assistant",content:data.answer});history=history.slice(-20);
 }catch(error){
  const bubble=pending?.querySelector(".ai-assistant-message-bubble");if(bubble)bubble.textContent=error?.message||"Could not get an AI answer.";
 }finally{
  if(send)send.disabled=false;if(input){input.disabled=false;input.value="";input.focus();}
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
 $("aiAssistantBack")?.addEventListener("click",closeAI);
 $("aiAssistantNewChat")?.addEventListener("click",()=>{
  history=[];const box=$("aiAssistantMessages");
  if(box)box.innerHTML='<div id="aiAssistantWelcome" class="ai-assistant-welcome"><div class="ai-assistant-welcome-icon">✦</div><h1>What can I help you with?</h1><p>Ask anything. GlobeDisc AI will bring together answers and useful sources.</p></div>';
  $("aiAssistantInput")?.focus();
 });
 $("aiAssistantForm")?.addEventListener("submit",e=>{e.preventDefault();ask($("aiAssistantInput")?.value);});
});
})();
window.openGlobeDiscAI=openAI;
window.closeGlobeDiscAI=closeAI;
window.addEventListener("load",bindAIControls,{once:true});
