(function(){
"use strict";
const SB=()=>window.supabaseClient;
const escLive=s=>String(s||"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const initials=s=>String(s||"Member").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"M";
const ago=v=>{const m=Math.max(1,Math.floor((Date.now()-new Date(v).getTime())/60000));return m<60?m+"m":m<1440?Math.floor(m/60)+"h":Math.floor(m/1440)+"d";};
async function loadLive(){
 const sb=SB(); if(!sb)return;
 const {data:{user}}=await sb.auth.getUser(); if(!user)return;
 try{
  const [people,communities,posts,notifications,members]=await Promise.all([
   sb.from("profiles").select("id,name,bio,city,state,avatar_url").neq("id",user.id).order("created_at",{ascending:false}).limit(60),
   sb.from("communities").select("id,name,description,cover_url,created_at").order("created_at",{ascending:false}).limit(30),
   sb.from("posts").select("id,author_id,community_id,body,created_at").order("created_at",{ascending:false}).limit(40),
   sb.from("notifications").select("id,title,message,is_read,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40),
   sb.from("chat_members").select("chat_id,last_read_at").eq("user_id",user.id)
  ]);
  if(people.error||communities.error)throw people.error||communities.error;
  window.__bcLive={people:people.data||[],communities:communities.data||[],posts:posts.data||[],notifications:notifications.data||[],chats:[]};
  const pmap=new Map((people.data||[]).map(p=>[p.id,p])), cmap=new Map((communities.data||[]).map(c=>[c.id,c]));
  for(const m of (members.data||[])){
   const {data:others}=await sb.from("chat_members").select("user_id").eq("chat_id",m.chat_id).neq("user_id",user.id);
   const other=others?.[0]?.user_id;
   const {data:msgs}=await sb.from("messages").select("body,created_at,sender_id").eq("chat_id",m.chat_id).is("deleted_at",null).order("created_at",{ascending:false}).limit(1);
   const last=msgs?.[0];
   window.__bcLive.chats.push({id:m.chat_id,name:pmap.get(other)?.name||"Banjara Member",preview:last?.body||"No messages yet",unread:!!(last&&last.sender_id!==user.id&&new Date(last.created_at)>(m.last_read_at?new Date(m.last_read_at):new Date(0)))});
  }
  refreshUI();
 }catch(e){console.warn("Banjara live data:",e);}
}
function refreshUI(){
 const d=window.__bcLive;if(!d)return;
 const chatList=document.querySelector("#bc-chats .bc-list");
 if(chatList)chatList.innerHTML=d.chats.length?d.chats.map(c=>'<div class="bc-row" data-chat-name="'+escLive(c.name)+'" data-chat-id="'+c.id+'"><div class="bc-avatar">'+initials(c.name)+'</div><div class="bc-row-main"><strong>'+escLive(c.name)+'</strong><small>'+escLive(c.preview)+'</small></div>'+(c.unread?'<span class="bc-badge">1</span>':'')+'</div>').join(""):'<div class="bc-empty"><i class="fas fa-comments"></i><strong>No conversations yet</strong><span>Start a chat from Connect.</span></div>';
 const connect=document.querySelector("#bc-connect .bc-grid");
 if(connect)connect.innerHTML=d.people.length?d.people.map(p=>'<div class="bc-card"><div class="bc-post-head"><div class="bc-avatar">'+initials(p.name)+'</div><div><h3>'+escLive(p.name||"Banjara Member")+'</h3><p>'+escLive([p.city,p.state].filter(Boolean).join(" • ")||"Banjara Connect member")+'</p></div></div><button class="bc-action primary" data-connect-user="'+p.id+'">Connect</button></div>').join(""):'<div class="bc-empty"><i class="fas fa-user-group"></i><strong>No other members yet</strong><span>New members will appear here automatically.</span></div>';
 const comm=document.querySelector("#bc-community .bc-grid");
 if(comm)comm.innerHTML=d.communities.length?d.communities.map(c=>'<div class="bc-card" data-community-id="'+c.id+'"><h3>'+escLive(c.name)+'</h3><p>'+escLive(c.description||"Community")+'</p></div>').join(""):'<div class="bc-empty"><i class="fas fa-users"></i><strong>No communities yet</strong><span>Create or join a community.</span></div>';
 const feed=document.querySelector("#bc-feed #bcFeedList");
 if(feed)feed.innerHTML=d.posts.length?d.posts.map(p=>{const a=d.people.find(x=>x.id===p.author_id);const c=d.communities.find(x=>x.id===p.community_id);return '<article class="bc-card bc-post"><div class="bc-post-head"><div class="bc-avatar">'+initials(a?.name||"Member")+'</div><div><h3>'+escLive(a?.name||"Banjara Member")+'</h3><p>'+escLive(c?.name||"Banjara Connect")+' • '+ago(p.created_at)+'</p></div></div><div class="bc-post-body">'+escLive(p.body)+'</div><div class="bc-post-actions"><button data-post-action="like">♡ Like</button><button data-post-action="comment">💬 Comment</button><button data-post-action="share">↗ Share</button><button data-post-action="save">🔖 Save</button></div></article>';}).join(""):'<div class="bc-empty"><i class="fas fa-newspaper"></i><strong>No posts yet</strong><span>Be the first to share something.</span></div>';
 const ns=document.querySelector("#bc-notifications .bc-list");
 if(ns)ns.innerHTML=d.notifications.length?d.notifications.map(n=>'<div class="bc-row" data-notification-id="'+n.id+'"><div class="bc-avatar">'+initials(n.title)+'</div><div class="bc-row-main"><strong>'+escLive(n.title)+'</strong><small>'+escLive(n.message)+' • '+ago(n.created_at)+'</small></div>'+(n.is_read?'':'<span class="bc-badge">•</span>')+'</div>').join(""):'<div class="bc-empty"><i class="fas fa-bell"></i><strong>All caught up</strong><span>You have no new notifications.</span></div>';
}
window.bcReloadLive=loadLive;
document.addEventListener("click",async e=>{
 const n=e.target.closest("[data-notification-id]"); if(n){await SB().from("notifications").update({is_read:true}).eq("id",n.dataset.notificationId);n.querySelector(".bc-badge")?.remove();return;}
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(loadLive,1200));else setTimeout(loadLive,1200);
})();
