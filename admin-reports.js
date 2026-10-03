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
                  <button type="button" class="btn btn-outline" id="adminModerationActivity"><i class="fas fa-clock-rotate-left"></i> Activity</button>
                  <button type="button" class="btn btn-outline" id="adminModerationAppeals"><i class="fas fa-scale-balanced"></i> Appeals</button>
                </div>
                <div id="adminReportsCount" class="sk-admin-meta" style="margin-top:10px"></div>
                <div id="adminReportsList" class="sk-admin-list"><div class="sk-admin-empty">Loading...</div></div>
              </div>`;
            document.body.appendChild(modal);
            modal.querySelectorAll("[data-close-admin-reports]").forEach(x=>x.addEventListener("click",()=>modal.classList.add("hidden")));
            modal.querySelector("#adminReportsRefresh").addEventListener("click",load);
            modal.querySelector("#adminReportsStatus").addEventListener("change",render);
            modal.querySelector("#adminModerationActivity").addEventListener("click",openActivity);
            modal.querySelector("#adminModerationAppeals").addEventListener("click",openAppeals);
        }
        modal.classList.remove("hidden"); await load();
        async function load(){
            const list=modal.querySelector("#adminReportsList");
            list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-spinner fa-spin"></i> Loading reports...</div>';
            const {data,error}=await supabaseClient.from("reports").select("id,product_id,reporter_id,reason,details,status,created_at,reviewed_at,reviewed_by").order("created_at",{ascending:false}).limit(100);
            if(error){list.innerHTML=`<div class="sk-admin-empty">Reports database is not ready yet.<br><small>${esc(error.message)}</small></div>`; return;}
            modal._reports=data||[];
            modal._products={};
            const productIds=[...new Set((modal._reports||[]).map(r=>r.product_id).filter(Boolean))];
            if(productIds.length){
                const pr=await supabaseClient.from("products").select("id,name,price,category,location,condition,seller,seller_email,moderation_status,moderation_reason").in("id",productIds);
                if(!pr.error)(pr.data||[]).forEach(p=>modal._products[p.id]=p);
            }
            render();
        }
        function render(){
            const status=modal.querySelector("#adminReportsStatus").value;
            const rows=(modal._reports||[]).filter(r=>!status||r.status===status);
            modal.querySelector("#adminReportsCount").textContent=`${rows.length} report${rows.length===1?"":"s"} shown`;
            const list=modal.querySelector("#adminReportsList");
            if(!rows.length){list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-flag"></i><br>No reports found.</div>';return;}
            list.innerHTML=rows.map(r=>`
              <article class="sk-admin-card">
                <div class="sk-admin-card-head"><div><strong>${esc(r.reason)}</strong><div class="sk-admin-meta">Status: ${esc(r.status)} · ${esc(new Date(r.created_at).toLocaleString("en-IN"))}<br>Listing: <strong>${esc(modal._products?.[r.product_id]?.name||"Deleted/unknown")}</strong>${modal._products?.[r.product_id]?.price!=null?` · ₹${esc(Number(modal._products[r.product_id].price).toLocaleString("en-IN"))}`:""}<br>Seller: ${esc(modal._products?.[r.product_id]?.seller||modal._products?.[r.product_id]?.seller_email||"Unknown")}<br>Product ID: ${esc(r.product_id||"Deleted/unknown")}<br>Moderation: <strong>${esc(modal._products?.[r.product_id]?.moderation_status||"active")}</strong><br>Reporter ID: ${esc(r.reporter_id||"Unknown")}</div></div></div>
                ${r.details?`<div class="sk-admin-meta" style="margin-top:10px">${esc(r.details)}</div>`:""}
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
                  ${r.product_id && modal._products?.[r.product_id] ? `<button class="btn btn-outline" type="button" data-view-report-product="${esc(r.product_id)}"><i class="fas fa-eye"></i> View Listing</button>` : ""}
                  ${modal._products?.[r.product_id] ? `<button class="btn btn-outline" type="button" data-moderate-product="${esc(r.product_id)}" data-moderation-status="${modal._products[r.product_id].moderation_status==="suspended"?"active":"suspended"}"><i class="fas fa-${modal._products[r.product_id].moderation_status==="suspended"?"rotate-left":"ban"}"></i> ${modal._products[r.product_id].moderation_status==="suspended"?"Restore Listing":"Suspend Listing"}</button>` : ""}
                  <button class="btn btn-outline" type="button" data-report-status="reviewed" data-report-id="${esc(r.id)}">Reviewed</button>
                  <button class="btn btn-primary" type="button" data-report-status="resolved" data-report-id="${esc(r.id)}">Resolve</button>
                  <button class="btn btn-outline" type="button" data-report-status="dismissed" data-report-id="${esc(r.id)}">Dismiss</button>
                </div>
              </article>`).join("");
            list.querySelectorAll("[data-report-status]").forEach(btn=>btn.addEventListener("click",()=>update(btn.dataset.reportId,btn.dataset.reportStatus)));
            list.querySelectorAll("[data-moderate-product]").forEach(btn=>btn.addEventListener("click",()=>moderateListing(btn.dataset.moderateProduct,btn.dataset.moderationStatus)));
            list.querySelectorAll("[data-view-report-product]").forEach(btn=>btn.addEventListener("click",async()=>{
                const productId=btn.dataset.viewReportProduct;
                if(typeof window.StudentKartOpenProductDetails!=="function"){window.showToast?.("Product details are unavailable","error");return;}
                modal.classList.add("hidden");
                await window.StudentKartOpenProductDetails(productId);
            }));
        }
        async function openActivity(){
            const list=modal.querySelector("#adminReportsList");
            list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-spinner fa-spin"></i> Loading activity...</div>';
            const {data,error}=await supabaseClient.from("moderation_activity").select("id,product_id,admin_id,action,reason,created_at").order("created_at",{ascending:false}).limit(100);
            if(error){list.innerHTML='<div class="sk-admin-empty">Activity log is not ready yet.<br><small>'+esc(error.message)+'</small></div>';return;}
            if(!data?.length){list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-clock"></i><br>No moderation activity yet.</div>';return;}
            list.innerHTML=data.map(a=>'<article class="sk-admin-card"><strong>'+esc(a.action==="suspend"?"Listing suspended":"Listing restored")+'</strong><div class="sk-admin-meta">'+esc(new Date(a.created_at).toLocaleString("en-IN"))+'<br>Product ID: '+esc(a.product_id||"Deleted/unknown")+'<br>Admin ID: '+esc(a.admin_id||"Unknown")+(a.reason?'<br>Reason: '+esc(a.reason):"")+'</div></article>').join("");
        }
        async function openAppeals(){
            const list=modal.querySelector("#adminReportsList");
            list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-spinner fa-spin"></i> Loading appeals...</div>';
            const {data,error}=await supabaseClient.from("moderation_appeals").select("id,product_id,seller_id,message,status,admin_note,created_at,reviewed_at").order("created_at",{ascending:false}).limit(100);
            if(error){list.innerHTML='<div class="sk-admin-empty">Appeals database is not ready yet.<br><small>'+esc(error.message)+'</small></div>';return;}
            const rows=data||[]; const ids=[...new Set(rows.map(a=>a.product_id).filter(Boolean))]; const products={};
            if(ids.length){const pr=await supabaseClient.from("products").select("id,name,price,moderation_status,moderation_reason,seller,seller_email").in("id",ids);if(!pr.error)(pr.data||[]).forEach(p=>products[p.id]=p);}
            if(!rows.length){list.innerHTML='<div class="sk-admin-empty"><i class="fas fa-scale-balanced"></i><br>No appeals yet.</div>';return;}
            list.innerHTML=rows.map(a=>{const p=products[a.product_id];return '<article class="sk-admin-card"><div class="sk-admin-card-head"><div><strong>'+esc(p?.name||"Deleted/unknown")+'</strong><div class="sk-admin-meta">Status: '+esc(a.status)+' · '+esc(new Date(a.created_at).toLocaleString("en-IN"))+'<br>Seller: '+esc(p?.seller||p?.seller_email||a.seller_id)+'<br>Product ID: '+esc(a.product_id||"Unknown")+'</div></div></div><div class="sk-admin-meta" style="margin-top:10px"><strong>Seller appeal:</strong><br>'+esc(a.message)+'</div>'+(p?.moderation_reason?'<div class="sk-admin-meta" style="margin-top:8px"><strong>Original moderation reason:</strong> '+esc(p.moderation_reason)+'</div>':"")+(a.admin_note?'<div class="sk-admin-meta" style="margin-top:8px"><strong>Admin note:</strong> '+esc(a.admin_note)+'</div>':"")+(a.status==="pending"?'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-primary" type="button" data-approve-appeal="'+esc(a.id)+'" data-appeal-product="'+esc(a.product_id)+'"><i class="fas fa-check"></i> Approve & Restore</button><button class="btn btn-outline" type="button" data-reject-appeal="'+esc(a.id)+'"><i class="fas fa-xmark"></i> Reject</button></div>':"")+'</article>'}).join("");
            list.querySelectorAll("[data-approve-appeal]").forEach(b=>b.addEventListener("click",()=>decideAppeal(b.dataset.approveAppeal,b.dataset.appealProduct,"approved",b.dataset.appealSeller)));
            list.querySelectorAll("[data-reject-appeal]").forEach(b=>b.addEventListener("click",()=>decideAppeal(b.dataset.rejectAppeal,null,"rejected",b.dataset.appealSeller)));
        }
        async function decideAppeal(appealId,productId,status,sellerId){
            const note=prompt(status==="approved"?"Optional note to the seller (leave blank if none):":"Reason for rejecting this appeal (optional):","");
            if(note===null)return;
            if(status==="approved"){
                if(!productId || !confirm("Approve this appeal and restore the listing?"))return;
                const {data,error}=await supabaseClient.rpc("admin_set_listing_moderation",{target_product_id:productId,new_status:"active",reason_text:null});
                if(error || data===false){window.showToast?.(error?.message||"Could not restore listing","error");return;}
            }
            const {data:userData}=await supabaseClient.auth.getUser();
            const {error}=await supabaseClient.from("moderation_appeals").update({status,admin_note:note||null,reviewed_at:new Date().toISOString(),reviewed_by:userData?.user?.id||null}).eq("id",appealId);
            if(error){window.showToast?.(error.message,"error");return;}
            if(status==="rejected" && sellerId){
                const notification=await supabaseClient.from("notifications").insert({user_id:sellerId,type:"listing_appeal_rejected",title:"Appeal rejected",message:"Your appeal for the listing was rejected."+ (note ? " Admin note: "+note : ""),is_read:false,created_at:new Date().toISOString()});
                if(notification.error) console.warn("Could not create appeal notification:",notification.error);
            }
            window.showToast?.(status==="approved"?"Appeal approved and listing restored":"Appeal rejected","success");
            await openAppeals();
        }
        async function moderateListing(productId,status){
            if(status==="suspended" && !confirm("Suspend this listing from the marketplace?")) return;
            const reason=status==="suspended" ? "Suspended during admin report moderation" : null;
            const {data,error}=await supabaseClient.rpc("admin_set_listing_moderation",{target_product_id:productId,new_status:status,reason_text:reason});
            if(error || data===false){window.showToast?.(error?.message||"Could not moderate listing","error");return;}
            window.showToast?.(status==="suspended"?"Listing suspended":"Listing restored","success"); await load();
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