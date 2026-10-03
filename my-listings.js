/* StudentKart Seller — My Listings + moderation */
(function(){
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const statusMeta={active:["Active","success"],suspended:["Suspended","danger"]};
const appealMeta={pending:["Appeal pending","warning"],reviewed:["Appeal under review","info"],approved:["Appeal approved","success"],rejected:["Appeal rejected","danger"]};

function styles(){
 if(document.getElementById("studentkartMyListingsStyles"))return;
 const s=document.createElement("style");s.id="studentkartMyListingsStyles";
 s.textContent=".sk-my-listing-card{position:relative;border:1px solid #dce7ed;border-radius:16px;background:#fff;overflow:hidden}.sk-my-listing-card img{width:100%;height:150px;object-fit:cover}.sk-my-listing-body{padding:13px}.sk-my-listing-name{font-weight:800;color:#102a43}.sk-my-listing-meta{font-size:11px;color:#718083;margin-top:5px;line-height:1.55}.sk-mod-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;margin-top:8px}.sk-mod-badge.success{background:#e7f7ef;color:#187548}.sk-mod-badge.danger{background:#ffe8e8;color:#b33a3a}.sk-mod-badge.warning{background:#fff5d9;color:#956800}.sk-mod-badge.info{background:#e8f2ff;color:#25649b}.sk-suspend-box{margin-top:10px;padding:11px;border-radius:12px;background:#fff5f5;border:1px solid #ffd9d9}.sk-suspend-title{font-size:11px;font-weight:800;color:#a82f2f}.sk-suspend-reason{font-size:11px;color:#5d6368;line-height:1.5;margin-top:4px}.sk-appeal-box{margin-top:10px;padding:10px;border-radius:12px;background:#f7faff;border:1px solid #dbe8f5}.sk-appeal-status{font-size:10px;font-weight:800}.sk-my-listing-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.sk-my-listings-empty{padding:28px;text-align:center;color:#718083}.sk-appeal-form textarea{width:100%;min-height:110px;resize:vertical;margin-top:8px}.sk-appeal-note{font-size:11px;color:#718083;margin-top:5px}";
 document.head.appendChild(s)
}
async function getUser(){return window.currentUser||(typeof currentUser!=="undefined"?currentUser:null)}
async function loadAppeals(user,ids){
 if(!ids.length)return{};
 const {data}=await supabaseClient.from("moderation_appeals").select("id,listing_id,status,reason,admin_note,created_at,updated_at").eq("user_id",user.id).in("listing_id",ids).order("created_at",{ascending:false});
 const out={};(data||[]).forEach(a=>{if(!out[a.listing_id])out[a.listing_id]=a});return out
}
async function open(){
 const user=await getUser();if(!user){window.showToast?.("Please login to manage your listings","warning");return}
 styles();
 const modal=document.getElementById("myListingsModal"),container=document.getElementById("myListingsContainer");
 if(!modal||!container){window.showToast?.("My Listings is unavailable","error");return}
 modal.classList.remove("hidden");container.innerHTML='<div class="sk-my-listings-empty"><i class="fas fa-spinner fa-spin"></i> Loading your listings...</div>';
 const {data,error}=await supabaseClient.from("products").select("id,name,category,price,location,condition,description,image,created_at,updated_at,status,moderation_reason,moderated_at").eq("user_id",user.id).order("created_at",{ascending:false});
 if(error){container.innerHTML='<div class="sk-my-listings-empty">Could not load your listings.<br><small>'+esc(error.message)+'</small></div>';return}
 const rows=data||[];if(!rows.length){container.innerHTML='<div class="sk-my-listings-empty"><i class="fas fa-box-open"></i><br><strong>No listings yet</strong><br><small>Your listings will appear here.</small></div>';return}
 const appeals=await loadAppeals(user,rows.map(x=>x.id));
 container.innerHTML=rows.map(p=>{
  const st=p.status||"active",sm=statusMeta[st]||statusMeta.active,a=appeals[p.id],am=a?appealMeta[a.status]:null;
  const appealHtml=st==="suspended"?(a?'<div class="sk-appeal-box"><div class="sk-appeal-status">'+esc(am?.[0]||a.status)+'</div><div class="sk-my-listing-meta">Submitted '+esc(new Date(a.created_at).toLocaleString("en-IN"))+(a.admin_note?'<br><strong>Admin note:</strong> '+esc(a.admin_note):"")+'</div></div>':'<div class="sk-my-listing-actions"><button type="button" class="btn btn-primary" data-appeal="'+esc(p.id)+'"><i class="fas fa-scale-balanced"></i> Appeal Decision</button></div>'):"";
  return '<article class="sk-my-listing-card">'+(p.image?'<img src="'+esc(p.image)+'" alt="'+esc(p.name)+'">':"")+'<div class="sk-my-listing-body"><div class="sk-my-listing-name">'+esc(p.name)+'</div><div class="sk-my-listing-meta">'+esc(p.category||"Other")+' · ₹'+esc(Number(p.price||0).toLocaleString("en-IN"))+'<br>'+esc(p.location||"Location not specified")+' · '+esc(p.condition||"Condition not specified")+'</div><span class="sk-mod-badge '+sm[1]+'"><i class="fas '+(st==="suspended"?"fa-ban":"fa-circle-check")+'"></i>'+sm[0]+'</span>'+(st==="suspended"?'<div class="sk-suspend-box"><div class="sk-suspend-title"><i class="fas fa-circle-exclamation"></i> Exact moderation reason</div><div class="sk-suspend-reason">'+esc(p.moderation_reason||"No reason was provided.")+'</div>'+appealHtml+'</div>':"")+'<div class="sk-my-listing-actions">'+(typeof window.StudentKartOpenProductDetails==="function"?'<button type="button" class="btn btn-outline" data-view="'+esc(p.id)+'"><i class="fas fa-eye"></i> View</button>':"")+'</div></div></article>'
 }).join("");
 container.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",async()=>{modal.classList.add("hidden");await window.StudentKartOpenProductDetails(b.dataset.view)}));
 container.querySelectorAll("[data-appeal]").forEach(b=>b.addEventListener("click",()=>openAppeal(b.dataset.appeal,rows.find(x=>String(x.id)===String(b.dataset.appeal)))));
}
async function openAppeal(productId,product){
 const existing=document.getElementById("listingAppealModal");if(existing)existing.remove();
 const m=document.createElement("div");m.id="listingAppealModal";m.className="modal";
 m.innerHTML='<div class="modal-overlay" data-close-appeal></div><div class="modal-content" style="max-width:560px"><div class="modal-header page-popup-header"><h2><i class="fas fa-scale-balanced"></i> Appeal Listing Suspension</h2><p>'+esc(product?.name||"Listing")+'</p></div><div class="sk-appeal-form"><div class="sk-suspend-box"><div class="sk-suspend-title">Moderation reason</div><div class="sk-suspend-reason">'+esc(product?.moderation_reason||"No reason provided.")+'</div></div><label style="display:block;margin-top:14px;font-weight:700;font-size:12px">Why should this decision be reviewed?</label><textarea id="listingAppealMessage" maxlength="1500" placeholder="Explain the issue, provide context, or tell the admin what you have changed."></textarea><div class="sk-appeal-note">Be specific. The admin will review your appeal before deciding whether to restore the listing.</div><div class="sk-my-listing-actions"><button type="button" class="btn btn-outline" data-close-appeal>Cancel</button><button type="button" class="btn btn-primary" id="submitListingAppeal"><i class="fas fa-paper-plane"></i> Submit Appeal</button></div></div></div>';
 document.body.appendChild(m);m.querySelectorAll("[data-close-appeal]").forEach(x=>x.addEventListener("click",()=>m.remove()));
 m.querySelector("#submitListingAppeal").addEventListener("click",async()=>{
  const user=await getUser(),msg=m.querySelector("#listingAppealMessage").value.trim(),btn=m.querySelector("#submitListingAppeal");
  if(!user){window.showToast?.("Please login again","warning");return}
  if(!msg){window.showToast?.("Please explain your appeal","warning");return}
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Sending...';
  const {data,error}=await supabaseClient.rpc("submit_listing_appeal",{p_listing_id:Number(productId),p_reason:msg});
  if(error){btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> Submit Appeal';window.showToast?.(error.message,"error");return}
  m.remove();window.showToast?.("Appeal submitted to admin","success");await open();
 });
}
function bind(){styles();const b=document.getElementById("myListingsButton");if(!b||b.dataset.skModerationBound)return;b.dataset.skModerationBound="1";b.addEventListener("click",open)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();setInterval(bind,1200);
window.StudentKartMyListings={open};
})();