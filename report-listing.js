/* StudentKart — User Listing Reports */
(function(){
    const reasons = [
        ["scam","Scam or suspicious listing"],
        ["prohibited","Prohibited or unsafe item"],
        ["misleading","Misleading information"],
        ["duplicate","Duplicate listing"],
        ["harassment","Harassment or inappropriate content"],
        ["other","Other"]
    ];

    function esc(v){
        return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
    }

    function ensureModal(){
        let modal=document.getElementById("reportListingModal");
        if(modal) return modal;

        modal=document.createElement("div");
        modal.id="reportListingModal";
        modal.className="modal hidden";
        modal.innerHTML=`
            <div class="modal-overlay" data-close-report></div>
            <div class="modal-content" style="max-width:520px">
                <div class="modal-header page-popup-header">
                    <h2><i class="fas fa-flag"></i> Report Listing</h2>
                    <p>Help keep StudentKart safe by telling us what is wrong with this listing.</p>
                </div>
                <form id="reportListingForm">
                    <div class="form-group">
                        <label for="reportReason">Reason</label>
                        <select id="reportReason" required>
                            <option value="">Select a reason</option>
                            ${reasons.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reportDetails">Additional details <small>(optional)</small></label>
                        <textarea id="reportDetails" maxlength="1000" placeholder="Tell us what you noticed..."></textarea>
                    </div>
                    <div id="reportListingInfo" style="padding:11px 12px;border:1px solid #dce7ed;border-radius:12px;background:#f8fbff;color:#52636b;font-size:12px;margin-bottom:14px"></div>
                    <button type="submit" class="btn btn-primary btn-full" id="submitListingReport"><i class="fas fa-paper-plane"></i> Submit Report</button>
                </form>
            </div>`;
        document.body.appendChild(modal);

        const close=()=>modal.classList.add("hidden");
        modal.querySelectorAll("[data-close-report]").forEach(el=>el.addEventListener("click",close));
        modal.querySelector("#reportListingForm").addEventListener("submit",submit);
        return modal;
    }

    async function openReport(){
        const product=window.currentProduct || (typeof currentProduct!=="undefined" ? currentProduct : null);
        if(!product?.id){
            window.showToast?.("Open a listing first","error");
            return;
        }

        const user=window.currentUser || (typeof currentUser!=="undefined" ? currentUser : null);
        if(!user){
            window.showToast?.("Please sign in to report a listing","error");
            document.getElementById("productModal")?.classList.add("hidden");
            document.getElementById("loginModal")?.classList.remove("hidden");
            return;
        }

        if(String(product.userId||product.user_id||"")===String(user.id)){
            window.showToast?.("You cannot report your own listing","error");
            return;
        }

        const modal=ensureModal();
        modal._product=product;
        modal.querySelector("#reportListingInfo").innerHTML=`<strong>${esc(product.name)}</strong><br><span>Listed by ${esc(product.seller||"Student")} · ${esc(product.location||"Community")}</span>`;
        modal.querySelector("#reportListingForm").reset();
        modal.classList.remove("hidden");
    }

    async function submit(event){
        event.preventDefault();
        const modal=document.getElementById("reportListingModal");
        const product=modal?._product;
        const user=window.currentUser || (typeof currentUser!=="undefined" ? currentUser : null);
        if(!modal || !product?.id || !user?.id) return;

        const button=modal.querySelector("#submitListingReport");
        button.disabled=true;
        button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Sending...';

        const reason=modal.querySelector("#reportReason").value;
        const details=modal.querySelector("#reportDetails").value.trim();

        const {error}=await supabaseClient.from("reports").insert({
            product_id:product.id,
            reporter_id:user.id,
            reason,
            details:details||null
        });

        button.disabled=false;
        button.innerHTML='<i class="fas fa-paper-plane"></i> Submit Report';

        if(error){
            console.error("Report listing error:",error);
            if(error.code==="23505"){
                window.showToast?.("You have already reported this listing","error");
            }else{
                window.showToast?.("Could not submit report. Please try again.","error");
            }
            return;
        }

        modal.classList.add("hidden");
        window.showToast?.("Report submitted. Thank you.","success");
    }

    function bind(){
        document.addEventListener("click",event=>{
            if(event.target.closest("#reportProductButton")) openReport();
        });
    }

    window.StudentKartReportListing={openReport};
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bind,{once:true});
    else bind();
})();