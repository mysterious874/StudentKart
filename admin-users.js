/* StudentKart Admin — Users */
(function(){
    const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
    async function openUsers(){
        if(!window.StudentKartAdminTool || !(await window.StudentKartAdminTool.checkAdmin())) return;
        let m=document.getElementById("adminUsersModal");
        if(!m){
            m=document.createElement("div"); m.id="adminUsersModal"; m.className="modal sk-admin-tool-modal hidden";
            m.innerHTML=`
              <div class="modal-overlay" data-close-users></div>
              <div class="modal-content">
                <div class="settings-page-header">
                  <div class="settings-title-wrap"><div class="settings-icon"><i class="fas fa-users"></i></div><div><span class="section-label">STUDENTKART ADMIN</span><h2>Users</h2><p>Registered StudentKart profiles.</p></div></div>
                  <button type="button" class="modal-close" data-close-users>&times;</button>
                </div>
                <div id="adminUsersStats" class="sk-admin-user-stats"></div>
                <div class="sk-admin-listings-toolbar">
                  <input id="adminUsersSearch" placeholder="Search name, email, username, phone or campus..." autocomplete="off">
                  <button type="button" class="btn btn-outline" id="adminUsersRefresh"><i class="fas fa-rotate"></i> Refresh</button>
                </div>
                <div id="adminUsersList" class="sk-admin-list"><div class="sk-admin-empty">Loading...</div></div>
              </div>`;
            document.body.appendChild(m);
            m.querySelectorAll("[data-close-users]").forEach(x=>x.addEventListener("click",()=>m.classList.add("hidden")));
            m.querySelector("#adminUsersRefresh").addEventListener("click",load);
            m.querySelector("#adminUsersSearch").addEventListener("input",render);
        }
        m.classList.remove("hidden"); await load();
        async function load(){
            const list=m.querySelector("#adminUsersList");
            list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-spinner fa-spin"></i> Loading users...</div>';
            const r=await supabaseClient.rpc("get_admin_users");
            if(r.error){list.innerHTML=`<div class="sk-admin-empty">Could not load users.<br><small>${esc(r.error.message)}</small></div>`;return;}
            m._users=r.data||[];
            const verified=m._users.filter(u=>String(u.verification_status||"").toLowerCase()==="verified").length;
            m.querySelector("#adminUsersStats").innerHTML=`
              <div><strong>${m._users.length}</strong><span>Total Users</span></div>
              <div><strong>${verified}</strong><span>Verified</span></div>
              <div><strong>${m._users.length-verified}</strong><span>Other Status</span></div>`;
            render();
        }
        function render(){
            const q=(m.querySelector("#adminUsersSearch").value||"").toLowerCase().trim();
            const rows=(m._users||[]).filter(u=>[u.name,u.email,u.username,u.phone,u.college,u.city,u.state,u.area,u.verification_status].some(v=>String(v||"").toLowerCase().includes(q)));
            const list=m.querySelector("#adminUsersList");
            if(!rows.length){list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-user-slash"></i><br>No users found.</div>';return;}
            list.innerHTML=rows.map(u=>{
                const location=[u.area,u.city,u.state].filter(Boolean).join(", ")||"Not added";
                const status=u.verification_status||"Not verified";
                return `<article class="sk-admin-card">
                  <div class="sk-admin-card-head"><div><strong>${esc(u.name||"Unnamed")}</strong><div class="sk-admin-meta">${esc(u.email||"No email")}${u.username?" · @"+esc(u.username):""}<br>Campus: ${esc(u.college||"Not added")}<br>Location: ${esc(location)}${u.phone?"<br>Phone: "+esc(u.phone):""}<br>Status: ${esc(status)}</div></div></div>
                </article>`;
            }).join("");
        }
    }
    window.StudentKartAdminUsers={openUsers};
    document.addEventListener("click",e=>{if(e.target.closest("#adminUsersTool"))openUsers();});
})();