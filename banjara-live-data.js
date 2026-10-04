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
  const [profile,people,communities,posts,notifications,members]=await Promise.all([sb.from("profiles").select("id,name,bio,city,state,area,avatar_url,cover_url,username,phone").eq("id",user.id).maybeSingle()),
   sb.from("profiles").select("id,name,bio,city,state,avatar_url").neq("id",user.id).order("created_at",{ascending:false}).limit(60),
   sb.from("communities").select("id,name,description,cover_url,created_at").order("created_at",{ascending:false}).limit(30),
   sb.from("posts").select("id,author_id,community_id,body,created_at").order("created_at",{ascending:false}).limit(40),
   sb.from("notifications").select("id,title,message,is_read,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40),
   sb.from("chat_members").select("chat_id,last_read_at").eq("user_id",user.id)
  ]);
  if(people.error||communities.error)throw people.error||communities.error;
  const {data:cmembers}=await sb.from("community_members").select("community_id,user_id,role").eq("user_id",user.id); const myCommunityIds=new Set((cmembers||[]).map(x=>x.community_id)); const {data:sent}=await sb.from("connections").select("id,addressee_id,status").eq("requester_id",user.id); const {data:received}=await sb.from("connections").select("id,requester_id,status").eq("addressee_id",user.id); const conMap=new Map(); (sent||[]).forEach(x=>conMap.set(x.addressee_id,{...x,direction:"sent"})); (received||[]).forEach(x=>conMap.set(x.requester_id,{...x,direction:"received"})); const postIds=(posts.data||[]).map(x=>x.id); let likes=[] , comments=[]; if(postIds.length){const lr=await sb.from("post_likes").select("post_id,user_id").in("post_id",postIds);likes=lr.data||[];const cr=await sb.from("comments").select("id,post_id,user_id,body,created_at").in("post_id",postIds).order("created_at",{ascending:true});comments=cr.data||[];} window.__bcProfile=profile.data||{};window.__bcLive={people:people.data||[],communities:communities.data||[],posts:posts.data||[],notifications:notifications.data||[],chats:[],connections:conMap,myCommunityIds,likes,comments,currentUserId:user.id};
  const pmap=new Map((people.data||[]).map(p=>[p.id,p])), cmap=new Map((communities.data||[]).map(c=>[c.id,c]));
  for(const m of (members.data||[])){
   const {data:others}=await sb.from("chat_members").select("user_id").eq("chat_id",m.chat_id).neq("user_id",user.id);
   const other=others?.[0]?.user_id;
   const {data:msgs}=await sb.from("messages").select("body,created_at,sender_id").eq("chat_id",m.chat_id).is("deleted_at",null).order("created_at",{ascending:false}).limit(1);
   const last=msgs?.[0];
   window.__bcLive.chats.push({id:m.chat_id,name:pmap.get(other)?.name||"Banjara Member",preview:last?.body||"No messages yet",unread:!!(last&&last.sender_id!==user.id&&new Date(last.created_at)>(m.last_read_at?new Date(m.last_read_at):new Date(0)))});
  }
  refreshUI();subscribeLive();
 }catch(e){console.warn("Banjara live data:",e);}
}
function refreshUI(){
 const d=window.__bcLive;if(!d)return;
 const chatList=document.querySelector("#bc-chats .bc-list");
 if(chatList)chatList.innerHTML=d.chats.length?d.chats.map(c=>'<div class="bc-row" data-chat-name="'+escLive(c.name)+'" data-chat-id="'+c.id+'"><div class="bc-avatar">'+initials(c.name)+'</div><div class="bc-row-main"><strong>'+escLive(c.name)+'</strong><small>'+escLive(c.preview)+'</small></div>'+(c.unread?'<span class="bc-badge">1</span>':'')+'</div>').join(""):'<div class="bc-empty"><i class="fas fa-comments"></i><strong>No conversations yet</strong><span>Start a chat from Connect.</span></div>';
 const connect=document.querySelector("#bc-connect .bc-grid");
 if(connect)connect.innerHTML=d.people.length?d.people.map(p=>'<div class="bc-card"><div class="bc-post-head"><div class="bc-avatar">'+initials(p.name)+'</div><div><h3>'+escLive(p.name||"Banjara Member")+'</h3><p>'+escLive([p.city,p.state].filter(Boolean).join(" • ")||"Banjara Connect member")+'</p></div></div><button class="bc-action primary" data-connect-user="'+p.id+'">'+(d.connections?.get(p.id)?.status==="accepted"?"Connected":d.connections?.get(p.id)?.status==="pending"&&d.connections?.get(p.id)?.direction==="received"?"Accept":d.connections?.get(p.id)?.status==="pending"?"Pending":"Connect")+'</button></div>').join(""):'<div class="bc-empty"><i class="fas fa-user-group"></i><strong>No other members yet</strong><span>New members will appear here automatically.</span></div>';
 const comm=document.querySelector("#bc-community .bc-grid");
 if(comm)comm.innerHTML=d.communities.length?d.communities.map(c=>'<div class="bc-card" data-community-id="'+c.id+'"><h3>'+escLive(c.name)+'</h3><p>'+escLive(c.description||"Community")+'</p></div>').join(""):'<div class="bc-empty"><i class="fas fa-users"></i><strong>No communities yet</strong><span>Create or join a community.</span></div>';
 const feed=document.querySelector("#bc-feed #bcFeedList");
 if(feed)feed.innerHTML=d.posts.length?d.posts.map(p=>{const a=d.people.find(x=>x.id===p.author_id);const c=d.communities.find(x=>x.id===p.community_id);return '<article class="bc-card bc-post"><div class="bc-post-head"><div class="bc-avatar">'+initials(a?.name||"Member")+'</div><div><h3>'+escLive(a?.name||"Banjara Member")+'</h3><p>'+escLive(c?.name||"Banjara Connect")+' • '+ago(p.created_at)+'</p></div></div><div class="bc-post-body">'+escLive(p.body)+'</div><div class="bc-post-actions"><button data-post-action="like">♡ Like</button><button data-post-action="comment">💬 Comment</button><button data-post-action="share">↗ Share</button><button data-post-action="save">🔖 Save</button></div></article>';}).join(""):'<div class="bc-empty"><i class="fas fa-newspaper"></i><strong>No posts yet</strong><span>Be the first to share something.</span></div>';
 const ns=document.querySelector("#bc-notifications .bc-list");
 if(ns)ns.innerHTML=d.notifications.length?d.notifications.map(n=>'<div class="bc-row" data-notification-id="'+n.id+'"><div class="bc-avatar">'+initials(n.title)+'</div><div class="bc-row-main"><strong>'+escLive(n.title)+'</strong><small>'+escLive(n.message)+' • '+ago(n.created_at)+'</small></div>'+(n.is_read?'':'<span class="bc-badge">•</span>')+'</div>').join(""):'<div class="bc-empty"><i class="fas fa-bell"></i><strong>All caught up</strong><span>You have no new notifications.</span></div>';
}
async function openChat(chatId,name){
 const existing=document.getElementById("bcChatOverlay"); if(existing)existing.remove();
 const box=document.createElement("section");box.id="bcChatOverlay";box.className="bc-chat-overlay";
 box.innerHTML='<div class="bc-chat-head"><button data-chat-close><i class="fas fa-arrow-left"></i></button><div class="bc-avatar">'+initials(name)+'</div><div><strong>'+escLive(name)+'</strong><small>Message</small></div></div><div class="bc-chat-messages" id="bcChatMessages"></div><form class="bc-chat-composer" id="bcChatForm"><input id="bcChatInput" autocomplete="off" placeholder="Write a message..."><button><i class="fas fa-paper-plane"></i></button></form>';
 document.body.appendChild(box);
 const sb=SB(), {data:{user}}=await sb.auth.getUser(); if(!user)return;
 let q=sb.from("messages").select("id,body,sender_id,created_at,message_type,attachment_url").eq("chat_id",chatId).is("deleted_at",null).order("created_at",{ascending:true}).limit(200);
 const {data,error}=await q;if(error){box.querySelector("#bcChatMessages").innerHTML='<div class="bc-empty"><strong>Could not load messages</strong><span>Please try again.</span></div>';return;}
 const render=rows=>{const el=box.querySelector("#bcChatMessages");el.innerHTML=(rows||[]).map(m=>'<div class="bc-msg '+(m.sender_id===user.id?'mine':'theirs')+'"><div>'+escLive(m.body)+'</div><small>'+ago(m.created_at)+'</small></div>').join("");el.scrollTop=el.scrollHeight;};
 render(data);
 box.querySelector("[data-chat-close]").onclick=()=>box.remove();
 box.querySelector("#bcChatForm").onsubmit=async ev=>{ev.preventDefault();const input=box.querySelector("#bcChatInput"),body=input.value.trim();if(!body)return;input.value="";const ins=await sb.from("messages").insert({chat_id:chatId,sender_id:user.id,body,message_type:"text"});if(ins.error){input.value=body;return;}const latest=await sb.from("messages").select("id,body,sender_id,created_at,message_type,attachment_url").eq("chat_id",chatId).is("deleted_at",null).order("created_at",{ascending:true}).limit(200);render(latest.data||[]);input.focus();};
 const channel=sb.channel("bc-chat-"+chatId).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"chat_id=eq."+chatId},payload=>{if(payload.new.sender_id!==user.id){const el=box.querySelector("#bcChatMessages");const m=payload.new;el.insertAdjacentHTML("beforeend",'<div class="bc-msg theirs"><div>'+escLive(m.body)+'</div><small>'+ago(m.created_at)+'</small></div>');el.scrollTop=el.scrollHeight;}}).subscribe();
 box.dataset.channel="bc-chat-"+chatId;
}
async function newChat(){
 const sb=SB();if(!sb)return;const {data:{user}}=await sb.auth.getUser();if(!user)return;
 const term=prompt("Search member by mobile number or name");if(!term?.trim())return;
 const digits=term.replace(/\D/g,""); let data=null,error=null;
 if(digits.length>=10){const r=await sb.functions.invoke("search-profile-by-phone",{body:{phone:term}});data=r.data?.profile?[r.data.profile]:[];error=r.error;}
 else{const r=await sb.from("profiles").select("id,name,city,state").neq("id",user.id).ilike("name","%"+term.trim()+"%").limit(10);data=r.data;error=r.error;}
 if(error||!data?.length){alert("Member not found.");return;}
 const p=data[0];
 const {data:mine}=await sb.from("chat_members").select("chat_id").eq("user_id",user.id);
 const mineIds=(mine||[]).map(x=>x.chat_id);
 let chat=null;
 if(mineIds.length){const {data:other}=await sb.from("chat_members").select("chat_id").eq("user_id",p.id).in("chat_id",mineIds).limit(1);if(other?.length)chat=other[0].chat_id;}
 if(!chat){const c=await sb.from("chats").insert({kind:"direct",created_by:user.id}).select("id").single();if(c.error){alert("Could not start chat.");return;}chat=c.data.id;const ins=await sb.from("chat_members").insert([{chat_id:chat,user_id:user.id},{chat_id:chat,user_id:p.id}]);if(ins.error){alert("Could not add member.");return;}}
 openChat(chat,p.name||"Banjara Member");
}
async function createPost(){const sb=SB();const {data:{user}}=await sb.auth.getUser();if(!user)return;const body=prompt("Write your post");if(!body?.trim())return;const r=await sb.from("posts").insert({author_id:user.id,body:body.trim(),visibility:"public"});if(r.error){alert("Could not publish post.");return;}await loadLive();}
async function postAction(action,id){const sb=SB();const {data:{user}}=await sb.auth.getUser();if(!user)return;if(action==="like"){const ex=await sb.from("post_likes").select("post_id").eq("post_id",id).eq("user_id",user.id).maybeSingle();if(ex.data)await sb.from("post_likes").delete().eq("post_id",id).eq("user_id",user.id);else await sb.from("post_likes").insert({post_id:id,user_id:user.id});await loadLive();return;}if(action==="comment"){const body=prompt("Comment");if(!body?.trim())return;await sb.from("comments").insert({post_id:id,user_id:user.id,body:body.trim()});await loadLive();return;}if(action==="delete"){if(confirm("Delete this post?")){await sb.from("posts").delete().eq("id",id).eq("author_id",user.id);await loadLive();}}if(action==="share"){await navigator.clipboard?.writeText(location.href);alert("Post link copied.");}}
async function connectAction(id){
 const sb=SB(); const {data:{user}}=await sb.auth.getUser(); if(!user||!id||user.id===id)return;
 const current=window.__bcLive?.connections?.get(id);
 if(current?.status==="pending"&&current.direction==="received"){await sb.from("connections").update({status:"accepted",updated_at:new Date().toISOString()}).eq("id",current.id);await loadLive();return;}
 if(current?.status==="accepted")return;
 if(current?.status==="pending")return;
 const r=await sb.from("connections").insert({requester_id:user.id,addressee_id:id,status:"pending"}); if(!r.error)await loadLive();
}
async function communityAction(id){
 const sb=SB();const {data:{user}}=await sb.auth.getUser();if(!user)return;
 if(window.__bcLive?.myCommunityIds?.has(id)){const r=await sb.from("community_members").delete().eq("community_id",id).eq("user_id",user.id);if(r.error){alert("Could not leave community.");return;}}
 else{const r=await sb.from("community_members").insert({community_id:id,user_id:user.id,role:"member"});if(r.error){alert("Could not join community.");return;}}
 await loadLive();
}
async function createCommunity(){
 const sb=SB();const {data:{user}}=await sb.auth.getUser();if(!user)return;
 const name=prompt("Community name");if(!name?.trim())return;const description=prompt("Short description")||"";
 const r=await sb.from("communities").insert({name:name.trim(),description:description.trim(),created_by:user.id,is_public:true}).select("id").single();
 if(r.error){alert("Could not create community.");return;}
 const m=await sb.from("community_members").insert({community_id:r.data.id,user_id:user.id,role:"admin"});if(m.error){alert("Community created, but owner membership could not be added.");}
 await loadLive();
}
function subscribeLive(){
 const sb=SB();if(!sb||window.__bcLiveChannel)return;
 window.__bcLiveChannel=sb.channel("banjara-live").on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"user_id=eq."+window.__bcLive.currentUserId},()=>loadLive()).on("postgres_changes",{event:"*",schema:"public",table:"connections"},()=>loadLive()).on("postgres_changes",{event:"*",schema:"public",table:"community_members"},()=>loadLive()).on("postgres_changes",{event:"*",schema:"public",table:"posts"},()=>loadLive()).on("postgres_changes",{event:"*",schema:"public",table:"post_likes"},()=>loadLive()).on("postgres_changes",{event:"*",schema:"public",table:"comments"},()=>loadLive()).subscribe();
}
window.bcReloadLive=loadLive;window.bcConnect=connectAction;window.bcCommunityAction=communityAction;window.bcCreateCommunity=createCommunity;window.bcCreatePost=createPost;window.bcPostAction=postAction;window.bcOpenChat=openChat;window.bcNewChat=newChat;


<style id="bc-live-chat-style">#bcChatOverlay{position:fixed;inset:0;z-index:190000;background:var(--bc-cream,#fbf4e8);display:flex;flex-direction:column}.bc-chat-head{height:64px;display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--bc-maroon,#7b1e2b);color:#fff}.bc-chat-head button{border:0;background:transparent;color:#fff;font-size:18px}.bc-chat-head small{display:block;opacity:.75}.bc-chat-messages{flex:1;overflow:auto;padding:18px 14px;display:flex;flex-direction:column;gap:8px}.bc-msg{max-width:78%;padding:9px 12px;border-radius:16px;font-size:14px;line-height:1.35}.bc-msg.mine{align-self:flex-end;background:var(--bc-orange,#d97706);color:#fff;border-bottom-right-radius:5px}.bc-msg.theirs{align-self:flex-start;background:#fff;color:#3b2930;border-bottom-left-radius:5px}.bc-msg small{display:block;font-size:10px;opacity:.6;margin-top:3px}.bc-chat-composer{display:flex;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid rgba(0,0,0,.08);padding-bottom:max(10px,env(safe-area-inset-bottom))}.bc-chat-composer input{flex:1;border:1px solid #ddd;border-radius:22px;padding:11px 14px;outline:0}.bc-chat-composer button{width:44px;border:0;border-radius:50%;background:var(--bc-maroon,#7b1e2b);color:#fff}@media(min-width:800px){#bcChatOverlay{left:50%;top:8%;right:8%;bottom:8%;border-radius:18px;overflow:hidden;box-shadow:0 20px 70px rgba(0,0,0,.25)}} </style>\ndocument.addEventListener("click",async e=>{
 const pa=e.target.closest("[data-post-action]");if(pa){postAction(pa.dataset.postAction,pa.dataset.postId);return;}const pc=e.target.closest("[data-feed-create]");if(pc){createPost();return;}const ca=e.target.closest("[data-community-action]");if(ca){communityAction(ca.dataset.communityAction);return;}const cc=e.target.closest("[data-community-create]");if(cc){createCommunity();return;}const conn=e.target.closest("[data-connect-user]");if(conn){connectAction(conn.dataset.connectUser);return;}const chat=e.target.closest("[data-chat-id]");if(chat){openChat(chat.dataset.chatId,chat.dataset.chatName||"Banjara Member");return;}const newChatBtn=e.target.closest("[data-new-chat]");if(newChatBtn){newChat();return;}const n=e.target.closest("[data-notification-id]"); if(n){await SB().from("notifications").update({is_read:true}).eq("id",n.dataset.notificationId);n.querySelector(".bc-badge")?.remove();return;}
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(loadLive,1200));else setTimeout(loadLive,1200);
})();
