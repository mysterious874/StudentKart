/* =========================================================
   BANJARA CONNECT — COMPLETE FRONTEND SHELL
   Frontend shell + Supabase authentication integration. Real backend data is loaded in later modules.
   ========================================================= */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={screen:"home",auth:"welcome",query:"",theme:"light",notifications:3};
let people=[];
let communities=[];
function avatar(x){return '<div class="bc-avatar">'+x+'</div>'}
function build(){
 const oldMain=$("main"); if(oldMain) oldMain.style.display="none";
 const oldSplash=$("#banjaraSplash"); if(oldSplash){oldSplash.classList.add("is-hidden");oldSplash.remove();}
 document.body.classList.add("bc-app-ready");document.body.classList.remove("banjara-splash-active");
 const root=document.createElement("div");root.id="bcAppShell";
 root.innerHTML='<div class="bc-app">'+
 '<header class="bc-topbar"><div class="bc-brand"><img src="/icons/banjara-connect-icon.svg" alt=""><div class="bc-brand-text"><strong>Banjara Connect</strong><small>People • Community • Culture</small></div></div><div class="bc-top-actions"><button class="bc-icon-btn" data-screen="notifications" aria-label="Notifications"><i class="fas fa-bell"></i></button><button class="bc-icon-btn" data-screen="profile" aria-label="Profile"><i class="fas fa-user"></i></button></div></header>'+
 '<nav class="bc-desktop-nav">'+navBtns("home","Home","fa-house")+navBtns("chats","Chats","fa-comments")+navBtns("connect","Connect","fa-user-plus")+navBtns("community","Community","fa-users")+navBtns("notifications","Alerts","fa-bell")+navBtns("profile","Profile","fa-user")+navBtns("settings","Settings","fa-gear")+'</nav>'+
 '<section id="bc-home" class="bc-screen active"></section><section id="bc-chats" class="bc-screen"></section><section id="bc-connect" class="bc-screen"></section><section id="bc-community" class="bc-screen"></section><section id="bc-feed" class="bc-screen"></section><section id="bc-notifications" class="bc-screen"></section><section id="bc-profile" class="bc-screen"></section><section id="bc-settings" class="bc-screen"></section><section id="bc-auth" class="bc-screen"></section>'+
 '</div>'+
 '<nav class="bc-bottom">'+navBtns("home","Home","fa-house")+navBtns("chats","Chats","fa-comments")+navBtns("connect","Connect","fa-user-plus")+'<button class="create-btn" data-create aria-label="Create"><i class="fas fa-plus"></i></button>'+navBtns("community","Community","fa-users")+navBtns("notifications","Alerts","fa-bell")+'<button data-more aria-label="More"><i class="fas fa-ellipsis"></i><span>More</span></button>'+'</nav>'+
 '<div id="bcModal" class="bc-modal"><div class="bc-sheet" id="bcSheet"></div></div><div id="bcToast" class="bc-toast"></div>';
 document.body.appendChild(root);
 renderAll(); bind();
 if(window.supabaseClient){ setTimeout(()=>void bcRestoreSession(),0); } else { showScreen("auth"); }
}
function navBtns(id,label,icon){return '<button data-screen="'+id+'"><i class="fas '+icon+'"></i><span>'+label+'</span></button>'}
function renderAll(){
 $("#bc-home").innerHTML=homeHTML();$("#bc-chats").innerHTML=chatsHTML();$("#bc-connect").innerHTML=connectHTML();$("#bc-community").innerHTML=communityHTML();$("#bc-feed").innerHTML=feedHTML();$("#bc-notifications").innerHTML=notificationsHTML();$("#bc-profile").innerHTML=profileHTML();$("#bc-settings").innerHTML=settingsHTML();$("#bc-auth").innerHTML=authHTML();
}
function homeHTML(){return '<div class="bc-hero"><h1>Welcome to Banjara Connect</h1><p>Connect with people, communities and culture.</p><div class="bc-search"><i class="fas fa-search"></i><input data-search placeholder="Search people, communities or posts..." value="'+esc(state.query)+'"><button data-do-search><i class="fas fa-arrow-right"></i></button></div><div class="bc-chips"><button class="bc-chip active" data-feed-tab="all">For You</button><button class="bc-chip" data-feed-tab="people">People</button><button class="bc-chip" data-feed-tab="communities">Communities</button><button class="bc-chip" data-feed-tab="events">Events</button></div></div>'+
'<div class="bc-section"><div class="bc-section-head"><h2>People you may know</h2><button data-screen="connect">See all</button></div><div class="bc-grid">'+(people.length?people.slice(0,3).map(personCard).join(""):empty("fa-user-plus","No members yet","Real Banjara Connect members will appear here."))+'</div></div>'+
'<div class="bc-section"><div class="bc-section-head"><h2>Communities</h2><button data-screen="community">Explore</button></div><div class="bc-grid">'+(communities.length?communities.slice(0,3).map(communityCard).join(""):empty("fa-users","No communities yet","Communities created by real members will appear here."))+'</div></div>'+
'<div class="bc-section"><div class="bc-section-head"><h2>Community feed</h2><button data-screen="feed">View all</button></div>'+empty("fa-newspaper","No posts yet","Real member posts will appear here.")+'</div>'+
'<div class="bc-section"><div class="bc-section-head"><h2>Upcoming</h2><button data-screen="community">Events</button></div>'+empty("fa-calendar","No events yet","Community events will appear here.")+'</div>'}
function personCard(p){return '<article class="bc-card"><div class="bc-person">'+avatar(p[0])+'<div><h3>'+esc(p[1])+'</h3><p>'+esc(p[2])+'</p></div></div><button class="bc-action primary" data-connect-user="'+esc(p[3]||"")+'">Connect</button></article>'}
function toast(msg){const t=$("#bcToast");if(!t)return;t.textContent=msg;t.classList.add("show");clearTimeout(window.__bcToast);window.__bcToast=setTimeout(()=>t.classList.remove("show"),1800)}

const BC_SUPABASE = () => window.supabaseClient;
function bcNormalizePhone(value){
  let d=String(value||"").replace(/\D/g,"");
  if(d.startsWith("91")&&d.length===12)d=d.slice(2);
  return /^\d{10}$/.test(d) ? "+91"+d : null;
}
function bcInternalEmail(phone){return "account+"+String(phone).replace(/\D/g,"")+"@banjaraconnect.app";}
function bcSessionId(){return crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"-"+Math.random().toString(36).slice(2));}
async function bcEnsureProfile(user, phone, sessionId){
  const sb=BC_SUPABASE(); if(!sb||!user?.id)return null;
  const {data:existing}=await sb.from("profiles").select("id,name,bio,college,state,city,area,avatar_url,active_session_id").eq("id",user.id).maybeSingle();
  const payload={id:user.id,phone:phone||existing?.phone||user.user_metadata?.phone||"",active_session_id:sessionId,updated_at:new Date().toISOString()};
  if(!existing){payload.name="Banjara Member";}
  const {data,error}=await sb.from("profiles").upsert(payload,{onConflict:"id"}).select("id,name,bio,college,state,city,area,avatar_url,active_session_id").single();
  if(error) throw error;
  return data;
}
let bcSessionTimer=null, bcSessionIdValue=null;
async function bcStartSessionGuard(user,sessionId){
  bcSessionIdValue=sessionId;
  clearInterval(bcSessionTimer);
  bcSessionTimer=setInterval(async()=>{
    if(!user?.id||!bcSessionIdValue)return;
    try{
      const sb=BC_SUPABASE();
      const {data,error}=await sb.from("profiles").select("active_session_id").eq("id",user.id).maybeSingle();
      if(error||!data)return;
      if(data.active_session_id && data.active_session_id!==bcSessionIdValue){
        clearInterval(bcSessionTimer); bcSessionTimer=null;
        await sb.auth.signOut({scope:"local"});
        state.auth="login"; state.screen="auth"; renderAll(); showScreen("auth");
        toast("This account was logged in on another device. You have been logged out.");
      }
    }catch(e){console.warn("Session guard:",e);}
  },5000);
}
async function bcAfterLogin(user,phone){
  const sid=bcSessionId();
  try{
    const profile=await bcEnsureProfile(user,phone,sid);
    window.__bcProfile=profile; window.__bcSessionId=sid;
    await bcStartSessionGuard(user,sid);
    state.auth="welcome"; renderAll(); showScreen("home"); await bcLoadSocialData(); toast("Welcome to Banjara Connect");
    return true;
  }catch(e){
    console.error("Profile setup:",e);
    await BC_SUPABASE().auth.signOut({scope:"local"});
    toast("Could not prepare account");
    return false;
  }
}
async function bcHandleAuth(form){
  const mode=form.dataset.authForm;
  const inputs=[...form.querySelectorAll("input")];
  const phone=bcNormalizePhone(inputs[0]?.value);
  const password=String(inputs[1]?.value||"");
  if(!phone){toast("Enter a valid 10-digit mobile number");return;}
  if(!/^\d{6}$/.test(password)){toast("Password must be exactly 6 digits");return;}
  const sb=BC_SUPABASE(); if(!sb){toast("Authentication is not ready");return;}
  const submit=form.querySelector("button[type=submit]"); if(submit){submit.disabled=true;submit.textContent=mode==="signup"?"Creating...":"Logging in...";}
  try{
    if(mode==="signup"){
      const confirm=String(inputs[2]?.value||"");
      if(confirm!==password){toast("Passwords do not match");return;}
      const {data,error}=await sb.functions.invoke("prepare-account",{body:{phone,password}});
      if(error) throw error;
      if(!data?.success) throw new Error(data?.error||"Could not create account");
    }
    const {data,error}=await sb.functions.invoke("mobile-login",{body:{phone,password}});
    if(error) throw error;
    if(!data?.success||!data?.session?.access_token||!data?.session?.refresh_token) throw new Error(data?.error||"Could not complete login");
    const {data:sessionData,error:sessionError}=await sb.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
    if(sessionError) throw sessionError;
    await bcAfterLogin(sessionData.user,phone);
  }catch(e){
    console.error("Auth error:",e);
    const msg=String(e?.message||"");
    toast(msg.includes("Invalid login")?"Mobile number or password is incorrect":msg||"Could not complete login");
  }finally{if(submit){submit.disabled=false;submit.textContent=mode==="signup"?"Create account":"Log in";}}
}
async function bcLoadSocialData(){
 const sb=BC_SUPABASE(); if(!sb)return;
 try{
  const {data:{user}}=await sb.auth.getUser(); if(!user)return;
  const [pr,cr]=await Promise.all([
   sb.from("profiles").select("id,name,bio,college,state,city,area,avatar_url").neq("id",user.id).order("created_at",{ascending:false}).limit(60),
   sb.from("communities").select("id,name,description,cover_url,created_at").order("created_at",{ascending:false}).limit(30)
  ]);
  if(pr.error)throw pr.error; if(cr.error)throw cr.error;
  people=(pr.data||[]).map(p=>[getInitials(p.name||"Member"),p.name||"Banjara Member",[p.city,p.state].filter(Boolean).join(" • ")||"Banjara Connect member",p.id]);
  communities=(cr.data||[]).map(x=>["👥",x.name||"Community",x.description||"Community",x.id]);
  renderAll(); showScreen(state.screen==="auth"?"home":state.screen);
 }catch(e){console.warn("Social data load:",e);}
}
async function bcSendConnection(userId,button){
 const sb=BC_SUPABASE(); const {data:{user}}=await sb.auth.getUser(); if(!user)return;
 button.disabled=true;
 try{
  const {error}=await sb.from("connections").insert({requester_id:user.id,addressee_id:userId,status:"pending"});
  if(error&&error.code!=="23505")throw error;
  button.textContent=error?"Requested":"Requested"; toast(error?"Request already sent":"Connection request sent");
 }catch(e){button.disabled=false;console.error(e);toast("Could not send connection request");}
}
async function bcRestoreSession(){
  const sb=BC_SUPABASE(); if(!sb)return;
  try{
    const {data}=await sb.auth.getSession();
    if(data?.session?.user){
      const phone=data.session.user.user_metadata?.phone||data.session.user.phone||"";
      await bcAfterLogin(data.session.user,phone);
    }else{showScreen("auth");}
  }catch(e){console.warn("Restore session:",e);showScreen("auth");}
}
function modal(title,html){$("#bcSheet").innerHTML='<div class="bc-sheet-head"><h2>'+title+'</h2><button class="bc-close" data-close-modal>&times;</button></div>'+html;$("#bcModal").classList.add("open")}
function closeModal(){$("#bcModal").classList.remove("open")}
function create(){modal("Create",'<div class="bc-create-grid">'+[['fa-pen','Post','Share an update','post'],['fa-image','Photo / Video','Share a moment','media'],['fa-square-poll-vertical','Poll','Ask your community','poll'],['fa-calendar-days','Event','Create an event','event'],['fa-user-group','Group','Start a group','group'],['fa-people-group','Community','Build a community','community']].map(x=>'<button class="bc-create" data-create-type="'+x[3]+'"><i class="fas '+x[0]+'"></i><strong>'+x[1]+'</strong><small>'+x[2]+'</small></button>').join("")+'</div>')}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",build,{once:true});else build();
})();