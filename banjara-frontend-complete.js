/* =========================================================
   BANJARA CONNECT — COMPLETE FRONTEND SHELL
   Frontend shell + Supabase authentication integration. Real backend data is loaded in later modules.
   ========================================================= */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={screen:"home",auth:"welcome",query:"",theme:"light",notifications:3,language:"English",connectTab:"Discover",communityTab:"Discover",chatFilter:"",profile:{name:"Harish Rathod",bio:"Building connections through community and culture."}};
try{
 const saved=JSON.parse(localStorage.getItem("banjara_connect_settings_v1")||"{}");
 if(saved&&typeof saved==="object"){
  if(["light","dark"].includes(saved.theme))state.theme=saved.theme;
  if(["English","Hindi","Gor Boli (Lambadi)"].includes(saved.language))state.language=saved.language;
 }
}catch(_){}
function bcSaveSettings(){try{localStorage.setItem("banjara_connect_settings_v1",JSON.stringify({theme:state.theme,language:state.language}));}catch(_){}}
function bcApplyTheme(){document.body.classList.toggle("bc-dark",state.theme==="dark");}
let people=[];
let communities=[];
function avatar(x){return '<div class="bc-avatar">'+x+'</div>'}
function getInitials(x){var s=String(x||"Member").trim();return s?s.split(" ").filter(Boolean).slice(0,2).map(function(v){return v.charAt(0)}).join("").toUpperCase():"M"}
function build(){
 const oldMain=$("main"); if(oldMain) oldMain.style.display="none";
 document.body.classList.add("bc-app-ready");document.body.classList.remove("banjara-splash-active");
 const root=document.createElement("div");root.id="bcAppShell";
 root.innerHTML='<div class="bc-app">'+
 '<header class="bc-topbar"><div class="bc-brand"><img src="/icons/banjara-connect-icon.svg" alt=""><div class="bc-brand-text"><strong>Banjara Connect</strong><small>People • Community • Culture</small></div></div><div class="bc-top-actions"><button class="bc-icon-btn" data-screen="notifications" aria-label="Notifications"><i class="fas fa-bell"></i></button><button class="bc-icon-btn" data-screen="profile" aria-label="Profile"><i class="fas fa-user"></i></button></div></header>'+
 '<nav class="bc-desktop-nav">'+navBtns("home","Home","fa-house")+navBtns("chats","Chats","fa-comments")+navBtns("connect","Connect","fa-user-plus")+navBtns("community","Community","fa-users")+navBtns("notifications","Alerts","fa-bell")+navBtns("profile","Profile","fa-user")+navBtns("settings","Settings","fa-gear")+'</nav>'+
 '<section id="bc-home" class="bc-screen active"></section><section id="bc-chats" class="bc-screen"></section><section id="bc-connect" class="bc-screen"></section><section id="bc-community" class="bc-screen"></section><section id="bc-feed" class="bc-screen"></section><section id="bc-notifications" class="bc-screen"></section><section id="bc-profile" class="bc-screen"></section><section id="bc-settings" class="bc-screen"></section><section id="bc-auth" class="bc-screen"></section>'+
 '</div>'+
 '<nav class="bc-bottom">'+navBtns("home","Home","fa-house")+navBtns("chats","Chats","fa-comments")+navBtns("connect","Connect","fa-user-plus")+'<button class="create-btn" data-create aria-label="Create"><i class="fas fa-plus"></i></button>'+navBtns("community","Community","fa-users")+'<button data-ai-open aria-label="Ask with AI"><i class="fas fa-wand-magic-sparkles"></i><span>AI</span></button>'+navBtns("notifications","Alerts","fa-bell")+'<button data-more aria-label="More"><i class="fas fa-ellipsis"></i><span>More</span></button>'+'</nav>'+
 '<div id="bcModal" class="bc-modal"><div class="bc-sheet" id="bcSheet"></div></div><div id="bcToast" class="bc-toast"></div>';
 document.body.appendChild(root);
 renderAll();
 bcInitSafeHistory();
 bind();
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
function personCard(p){return '<article class="bc-card"><div class="bc-person">'+avatar(p[0])+'<div><h3>'+p[1]+'</h3><p>'+p[2]+'</p></div></div><button class="bc-action primary" data-connect-user="'+esc(p[3]||"")+'">Connect</button></article>'}
function communityCard(c){return '<article class="bc-card bc-community-card"><div class="bc-community-icon">'+c[0]+'</div><div><h3>'+c[1]+'</h3><p>'+c[2]+'<br>'+c[3]+'</p></div><button class="bc-action" data-demo="Community opened">Explore</button></article>'}
function chatsHTML(){return '<div class="bc-hero"><h1>Chats</h1><p>Your conversations in one place.</p><div class="bc-search"><i class="fas fa-search"></i><input placeholder="Search chats..."><button><i class="fas fa-pen"></i></button></div></div><div class="bc-list">'+[['MP','Meena P.','Kal Banjara event ke baare mein...','2'],['RS','Ravi S.','See you at the community meet.',''],['NK','Nisha K.','Voice message • 0:18','1']].map(x=>'<div class="bc-row" data-demo="Chat opened">'+avatar(x[0])+'<div class="bc-row-main"><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>'+(x[3]?'<span class="bc-badge">'+x[3]+'</span>':'')+'</div>').join("")+'</div><div class="bc-section">'+empty("fa-comments","No more conversations","Backend chat will be connected after frontend completion.")+'</div>'}
function connectHTML(){return '<div class="bc-hero"><h1>Connect</h1><p>Discover people who share your interests.</p><div class="bc-search"><i class="fas fa-search"></i><input placeholder="Search people..."><button><i class="fas fa-search"></i></button></div><div class="bc-tabs"><button class="bc-tab active">Discover</button><button class="bc-tab">Requests</button><button class="bc-tab">My Connections</button></div></div><div class="bc-section"><div class="bc-section-head"><h2>People on Banjara Connect</h2><button data-refresh-social>Refresh</button></div><div class="bc-grid">'+(people.length?people.map(personCard).join(""):empty("fa-user-group","No other members yet","New members will appear here automatically."))+'</div></div>'}
function communityHTML(){return '<div class="bc-hero"><h1>Community</h1><p>Find your people, interests and culture.</p><div class="bc-search"><i class="fas fa-search"></i><input placeholder="Search communities..."><button><i class="fas fa-search"></i></button></div><div class="bc-tabs"><button class="bc-tab active">Discover</button><button class="bc-tab">My Communities</button><button class="bc-tab">Featured</button></div></div><div class="bc-section"><div class="bc-grid">'+(communities.length?communities.map(communityCard).join(""):empty("fa-users","No communities yet","Create or join a community and it will appear here."))+'</div></div><div class="bc-section">'+empty("fa-calendar-days","No events yet","Events from real communities will appear here.")+'</div>'}
function postCard(name,community,text){return '<article class="bc-card bc-post"><div class="bc-post-head">'+avatar(name.split(" ").map(x=>x[0]).join(""))+'<div><h3>'+name+'</h3><p>'+community+' • 2h</p></div></div><div class="bc-post-body">'+esc(text)+'</div><div class="bc-post-media"><i class="fas fa-mountain"></i></div><div class="bc-post-actions"><button data-post-action="like">♡ Like</button><button data-post-action="comment">💬 Comment</button><button data-post-action="share">↗ Share</button><button data-post-action="save">🔖 Save</button></div></article>'}
function feedHTML(){return '<div class="bc-hero"><h1>Feed</h1><p>What is happening across your communities.</p><div class="bc-search"><i class="fas fa-search"></i><input data-feed-search placeholder="Search posts..."><button data-feed-create><i class="fas fa-plus"></i></button></div></div><div class="bc-section" id="bcFeedList">'+postCard("Banjara Community","Banjara Connect","Welcome to Banjara Connect. Share your ideas, culture and community moments.")+postCard("Community Member","Culture & Community","What should we plan for our next community gathering?")+'</div>'}
function notificationsHTML(){return '<div class="bc-hero"><h1>Notifications</h1><p>Stay updated without missing what matters.</p></div><div class="bc-list">'+[['RS','Ravi S.','sent you a connection request','2m'],['NK','Nisha K.','liked your community post','18m'],['🎓','Banjara Students','new event: Study Circle','1h'],['💬','Meena P.','sent you a message','2h']].map(x=>'<div class="bc-row">'+avatar(x[0])+'<div class="bc-row-main"><strong>'+x[1]+'</strong><small>'+x[2]+' • '+x[3]+'</small></div><span class="bc-badge">•</span></div>').join("")+'</div><div class="bc-section">'+empty("fa-bell","All caught up","Read and unread notification states are ready for backend data.")+'</div>'}
function profileHTML(){return '<div class="bc-profile-hero">'+avatar("HR").replace("bc-avatar","bc-profile-avatar")+'<div><h1>Harish Rathod</h1><p>Building connections through community and culture.</p><button class="bc-action primary" data-edit-profile style="width:auto;padding:0 14px">Edit Profile</button></div></div><div class="bc-stat-row"><div class="bc-stat"><strong>128</strong><span>Connections</span></div><div class="bc-stat"><strong>12</strong><span>Communities</span></div><div class="bc-stat"><strong>24</strong><span>Posts</span></div></div><div class="bc-section"><div class="bc-section-head"><h2>About</h2></div><div class="bc-card"><p>Community builder • Student • Technology enthusiast</p></div></div><div class="bc-section"><div class="bc-section-head"><h2>My posts</h2><button data-screen="feed">View all</button></div>'+postCard("Harish Rathod","Banjara Connect","Welcome to our new community space. ❤️")+'</div>'}
function settingsHTML(){const rows=[["fa-user","Profile","Personal information"],["fa-bell","Notifications","Choose what you receive"],["fa-palette","Appearance",state.theme==="dark"?"Dark theme":"Light theme"],["fa-language","Language",state.language],["fa-shield-halved","Privacy","Control your visibility"],["fa-lock","Security","Account security"],["fa-user-slash","Blocked accounts","Manage blocked people"],["fa-mobile-screen","Sessions","Manage active sessions"],["fa-circle-info","Help & About","Help, feedback and app info"],["fa-user-gear","Account","Account actions"]];return '<div class="bc-hero"><h1>Settings</h1><p>Make Banjara Connect feel like yours.</p></div><div class="bc-setting-list">'+rows.map((r,i)=>'<button class="bc-setting" data-setting="'+i+'"><span class="bc-setting-icon"><i class="fas '+r[0]+'"></i></span><span class="bc-setting-main"><strong>'+r[1]+'</strong><small>'+r[2]+'</small></span><i class="fas fa-chevron-right"></i></button>').join("")+'</div><div class="bc-section"><button class="bc-action" data-logout style="height:42px">Log out</button></div>'}
function authHTML(){return '<div class="bc-auth"><div class="bc-auth-box">'+(state.auth==="signup"?signupHTML():state.auth==="login"?loginHTML():welcomeHTML())+'</div></div>'}
function welcomeHTML(){return '<img class="bc-auth-logo" src="/icons/banjara-connect-icon.svg"><h1>Welcome to Banjara Connect</h1><p>People, communities, culture and conversations — all in one place.</p><button class="bc-action primary" data-auth="signup" style="height:42px">Create account</button><button class="bc-action" data-auth="login" style="height:42px">Log in</button>'}
function loginHTML(){return '<img class="bc-auth-logo" src="/icons/banjara-connect-icon.svg"><h1>Welcome back</h1><p>Log in with your mobile number.</p><form class="bc-form" data-auth-form="login"><div class="bc-field"><label>Mobile number</label><input required inputmode="numeric" placeholder="10-digit mobile number"></div><div class="bc-field"><label>Password</label><input required type="password" placeholder="Password"></div><button class="bc-action primary" style="height:42px">Log in</button></form><div class="bc-switch"><span>New here?</span><button data-auth="signup">Create account</button></div><div class="bc-switch"><button data-demo="Password recovery UI ready">Forgot password?</button></div>'}
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

/* Safe browser back navigation: isolated from showScreen/rendering logic. */
let bcSafeHistoryReady=false;
const BC_HISTORY_SCREENS=["home","chats","connect","community","feed","notifications","profile","settings","auth"];
function bcHistoryScreen(){const h=String(window.location.hash||"").replace(/^#/,"");return BC_HISTORY_SCREENS.includes(h)?h:"home";}
function bcPushHistory(screen){
 if(!bcSafeHistoryReady||!BC_HISTORY_SCREENS.includes(screen)||screen===state.screen)return;
 try{window.history.pushState({bcScreen:screen},"",window.location.pathname+window.location.search+(screen==="home"?"":"#"+screen));}catch(e){console.warn("Banjara history:",e);}
}
function bcInitSafeHistory(){
 if(bcSafeHistoryReady)return;
 const initial=bcHistoryScreen();
 try{window.history.replaceState({bcScreen:initial},"",window.location.pathname+window.location.search+(initial==="home"?"":"#"+initial));}catch(e){console.warn("Banjara history init:",e);}
 bcSafeHistoryReady=true;
 window.addEventListener("popstate",function(e){
  const target=(e.state&&e.state.bcScreen)||bcHistoryScreen();
  if(BC_HISTORY_SCREENS.includes(target))showScreen(target);
 });
 document.addEventListener("click",async function(e){
  const nav=e.target.closest("[data-screen]");
  if(nav)bcPushHistory(nav.dataset.screen);
  else if(e.target.closest("[data-more]"))bcPushHistory("settings");
 },true);
}


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
function create(){modal("Create",'<div class="bc-create-grid">'+[['fa-pen','Post','Share an update'],['fa-image','Photo / Video','Share a moment'],['fa-square-poll-vertical','Poll','Ask your community'],['fa-calendar-days','Event','Create an event'],['fa-user-group','Group','Start a group'],['fa-people-group','Community','Build a community']].map(x=>'<button class="bc-create" data-demo="'+x[1]+' opened"><i class="fas '+x[0]+'"></i><strong>'+x[1]+'</strong><small>'+x[2]+'</small></button>').join("")+'</div>')}
function bind(){
 document.addEventListener("click",e=>{
  const ai=e.target.closest("[data-ai-open]");if(ai){e.preventDefault();if(window.openBanjaraConnectAI)window.openBanjaraConnectAI();return;}
  const more=e.target.closest("[data-more]");if(more){e.preventDefault();e.stopPropagation();showScreen("settings");return}
  const nav=e.target.closest("[data-screen]");if(nav){e.preventDefault();showScreen(nav.dataset.screen);return}
  if(e.target.closest("[data-create]")){create();return}
  if(e.target.closest("[data-close-modal]")||e.target.id==="bcModal"){closeModal();return}
  const connect=e.target.closest("[data-connect-user]");if(connect){void bcSendConnection(connect.dataset.connectUser,connect);return}
  if(e.target.closest("[data-community-id]")){toast("Community selected");return}
  const demo=e.target.closest("[data-demo]");if(demo){const label=demo.dataset.demo||"";if(label==="Chat opened"){modal("Chat",'<div class="bc-chat-window"><div class="bc-chat-messages"><div class="bc-chat-bubble incoming">Hi! Welcome to Banjara Connect.</div><div class="bc-chat-bubble outgoing">Hello 👋</div></div><div class="bc-chat-composer"><input placeholder="Type a message..." data-chat-input><button data-send-chat><i class="fas fa-paper-plane"></i></button></div></div>');return}if(label==="Community opened"){modal("Community",'<div class="bc-card"><h3>Community</h3><p>Community details and actions are ready for the backend data.</p><button class="bc-action primary" data-close-modal>Done</button></div>');return}if(label==="Connection request sent"){demo.textContent="Requested";demo.disabled=true;toast("Connection request sent");return}toast(label);return}
  const tab=e.target.closest(".bc-tab,.bc-chip");if(tab){const group=tab.parentElement;$(".bc-tab,.bc-chip",group).forEach(x=>x.classList.remove("active"));tab.classList.add("active");toast(tab.textContent.trim()+" selected");return}
  const auth=e.target.closest("[data-auth]");if(auth){state.auth=auth.dataset.auth;renderAll();showScreen("auth");return}
  if(e.target.closest("[data-do-search]")){state.query=$("[data-search]")?.value||"";toast(state.query?"Searching "+state.query+"…":"Type something to search");return}
  const refresh=e.target.closest(".bc-section-head button");if(refresh && refresh.textContent.trim()==="Refresh"){toast("Suggestions refreshed");return}
  const setting=e.target.closest("[data-setting]");if(setting){const labels=["Profile","Notifications","Appearance","Language","Privacy","Security","Blocked accounts","Sessions","Help & About","Account"];modal(labels[+setting.dataset.setting]||"Settings",'<div class="bc-card"><p>This frontend section is ready. Backend controls will be connected in the backend phase.</p><button class="bc-action primary" data-close-modal>Done</button></div>');return}
  if(e.target.closest("[data-refresh-social]")){void bcLoadSocialData();return}
  if(e.target.closest("[data-logout]")){void (async()=>{try{clearInterval(bcSessionTimer);bcSessionTimer=null;await BC_SUPABASE()?.auth.signOut({scope:"local"});}catch(err){console.warn(err);}state.auth="welcome";renderAll();showScreen("auth");toast("Logged out");})();return}
  if(e.target.closest("[data-edit-profile]")){const u=await BC_SUPABASE()?.auth.getUser();const id=u?.data?.user?.id||"";modal("Edit Profile",'<form class="bc-form" data-profile-form data-profile-id="'+id+'"><div class="bc-field"><label>Profile photo</label><input name="avatar" type="file" accept="image/*"></div><div class="bc-field"><label>Name</label><input name="name" value="'+esc(window.__bcProfile?.name||"")+'"></div><div class="bc-field"><label>Bio</label><textarea name="bio">'+esc(window.__bcProfile?.bio||"")+'</textarea></div><div class="bc-field"><label>City</label><input name="city" value="'+esc(window.__bcProfile?.city||"")+'"></div><div class="bc-field"><label>State</label><input name="state" value="'+esc(window.__bcProfile?.state||"")+'"></div><button class="bc-action primary" type="submit">Save changes</button></form>');return}
 });
 document.addEventListener("submit",e=>{const f=e.target.closest("[data-auth-form]");if(!f)return;e.preventDefault();void bcHandleAuth(f);});document.addEventListener("submit",e=>{const cf=e.target.closest("[data-change-password-form]");if(cf){e.preventDefault();const fd=new FormData(cf),p=String(fd.get("password")||""),c=String(fd.get("confirm")||"");if(!/^\d{6}$/.test(p)||p!==c){toast("Password must be 6 matching digits");return;}void (async()=>{const r=await BC_SUPABASE()?.auth.updateUser({password:p});if(r?.error){toast("Could not update password");return;}closeModal();toast("Password updated");})();return;}
 document.addEventListener("submit",e=>{const pf=e.target.closest("[data-profile-form]");if(!pf)return;e.preventDefault();void (async()=>{const sb=BC_SUPABASE();const id=pf.dataset.profileId;if(!sb||!id)return;const fd=new FormData(pf);const avatar=fd.get("avatar");let avatar_url=window.__bcProfile?.avatar_url||null;if(avatar&&avatar.size){const ext=(avatar.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");const path=id+"/avatar."+ext;const up=await sb.storage.from("banjara-avatars").upload(path,avatar,{upsert:true,contentType:avatar.type||"image/jpeg"});if(up.error){toast("Could not upload photo");return;}avatar_url=sb.storage.from("banjara-avatars").getPublicUrl(path).data.publicUrl;}const r=await sb.from("profiles").update({name:String(fd.get("name")||"").trim(),bio:String(fd.get("bio")||"").trim(),city:String(fd.get("city")||"").trim(),state:String(fd.get("state")||"").trim(),avatar_url,updated_at:new Date().toISOString()}).eq("id",id);if(r.error){toast("Could not save profile");return;}closeModal();toast("Profile updated");window.bcReloadLive?.();})();return;});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
}

function bcOpenChat(name){modal("Chat with "+esc(name),'<div class="bc-chat-window"><div class="bc-chat-messages"><div class="bc-chat-bubble incoming">Hi! Welcome to Banjara Connect 👋</div><div class="bc-chat-bubble outgoing">Hello!</div></div><div class="bc-chat-tools"><button data-chat-tool="emoji">😊 Emoji</button><button data-chat-tool="attach">📎 Attach</button><button data-chat-tool="voice">🎙 Voice</button></div><div class="bc-chat-composer"><input data-chat-input placeholder="Type a message..." autocomplete="off"><button data-send-chat><i class="fas fa-paper-plane"></i></button></div></div>');}
function bcComposer(kind){let fields='<div class="bc-field"><label>Title</label><input name="title" required placeholder="'+kind+' title"></div><div class="bc-field"><label>Description</label><textarea name="description" required placeholder="Write something..."></textarea></div>';if(kind==="Photo / Video")fields='<div class="bc-field"><label>Caption</label><textarea name="description" placeholder="Write a caption..."></textarea></div><div class="bc-field"><label>Media</label><input name="media" type="file" accept="image/*,video/*" required></div>';if(kind==="Poll")fields='<div class="bc-field"><label>Question</label><input name="title" required placeholder="Ask your community"></div><div class="bc-field"><label>Option 1</label><input required placeholder="First option"></div><div class="bc-field"><label>Option 2</label><input required placeholder="Second option"></div><div class="bc-field"><label>Option 3</label><input placeholder="Optional third option"></div>';if(kind==="Event")fields='<div class="bc-field"><label>Event name</label><input name="title" required placeholder="Event name"></div><div class="bc-field"><label>Date & time</label><input type="datetime-local" required></div><div class="bc-field"><label>Location</label><input required placeholder="Venue or online"></div><div class="bc-field"><label>Description</label><textarea placeholder="Event details"></textarea></div>';if(kind==="Group"||kind==="Community")fields='<div class="bc-field"><label>Name</label><input name="title" required placeholder="'+kind+' name"></div><div class="bc-field"><label>Description</label><textarea name="description" required placeholder="Tell people what this is about"></textarea></div>';modal("Create "+kind,'<form class="bc-form" data-composer-form><div class="bc-card"><p>Create a '+kind.toLowerCase()+' in Banjara Connect.</p></div>'+fields+'<div class="bc-setting-controls"><button class="bc-action" type="button" data-demo="Draft saved">Save draft</button><button class="bc-action primary" type="submit">Publish</button></div></form>');}
function bcSettingDetail(title){const copy={Profile:"Edit your name and bio.",Notifications:"Choose notification preferences.",Appearance:"Light theme is active.",Language:"English, Hindi and Lambadi are supported.",Privacy:"Control who can see and interact with you.",Security:"Security controls will be connected in backend phase.",Blocked:"Manage blocked accounts.",Sessions:"Review active sessions.",Help:"Help, feedback and app information.",Account:"Account actions and logout."};modal(title,'<div class="bc-card bc-setting-detail"><p>'+esc(copy[title]||"Frontend settings are ready.")+'</p><button class="bc-action primary" data-close-modal>Done</button></div>');}
document.addEventListener("click",function(e){
 if(e.target.closest("[data-ai-open],[data-more],[data-create],[data-close-modal],[data-connect-user],[data-chat-name],[data-send-chat],[data-new-chat],[data-setting],[data-post-action],[data-demo],[data-screen],[data-connect-tab],[data-community-tab],[data-event-open],[data-create-event],[data-feed-create],[data-edit-profile],[data-theme],[data-language],[data-profile-stat],[data-mark-notifications]"))e.stopImmediatePropagation();
 const ai=e.target.closest("[data-ai-open]");if(ai){e.preventDefault();if(window.openBanjaraConnectAI)window.openBanjaraConnectAI();return;}
 const close=e.target.closest("[data-close-modal]");if(close||e.target.id==="bcModal"){closeModal();return;}
 const nav=e.target.closest("[data-screen]");if(nav){showScreen(nav.dataset.screen);return;}
 const more=e.target.closest("[data-more]");if(more){showScreen("settings");return;}
 const connect=e.target.closest("[data-connect-user]");if(connect){void bcSendConnection(connect.dataset.connectUser,connect);return;}
 const chat=e.target.closest("[data-chat-name]");if(chat){bcOpenChat(chat.dataset.chatName);return;}
 const newChat=e.target.closest("[data-new-chat]");if(newChat){modal("New chat",'<form class="bc-form" data-new-chat-form><div class="bc-field"><label>Person</label><input name="person" required placeholder="Name or mobile number"></div><button class="bc-action primary" type="submit">Start chat</button></form>');return;}
 const chatTool=e.target.closest("[data-chat-tool]");if(chatTool){const type=chatTool.dataset.chatTool;if(type==="emoji"){const input=$("#bcModal [data-chat-input]");if(input){input.value+=" 😊";input.focus();}}else if(type==="attach"){modal("Attach media",'<div class="bc-form"><div class="bc-field"><label>Choose image or video</label><input data-chat-media type="file" accept="image/*,video/*"></div><div id="bcMediaPreview"></div><button class="bc-action primary" data-demo="Attachment ready">Attach</button></div>');}else{chatTool.classList.toggle("is-recording");chatTool.textContent=chatTool.classList.contains("is-recording")?"⏹ Stop recording":"🎙 Voice";toast(chatTool.classList.contains("is-recording")?"Recording…":"Voice message ready");}return;}
const media=e.target.closest("[data-chat-media]");if(media){const file=media.files&&media.files[0],box=$("#bcMediaPreview");if(file&&box){const url=URL.createObjectURL(file);box.innerHTML=file.type.startsWith("video/")?'<video class="bc-media-preview" controls src="'+url+'"></video>':'<img class="bc-media-preview" src="'+url+'" alt="Preview">';}return;}
const send=e.target.closest("[data-send-chat]");if(send){const input=$("#bcModal [data-chat-input]");const v=(input?.value||"").trim();if(!v){toast("Type a message first");return;}const box=$("#bcModal .bc-chat-messages");if(box){box.insertAdjacentHTML("beforeend",'<div class="bc-chat-bubble outgoing">'+esc(v)+'</div>');box.scrollTop=box.scrollHeight;}input.value="";return;}
 const create=e.target.closest(".bc-create");if(create){const label=(create.querySelector("strong")||{}).textContent||"Post";closeModal();bcComposer(label);return;}
 const action=e.target.closest("[data-post-action]");if(action){const a=action.dataset.postAction;if(a==="like"){action.classList.toggle("is-active");action.textContent=action.classList.contains("is-active")?"♥ Liked":"♡ Like";}else if(a==="save"){action.classList.toggle("is-active");action.textContent=action.classList.contains("is-active")?"🔖 Saved":"🔖 Save";}else if(a==="comment"){modal("Comments",'<div class="bc-card"><p>No comments yet. Start the conversation.</p></div><div class="bc-chat-composer"><input placeholder="Write a comment..."><button data-demo="Comment added">Send</button></div>');}else{modal("Share post",'<div class="bc-card"><p>Choose where you want to share this post.</p><button class="bc-action primary" data-demo="Post link copied">Copy link</button></div>');}return;}
 const setting=e.target.closest("[data-setting]");if(setting){const labels=["Profile","Notifications","Appearance","Language","Privacy","Security","Blocked accounts","Sessions","Help & About","Account"];const k=labels[+setting.dataset.setting]||"Settings";if(k==="Profile"){showScreen("profile");return;}if(k==="Appearance"){modal("Appearance",'<div class="bc-theme-grid"><button class="bc-card" data-theme="light">☀️<strong>Light</strong><small>Warm Banjara theme</small></button><button class="bc-card" data-theme="dark">🌙<strong>Dark</strong><small>Low-light theme</small></button></div>');return;}if(k==="Language"){modal("Language",'<div class="bc-language-grid">'+["English","Hindi","Gor Boli (Lambadi)"].map(x=>'<button class="bc-action '+(state.language===x?"primary":"")+'" data-language="'+x+'">'+x+'</button>').join("")+'</div>');return;}
if(k==="Notifications"){modal("Notifications",'<div class="bc-card"><label class="bc-switch-row"><span>Connection requests</span><input type="checkbox" data-pref="connections" checked></label><label class="bc-switch-row"><span>Messages</span><input type="checkbox" data-pref="messages" checked></label><label class="bc-switch-row"><span>Community activity</span><input type="checkbox" data-pref="community" checked></label><button class="bc-action primary" data-save-prefs>Save</button></div>');return;}
if(k==="Privacy"){modal("Privacy",'<div class="bc-card"><label class="bc-switch-row"><span>Show online status</span><input type="checkbox" data-privacy="online" checked></label><label class="bc-switch-row"><span>Allow connection requests</span><input type="checkbox" data-privacy="requests" checked></label><button class="bc-action primary" data-save-prefs>Save</button></div>');return;}
if(k==="Security"){modal("Security",'<div class="bc-card"><p>Mobile login uses your 6-digit password.</p><button class="bc-action primary" data-change-password>Change password</button><button class="bc-action" data-security-signout>Sign out this device</button></div>');return;}
if(k==="Blocked accounts"){modal("Blocked accounts",'<div class="bc-card"><p>No blocked accounts currently.</p><button class="bc-action primary" data-close-modal>Done</button></div>');return;}
if(k==="Sessions"){modal("Sessions",'<div class="bc-card"><p>Current device session is active.</p><button class="bc-action primary" data-security-signout>Sign out this device</button></div>');return;}
if(k==="Help & About"){modal("Help & About",'<div class="bc-card"><h3>Banjara Connect</h3><p>Community, culture and conversations in one place.</p><p>Version 2.0</p><button class="bc-action primary" data-close-modal>Done</button></div>');return;}
if(k==="Account"){modal("Account",'<div class="bc-card"><p>Account is secured with your mobile number.</p><button class="bc-action" data-logout>Log out</button><button class="bc-action primary" data-close-modal>Done</button></div>');return;}
modal(k,'<div class="bc-card"><p>Settings saved for this device.</p><button class="bc-action primary" data-close-modal>Done</button></div>');return;}
 const savePrefs=e.target.closest("[data-save-prefs]");if(savePrefs){const prefs={};$("#bcModal")?.querySelectorAll("[data-pref],[data-privacy]").forEach(x=>prefs[x.dataset.pref||x.dataset.privacy]=!!x.checked);localStorage.setItem("banjara_connect_prefs_v1",JSON.stringify(prefs));closeModal();toast("Settings saved");return;}
 const signoutDevice=e.target.closest("[data-security-signout]");if(signoutDevice){try{await BC_SUPABASE()?.auth.signOut({scope:"local"});}catch(err){console.warn(err);}state.auth="welcome";renderAll();showScreen("auth");toast("Signed out");return;}
 const changePw=e.target.closest("[data-change-password]");if(changePw){modal("Change password",'<form class="bc-form" data-change-password-form><div class="bc-field"><label>New 6-digit password</label><input name="password" inputmode="numeric" maxlength="6" required></div><div class="bc-field"><label>Confirm password</label><input name="confirm" inputmode="numeric" maxlength="6" required></div><button class="bc-action primary" type="submit">Update password</button></form>');return;}
 const theme=e.target.closest("[data-theme]");if(theme){state.theme=theme.dataset.theme;bcSaveSettings();bcApplyTheme();closeModal();renderAll();showScreen("settings");toast(state.theme==="dark"?"Dark theme enabled":"Light theme enabled");return;}
 const lang=e.target.closest("[data-language]");if(lang){state.language=lang.dataset.language;bcSaveSettings();closeModal();renderAll();showScreen("settings");toast("Language: "+state.language);return;}
 const ct=e.target.closest("[data-connect-tab]");if(ct){state.connectTab=ct.dataset.connectTab;renderAll();showScreen("connect");return;}
 const com=e.target.closest("[data-community-tab]");if(com){state.communityTab=com.dataset.communityTab;renderAll();showScreen("community");return;}
 const ev=e.target.closest("[data-event-open]");if(ev){modal(ev.dataset.eventOpen,'<div class="bc-card"><h3>'+esc(ev.dataset.eventOpen)+'</h3><p>Community gathering and connection event.</p><button class="bc-action primary" data-demo="Event reminder set">Remind me</button></div>');return;}
 const ce=e.target.closest("[data-create-event]");if(ce){bcComposer("Event");return;}
 const fc=e.target.closest("[data-feed-create]");if(fc){bcComposer("Post");return;}
 const ps=e.target.closest("[data-profile-stat]");if(ps){showScreen(ps.dataset.profileStat==="connections"?"connect":ps.dataset.profileStat==="communities"?"community":"feed");return;}
 const edit=e.target.closest("[data-edit-profile]");if(edit){modal("Edit Profile",'<form class="bc-form" data-profile-form><div class="bc-field"><label>Name</label><input name="name" required value="'+esc(state.profile.name)+'"></div><div class="bc-field"><label>Bio</label><textarea name="bio">'+esc(state.profile.bio)+'</textarea></div><button class="bc-action primary" type="submit">Save changes</button></form>');return;}
 const demo=e.target.closest("[data-demo]");if(demo){const label=demo.dataset.demo||"";if(["Post","Photo / Video","Poll","Event","Group","Community"].includes(label.replace(" opened",""))){bcComposer(label.replace(" opened",""));return;}if(label==="Chat opened"){bcOpenChat("Community member");return;}if(label==="Community opened"){modal("Community",'<div class="bc-card"><h3>Community</h3><p>Explore posts, members and events from this community.</p><div class="bc-setting-controls"><button class="bc-action primary" data-demo="Joined community">Join community</button><button class="bc-action" data-demo="Members opened">Members</button></div></div>');return;}toast(label);return;}
 const mark=e.target.closest("[data-mark-notifications]");if(mark){state.notifications=0;toast("All notifications marked as read");return;}
},true);
document.addEventListener("input",function(e){
 const el=e.target;
 if(el.matches("[data-chat-filter]")){const q=el.value.toLowerCase();$("[data-chat-name]").forEach(x=>x.style.display=!q||x.textContent.toLowerCase().includes(q)?"":"none");}
 if(el.matches("[data-connect-search]")){const q=el.value.toLowerCase();$("[data-connect-user]").forEach(x=>{const card=x.closest(".bc-card");if(card)card.style.display=!q||card.textContent.toLowerCase().includes(q)?"":"none";});}
 if(el.matches("[data-community-search]")){const q=el.value.toLowerCase();$(".bc-community-card").forEach(x=>x.style.display=!q||x.textContent.toLowerCase().includes(q)?"":"none");}
 if(el.matches("[data-feed-search]")){const q=el.value.toLowerCase();$(".bc-post").forEach(x=>x.style.display=!q||x.textContent.toLowerCase().includes(q)?"":"none");}
},true);
document.addEventListener("change",function(e){if(e.target.matches("[data-chat-media]")){const file=e.target.files&&e.target.files[0],box=$("#bcMediaPreview");if(file&&box){const url=URL.createObjectURL(file);box.innerHTML=file.type.startsWith("video/")?'<video class="bc-media-preview" controls src="'+url+'"></video>':'<img class="bc-media-preview" src="'+url+'" alt="Preview">';}}},true);
document.addEventListener("submit",async function(e){
 if(e.target.matches("[data-composer-form]")){e.preventDefault();closeModal();toast("Published locally — backend connection comes later.");}
 if(e.target.matches("[data-profile-form]")){
  e.preventDefault();
  const f=e.target;state.profile=state.profile||{};
  state.profile.name=f.name.value||"Banjara Member";state.profile.bio=f.bio.value||"";
  try{
   const sb=BC_SUPABASE(),{data:{user}}=await sb.auth.getUser();
   if(user)await sb.from("profiles").update({name:state.profile.name,bio:state.profile.bio,updated_at:new Date().toISOString()}).eq("id",user.id);
  }catch(err){console.warn("Profile update:",err);}
  closeModal();renderAll();showScreen("profile");toast("Profile updated");
 }
});

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",build,{once:true});else build();
bcApplyTheme();
})();