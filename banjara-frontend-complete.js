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
function personCard(p){return '<article class="bc-card">'+ '<div class="bc-person">'+avatar(p[0])+'<div><h3>'+p[1]+'</h3><p>'+p[2]+'</p></div></div><button class="bc-action primary" data-demo="Connection request sent">Connect</button></article>'}
function communityCard(c){return '<article class="bc-card bc-community-card"><div class="bc-community-icon">'+c[0]+'</div><div><h3>'+esc(c[1])+'</h3><p>'+esc(c[2])+'</p></div><button class="bc-action" data-community-id="'+esc(c[3]||"")+'">Open community</button></article>'}
function chatsHTML(){return '<div class="bc-hero"><h1>Chats</h1><p>Your conversations in one place.</p><div class="bc-search"><i class="fas fa-search"></i><input placeholder="Search chats..."><button><i class="fas fa-pen"></i></button></div></div><div class="bc-list">'+[['MP','Meena P.','Kal Banjara event ke baare mein...','2'],['RS','Ravi S.','See you at the community meet.',''],['NK','Nisha K.','Voice message • 0:18','1']].map(x=>'<div class="bc-row" data-demo="Chat opened">'+avatar(x[0])+'<div class="bc-row-main"><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>'+(x[3]?'<span class="bc-badge">'+x[3]+'</span>':'')+'</div>').join("")+'</div><div class="bc-section">'+empty("fa-comments","No more conversations","Backend chat will be connected after frontend completion.")+'</div>'}
function connectHTML(){return '<div class="bc-hero"><h1>Connect</h1><p>Discover people who share your interests.</p><div class="bc-search"><i class="fas fa-search"></i><input placeholder="Search people..."><button><i class="fas fa-search"></i></button></div><div class="bc-tabs"><button class="bc-tab active">Discover</button><button class="bc-tab">Requests</button><button class="bc-tab">My Connections</button></div></div><div class="bc-section"><div class="bc-section-head"><h2>People on Banjara Connect</h2><button data-refresh-social>Refresh</button></div><div class="bc-grid">'+(people.length?people.map(personCard).join(""):empty("fa-user-group","No other members yet","New members will appear here automatically."))+'</div></div>'}
function communityHTML(){return '<div class="bc-hero"><h1>Community</h1><p>Find your people, interests and culture.</p><div class="bc-search"><i class="fas fa-search"></i><input placeholder="Search communities..."><button><i class="fas fa-search"></i></button></div><div class="bc-tabs"><button class="bc-tab active">Discover</button><button class="bc-tab">My Communities</button><button class="bc-tab">Featured</button></div></div><div class="bc-section"><div class="bc-grid">'+(communities.length?communities.map(communityCard).join(""):empty("fa-users","No communities yet","Create or join a community and it will appear here."))+'</div></div><div class="bc-section">'+empty("fa-calendar-days","No events yet","Events from real communities will appear here.")+'</div>'}
function postCard(name,community,text){return '<article class="bc-card bc-post"><div class="bc-post-head">'+avatar(name.split(" ").map(x=>x[0]).join(""))+'<div><h3>'+name+'</h3><p>'+community+' • 2h</p></div></div><div class="bc-post-body">'+text+'</div><div class="bc-post-media"><i class="fas fa-mountain"></i></div><div class="bc-post-actions"><button data-demo="Liked">♡ Like</button><button data-demo="Comments opened">💬 Comment</button><button data-demo="Share sheet opened">↗ Share</button><button data-demo="Saved">🔖 Save</button></div></article>'}
function feedHTML(){return '<div class="bc-hero"><h1>Feed</h1><p>What is happening across your communities.</p></div><div class="bc-section">'+empty("fa-newspaper","Your feed is empty","Real posts from people and communities will appear here.")+'</div>'}
function notificationsHTML(){return '<div class="bc-hero"><h1>Notifications</h1><p>Stay updated without missing what matters.</p></div><div class="bc-list">'+[['RS','Ravi S.','sent you a connection request','2m'],['NK','Nisha K.','liked your community post','18m'],['🎓','Banjara Students','new event: Study Circle','1h'],['💬','Meena P.','sent you a message','2h']].map(x=>'<div class="bc-row">'+avatar(x[0])+'<div class="bc-row-main"><strong>'+x[1]+'</strong><small>'+x[2]+' • '+x[3]+'</small></div><span class="bc-badge">•</span></div>').join("")+'</div><div class="bc-section">'+empty("fa-bell","All caught up","Read and unread notification states are ready for backend data.")+'</div>'}
function profileHTML(){return '<div class="bc-profile-hero">'+avatar("HR").replace("bc-avatar","bc-profile-avatar")+'<div><h1>Harish Rathod</h1><p>Building connections through community and culture.</p><button class="bc-action primary" data-edit-profile style="width:auto;padding:0 14px">Edit Profile</button></div></div><div class="bc-stat-row"><div class="bc-stat"><strong>128</strong><span>Connections</span></div><div class="bc-stat"><strong>12</strong><span>Communities</span></div><div class="bc-stat"><strong>24</strong><span>Posts</span></div></div><div class="bc-section"><div class="bc-section-head"><h2>About</h2></div><div class="bc-card"><p>Community builder • Student • Technology enthusiast</p></div></div><div class="bc-section"><div class="bc-section-head"><h2>My posts</h2><button data-screen="feed">View all</button></div>'+postCard("Harish Rathod","Banjara Connect","Welcome to our new community space. ❤️")+'</div>'}
function settingsHTML(){const rows=[["fa-user","Profile","Personal information"],["fa-bell","Notifications","Choose what you receive"],["fa-palette","Appearance","Theme and visual preferences"],["fa-language","Language","English • Hindi • Lambadi"],["fa-shield-halved","Privacy","Control your visibility"],["fa-lock","Security","Account security"],["fa-user-slash","Blocked accounts","Manage blocked people"],["fa-mobile-screen","Sessions","Manage active sessions"],["fa-circle-info","Help & About","Help, feedback and app info"],["fa-user-gear","Account","Account actions"]];return '<div class="bc-hero"><h1>Settings</h1><p>Make Banjara Connect feel like yours.</p></div><div class="bc-setting-list">'+rows.map((r,i)=>'<button class="bc-setting" data-setting="'+i+'"><span class="bc-setting-icon"><i class="fas '+r[0]+'"></i></span><span class="bc-setting-main"><strong>'+r[1]+'</strong><small>'+r[2]+'</small></span><i class="fas fa-chevron-right"></i></button>').join("")+'</div><div class="bc-section"><button class="bc-action" data-logout style="height:42px">Log out</button></div>'}
function authHTML(){return '<div class="bc-auth"><div class="bc-auth-box">'+(state.auth==="signup"?signupHTML():state.auth==="login"?loginHTML():welcomeHTML())+'</div></div>'}
function welcomeHTML(){return '<img class="bc-auth-logo" src="/icons/banjara-connect-icon.svg"><h1>Welcome to Banjara Connect</h1><p>People, communities, culture and conversations — all in one place.</p><button class="bc-action primary" data-auth="signup" style="height:42px">Create account</button><button class="bc-action" data-auth="login" style="height:42px">Log in</button>'}
function loginHTML(){return '<img class="bc-auth-logo" src="/icons/banjara-connect-icon.svg"><h1>Welcome back</h1><p>Log in with your mobile number.</p><form class="bc-form" data-auth-form="login"><div class="bc-field"><label>Mobile number</label><input required inputmode="numeric" placeholder="10-digit mobile number"></div><div class="bc-field"><label>Password</label><input required type="password" placeholder="Password"></div><button class="bc-action primary" style="height:42px">Log in</button></form><div class="bc-switch"><span>New here?</span><button data-auth="signup">Create account</button></div><div class="bc-switch"><button data-demo="Password recovery UI ready">Forgot password?</button></div>'}
function signupHTML(){return '<img class="bc-auth-logo" src="/icons/banjara-connect-icon.svg"><h1>Create your account</h1><p>Mobile-only account setup. No email field.</p><form class="bc-form" data-auth-form="signup"><div class="bc-field"><label>Mobile number</label><input required inputmode="numeric" placeholder="10-digit mobile number"></div><div class="bc-field"><label>Password</label><input required type="password" placeholder="Create password"></div><div class="bc-field"><label>Confirm password</label><input required type="password" placeholder="Confirm password"></div><button class="bc-action primary" style="height:42px">Create account</button></form><div class="bc-switch"><span>Already have an account?</span><button data-auth="login">Log in</button></div>'}
function bcOpenChat(name){modal(name,'<div class="bc-chat-window"><div class="bc-chat-messages"><div class="bc-chat-bubble incoming">Hi! Welcome to Banjara Connect.</div><div class="bc-chat-bubble outgoing">Hello 👋</div></div><div class="bc-chat-composer"><input placeholder="Type a message..." data-chat-input><button data-send-chat><i class="fas fa-paper-plane"></i></button></div></div>')}
function bcOpenSetting(key){const m={profile:["Profile","Edit your profile information."],notifications:["Notifications","Choose which alerts you receive."],appearance:["Appearance","Theme and visual preferences."],language:["Language","English • Hindi • Lambadi"],privacy:["Privacy","Control your visibility."],security:["Security","Account security options."],blocked:["Blocked accounts","Manage blocked people."],sessions:["Sessions","Manage active sessions."],help:["Help & About","Help, feedback and app information."],account:["Account","Account actions."]};const x=m[key]||["Settings","Settings"];modal(x[0],'<div class="bc-card"><p>'+x[1]+'</p><button class="bc-action primary" data-close-modal>Done</button></div>')}
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
  const more=e.target.closest("[data-more]");if(more){e.preventDefault();e.stopPropagation();showScreen("settings");return}
  const nav=e.target.closest("[data-screen]");if(nav){e.preventDefault();showScreen(nav.dataset.screen);return}
  if(e.target.closest("[data-create]")){create();return}
  const chat=e.target.closest(".bc-row[data-demo=\"Chat opened\"]");if(chat){bcOpenChat(chat.querySelector("strong")?.textContent||"Chat");return}
  if(e.target.closest("[data-close-modal]")||e.target.id==="bcModal"){closeModal();return}
  const connect=e.target.closest("[data-connect-user]");if(connect){void bcSendConnection(connect.dataset.connectUser,connect);return}
  if(e.target.closest("[data-community-id]")){toast("Community selected");return}
  const setting=e.target.closest("[data-setting]");if(setting){bcOpenSetting(setting.dataset.setting);return}
  const demo=e.target.closest("[data-demo]");if(demo){toast(demo.dataset.demo);return}
  const tab=e.target.closest(".bc-tab,.bc-chip");if(tab){const group=tab.parentElement;$(".bc-tab,.bc-chip",group).forEach(x=>x.classList.remove("active"));tab.classList.add("active");toast(tab.textContent.trim()+" selected");return}
  const auth=e.target.closest("[data-auth]");if(auth){state.auth=auth.dataset.auth;renderAll();showScreen("auth");return}
  if(e.target.closest("[data-do-search]")){state.query=$("[data-search]")?.value||"";toast(state.query?"Searching "+state.query+"…":"Type something to search");return}
  const refresh=e.target.closest(".bc-section-head button");if(refresh && refresh.textContent.trim()==="Refresh"){toast("Suggestions refreshed");return}
  const setting=e.target.closest("[data-setting]");if(setting){const labels=["Profile","Notifications","Appearance","Language","Privacy","Security","Blocked accounts","Sessions","Help & About","Account"];modal(labels[+setting.dataset.setting]||"Settings",'<div class="bc-card"><p>This frontend section is ready. Backend controls will be connected in the backend phase.</p><button class="bc-action primary" data-close-modal>Done</button></div>');return}
  if(e.target.closest("[data-refresh-social]")){void bcLoadSocialData();return}
  if(e.target.closest("[data-logout]")){void (async()=>{try{clearInterval(bcSessionTimer);bcSessionTimer=null;await BC_SUPABASE()?.auth.signOut({scope:"local"});}catch(err){console.warn(err);}state.auth="welcome";renderAll();showScreen("auth");toast("Logged out");})();return}
  if(e.target.closest("[data-edit-profile]")){modal("Edit Profile",'<form class="bc-form"><div class="bc-field"><label>Name</label><input value="Harish Rathod"></div><div class="bc-field"><label>Bio</label><textarea>Community builder • Student • Technology enthusiast</textarea></div><button type="button" class="bc-action primary" data-demo="Profile changes saved locally">Save changes</button></form>');return}
 });
 document.addEventListener("submit",e=>{const f=e.target.closest("[data-auth-form]");if(!f)return;e.preventDefault();void bcHandleAuth(f);});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",build,{once:true});else build();
})();