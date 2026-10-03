(function(){
async function openUsers(){
if(!window.StudentKartAdminTool || !(await window.StudentKartAdminTool.checkAdmin())) return;
let m=document.getElementById("adminUsersModal");
if(!m){
m=document.createElement("div");m.id="adminUsersModal";m.className="modal sk-admin-tool-modal hidden";
m.innerHTML="<div class='modal-overlay' data-close-users></div><div class='modal-content'><h2>Users</h2><p>Registered StudentKart profiles.</p><input id='adminUsersSearch' placeholder='Search users...' style='width:100%;padding:12px;box-sizing:border-box'><div id='adminUsersList' style='margin-top:12px'>Loading...</div></div>";
document.body.appendChild(m);m.querySelector("[data-close-users]").onclick=()=>m.classList.add("hidden");
}
m.classList.remove("hidden");
const list=m.querySelector("#adminUsersList"),search=m.querySelector("#adminUsersSearch");
const r=await supabaseClient.from("profiles").select("id,name,email,username,phone,college,state,city,area").order("name",{ascending:true});
if(r.error){list.textContent="Could not load users. Run the Admin Users SQL policy.";return;}
const esc=v=>String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const render=()=>{const q=(search.value||"").toLowerCase();const rows=(r.data||[]).filter(u=>[u.name,u.email,u.username,u.phone,u.college,u.city,u.state].some(v=>String(v||"").toLowerCase().includes(q)));list.innerHTML=rows.length?rows.map(u=>"<div style='padding:12px;border:1px solid #ddd;border-radius:12px;margin-top:8px'><b>"+esc(u.name||"Unnamed")+"</b><br><small>"+esc(u.email||"No email")+" "+(u.username?"@"+esc(u.username):"")+"</small><br><small>Campus: "+esc(u.college||"Not added")+" · "+esc([u.city,u.state].filter(Boolean).join(", ")||"Not added")+"</small></div>").join(""):"No users found.";};
search.oninput=render;render();
}
window.StudentKartAdminUsers={openUsers};
document.addEventListener("click",e=>{if(e.target.closest("#adminUsersTool"))openUsers();});
})();