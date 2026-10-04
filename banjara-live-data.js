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
   const {data:msgs}=await sb.from("messages").select("body,created_at,sender_id,message_type").eq("chat_id",m.chat_id).is("deleted_at",null).order("created_at",{ascending:false}).limit(1);
   const last=msgs?.[0];
   const previewType=last?.message_type;
   const preview=previewType==="image"?"📷 Photo":previewType==="video"?"🎥 Video":previewType==="voice"?"🎙 Voice message":previewType==="file"?"📎 File":last?.body||"No messages yet";
   window.__bcLive.chats.push({id:m.chat_id,name:pmap.get(other)?.name||"Banjara Member",preview,previewType,previewSender:last?.sender_id,updatedAt:last?.created_at||null,unread:!!(last&&last.sender_id!==user.id&&new Date(last.created_at)>(m.last_read_at?new Date(m.last_read_at):new Date(0)))});

  }
  refreshUI();subscribeLive();
 }catch(e){console.warn("Banjara live data:",e);}
}
function refreshUI(){
 const d=window.__bcLive;if(!d)return;
 const chatList=document.querySelector("#bc-chats .bc-list");
 if(chatList)chatList.innerHTML=d.chats.length?d.chats.map(c=>'<div class="bc-row bc-chat-row" data-chat-name="'+escLive(c.name)+'" data-chat-id="'+c.id+'"><div class="bc-avatar">'+initials(c.name)+'</div><div class="bc-row-main"><strong>'+escLive(c.name)+'</strong><small class="'+(c.unread?"is-unread":"")+'">'+escLive(c.preview)+'</small></div><div class="bc-chat-row-meta">'+(c.updatedAt?'<time>'+ago(c.updatedAt)+'</time>':'')+(c.unread?'<span class="bc-badge">1</span>':'')+'</div></div>').join(""):'<div class="bc-empty"><i class="fas fa-comments"></i><strong>No conversations yet</strong><span>Start a chat from Connect.</span></div>';
 const connect=document.querySelector("#bc-connect .bc-grid");
 if(connect)connect.innerHTML=d.people.length?d.people.map(p=>'<div class="bc-card"><div class="bc-post-head"><div class="bc-avatar">'+initials(p.name)+'</div><div><h3>'+escLive(p.name||"Banjara Member")+'</h3><p>'+escLive([p.city,p.state].filter(Boolean).join(" • ")||"Banjara Connect member")+'</p></div></div><button class="bc-action primary" data-connect-user="'+p.id+'">'+(d.connections?.get(p.id)?.status==="accepted"?"Connected":d.connections?.get(p.id)?.status==="pending"&&d.connections?.get(p.id)?.direction==="received"?"Accept":d.connections?.get(p.id)?.status==="pending"?"Pending":"Connect")+'</button></div>').join(""):'<div class="bc-empty"><i class="fas fa-user-group"></i><strong>No other members yet</strong><span>New members will appear here automatically.</span></div>';
 const comm=document.querySelector("#bc-community .bc-grid");
 if(comm)comm.innerHTML=d.communities.length?d.communities.map(c=>'<div class="bc-card" data-community-id="'+c.id+'"><h3>'+escLive(c.name)+'</h3><p>'+escLive(c.description||"Community")+'</p><button class="bc-action primary" data-community-action="'+c.id+'">'+(d.myCommunityIds?.has(c.id)?"Leave":"Join")+'</button></div>').join(""):'<div class="bc-empty"><i class="fas fa-users"></i><strong>No communities yet</strong><span>Create or join a community.</span></div>';
 const feed=document.querySelector("#bc-feed #bcFeedList");
 if(feed)feed.innerHTML=d.posts.length?d.posts.map(p=>{const a=d.people.find(x=>x.id===p.author_id);const c=d.communities.find(x=>x.id===p.community_id);const liked=d.likes?.some(x=>x.post_id===p.id&&x.user_id===d.currentUserId);const cc=d.comments?.filter(x=>x.post_id===p.id)||[];return '<article class="bc-card bc-post" data-post-id="'+p.id+'"><div class="bc-post-head"><div class="bc-avatar">'+initials(a?.name||"Member")+'</div><div><h3>'+escLive(a?.name||"Banjara Member")+'</h3><p>'+escLive(c?.name||"Banjara Connect")+' • '+ago(p.created_at)+'</p></div></div><div class="bc-post-body">'+escLive(p.body)+'</div><div class="bc-post-actions"><button data-post-action="like" data-post-id="'+p.id+'">'+(liked?"♥":"♡")+' Like '+(d.likes?.filter(x=>x.post_id===p.id).length||0)+'</button><button data-post-action="comment" data-post-id="'+p.id+'">💬 Comment '+cc.length+'</button><button data-post-action="share" data-post-id="'+p.id+'">↗ Share</button>'+(p.author_id===d.currentUserId?'<button data-post-action="delete" data-post-id="'+p.id+'">🗑 Delete</button>':'')+'</div></article>';}).join(""):'<div class="bc-empty"><i class="fas fa-newspaper"></i><strong>No posts yet</strong><span>Be the first to share something.</span></div>';
 const prof=document.querySelector("#bc-profile");
 if(prof){const p=window.__bcProfile||{};const connCount=[...(d.connections?.values()||[])].filter(x=>x.status==="accepted").length;const commCount=d.myCommunityIds?.size||0;const postCount=d.posts?.filter(x=>x.author_id===d.currentUserId).length||0;prof.innerHTML='<div class="bc-profile-hero"><div class="bc-profile-avatar bc-avatar">'+initials(p.name||"Member")+'</div><div><h1>'+escLive(p.name||"Banjara Member")+'</h1><p>'+escLive(p.bio||"Building connections through community and culture.")+'</p><button class="bc-action primary" data-edit-profile style="width:auto;padding:0 14px">Edit Profile</button></div></div><div class="bc-stat-row"><div class="bc-stat"><strong>'+connCount+'</strong><span>Connections</span></div><div class="bc-stat"><strong>'+commCount+'</strong><span>Communities</span></div><div class="bc-stat"><strong>'+postCount+'</strong><span>Posts</span></div></div><div class="bc-section"><div class="bc-section-head"><h2>About</h2></div><div class="bc-card"><p>'+escLive(p.bio||"No bio added yet.")+'</p></div></div>';}
 const ns=document.querySelector("#bc-notifications .bc-list");
 if(ns)ns.innerHTML=d.notifications.length?d.notifications.map(n=>'<div class="bc-row" data-notification-id="'+n.id+'"><div class="bc-avatar">'+initials(n.title)+'</div><div class="bc-row-main"><strong>'+escLive(n.title)+'</strong><small>'+escLive(n.message)+' • '+ago(n.created_at)+'</small></div>'+(n.is_read?'':'<span class="bc-badge">•</span>')+'</div>').join(""):'<div class="bc-empty"><i class="fas fa-bell"></i><strong>All caught up</strong><span>You have no new notifications.</span></div>';
}
async function openChat(chatId,name){
 const existing=document.getElementById("bcChatOverlay");if(existing){const topic=existing.dataset.channel;const old=topic?SB().getChannels().find(x=>x.topic===topic):null;if(old)await SB().removeChannel(old);existing.remove();}
 const box=document.createElement("section");box.id="bcChatOverlay";box.className="bc-chat-overlay";
 box.innerHTML='<div class="bc-chat-head"><button data-chat-close><i class="fas fa-arrow-left"></i></button><div class="bc-avatar">'+initials(name)+'</div><div><strong>'+escLive(name)+'</strong><small id="bcChatPresence">Offline</small></div></div><div class="bc-chat-messages" id="bcChatMessages"></div><div id="bcReplyBar" class="bc-reply-bar" hidden><button type="button" data-reply-cancel><i class="fas fa-xmark"></i></button><div><small>Replying to</small><strong id="bcReplyText"></strong></div></div><form class="bc-chat-composer" id="bcChatForm"><button type="button" class="bc-chat-tool" id="bcAttachBtn" title="Photo, video or file"><i class="fas fa-paperclip"></i></button><input type="file" id="bcAttachInput" hidden accept="image/*,video/*,.pdf"><input id="bcChatInput" autocomplete="off" placeholder="Write a message..."><button type="button" class="bc-chat-tool" id="bcVoiceBtn" title="Voice message"><i class="fas fa-microphone"></i></button><button type="submit" class="bc-send-btn"><i class="fas fa-paper-plane"></i></button></form>';
 document.body.appendChild(box);
 const sb=SB(),{data:{user}}=await sb.auth.getUser();if(!user)return;
 const {data:blockRows}=await sb.from("user_blocks").select("blocker_id,blocked_id").or("blocker_id.eq."+user.id+",blocked_id.eq."+user.id);
 const blockedByMe=new Set((blockRows||[]).filter(x=>x.blocker_id===user.id).map(x=>x.blocked_id));
 const blockedMe=new Set((blockRows||[]).filter(x=>x.blocked_id===user.id).map(x=>x.blocker_id));
 const mediaUrl=async path=>{if(!path)return null;const r=await sb.storage.from("banjara-media").createSignedUrl(path,3600);return r.data?.signedUrl||null;};
 const renderMessage=async m=>{
   const mine=m.sender_id===user.id, type=m.message_type||"text", url=await mediaUrl(m.attachment_url);
   const receipt=mine?'<span class="bc-msg-receipt '+(m.read_at?"seen":"")+'">'+(m.read_at?"✓✓":m.delivered_at?"✓✓":"✓")+'</span>':"";
   let content=escLive(m.body||"");
   if(type==="image"&&url)content='<img class="bc-msg-image" src="'+url+'" alt="Image" loading="lazy">';
   else if(type==="video"&&url)content='<video class="bc-msg-video" controls playsinline preload="metadata" src="'+url+'"></video>';
   else if(type==="voice"&&url)content='<audio class="bc-msg-audio" controls preload="metadata" src="'+url+'"></audio>';
   else if(type==="file"&&url)content='<a class="bc-msg-file" href="'+url+'" target="_blank" rel="noopener"><i class="fas fa-file-lines"></i><span>'+escLive(m.body||"Attachment")+'</span></a>';
   const reply=m.reply_to_id?currentMessages.find(x=>x.id===m.reply_to_id):null;
   const quoted=reply?'<div class="bc-msg-quote">'+escLive(reply.body||("["+reply.message_type+"]"))+'</div>':"";
   const rs=reactions.get(m.id)||[], counts={};rs.forEach(r=>counts[r.reaction]=(counts[r.reaction]||0)+1);const reactionHtml=Object.entries(counts).map(([emoji,count])=>'<span class="bc-msg-reaction">'+emoji+(count>1?'<b>'+count+'</b>':'')+'</span>').join("");
 return '<button type="button" class="bc-msg '+(mine?"mine":"theirs")+'" data-message-id="'+m.id+'">'+quoted+content+'<small>'+ago(m.created_at)+receipt+'</small>'+(reactionHtml?'<div class="bc-msg-reactions">'+reactionHtml+'</div>':"")+'</button>';
 };
 let currentMessages=[];
 const reactionMap=()=>{const map=new Map();(reactionRows||[]).forEach(r=>{if(!map.has(r.message_id))map.set(r.message_id,[]);map.get(r.message_id).push(r);});return map;}; let reactions=reactionMap();
 const render=async rows=>{
   currentMessages=rows||[];
   const el=box.querySelector("#bcChatMessages");
   const html=await Promise.all(currentMessages.map(renderMessage));
   el.innerHTML=html.join("");el.scrollTop=el.scrollHeight;
 };
 const {data:hiddenRows}=await sb.from("message_hidden").select("message_id").eq("user_id",user.id);
 const {data:reactionRows}=await sb.from("message_reactions").select("message_id,user_id,reaction").in("message_id",(data||[]).map(x=>x.id));
 const hiddenIds=new Set((hiddenRows||[]).map(x=>x.message_id));
 const q=sb.from("messages").select("id,body,sender_id,created_at,message_type,attachment_url,reply_to_id,delivered_at,read_at").eq("chat_id",chatId).is("deleted_at",null).order("created_at",{ascending:true}).limit(200);
 const {data,error}=await q;if(error){box.querySelector("#bcChatMessages").innerHTML='<div class="bc-empty"><strong>Could not load messages</strong><span>Please try again.</span></div>';return;}
 await render((data||[]).filter(m=>!hiddenIds.has(m.id)));
 await sb.from("chat_members").update({last_read_at:new Date().toISOString()}).eq("chat_id",chatId).eq("user_id",user.id);
 const now=new Date().toISOString(); await sb.from("messages").update({delivered_at:now,read_at:now}).eq("chat_id",chatId).neq("sender_id",user.id).is("read_at",null);
 if(window.__bcLive?.chats){const current=window.__bcLive.chats.find(x=>x.id===chatId);if(current)current.unread=false;}
 const input=box.querySelector("#bcChatInput"),attachInput=box.querySelector("#bcAttachInput"),attachBtn=box.querySelector("#bcAttachBtn"),voiceBtn=box.querySelector("#bcVoiceBtn"); let pressTimer=null;
 const presenceEl=box.querySelector("#bcChatPresence"); let typingTimer=null;
 const {data:members}=await sb.from("chat_members").select("user_id").eq("chat_id",chatId);
 const memberIds=(members||[]).map(x=>x.user_id).filter(Boolean); const {data:presenceProfiles}=memberIds.length?await sb.from("profiles").select("id,last_seen_at").in("id",memberIds):{data:[]}; const lastSeenMap=new Map((presenceProfiles||[]).map(x=>[x.id,x.last_seen_at]));
 const otherChatUser=(members||[]).map(x=>x.user_id).find(id=>id!==user.id);
 if(otherChatUser&&(blockedByMe.has(otherChatUser)||blockedMe.has(otherChatUser))){alert("Chat is unavailable because one of you has blocked the other.");box.remove();return;}
 const otherId=(members||[]).map(x=>x.user_id).find(id=>id!==user.id);
 const formatLastSeen=ts=>{if(!ts)return"Offline";const diff=Date.now()-new Date(ts).getTime();if(diff<60000)return"Last seen just now";if(diff<3600000)return"Last seen "+Math.floor(diff/60000)+"m ago";if(diff<86400000)return"Last seen "+Math.floor(diff/3600000)+"h ago";return"Last seen "+new Date(ts).toLocaleDateString([], {day:"numeric",month:"short"});};
 const chatChannel=sb.channel("bc-chat-presence-"+chatId,{config:{presence:{key:user.id}}});
 chatChannel.on("presence",{event:"sync"},()=>{const state=chatChannel.presenceState();const online=otherId&&!!state[otherId];if(presenceEl)presenceEl.textContent=online?"Online":formatLastSeen(lastSeenMap.get(otherId));})
 .on("presence",{event:"join"},({key})=>{if(key===otherId&&presenceEl)presenceEl.textContent="Online";})
 .on("presence",{event:"leave"},({key})=>{if(key===otherId&&presenceEl)presenceEl.textContent=formatLastSeen(new Date().toISOString());})
 .on("broadcast",{event:"typing"},({payload})=>{if(payload?.user_id!==user.id){clearTimeout(typingTimer);if(payload?.typing){presenceEl.textContent="typing...";typingTimer=setTimeout(()=>{if(presenceEl)presenceEl.textContent=otherId&&chatChannel.presenceState()[otherId]?"Online":formatLastSeen(lastSeenMap.get(otherId));} ,1800);}else{presenceEl.textContent="Online";}}})
 .subscribe(async status=>{if(status==="SUBSCRIBED")await chatChannel.track({online_at:new Date().toISOString()});});
 let typingStopTimer=null;
 const emitTyping=()=>{chatChannel.send({type:"broadcast",event:"typing",payload:{user_id:user.id,typing:true}});clearTimeout(typingStopTimer);typingStopTimer=setTimeout(()=>chatChannel.send({type:"broadcast",event:"typing",payload:{user_id:user.id,typing:false}}),1200);};
 input?.addEventListener("input",emitTyping);
 const touchLastSeen=()=>void sb.from("profiles").update({last_seen_at:new Date().toISOString()}).eq("id",user.id);
 touchLastSeen(); const seenHeartbeat=setInterval(touchLastSeen,60000);
 box.querySelector("[data-chat-close]").onclick=async()=>{clearInterval(seenHeartbeat);clearTimeout(typingStopTimer);chatChannel.send({type:"broadcast",event:"typing",payload:{user_id:user.id,typing:false}});const topic=box.dataset.channel;const ch=topic?sb.getChannels().find(x=>x.topic===topic):null;if(ch)await sb.removeChannel(ch);try{await sb.removeChannel(chatChannel);}catch(e){}box.remove();};
 const replyBar=box.querySelector("#bcReplyBar"),replyText=box.querySelector("#bcReplyText"); let replyTo=null;
 const setReply=m=>{replyTo=m;replyText.textContent=(m.body||("["+m.message_type+"]")).slice(0,90);replyBar.hidden=false;input.focus();};
 box.querySelector("[data-reply-cancel]").onclick=()=>{replyTo=null;replyBar.hidden=true;};
 box.querySelector("#bcChatMessages").addEventListener("click",ev=>{const media=ev.target.closest(".bc-msg-image,.bc-msg-video");if(!media)return;ev.preventDefault();const viewer=document.createElement("div");viewer.className="bc-media-viewer";viewer.innerHTML='<button type="button" aria-label="Close"><i class="fas fa-xmark"></i></button>'+media.outerHTML;document.body.appendChild(viewer);const close=()=>viewer.remove();viewer.onclick=e=>{if(e.target===viewer||e.target.closest("button"))close();};});
 box.querySelector("#bcChatMessages").addEventListener("pointerdown",ev=>{const item=ev.target.closest("[data-message-id]");if(!item)return;clearTimeout(pressTimer);pressTimer=setTimeout(()=>item.click(),550);});
 box.querySelector("#bcChatMessages").addEventListener("pointerup",()=>clearTimeout(pressTimer));
 box.querySelector("#bcChatMessages").addEventListener("pointercancel",()=>clearTimeout(pressTimer));
 box.querySelector("#bcChatMessages").onclick=async ev=>{
   const item=ev.target.closest("[data-message-id]");if(!item)return;
   const m=currentMessages.find(x=>x.id===item.dataset.messageId);if(!m)return;
   const action=document.createElement("div");action.className="bc-msg-actions";
   const picker=document.createElement("div");picker.className="bc-reaction-picker";picker.innerHTML=['❤️','😂','👍','🔥'].map(x=>'<button type="button" data-reaction="'+x+'">'+x+'</button>').join("");document.body.appendChild(picker);const rr=item.getBoundingClientRect();picker.style.left=Math.max(10,Math.min(window.innerWidth-220,rr.left))+"px";picker.style.top=Math.max(10,rr.top-55)+"px";
   action.innerHTML='<button type="button" data-action="reply"><i class="fas fa-reply"></i> Reply</button><button type="button" data-action="hide"><i class="fas fa-eye-slash"></i> Delete for me</button>'+(m.sender_id===user.id?'<button type="button" data-action="delete"><i class="fas fa-trash"></i> Delete for everyone</button>':'<button type="button" data-action="block"><i class="fas fa-user-slash"></i> Block user</button>');
   document.body.appendChild(action);
   const rect=item.getBoundingClientRect();action.style.left=Math.max(10,Math.min(window.innerWidth-220,rect.left))+"px";action.style.top=Math.max(10,rect.top-8-action.offsetHeight)+"px";
   const close=()=>{action.remove();picker.remove();};picker.onclick=async a=>{const b=a.target.closest("[data-reaction]");if(!b)return;const reaction=b.dataset.reaction;const existing=(reactions.get(m.id)||[]).find(x=>x.user_id===user.id);let r;if(existing?.reaction===reaction)r=await sb.from("message_reactions").delete().eq("message_id",m.id).eq("user_id",user.id);else if(existing)r=await sb.from("message_reactions").update({reaction}).eq("message_id",m.id).eq("user_id",user.id);else r=await sb.from("message_reactions").insert({message_id:m.id,user_id:user.id,reaction});if(!r.error){const rr=await sb.from("message_reactions").select("message_id,user_id,reaction").eq("message_id",m.id);reactions.set(m.id,rr.data||[]);await render(currentMessages);}close();};action.onclick=async a=>{
     const b=a.target.closest("[data-action]");if(!b)return;const kind=b.dataset.action;close();
     if(kind==="reply"){setReply(m);return;}
     if(kind==="block"){const ok=confirm("Block this user? You will no longer be able to chat with them.");if(!ok)return;const r=await sb.from("user_blocks").insert({blocker_id:user.id,blocked_id:m.sender_id});if(!r.error){alert("User blocked.");box.remove();}return;}
     if(kind==="hide"){const r=await sb.from("message_hidden").insert({message_id:m.id,user_id:user.id});if(!r.error)await render(currentMessages.filter(x=>x.id!==m.id));return;}
     if(kind==="delete"){const r=await sb.from("messages").update({deleted_at:new Date().toISOString()}).eq("id",m.id).eq("sender_id",user.id);if(!r.error){if(m.attachment_url)await sb.storage.from("banjara-media").remove([m.attachment_url]);await render(currentMessages.filter(x=>x.id!==m.id));}}
   };
   setTimeout(()=>document.addEventListener("click",close,{once:true}),0);
 };
 const sendAttachment=async file=>{
   if(!file)return;if(file.size>25*1024*1024){alert("File is too large. Maximum 25 MB.");return;}
   const mime=file.type||"",type=mime.startsWith("image/")?"image":mime.startsWith("video/")?"video":mime==="application/pdf"?"file":null;
   if(!type){alert("Please choose an image, video or PDF.");return;}
   const ext=(file.name.split(".").pop()||"bin").toLowerCase(),path=user.id+"/"+chatId+"/"+crypto.randomUUID()+"."+ext;
   attachBtn.disabled=true;attachBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
   const up=await sb.storage.from("banjara-media").upload(path,file,{contentType:mime,upsert:false});
   if(up.error){alert("Could not upload attachment.");attachBtn.disabled=false;attachBtn.innerHTML='<i class="fas fa-paperclip"></i>';return;}
   const ins=await sb.from("messages").insert({chat_id:chatId,sender_id:user.id,body:type==="file"?file.name:"",message_type:type,attachment_url:path,reply_to_id:replyTo?.id||null}).select("id,body,sender_id,created_at,message_type,attachment_url,reply_to_id,delivered_at,read_at").single();
   if(ins.error){await sb.storage.from("banjara-media").remove([path]);alert("Could not send attachment.");}
   else await render([...currentMessages,ins.data]);
   attachBtn.disabled=false;attachBtn.innerHTML='<i class="fas fa-paperclip"></i>';attachInput.value="";input.focus();
 };
 attachBtn.onclick=()=>attachInput.click();attachInput.onchange=()=>sendAttachment(attachInput.files?.[0]);
 let recorder=null,chunks=[],recordStartedAt=0,recordTimer=null,cancelRecording=false;
 const updateRecordTimer=()=>{const s=Math.floor((Date.now()-recordStartedAt)/1000);voiceBtn.setAttribute("data-recording-time",String(s).padStart(2,"0")+"s");};
 voiceBtn.onclick=async()=>{

   if(recorder&&recorder.state==="recording"){cancelRecording=true;recorder.stop();return;}
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert("Voice recording is not supported in this browser.");return;}
   try{
     const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];cancelRecording=false;
     recorder=new MediaRecorder(stream);voiceBtn.classList.add("recording");voiceBtn.innerHTML='<i class="fas fa-stop"></i>';
     recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
     recorder.onstop=async()=>{
       stream.getTracks().forEach(t=>t.stop());clearInterval(recordTimer);voiceBtn.classList.remove("recording");voiceBtn.innerHTML='<i class="fas fa-microphone"></i>';voiceBtn.removeAttribute("data-recording-time");if(cancelRecording){chunks=[];return;}
       const blob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});if(blob.size>25*1024*1024)return;
       const ext=(blob.type.includes("ogg")?"ogg":blob.type.includes("mp4")?"m4a":"webm"),path=user.id+"/"+chatId+"/"+crypto.randomUUID()+"."+ext;
       const up=await sb.storage.from("banjara-media").upload(path,blob,{contentType:blob.type||"audio/webm",upsert:false});
       if(up.error){alert("Could not upload voice message.");return;}
       const ins=await sb.from("messages").insert({chat_id:chatId,sender_id:user.id,body:"",message_type:"voice",attachment_url:path,reply_to_id:replyTo?.id||null}).select("id,body,sender_id,created_at,message_type,attachment_url,reply_to_id,delivered_at,read_at").single();
       if(ins.error){await sb.storage.from("banjara-media").remove([path]);alert("Could not send voice message.");return;}
       await render([...currentMessages,ins.data]);replyTo=null;replyBar.hidden=true;
     };
     recordStartedAt=Date.now();updateRecordTimer();recordTimer=setInterval(updateRecordTimer,1000);recorder.start();
   }catch(e){alert("Microphone permission is required for voice messages.");}
 };
 document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&recorder&&recorder.state==="recording"){cancelRecording=true;recorder.stop();}});
 box.querySelector("#bcChatForm").onsubmit=async ev=>{ev.preventDefault();const body=input.value.trim();if(!body)return;input.value="";const ins=await sb.from("messages").insert({chat_id:chatId,sender_id:user.id,body,message_type:"text",reply_to_id:replyTo?.id||null}).select("id,body,sender_id,created_at,message_type,attachment_url,delivered_at,read_at").single();if(ins.error){input.value=body;return;}replyTo=null;replyBar.hidden=true;await render([...currentMessages,ins.data]);input.focus();};
 const channel=sb.channel("bc-chat-"+chatId)
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"chat_id=eq."+chatId},async payload=>{if(payload.new.sender_id!==user.id){currentMessages=[...currentMessages,payload.new];await sb.from("messages").update({delivered_at:new Date().toISOString(),read_at:new Date().toISOString()}).eq("id",payload.new.id);const html=await renderMessage(payload.new),el=box.querySelector("#bcChatMessages");el.insertAdjacentHTML("beforeend",html);el.scrollTop=el.scrollHeight;await sb.from("chat_members").update({last_read_at:new Date().toISOString()}).eq("chat_id",chatId).eq("user_id",user.id);}})
 .on("postgres_changes",{event:"*",schema:"public",table:"message_reactions"},async payload=>{const mid=payload.new?.message_id||payload.old?.message_id;if(!mid)return;const r=await sb.from("message_reactions").select("message_id,user_id,reaction").eq("message_id",mid);reactions.set(mid,r.data||[]);await render(currentMessages);})
 .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:"chat_id=eq."+chatId},async payload=>{if(payload.new.deleted_at){await render(currentMessages.filter(x=>x.id!==payload.new.id));return;}const i=currentMessages.findIndex(x=>x.id===payload.new.id);if(i>=0){currentMessages[i]=payload.new;await render(currentMessages);}});
 box.dataset.channel="bc-chat-"+chatId;
}
async function newChat(){
 const sb=SB();if(!sb)return;
 const {data:{user}}=await sb.auth.getUser();if(!user)return;
 const old=document.getElementById("bcUserSearchOverlay");if(old)old.remove();
 const box=document.createElement("section");box.id="bcUserSearchOverlay";box.className="bc-user-search-overlay";
 box.innerHTML='<div class="bc-user-search-card"><div class="bc-user-search-head"><button type="button" data-user-search-close><i class="fas fa-arrow-left"></i></button><div><strong>New conversation</strong><small>Find a Banjara Connect member</small></div></div><div class="bc-user-search-input"><i class="fas fa-magnifying-glass"></i><input id="bcMemberSearchInput" inputmode="numeric" autocomplete="off" placeholder="Enter mobile number"></div><div id="bcMemberSearchResults" class="bc-user-search-results"><div class="bc-user-search-empty"><i class="fas fa-user-plus"></i><strong>Search by mobile number</strong><span>Enter a 10-digit mobile number to find a member.</span></div></div></div>';
 document.body.appendChild(box);
 const input=box.querySelector("#bcMemberSearchInput"),results=box.querySelector("#bcMemberSearchResults");
 box.querySelector("[data-user-search-close]").onclick=()=>box.remove();
 let timer=null;
 const render=profile=>{
   if(!profile){results.innerHTML='<div class="bc-user-search-empty"><i class="fas fa-user-slash"></i><strong>Member not found</strong><span>No Banjara Connect account matches this mobile number.</span></div>';return;}
   const name=escLive(profile.name||"Banjara Member");
   results.innerHTML='<button type="button" class="bc-user-result" data-member-id="'+profile.id+'"><div class="bc-avatar">'+initials(profile.name||"Member")+'</div><div><strong>'+name+'</strong><small>'+escLive([profile.city,profile.state].filter(Boolean).join(" • ")||"Banjara Connect member")+'</small></div><i class="fas fa-chevron-right"></i></button>';
 };
 input.oninput=()=>{
   clearTimeout(timer);
   const digits=input.value.replace(/\D/g,"").slice(0,10);input.value=digits;
   if(digits.length<10){results.innerHTML='<div class="bc-user-search-empty"><i class="fas fa-mobile-screen-button"></i><strong>Enter 10 digits</strong><span>We only use the number to find the member.</span></div>';return;}
   results.innerHTML='<div class="bc-user-search-loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
   timer=setTimeout(async()=>{
     const r=await sb.functions.invoke("search-profile-by-phone",{body:{phone:digits}});
     if(r.error){render(null);return;} render(r.data?.profile||null);
   },250);
 };
 results.onclick=async e=>{
   const result=e.target.closest("[data-member-id]");if(!result)return;
   const p={id:result.dataset.memberId,name:result.querySelector("strong")?.textContent||"Banjara Member"};
   if(p.id===user.id){results.innerHTML='<div class="bc-user-search-empty"><i class="fas fa-user"></i><strong>This is your account</strong><span>Search another member to start a conversation.</span></div>';return;}
   const {data:mine}=await sb.from("chat_members").select("chat_id").eq("user_id",user.id);
   const mineIds=(mine||[]).map(x=>x.chat_id);let chat=null;
   if(mineIds.length){const {data:other}=await sb.from("chat_members").select("chat_id").eq("user_id",p.id).in("chat_id",mineIds).limit(1);if(other?.length)chat=other[0].chat_id;}
   if(!chat){const cr=await sb.from("chats").insert({kind:"direct",created_by:user.id}).select("id").single();if(cr.error){alert("Could not start chat.");return;}chat=cr.data.id;const ins=await sb.from("chat_members").insert([{chat_id:chat,user_id:user.id},{chat_id:chat,user_id:p.id}]);if(ins.error){alert("Could not add member.");return;}}
   box.remove();openChat(chat,p.name);
 };
 input.focus();
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


const liveStyle=document.createElement("style");liveStyle.id="bc-live-chat-style";liveStyle.textContent="#bcChatOverlay{position:fixed;inset:0;z-index:190000;background:var(--bc-cream,#fbf4e8);display:flex;flex-direction:column}.bc-chat-head{height:64px;display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--bc-maroon,#7b1e2b);color:#fff}.bc-chat-head button{border:0;background:transparent;color:#fff;font-size:18px}.bc-chat-head small{display:block;opacity:.75}.bc-chat-messages{flex:1;overflow:auto;padding:18px 14px;display:flex;flex-direction:column;gap:8px}.bc-msg{max-width:78%;padding:9px 12px;border-radius:16px;font-size:14px;line-height:1.35}.bc-msg.mine{align-self:flex-end;background:var(--bc-orange,#d97706);color:#fff;border-bottom-right-radius:5px}.bc-msg.theirs{align-self:flex-start;background:#fff;color:#3b2930;border-bottom-left-radius:5px}.bc-msg small{display:block;font-size:10px;opacity:.6;margin-top:3px}.bc-chat-composer{display:flex;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid rgba(0,0,0,.08);padding-bottom:max(10px,env(safe-area-inset-bottom))}.bc-chat-composer input{flex:1;border:1px solid #ddd;border-radius:22px;padding:11px 14px;outline:0}.bc-chat-composer button{width:44px;border:0;border-radius:50%;background:var(--bc-maroon,#7b1e2b);color:#fff}@media(min-width:800px){#bcChatOverlay{left:50%;top:8%;right:8%;bottom:8%;border-radius:18px;overflow:hidden;box-shadow:0 20px 70px rgba(0,0,0,.25)}} ";if(!document.getElementById("bc-live-chat-style"))document.head.appendChild(liveStyle);\ndocument.addEventListener("click",async e=>{
 const pa=e.target.closest("[data-post-action]");if(pa){postAction(pa.dataset.postAction,pa.dataset.postId);return;}const pc=e.target.closest("[data-feed-create]");if(pc){createPost();return;}const ca=e.target.closest("[data-community-action]");if(ca){communityAction(ca.dataset.communityAction);return;}const cc=e.target.closest("[data-community-create]");if(cc){createCommunity();return;}const conn=e.target.closest("[data-connect-user]");if(conn){connectAction(conn.dataset.connectUser);return;}const chat=e.target.closest("[data-chat-id]");if(chat){openChat(chat.dataset.chatId,chat.dataset.chatName||"Banjara Member");return;}const newChatBtn=e.target.closest("[data-new-chat]");if(newChatBtn){newChat();return;}const n=e.target.closest("[data-notification-id]"); if(n){await SB().from("notifications").update({is_read:true}).eq("id",n.dataset.notificationId);n.querySelector(".bc-badge")?.remove();return;}
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(loadLive,1200));else setTimeout(loadLive,1200);
})();
