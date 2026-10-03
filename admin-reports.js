/* StudentKart Admin — Reports & Moderation */
(function(){
    function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
    async function openReports(){
        if(!window.StudentKartAdminTool || !(await window.StudentKartAdminTool.checkAdmin())) return;
        let modal=document.getElementById("adminReportsModal");
        if(!modal){
            modal=document.createElement("div");
            modal.id="adminReportsModal";
            modal.className="modal sk-admin-tool-modal hidden";
            modal.innerHTML=`
              <div class="modal-overlay" data-close-admin-reports></div>
              <div class="modal-content">
                <div class="settings-page-header">
                  <div class="settings-title-wrap"><div class="settings-icon"><i class="fas fa-flag"></i></div><div><span class="section-label">STUDENTKART ADMIN</span><h2>Reports</h2><p>Review reported marketplace activity.</p></div></div>
                  <button type="button" class="modal-close" data-close-admin-reports>&times;</button>
                </div>
                <div class="sk-admin-listings-toolbar">
                  <select id="adminReportsStatus"><option value="">All statuses</option><option value="pending">Pending</option><option value="reviewed">Reviewed</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>
                  <button type="button" class="btn btn-outline" id="adminReportsRefresh"><i class="fas fa-rotate"></i> Refresh</button>
                </div>
                <div id="adminReportsCount" class="sk-admin-meta" style="margin-top:10px"></div>
                <div id="adminReportsList" class="sk-admin-list"><div class="sk-admin-empty">Loading...</div></div>
              </div>`;
            document.body.appendChild(modal);
            modal.querySelectorAll("[data-close-admin-reports]").forEach(x=>x.addEventListener("click",()=>modal.classList.add("hidden")));
            modal.querySelector("#adminReportsRefresh").addEventListener("click",load);
            modal.querySelector("#adminReportsStatus").addEventListener("change",render);
        }
        modal.classList.remove("hidden"); await load();
        async function load(){
            const list=modal.querySelector("#adminReportsList");
            list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-spinner fa-spin"></i> Loading reports...</div>';
            const {data,error}=await supabaseClient.from("reports").select("id,product_id,reporter_id,reason,details,status,created_at,reviewed_at,reviewed_by").order("created_at",{ascending:false}).limit(100);
            if(error){list.innerHTML=`<div class="sk-admin-empty">Reports database is not ready yet.<br><small>${esc(error.message)}</small></div>`; return;}
            modal._reports=data||[]; render();
        }
        function render(){
            const status=modal.querySelector("#adminReportsStatus").value;
            const rows=(modal._reports||[]).filter(r=>!status||r.status===status);
            modal.querySelector("#adminReportsCount").textContent=`${rows.length} report${rows.length===1?"":"s"} shown`;
            const list=modal.querySelector("#adminReportsList");
            if(!rows.length){list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-flag"></i><br>No reports found.</div>';return;}
            list.innerHTML=rows.map(r=>`
              <article class="sk-admin-card">
                <div class="sk-admin-card-head"><div><strong>${esc(r.reason)}</strong><div class="sk-admin-meta">Status: ${esc(r.status)} · ${esc(new Date(r.created_at).toLocaleString("en-IN"))}<br>Product ID: ${esc(r.product_id||"Deleted/unknown")}<br>Reporter ID: ${esc(r.reporter_id||"Unknown")}</div></div></div>
                ${r.details?`<div class="sk-admin-meta" style="margin-top:10px">${esc(r.details)}</div>`:""}
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
                  <button class="btn btn-outline" type="button" data-report-status="reviewed" data-report-id="${esc(r.id)}">Reviewed</button>
                  <button class="btn btn-primary" type="button" data-report-status="resolved" data-report-id="${esc(r.id)}">Resolve</button>
                  <button class="btn btn-outline" type="button" data-report-status="dismissed" data-report-id="${esc(r.id)}">Dismiss</button>
                </div>
              </article>`).join("");
            list.querySelectorAll("[data-report-status]").forEach(btn=>btn.addEventListener("click",()=>update(btn.dataset.reportId,btn.dataset.reportStatus)));
        }
        async function update(id,status){
            const {error}=await supabaseClient.from("reports").update({status,reviewed_at:new Date().toISOString(),reviewed_by:(window.currentUser?.id||null)}).eq("id",id);
            if(error){window.showToast?.("Could not update report","error");return;}
            window.showToast?.("Report updated","success"); await load();
        }
    }
    window.StudentKartAdminReports={openReports};
    document.addEventListener("click",e=>{if(e.target.closest("#adminReportsTool"))openReports();});
})();