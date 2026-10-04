/* =========================================================
   BANJARA CONNECT — COMPLETE FRONTEND SHELL
   Frontend shell + Supabase authentication integration. Real backend data is loaded in later modules.
   ========================================================= */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={screen:"home",auth:"welcome",query:"",theme:"light",notifications:0,language:"English",connectTab:"Discover",communityTab:"Discover",chatFilter:"",profile:{name:"Banjara Member",bio:"Building connections through community and culture."}};
let people=[];
let communities=[];
function avatar(x){return '<div class="bc-avatar">'+x+'</div>'}
function getInitials(x){var s=String(x||"Member").trim();return s?s.split(" ").filter(Boolean).slice(0,2).map(function(v){return v.charAt(0)}).join("").toUpperCase():"M"}
function bcApplyTheme(value){
 const saved=value==="system"?"system":(value==="dark"?"dark":"light");
 const effective=saved==="system" ? (window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light") : saved;
 document.documentElement.dataset.theme=saved;
 document.body.classList.toggle("bc-dark",effective==="dark");
 document.documentElement.style.colorScheme=effective;
 return effective;
}
function build(){
 state.theme=bcLoadPref("theme","light")==="dark"?"dark":(bcLoadPref("theme","light")==="system"?"system":"light");
 state.language=String(bcLoadPref("language","English")||"English");
 bcApplyTheme(state.theme);
 const oldMain=$("main"); if(oldMain) oldMain.style.display="none";
 document.body.classList.add("bc-app-ready");document.body.classList.remove("banjara-splash-active");
 const root=document.createElement("div");root.id="bcAppShell";
 root.innerHTML='<div class="bc-app">'+
 '<header class="bc-topbar"><div class="bc-brand"><img src="/icons/banjara-connect-icon.svg" alt=""><div class="bc-brand-text"><strong>Banjara Connect</strong><small>People • Community • Culture</small></div></div><div class="bc-top-actions"><button class="bc-icon-btn" data-screen="notifications" aria-label="Notifications"><i class="fas fa-bell"></i><span data-notification-badge hidden></span></button><button class="bc-icon-btn" data-screen="profile" aria-label="Profile"><i class="fas fa-user"></i></button></div></header>'+
 '<nav class="bc-desktop-nav">'+navBtns("home","Home","fa-house")+navBtns("chats","Chats","fa-comments")+navBtns("connect","Connect","fa-user-plus")+navBtns("community","Community","fa-users")+navBtns("notifications","Alerts","fa-bell")+navBtns("profile","Profile","fa-user")+navBtns("settings","Settings","fa-gear")+'</nav>'+
 '<section id="bc-home" class="bc-screen active"></section><section id="bc-chats" class="bc-screen"></section><section id="bc-connect" class="bc-screen"></section><section id="bc-community" class="bc-screen"></section><section id="bc-feed" class="bc-screen"></section><section id="bc-notifications" class="bc-screen"></section><section id="bc-profile" class="bc-screen"></section><section id="bc-settings" class="bc-screen"></section><section id="bc-auth" class="bc-screen"></section>'+
 '</div>'+
 '<nav class="bc-bottom">'+navBtns("home","Home","fa-house")+navBtns("chats","Chats","fa-comments")+navBtns("connect","Connect","fa-user-plus")+'<button class="create-btn" data-create aria-label="Create"><i class="fas fa-plus"></i></button>'+navBtns("community","Community","fa-users")+'<button data-ai-open aria-label="Ask with AI"><i class="fas fa-wand-magic-sparkles"></i><span>AI</span></button>'+navBtns("notifications","Alerts","fa-bell")+'<button data-more aria-label="More"><i class="fas fa-ellipsis"></i><span>More</span></button>'+'</nav>'+
 '<div id="bcModal" class="bc-modal"><div class="bc-sheet" id="bcSheet"></div></div><div id="bcToast" class="bc-toast"></div>';
 document.body.appendChild(root);
 renderAll(); bind();
 if(window.supabaseClient){ setTimeout(()=>void bcRestoreSession(),0); } else { showScreen("auth"); }
}
function navBtns(id,label,icon){return '<button data-screen="'+id+'"><i class="fas '+icon+'"></i><span>'+label+'</span></button>'}
function renderAll(){
 $("#bc-home").innerHTML=homeHTML();$("#bc-chats").innerHTML=chatsHTML();$("#bc-connect").innerHTML=connectHTML();$("#bc-community").innerHTML=communityHTML();$("#bc-feed").innerHTML=feedHTML();$("#bc-notifications").innerHTML=notificationsHTML();$("#bc-profile").innerHTML=profileHTML();$("#bc-settings").innerHTML=settingsHTML();$("#bc-auth").innerHTML=authHTML();
}
function homeHTML(){return '<div class="bc-hero"><h1>Welcome to Banjara Connect</h1><p>Connect with people, communities and culture.</p><div class="bc-search"><i class="fas fa-search"></i><input data-search placeholder="Search people, communities or posts..." value="'+esc(state.query)+'"><button type="button" data-voice-search aria-label="Voice search"><i class="fas fa-microphone"></i></button><button type="button" data-do-search><i class="fas fa-arrow-right"></i></button></div><div class="bc-chips"><button class="bc-chip active" data-feed-tab="all">For You</button><button class="bc-chip" data-feed-tab="people">People</button><button class="bc-chip" data-feed-tab="communities">Communities</button><button class="bc-chip" data-feed-tab="events">Events</button></div></div>'+
'<div class="bc-section"><div class="bc-section-head"><h2>People you may know</h2><button data-screen="connect">See all</button></div><div class="bc-grid">'+(people.length?people.slice(0,3).map(personCard).join(""):empty("fa-user-plus","No members yet","Real Banjara Connect members will appear here."))+'</div></div>'+
'<div class="bc-section"><div class="bc-section-head"><h2>Communities</h2><button data-screen="community">Explore</button></div><div class="bc-grid">'+(communities.length?communities.slice(0,3).map(communityCard).join(""):empty("fa-users","No communities yet","Communities created by real members will appear here."))+'</div></div>'+
'<div class="bc-section"><div class="bc-section-head"><h2>Community feed</h2><button data-screen="feed">View all</button></div>'+empty("fa-newspaper","No posts yet","Real member posts will appear here.")+'</div>'+
'<div class="bc-section"><div class="bc-section-head"><h2>Upcoming</h2><button data-screen="community">Events</button></div>'+empty("fa-calendar","No events yet","Community events will appear here.")+'</div>'}
function personCard(p){return '<article class="bc-card"><div class="bc-person">'+avatar(p[0])+'<div><h3>'+p[1]+'</h3><p>'+p[2]+'</p></div></div><button class="bc-action primary" data-connect-user="'+esc(p[3]||"")+'">Connect</button></article>'}
function communityCard(c){return '<article class="bc-card bc-community-card" data-community-id="'+esc(c[3]||"")+'"><div class="bc-community-icon">'+c[0]+'</div><div><h3>'+esc(c[1])+'</h3><p>'+esc(c[2])+'<br>'+esc(c[3])+'</p></div><button class="bc-action" data-community-id="'+esc(c[3]||"")+'">Explore</button></article>'}
function chatsHTML(){return '<div class="bc-hero"><h1>Chats</h1><p>Your conversations in one place.</p><div class="bc-search"><i class="fas fa-search"></i><input data-chat-filter placeholder="Search chats..."><button data-new-chat aria-label="New chat"><i class="fas fa-pen"></i></button></div></div><div class="bc-list"><div class="bc-empty"><i class="fas fa-comments"></i><strong>Loading conversations...</strong><span>Your real conversations will appear here.</span></div></div>'}
function connectHTML(){return '<div class="bc-hero"><h1>Connect</h1><p>Discover people who share your interests.</p><div class="bc-search"><i class="fas fa-search"></i><input data-connect-search placeholder="Search people..."><button type="button"><i class="fas fa-search"></i></button></div><div class="bc-tabs"><button class="bc-tab active">Discover</button><button class="bc-tab">Requests</button><button class="bc-tab">My Connections</button></div></div><div class="bc-section"><div class="bc-section-head"><h2>People on Banjara Connect</h2><button data-refresh-social>Refresh</button></div><div class="bc-grid">'+(people.length?people.map(personCard).join(""):empty("fa-user-group","No other members yet","New members will appear here automatically."))+'</div></div>'}
function communityHTML(){return '<div class="bc-hero"><h1>Community</h1><p>Find your people, interests and culture.</p><div class="bc-search"><i class="fas fa-search"></i><input data-community-search placeholder="Search communities..."><button type="button"><i class="fas fa-search"></i></button></div><div class="bc-tabs"><button class="bc-tab active">Discover</button><button class="bc-tab">My Communities</button><button class="bc-tab">Featured</button></div></div><div class="bc-section"><div class="bc-grid">'+(communities.length?communities.map(communityCard).join(""):empty("fa-users","No communities yet","Create or join a community and it will appear here."))+'</div></div><div class="bc-section"><div class="bc-section-head"><h2>Events</h2><button class="bc-action" data-feed-create data-feed-kind="Event">Create</button></div><div class="bc-grid" data-event-list>'+empty("fa-calendar-days","No events yet","Events from real communities will appear here.")+'</div></div>'}
function postCard(name,community,text){return '<article class="bc-card bc-post"><div class="bc-post-head">'+avatar(name.split(" ").map(x=>x[0]).join(""))+'<div><h3>'+name+'</h3><p>'+community+' • 2h</p></div></div><div class="bc-post-body">'+esc(text)+'</div><div class="bc-post-media"><i class="fas fa-mountain"></i></div><div class="bc-post-actions"><button data-post-action="like">♡ Like</button><button data-post-action="comment">💬 Comment</button><button data-post-action="share">↗ Share</button><button data-post-action="save">🔖 Save</button></div></article>'}
function feedHTML(){return '<div class="bc-hero"><h1>Feed</h1><p>What is happening across your communities.</p><div class="bc-search"><i class="fas fa-search"></i><input data-feed-search placeholder="Search posts..."><button data-feed-create><i class="fas fa-plus"></i></button></div></div><div class="bc-section" id="bcFeedList">'+empty("fa-newspaper","No posts yet","Real member posts will appear here.")+'</div>'}
function notificationsHTML(){return '<div class="bc-hero"><h1>Notifications</h1><p>Stay updated without missing what matters.</p><button class="bc-action" data-mark-notifications style="width:auto">Mark all as read</button></div><div class="bc-list"><div class="bc-empty"><i class="fas fa-bell"></i><strong>Loading notifications...</strong><span>Your real notifications will appear here.</span></div></div>'}
function profileHTML(){return '<div class="bc-profile-hero">'+avatar("BC").replace("bc-avatar","bc-profile-avatar")+'<div><h1>Banjara Connect member</h1><p>Your profile will load from your account.</p><button class="bc-action primary" data-edit-profile style="width:auto;padding:0 14px">Edit Profile</button></div></div><div class="bc-stat-row"><div class="bc-stat"><strong>0</strong><span>Connections</span></div><div class="bc-stat"><strong>0</strong><span>Communities</span></div><div class="bc-stat"><strong>0</strong><span>Posts</span></div></div><div class="bc-section"><div class="bc-section-head"><h2>About</h2></div><div class="bc-card"><p>Your profile information will appear here.</p></div></div><div class="bc-section"><div class="bc-section-head"><h2>My posts</h2><button data-screen="feed">View all</button></div><div class="bc-empty"><i class="fas fa-newspaper"></i><strong>No posts yet</strong><span>Your posts will appear here.</span></div></div>'}
function settingsHTML(){const rows=[["fa-user","Profile","Personal information"],["fa-bell","Notifications","Choose what you receive"],["fa-palette","Appearance",state.theme==="dark"?"Dark theme":"Light theme"],["fa-language","Language",state.language],["fa-shield-halved","Privacy","Control your visibility"],["fa-lock","Security","Account security"],["fa-user-slash","Blocked accounts","Manage blocked people"],["fa-mobile-screen","Sessions","Manage active sessions"],["fa-circle-info","Help & About","Help, feedback and app info"],["fa-user-gear","Account","Account actions"]];return '<div class="bc-hero"><h1>Settings</h1><p>Make Banjara Connect feel like yours.</p></div><div class="bc-setting-list">'+rows.map((r,i)=>'<button class="bc-setting" data-setting="'+i+'"><span class="bc-setting-icon"><i class="fas '+r[0]+'"></i></span><span class="bc-setting-main"><strong>'+r[1]+'</strong><small>'+r[2]+'</small></span><i class="fas fa-chevron-right"></i></button>').join("")+'</div><div class="bc-section"><button class="bc-action" data-logout style="height:42px">Log out</button></div>'}
function authHTML(){return '<div class="bc-auth"><div class="bc-auth-box">'+(state.auth==="signup"?signupHTML():state.auth==="login"?loginHTML():welcomeHTML())+'</div></div>'}
function welcomeHTML(){return '<img class="bc-auth-logo" src="/icons/banjara-connect-icon.svg"><h1>Welcome to Banjara Connect</h1><p>People, communities, culture and conversations — all in one place.</p><button class="bc-action primary" data-auth="signup" style="height:42px">Create account</button><button class="bc-action" data-auth="login" style="height:42px">Log in</button>'}
function loginHTML(){return '<img class="bc-auth-logo" src="/icons/banjara-connect-icon.svg"><h1>Welcome back</h1><p>Log in with your mobile number.</p><form class="bc-form" data-auth-form="login"><div class="bc-field"><label>Mobile number</label><input required inputmode="numeric" placeholder="10-digit mobile number"></div><div class="bc-field"><label>Password</label><input required type="password" placeholder="Password"></div><button class="bc-action primary" style="height:42px">Log in</button></form><div class="bc-switch"><span>New here?</span><button data-auth="signup">Create account</button></div>'}
function signupHTML(){return '<img class="bc-auth-logo" src="/icons/banjara-connect-icon.svg"><h1>Create your account</h1><p>Mobile-only account setup. No email field.</p><form class="bc-form" data-auth-form="signup"><div class="bc-field"><label>Mobile number</label><input required inputmode="numeric" placeholder="10-digit mobile number"></div><div class="bc-field"><label>Password</label><input required type="password" placeholder="Create password"></div><div class="bc-field"><label>Confirm password</label><input required type="password" placeholder="Confirm password"></div><button class="bc-action primary" style="height:42px">Create account</button></form><div class="bc-switch"><span>Already have an account?</span><button data-auth="login">Log in</button></div>'}
function empty(icon,title,text){return '<div class="bc-empty"><i class="fas '+icon+'"></i><strong>'+title+'</strong><span>'+text+'</span></div>'}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function showScreen(screen){
 state.screen=screen;
 document.body.classList.toggle("bc-auth-mode",screen==="auth");
 $$(".bc-screen").forEach(x=>x.classList.remove("active"));
 const el=$("#bc-"+screen);if(el)el.classList.add("active");
 $$("[data-screen]").forEach(b=>b.classList.toggle("active",b.dataset.screen===screen));
 window.scrollTo({top:0,behavior:"smooth"});
}
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
  const {data:existing,error}=await sb.from("profiles").select("id,name,bio,college,state,city,area,avatar_url").eq("id",user.id).maybeSingle();
  if(error) throw error;
  return existing||{id:user.id,name:"Banjara Member",bio:""};
}
let bcSessionTimer=null, bcSessionIdValue=null;
async function bcStartSessionGuard(user,sessionId){
  bcSessionIdValue=sessionId;
  clearInterval(bcSessionTimer);
  bcSessionTimer=setInterval(async()=>{
    if(!user?.id||!bcSessionIdValue)return;
    try{
      const sb=BC_SUPABASE();
      const {data,error}=await sb.functions.invoke("get-active-session");
      if(error||!data)return;
      if(data?.active_session_id && data.active_session_id!==bcSessionIdValue){
        clearInterval(bcSessionTimer); bcSessionTimer=null;
        await sb.auth.signOut({scope:"local"});
        state.auth="login"; state.screen="auth"; renderAll(); showScreen("auth");
        toast("This account was logged in on another device. You have been logged out.");
      }
    }catch(e){console.warn("Session guard:",e);}
  },5000);
}
async function bcAfterLogin(user,phone,sessionId){
  const sid=String(sessionId||"").trim()||bcSessionId();
  try{
    const sb=BC_SUPABASE();
    const {data:sessionReg,error:sessionRegError}=await sb.functions.invoke("register-active-session",{body:{session_id:sid}});
    if(sessionRegError||!sessionReg?.success){
      const detail=sessionReg?.error||sessionRegError?.message||"Could not register this device";
      throw new Error(detail);
    }
    try{sessionStorage.setItem("bc_active_session_id",sid);}catch(_){}
    window.__bcSessionId=sid;
    let profile=window.__bcProfile||null;
    try{
      profile=await bcEnsureProfile(user,phone,sid);
    }catch(profileError){
      console.warn("Profile read failed after login:",profileError);
      profile=profile||{id:user.id,name:String(user.user_metadata?.name||"Banjara Member"),bio:""};
    }
    window.__bcProfile=profile;
    await bcStartSessionGuard(user,sid);
    state.auth="welcome";
    renderAll();
    showScreen("home");
    try{
      await bcLoadSocialData();
    }catch(dataError){
      console.warn("Social data load failed after login:",dataError);
      toast("Signed in. Some community data could not be loaded.");
      return true;
    }
    toast("Welcome to Banjara Connect");
    return true;
  }catch(e){
    console.error("Login session setup:",e);
    toast(String(e?.message||"Could not prepare account"));
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
      const email=String(data.session.user.email||"");
      const match=email.match(/^account\+(\d{10})@banjaraconnect\.app$/i);
      const phone=match?"+91"+match[1]:"";
      if(!phone){await sb.auth.signOut({scope:"local"});state.auth="login";renderAll();showScreen("auth");toast("Please log in again to restore this session.");return;}
      let sid="";
      try{sid=sessionStorage.getItem("bc_active_session_id")||"";}catch(_){}
      if(!sid){
        await sb.auth.signOut({scope:"local"});
        state.auth="login";renderAll();showScreen("auth");
        toast("Please log in again to restore this session.");
        return;
      }
      const {data:active,error:activeError}=await sb.functions.invoke("get-active-session");
      if(!activeError && active?.active_session_id && active.active_session_id!==sid){
        await sb.auth.signOut({scope:"local"});
        try{sessionStorage.removeItem("bc_active_session_id");}catch(_){}
        state.auth="login";renderAll();showScreen("auth");
        toast("This account is active on another device.");
        return;
      }
      await bcAfterLogin(data.session.user,phone,sid);
    }else{showScreen("auth");}
  }catch(e){console.warn("Restore session:",e);showScreen("auth");}
}
function modal(title,html){$("#bcSheet").innerHTML='<div class="bc-sheet-head"><h2>'+title+'</h2><button class="bc-close" data-close-modal>&times;</button></div>'+html;$("#bcModal").classList.add("open")}
function closeModal(){$("#bcModal").classList.remove("open")}
function create(){modal("Create",'<div class="bc-create-grid">'+[['fa-pen','Post','Share an update'],['fa-image','Photo / Video','Share a moment'],['fa-calendar-days','Event','Create an event'],['fa-user-group','Group','Start a group'],['fa-people-group','Community','Build a community']].map(x=>'<button class="bc-create" data-create-kind="'+x[1]+'"><i class="fas '+x[0]+'"></i><strong>'+x[1]+'</strong><small>'+x[2]+'</small></button>').join("")+'</div>')}
function bind(){
 document.addEventListener("click",e=>{
  const voiceSearch=e.target.closest("[data-voice-search]");if(voiceSearch){e.preventDefault();bcStartVoiceSearch();return;}
  const ai=e.target.closest("[data-ai-open]");if(ai){e.preventDefault();if(window.openBanjaraConnectAI)window.openBanjaraConnectAI();return;}
  const more=e.target.closest("[data-more]");if(more){e.preventDefault();e.stopPropagation();showScreen("settings");return}
  const nav=e.target.closest("[data-screen]");if(nav){e.preventDefault();showScreen(nav.dataset.screen);return}
  if(e.target.closest("[data-create]")){create();return}
  const createKind=e.target.closest("[data-create-kind]");if(createKind){bcComposer(createKind.dataset.createKind);return;}
  if(e.target.closest("[data-close-modal]")||e.target.id==="bcModal"){closeModal();return}
  const connect=e.target.closest("[data-connect-user]");if(connect){void (window.bcConnect?window.bcConnect(connect.dataset.connectUser):bcSendConnection(connect.dataset.connectUser,connect));return}
  if(e.target.closest("[data-community-id]")){toast("Community selected");return}
  const unblock=e.target.closest("[data-unblock-user]");if(unblock){void (async()=>{const sb=BC_SUPABASE();const {data:{user}}=await sb.auth.getUser();if(!user)return;const {error}=await sb.from("user_blocks").delete().eq("blocker_id",user.id).eq("blocked_id",unblock.dataset.unblockUser);if(error){toast("Could not unblock user");return;}toast("User unblocked");await bcLoadBlockedAccounts();})();return;}
 
  const tab=e.target.closest(".bc-tab,.bc-chip");if(tab){const group=tab.parentElement;$(".bc-tab,.bc-chip",group).forEach(x=>x.classList.remove("active"));tab.classList.add("active");toast(tab.textContent.trim()+" selected");return}
  const auth=e.target.closest("[data-auth]");if(auth){state.auth=auth.dataset.auth;renderAll();showScreen("auth");return}
  if(e.target.closest("[data-do-search]")){state.query=($("[data-search]")?.value||"").trim();if(!state.query){toast("Type something to search");return;}const q=state.query.toLowerCase();const d=window.__bcLive||{};const ps=(d.people||[]).filter(x=>(x.name||"").toLowerCase().includes(q)||(x.city||"").toLowerCase().includes(q)||(x.state||"").toLowerCase().includes(q)).slice(0,10);const cs=(d.communities||[]).filter(x=>(x.name||"").toLowerCase().includes(q)||(x.description||"").toLowerCase().includes(q)).slice(0,10);const posts=(d.posts||[]).filter(x=>(x.body||"").toLowerCase().includes(q)).slice(0,10);const html=(ps.length?'<h3>People</h3>'+ps.map(x=>'<div class="bc-row"><div class="bc-avatar">'+getInitials(x.name)+'</div><div class="bc-row-main"><strong>'+esc(x.name||"Banjara Member")+'</strong><small>'+esc([x.city,x.state].filter(Boolean).join(" • "))+'</small></div><button class="bc-action" data-connect-user="'+x.id+'">Connect</button></div>').join(""):"")+(cs.length?'<h3>Communities</h3>'+cs.map(x=>'<div class="bc-row"><div class="bc-avatar">👥</div><div class="bc-row-main"><strong>'+esc(x.name)+'</strong><small>'+esc(x.description||"Community")+'</small></div></div>').join(""):"")+(posts.length?'<h3>Posts</h3>'+posts.map(x=>'<div class="bc-row"><div class="bc-avatar">📝</div><div class="bc-row-main"><strong>Post</strong><small>'+esc((x.body||"").slice(0,180))+'</small></div></div>').join(""):"");modal("Search results",html||empty("fa-magnifying-glass","No results found","Try another name, community or post."));return}
  const refresh=e.target.closest(".bc-section-head button");if(refresh && refresh.textContent.trim()==="Refresh"){toast("Suggestions refreshed");return}
  const setting=e.target.closest("[data-setting]");if(setting){bcSettingsPanel(+setting.dataset.setting);return}
  if(e.target.closest("[data-refresh-social]")){void bcLoadSocialData();return}
  const themeChoice=e.target.closest("[data-theme-choice]");if(themeChoice){const value=themeChoice.dataset.themeChoice;bcSavePref("theme",value);state.theme=value==="dark"?"dark":(value==="system"?"system":"light");bcApplyTheme(state.theme);renderAll();closeModal();toast("Appearance saved");return}
  const langChoice=e.target.closest("[data-lang-choice]");if(langChoice){state.language=langChoice.dataset.langChoice;bcSavePref("language",state.language);renderAll();closeModal();toast("Language saved");return}
  const savePrefs=e.target.closest("[data-save-prefs]");if(savePrefs){savePrefs.closest(".bc-card")?.querySelectorAll("[data-pref]").forEach(x=>bcSavePref(x.dataset.pref,x.checked));closeModal();toast("Settings saved");return}
  if(e.target.closest("[data-delete-account]")){void bcDeleteAccount();return}
  if(e.target.closest("[data-logout]")){void (async()=>{try{clearInterval(bcSessionTimer);bcSessionTimer=null;try{sessionStorage.removeItem("bc_active_session_id");}catch(_){}await BC_SUPABASE()?.auth.signOut({scope:"local"});}catch(err){console.warn(err);}state.auth="welcome";renderAll();showScreen("auth");toast("Logged out");})();return}
  if(e.target.closest("[data-edit-profile]")){const p=window.__bcProfile||state.profile||{};modal("Edit Profile",'<form class="bc-form" data-profile-form><div class="bc-field"><label>Name</label><input name="name" required value="'+esc(p.name||"")+'"></div><div class="bc-field"><label>Bio</label><textarea name="bio">'+esc(p.bio||"")+'</textarea></div><button type="submit" class="bc-action primary">Save changes</button></form>');return}
 });
 document.addEventListener("submit",e=>{const f=e.target.closest("[data-auth-form]");if(!f)return;e.preventDefault();void bcHandleAuth(f);});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
}

async function bcLoadBlockedAccounts(){
 const sb=BC_SUPABASE();if(!sb)return;
 const {data:{user}}=await sb.auth.getUser();if(!user)return;
 const panel=document.querySelector("#bcBlockedAccountsPanel");if(!panel)return;
 const {data,error}=await sb.from("user_blocks").select("blocked_id,created_at").eq("blocker_id",user.id).order("created_at",{ascending:false});
 if(error){panel.innerHTML='<div class="bc-empty"><strong>Could not load blocked accounts</strong><span>Please try again.</span></div>';return;}
 const ids=(data||[]).map(x=>x.blocked_id);
 if(!ids.length){panel.innerHTML='<div class="bc-empty"><i class="fas fa-user-check"></i><strong>No blocked accounts</strong><span>People you block will appear here.</span></div>';return;}
 const {data:profiles}=await sb.from("profiles").select("id,name,city,state,avatar_url").in("id",ids);
 const map=new Map((profiles||[]).map(x=>[x.id,x]));
 panel.innerHTML=(data||[]).map(x=>{const p=map.get(x.blocked_id)||{};return '<div class="bc-blocked-row"><div class="bc-avatar">'+esc((p.name||"Member").split(" ").map(v=>v[0]).join("").slice(0,2).toUpperCase())+'</div><div class="bc-blocked-main"><strong>'+esc(p.name||"Banjara Member")+'</strong><small>'+esc([p.city,p.state].filter(Boolean).join(" • ")||"Banjara Connect member")+'</small></div><button class="bc-action" data-unblock-user="'+x.blocked_id+'">Unblock</button></div>';}).join("");
}
async function bcDeleteAccount(){
 const sb=BC_SUPABASE();if(!sb)return;
 const {data:{user}}=await sb.auth.getUser();if(!user){toast("Please log in first");return;}
 if(!confirm("Delete your Banjara Connect account permanently? This cannot be undone."))return;
 const second=prompt("Type DELETE to confirm account deletion");
 if(second!=="DELETE"){toast("Account deletion cancelled");return;}
 try{
   const {data,error}=await sb.functions.invoke("delete-account",{body:{}});
   if(error||!data?.success)throw error||new Error(data?.error||"Could not delete account");
   clearInterval(bcSessionTimer);bcSessionTimer=null;
   try{sessionStorage.removeItem("bc_active_session_id");}catch(_){}
   await sb.auth.signOut({scope:"local"});
   state.auth="welcome";renderAll();showScreen("auth");toast("Account deleted");
 }catch(e){console.error("Delete account:",e);toast("Could not delete account");}
}
function bcSettingsPanel(index){
 const titles=["Profile","Notifications","Appearance","Language","Privacy","Security","Blocked accounts","Sessions","Help & About","Account"];
 const title=titles[index]||"Settings";
 let body="";
 if(index===0) body='<div class="bc-card"><strong>Profile</strong><p>Manage your name, bio, city and profile photo from your profile page.</p><button class="bc-action primary" data-screen="profile">Open Profile</button></div>';
 if(index===1) body='<div class="bc-card"><label class="bc-setting-toggle"><span><strong>Connection requests</strong><small>Notify me about new connection requests</small></span><input type="checkbox" data-pref="connections" '+(bcLoadPref("connections",true)?"checked":"")+'></label><label class="bc-setting-toggle"><span><strong>Messages</strong><small>Notify me about new messages</small></span><input type="checkbox" data-pref="messages" '+(bcLoadPref("messages",true)?"checked":"")+'></label><label class="bc-setting-toggle"><span><strong>Community activity</strong><small>Notify me about community updates</small></span><input type="checkbox" data-pref="community" '+(bcLoadPref("community",true)?"checked":"")+'></label><button class="bc-action primary" data-save-prefs>Save preferences</button></div>';
 if(index===2) body='<div class="bc-card"><p>Choose how Banjara Connect looks on this device.</p><div class="bc-choice-row"><button class="bc-action" data-theme-choice="light">☀️ Light</button><button class="bc-action" data-theme-choice="dark">🌙 Dark</button><button class="bc-action" data-theme-choice="system">⚙️ System</button></div></div>';
 if(index===3) body='<div class="bc-card"><p>Select your preferred app language.</p><div class="bc-choice-row"><button class="bc-action" data-lang-choice="English">English</button><button class="bc-action" data-lang-choice="Hindi">हिन्दी</button><button class="bc-action" data-lang-choice="Gor Boli">Gor Boli</button></div></div>';
 if(index===4) body='<div class="bc-card"><label class="bc-setting-toggle"><span><strong>Profile visibility</strong><small>Allow other members to discover your profile</small></span><input type="checkbox" data-pref="profile_visibility" '+(bcLoadPref("profile_visibility",true)?"checked":"")+'></label><label class="bc-setting-toggle"><span><strong>Connection visibility</strong><small>Show your connection status to others</small></span><input type="checkbox" data-pref="connection_visibility" '+(bcLoadPref("connection_visibility",true)?"checked":"")+'></label><button class="bc-action primary" data-save-prefs>Save privacy</button></div>';
 if(index===5) body='<div class="bc-card"><strong>Account security</strong><p>Change the 6-digit password used for this mobile account.</p><form class="bc-form" data-password-form><div class="bc-field"><label>New password</label><input name="password" type="password" inputmode="numeric" maxlength="6" pattern="\\d{6}" required placeholder="6 digits"></div><div class="bc-field"><label>Confirm password</label><input name="confirm" type="password" inputmode="numeric" maxlength="6" pattern="\\d{6}" required placeholder="6 digits"></div><button class="bc-action primary" type="submit">Change password</button></form></div>';
 if(index===6) body='<div class="bc-card" id="bcBlockedAccountsPanel"><div class="bc-empty"><i class="fas fa-spinner fa-spin"></i><strong>Loading blocked accounts...</strong></div></div>';
 if(index===7) body='<div class="bc-card"><strong>Current session</strong><p>This device is currently signed in. A new login on the same mobile number can replace older sessions.</p><button class="bc-action" data-logout>Log out this device</button></div>';
 if(index===8) body='<div class="bc-card"><strong>Banjara Connect Help</strong><p>For account, chat, community or safety issues, use the in-app controls or contact the app administrator.</p><p><small>Version 1.0 • Banjara Connect</small></p></div>';
 if(index===9) body='<div class="bc-card"><strong>Account</strong><p>Your Banjara Connect account is linked to your mobile number.</p><div class="bc-setting-controls"><button class="bc-action" data-logout>Log out</button><button class="bc-action" data-delete-account style="color:#a21d2b;border-color:rgba(162,29,43,.25)">Delete account</button></div></div>';
 modal(title,body);
 if(index===6) void bcLoadBlockedAccounts();

}
let bcVoiceRecognition=null;
function bcStartVoiceSearch(){
 const input=document.querySelector("[data-search]");
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){toast("Voice search is not supported in this browser.");return;}
 if(bcVoiceRecognition){try{bcVoiceRecognition.stop();}catch(_){}bcVoiceRecognition=null;toast("Voice search stopped");return;}
 const button=document.querySelector("[data-voice-search]");
 const rec=new Recognition();bcVoiceRecognition=rec;rec.lang=state.language==="Hindi"?"hi-IN":"en-IN";rec.interimResults=true;rec.continuous=false;
 if(button){button.classList.add("is-listening");button.innerHTML='<i class="fas fa-stop"></i>';button.setAttribute("aria-label","Stop voice search");}
 rec.onresult=e=>{let text="";for(let i=e.resultIndex;i<e.results.length;i++)text+=e.results[i][0].transcript; if(input)input.value=text.trim();state.query=text.trim();};
 rec.onerror=e=>{toast(e.error==="not-allowed"?"Microphone permission was denied.":"Voice search could not start.");};
 rec.onend=()=>{if(button){button.classList.remove("is-listening");button.innerHTML='<i class="fas fa-microphone"></i>';button.setAttribute("aria-label","Voice search");}bcVoiceRecognition=null;if(input&&input.value.trim())input.dispatchEvent(new Event("input",{bubbles:true}));};
 try{rec.start();toast("Listening…");}catch(_){bcVoiceRecognition=null;toast("Voice search could not start.");}
}
function bcSavePref(key,value){try{localStorage.setItem("bc_pref_"+key,String(value));}catch(e){}}
function bcLoadPref(key,fallback){try{const v=localStorage.getItem("bc_pref_"+key);return v===null?fallback:v==="true"?true:v==="false"?false:v;}catch(e){return fallback;}}
function bcOpenChat(name){modal("Chat with "+esc(name),'<div class="bc-chat-window"><div class="bc-chat-messages"><div class="bc-chat-bubble incoming">Hi! Welcome to Banjara Connect 👋</div><div class="bc-chat-bubble outgoing">Hello!</div></div><div class="bc-chat-tools"><button data-chat-tool="emoji">😊 Emoji</button><button data-chat-tool="attach">📎 Attach</button><button data-chat-tool="voice">🎙 Voice</button></div><div class="bc-chat-composer"><input data-chat-input placeholder="Type a message..." autocomplete="off"><button data-send-chat><i class="fas fa-paper-plane"></i></button></div></div>');}
function bcComposer(kind){let fields='';if(kind==="Post")fields='<div class="bc-field"><label>Post</label><textarea name="body" required maxlength="5000" placeholder="Share something with your community..."></textarea></div>';else if(kind==="Community")fields='<div class="bc-field"><label>Community name</label><input name="title" required maxlength="120" placeholder="Community name"></div><div class="bc-field"><label>Description</label><textarea name="description" maxlength="2000" placeholder="Tell people what this community is about"></textarea></div>';else if(kind==="Photo / Video")fields='<div class="bc-field"><label>Caption</label><textarea name="body" maxlength="5000" placeholder="Add a caption..."></textarea></div><div class="bc-field"><label>Photo or video</label><input name="media" type="file" accept="image/*,video/*" required></div>';else if(kind==="Event")fields='<div class="bc-field"><label>Event name</label><input name="title" required maxlength="160" placeholder="Event name"></div><div class="bc-field"><label>Date & time</label><input name="starts_at" type="datetime-local" required></div><div class="bc-field"><label>Location</label><input name="location" required maxlength="300" placeholder="Venue or online"></div><div class="bc-field"><label>Description</label><textarea name="description" maxlength="3000" placeholder="Event details"></textarea></div>';else if(kind==="Group")fields='<div class="bc-field"><label>Group name</label><input name="title" required maxlength="120" placeholder="Group name"></div><div class="bc-field"><label>Member mobile numbers</label><textarea name="members" required placeholder="10-digit numbers separated by commas"></textarea><small>Only existing Banjara Connect members can be added.</small></div>';else fields='<div class="bc-card"><p>'+esc(kind+' creation is being completed in the backend.')+'</p></div>';modal("Create "+kind,'<form class="bc-form" data-composer-kind="'+esc(kind)+'" data-composer-form><div class="bc-card"><p>Create a '+kind.toLowerCase()+' in Banjara Connect.</p></div>'+fields+'<div class="bc-setting-controls"><button class="bc-action primary" type="submit">Publish</button></div></form>');}
function bcSettingDetail(title){const copy={Profile:"Edit your name and bio.",Notifications:"Choose notification preferences.",Appearance:(bcLoadPref("theme","light")==="dark"?"Dark theme is active.":bcLoadPref("theme","light")==="system"?"System theme is active.":"Light theme is active."),Language:"English, Hindi and Lambadi are supported.",Privacy:"Control who can see and interact with you.",Security:"Your account uses a 6-digit password and active-session protection.",Blocked:"Manage blocked accounts.",Sessions:"Review active sessions.",Help:"Help, feedback and app information.",Account:"Account actions and logout."};modal(title,'<div class="bc-card bc-setting-detail"><p>'+esc(copy[title]||"Frontend settings are ready.")+'</p><button class="bc-action primary" data-close-modal>Done</button></div>');}
document.addEventListener("click",function(e){
 if(e.target.closest("[data-ai-open],[data-more],[data-create],[data-close-modal],[data-connect-user],[data-send-chat],[data-new-chat],[data-setting],[data-post-action],[data-screen],[data-connect-tab],[data-community-tab],[data-event-open],[data-create-event],[data-feed-create],[data-edit-profile],[data-theme],[data-language],[data-profile-stat],[data-mark-notifications]"))e.stopImmediatePropagation();
 const ai=e.target.closest("[data-ai-open]");if(ai){e.preventDefault();if(window.openBanjaraConnectAI)window.openBanjaraConnectAI();return;}
 const close=e.target.closest("[data-close-modal]");if(close||e.target.id==="bcModal"){closeModal();return;}
 const nav=e.target.closest("[data-screen]");if(nav){showScreen(nav.dataset.screen);return;}
 const more=e.target.closest("[data-more]");if(more){showScreen("settings");return;}
 const connect=e.target.closest("[data-connect-user]");if(connect){void (window.bcConnect?window.bcConnect(connect.dataset.connectUser,connect):bcSendConnection(connect.dataset.connectUser,connect));return;}
 const chat=e.target.closest("[data-chat-id]");if(chat){void (window.bcOpenChat?window.bcOpenChat(chat.dataset.chatId,chat.dataset.chatName||"Banjara Member"):bcOpenChat(chat.dataset.chatName||"Banjara Member"));return;}
 const newChat=e.target.closest("[data-new-chat]");if(newChat){if(window.bcNewChat){void window.bcNewChat();}else{toast("Chat tools are still loading");}return;}
 const chatTool=e.target.closest("[data-chat-tool]");if(chatTool){const type=chatTool.dataset.chatTool;if(type==="emoji"){const input=$("#bcModal [data-chat-input]");if(input){input.value+=" 😊";input.focus();}}else if(type==="attach"){modal("Attach media",'<div class="bc-form"><div class="bc-field"><label>Choose image or video</label><input data-chat-media type="file" accept="image/*,video/*"></div><div id="bcMediaPreview"></div><button class="bc-action primary" data-attachment-close>Attach</button></div>');}else{chatTool.classList.toggle("is-recording");chatTool.textContent=chatTool.classList.contains("is-recording")?"⏹ Stop recording":"🎙 Voice";toast(chatTool.classList.contains("is-recording")?"Recording…":"Voice message ready");}return;}
const media=e.target.closest("[data-chat-media]");if(media){const file=media.files&&media.files[0],box=$("#bcMediaPreview");if(file&&box){const url=URL.createObjectURL(file);box.innerHTML=file.type.startsWith("video/")?'<video class="bc-media-preview" controls src="'+url+'"></video>':'<img class="bc-media-preview" src="'+url+'" alt="Preview">';}return;}
const send=e.target.closest("[data-send-chat]");if(send){const input=$("#bcModal [data-chat-input]");const v=(input?.value||"").trim();if(!v){toast("Type a message first");return;}const box=$("#bcModal .bc-chat-messages");if(box){box.insertAdjacentHTML("beforeend",'<div class="bc-chat-bubble outgoing">'+esc(v)+'</div>');box.scrollTop=box.scrollHeight;}input.value="";return;}
 const create=e.target.closest(".bc-create");if(create){const label=(create.querySelector("strong")||{}).textContent||"Post";closeModal();bcComposer(label);return;}
 const action=e.target.closest("[data-post-action]");if(action){if(window.bcPostAction){void window.bcPostAction(action.dataset.postAction,action.dataset.postId);}else{toast("Feed is still loading");}return;}
 const setting=e.target.closest("[data-setting]");if(setting){bcSettingsPanel(+setting.dataset.setting);return;}
 const theme=e.target.closest("[data-theme]");if(theme){state.theme=theme.dataset.theme;document.body.classList.toggle("bc-dark",state.theme==="dark");closeModal();renderAll();showScreen("settings");toast(state.theme==="dark"?"Dark theme enabled":"Light theme enabled");return;}
 const lang=e.target.closest("[data-language]");if(lang){state.language=lang.dataset.language;closeModal();renderAll();showScreen("settings");toast("Language: "+state.language);return;}
 const ct=e.target.closest("[data-connect-tab]");if(ct){state.connectTab=ct.dataset.connectTab;renderAll();showScreen("connect");return;}
 const com=e.target.closest("[data-community-tab]");if(com){state.communityTab=com.dataset.communityTab;renderAll();showScreen("community");return;}
 const ev=e.target.closest("[data-event-open]");if(ev){modal(ev.dataset.eventOpen,'<div class="bc-card"><h3>'+esc(ev.dataset.eventOpen)+'</h3><p>Community gathering and connection event.</p><button class="bc-action primary" data-close-modal>Close</button></div>');return;}
 const ce=e.target.closest("[data-create-event]");if(ce){bcComposer("Event");return;}
 const fc=e.target.closest("[data-feed-create]");if(fc){bcComposer(fc.dataset.feedKind||"Post");return;}
 const ps=e.target.closest("[data-profile-stat]");if(ps){showScreen(ps.dataset.profileStat==="connections"?"connect":ps.dataset.profileStat==="communities"?"community":"feed");return;}
 const edit=e.target.closest("[data-edit-profile]");if(edit){const p=window.__bcProfile||state.profile||{};modal("Edit Profile",'<form class="bc-form" data-profile-form><div class="bc-field"><label>Name</label><input name="name" required value="'+esc(p.name||"")+'"></div><div class="bc-field"><label>Bio</label><textarea name="bio">'+esc(p.bio||"")+'</textarea></div><button class="bc-action primary" type="submit">Save changes</button></form>');return;}

 const notif=e.target.closest("[data-notification-id]");if(notif){if(notif.dataset.notificationRead!=="true"&&window.bcMarkNotificationRead){void window.bcMarkNotificationRead(notif.dataset.notificationId);}return;}const mark=e.target.closest("[data-mark-notifications]");if(mark){void (async()=>{const sb=BC_SUPABASE();const {data:{user}}=await sb.auth.getUser();if(!user)return;const {error}=await sb.from("notifications").update({is_read:true}).eq("user_id",user.id).eq("is_read",false);if(error){toast("Could not mark notifications as read");return;}state.notifications=0;await window.bcReloadLive?.();toast("All notifications marked as read");})();return;}
},true);
document.addEventListener("input",function(e){
 const el=e.target;
 if(el.matches("[data-chat-filter]")){const q=el.value.toLowerCase();$("[data-chat-name]").forEach(x=>x.style.display=!q||x.textContent.toLowerCase().includes(q)?"":"none");}
 if(el.matches("[data-connect-search]")){const q=el.value.toLowerCase();$("[data-connect-user]").forEach(x=>{const card=x.closest(".bc-card");if(card)card.style.display=!q||card.textContent.toLowerCase().includes(q)?"":"none";});}
 if(el.matches("[data-community-search]")){const q=el.value.toLowerCase();$(".bc-community-card").forEach(x=>x.style.display=!q||x.textContent.toLowerCase().includes(q)?"":"none");}
 if(el.matches("[data-feed-search]")){const q=el.value.toLowerCase();$(".bc-post").forEach(x=>x.style.display=!q||x.textContent.toLowerCase().includes(q)?"":"none");}
},true);
document.addEventListener("change",function(e){if(e.target.matches("[data-chat-media]")){const file=e.target.files&&e.target.files[0],box=$("#bcMediaPreview");if(file&&box){const url=URL.createObjectURL(file);box.innerHTML=file.type.startsWith("video/")?'<video class="bc-media-preview" controls src="'+url+'"></video>':'<img class="bc-media-preview" src="'+url+'" alt="Preview">';}}},true);
document.addEventListener("submit",async function(e){if(e.target.matches("[data-password-form]")){e.preventDefault();const f=e.target;const p=String(f.password.value||"");const confirm=String(f.confirm.value||"");if(!/^\d{6}$/.test(p)){toast("Password must be exactly 6 digits");return;}if(p!==confirm){toast("Passwords do not match");return;}const sb=BC_SUPABASE();const {error}=await sb.auth.updateUser({password:p});if(error){console.error("Password update:",error);toast("Could not change password");return;}closeModal();toast("Password changed successfully");return;}if(e.target.matches("[data-composer-form]")){e.preventDefault();const f=e.target;const kind=f.dataset.composerKind;const sb=BC_SUPABASE();const {data:{user}}=await sb.auth.getUser();if(!user)return;const submit=f.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Publishing...";}try{let error=null;if(kind==="Post"){const body=(f.body?.value||"").trim();if(!body){toast("Write something first");return;}({error}=await sb.from("posts").insert({author_id:user.id,body,visibility:"public"}));}else if(kind==="Photo / Video"){const file=f.media?.files?.[0];if(!file){toast("Choose a photo or video");return;}if(file.size>25*1024*1024){toast("Media must be 25 MB or smaller");return;}const ext=(file.name.split(".").pop()||"bin").toLowerCase();const path=user.id+"/posts/"+crypto.randomUUID()+"."+ext;const up=await sb.storage.from("banjara-media").upload(path,file,{contentType:file.type,upsert:false});if(up.error){throw up.error;}const media=[{path,type:file.type,name:file.name}];const created=await sb.from("posts").insert({author_id:user.id,body:(f.body?.value||"").trim(),visibility:"public",media}).select("id").single();error=created.error;if(error)await sb.storage.from("banjara-media").remove([path]);}else if(kind==="Community"){const name=(f.title?.value||"").trim();const description=(f.description?.value||"").trim();if(!name){toast("Community name is required");return;}const created=await sb.from("communities").insert({name,description,created_by:user.id,is_public:true}).select("id").single();error=created.error;if(!error){const member=await sb.from("community_members").insert({community_id:created.data.id,user_id:user.id,role:"admin"});error=member.error;}}else if(kind==="Event"){const title=(f.title?.value||"").trim();const starts=f.starts_at?.value;if(!title||!starts){toast("Event name and date are required");return;}({error}=await sb.from("events").insert({title,description:(f.description?.value||"").trim(),location:(f.location?.value||"").trim(),starts_at:new Date(starts).toISOString(),created_by:user.id}));}else if(kind==="Group"){const name=(f.title?.value||"").trim();const numbers=String(f.members?.value||"").split(/[,\s]+/).map(x=>x.replace(/\D/g,"")).filter(Boolean);const unique=[...new Set(numbers)].filter(x=>x.length===10);if(!name||!unique.length){toast("Enter a group name and at least one valid 10-digit number");return;}const ids=[];for(const phone of unique.slice(0,30)){const lookup=await sb.functions.invoke("search-profile-by-phone",{body:{phone}});if(!lookup.error&&lookup.data?.profile?.id&&lookup.data.profile.id!==user.id)ids.push(lookup.data.profile.id);}const memberIds=[...new Set(ids)];if(!memberIds.length){toast("No matching members found");return;}const created=await sb.from("chats").insert({kind:"group",name,created_by:user.id}).select("id").single();error=created.error;if(!error){const rows=[user.id,...memberIds].map(user_id=>({chat_id:created.data.id,user_id}));const member=await sb.from("chat_members").insert(rows);error=member.error;}}else{toast(kind+" creation is not available yet");return;}if(error)throw error;closeModal();await window.bcReloadLive?.();toast(kind+" published");}catch(err){console.error("Composer:",err);toast("Could not publish "+kind.toLowerCase());}finally{if(submit){submit.disabled=false;submit.textContent="Publish";}}return;}if(e.target.matches("[data-profile-form]")){e.preventDefault();const f=e.target;const sb=BC_SUPABASE();const {data:{user}}=await sb.auth.getUser();if(!user)return;const name=(f.name.value||"").trim();const bio=(f.bio.value||"").trim();if(!name){toast("Name is required");return;}const {error}=await sb.from("profiles").update({name,bio,updated_at:new Date().toISOString()}).eq("id",user.id);if(error){console.error("Profile update:",error);toast("Could not update profile");return;}state.profile={...(state.profile||{}),name,bio};window.__bcProfile={...(window.__bcProfile||{}),name,bio};closeModal();await window.bcReloadLive?.();showScreen("profile");toast("Profile updated");}});

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",build,{once:true});else build();
})();