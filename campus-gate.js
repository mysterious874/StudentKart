/* =========================================================
   STUDENTKART — CAMPUS VERIFICATION GATE
   Student ID upload + Supabase verification request
   ========================================================= */
(function () {
    const esc = (value) => typeof escapeHTML === "function"
        ? escapeHTML(value)
        : String(value ?? "").replace(/[&<>"']/g, c => ({
            "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
        }[c]));

    function getCampusFromProfile() {
        const profile = typeof getSavedProfile === "function" ? getSavedProfile() : null;
        return String(profile?.college || "").trim();
    }

    function statusText(status) {
        return ({pending:"Verification pending",approved:"Campus verified",rejected:"Verification rejected"})[status] || "Not submitted";
    }

    function statusClass(status) {
        return status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
    }

    async function getLatestVerification() {
        if (typeof currentUser === "undefined" || !currentUser || typeof supabaseClient === "undefined") return null;
        const { data, error } = await supabaseClient.from("campus_verifications")
            .select("id,campus,student_name,student_id,status,rejection_reason,created_at,updated_at")
            .eq("user_id", currentUser.id).order("created_at", { ascending:false }).limit(1).maybeSingle();
        if (error) { console.warn("Campus verification read:", error); return null; }
        return data || null;
    }

    function addStyles() {
        if (document.getElementById("studentkartCampusVerificationStyles")) return;
        const style = document.createElement("style");
        style.id = "studentkartCampusVerificationStyles";
        style.textContent = `
            .campus-verification-card{padding:20px;border:1px solid rgba(39,170,166,.18);border-radius:18px;background:#f7fffe}
            .campus-verification-card h3{margin:0 0 8px;display:flex;gap:9px;align-items:center}
            .campus-verification-card h3 i{color:#27aaa6}
            .campus-verification-campus{font-size:15px;line-height:1.5;color:#465f5f}
            .campus-gate-note{margin:14px 0;padding:12px;border-radius:12px;background:#eef8f7;color:#456363;font-size:13px;line-height:1.45}
            .campus-verification-status{display:flex;align-items:center;gap:8px;margin:14px 0;padding:11px 13px;border-radius:12px;font-size:13px;font-weight:700}
            .campus-verification-status.pending{background:#fff7e8;color:#9a6700}
            .campus-verification-status.approved{background:#eaf9f0;color:#187a43}
            .campus-verification-status.rejected{background:#fff0f0;color:#b42318}
            .campus-verification-form{display:grid;gap:12px;margin-top:14px}
            .campus-verification-form label{display:grid;gap:6px;font-size:13px;font-weight:700;color:#405858}
            .campus-verification-form input{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid #d8e5e4;border-radius:12px;background:#fff}
            .campus-id-help{font-size:12px;color:#718181;font-weight:400;line-height:1.4}
            .campus-id-preview{max-height:130px;width:100%;object-fit:contain;border-radius:12px;border:1px solid #dce8e7;background:#fff;display:none}
            .campus-gate-actions{display:grid;gap:9px;margin-top:14px}
        `;
        document.head.appendChild(style);
    }

    async function renderGate() {
        const list = document.getElementById("campusPickerList");
        if (!list) return;
        addStyles();

        if (typeof currentUser === "undefined" || !currentUser) {
            list.innerHTML = `<div class="campus-verification-card">
                <h3><i class="fas fa-lock"></i> Login Required</h3>
                <p class="campus-verification-campus">Please login before accessing campus verification.</p>
                <button type="button" class="btn btn-primary btn-full" id="campusGateLogin"><i class="fas fa-right-to-bracket"></i> Login</button>
            </div>`;
            document.getElementById("campusGateLogin")?.addEventListener("click", () => {
                closeModal("campusModal", {instant:true}); openModal("loginModal");
            });
            return;
        }

        const campus = getCampusFromProfile();
        if (!campus) {
            list.innerHTML = `<div class="campus-verification-card">
                <h3><i class="fas fa-building-columns"></i> Your Campus</h3>
                <p class="campus-verification-campus"><strong>Campus not added</strong><br><small>Add your college/university in your profile first.</small></p>
                <button type="button" class="btn btn-outline btn-full" id="campusEditProfile"><i class="fas fa-pen"></i> Edit Profile</button>
            </div>`;
            document.getElementById("campusEditProfile")?.addEventListener("click", () => {
                closeModal("campusModal", {instant:true}); if (typeof openEditProfile === "function") openEditProfile();
            });
            return;
        }

        list.innerHTML = `<div class="campus-verification-card">
            <h3><i class="fas fa-building-columns"></i> Your Campus</h3>
            <p class="campus-verification-campus"><strong>${esc(campus)}</strong><br><small>This campus is linked to your StudentKart profile.</small></p>
            <div id="campusVerificationBody"><div class="campus-gate-note"><i class="fas fa-spinner fa-spin"></i> Checking verification status...</div></div>
        </div>`;

        const verification = await getLatestVerification();
        const body = document.getElementById("campusVerificationBody");
        if (!body) return;

        if (verification) {
            const status = verification.status || "pending";
            const reason = verification.rejection_reason ? `<small style="display:block;margin-top:5px;font-weight:400">Reason: ${esc(verification.rejection_reason)}</small>` : "";
            body.innerHTML = `
                <div class="campus-verification-status ${statusClass(status)}">
                    <i class="fas ${status==="approved"?"fa-circle-check":status==="rejected"?"fa-circle-xmark":"fa-clock"}"></i>
                    <span>${esc(statusText(status))}${reason}</span>
                </div>
                ${status==="approved"
                    ? `<div class="campus-gate-note"><i class="fas fa-shield-halved"></i> Your campus identity has been verified.</div>`
                    : `<div class="campus-gate-note"><i class="fas fa-id-card"></i> Upload a clear current student ID. It will be reviewed before campus-community access is enabled.</div>
                       <button type="button" class="btn ${status==="rejected"?"btn-primary":"btn-outline"} btn-full" id="campusVerificationRetry">
                       <i class="fas fa-${status==="rejected"?"rotate-right":"id-card"}"></i> ${status==="rejected"?"Submit Again":"View Submission"}</button>`}`;
            if (status !== "approved") document.getElementById("campusVerificationRetry")?.addEventListener("click", () => renderVerificationForm(campus, verification));
            return;
        }
        renderVerificationForm(campus, null);
    }

    function renderVerificationForm(campus, existing) {
        const body = document.getElementById("campusVerificationBody");
        if (!body) return;
        body.innerHTML = `
            <div class="campus-gate-note"><i class="fas fa-shield-halved"></i> Use the ID only for campus verification. Do not upload passwords, bank cards, Aadhaar, PAN, or unrelated documents.</div>
            <form class="campus-verification-form" id="campusVerificationForm">
                <label>Student name<input id="campusVerificationName" type="text" maxlength="100" placeholder="Name as on student ID" value="${esc(existing?.student_name||"")}" required></label>
                <label>Student ID / Enrollment number<input id="campusVerificationStudentId" type="text" maxlength="80" placeholder="Student ID number" value="${esc(existing?.student_id||"")}" required></label>
                <label>Student ID image<input id="campusVerificationFile" type="file" accept="image/jpeg,image/png,image/webp" required>
                    <span class="campus-id-help">JPG, PNG or WebP · maximum 5 MB · name, college and ID should be readable.</span>
                </label>
                <img id="campusIdPreview" class="campus-id-preview" alt="Student ID preview">
                <div class="campus-gate-actions">
                    <button type="submit" class="btn btn-primary btn-full" id="campusVerificationSubmit"><i class="fas fa-paper-plane"></i> Submit for Verification</button>
                    <button type="button" class="btn btn-outline btn-full" id="campusVerificationBack">Back</button>
                </div>
            </form>`;

        const fileInput=document.getElementById("campusVerificationFile");
        const preview=document.getElementById("campusIdPreview");
        fileInput?.addEventListener("change",()=>{
            const file=fileInput.files?.[0];
            if(!file){preview.style.display="none";preview.removeAttribute("src");return;}
            if(!file.type.startsWith("image/")||file.size>5*1024*1024){
                fileInput.value="";preview.style.display="none";
                if(typeof showToast==="function")showToast("Choose an image up to 5 MB.","warning");return;
            }
            preview.src=URL.createObjectURL(file);preview.style.display="block";
        });
        document.getElementById("campusVerificationBack")?.addEventListener("click",renderGate);
        document.getElementById("campusVerificationForm")?.addEventListener("submit",e=>submitVerification(e,campus));
    }

    async function submitVerification(event,campus) {
        event.preventDefault();
        if(!currentUser||typeof supabaseClient==="undefined")return;
        const submit=document.getElementById("campusVerificationSubmit");
        const file=document.getElementById("campusVerificationFile")?.files?.[0];
        const studentName=document.getElementById("campusVerificationName")?.value?.trim();
        const studentId=document.getElementById("campusVerificationStudentId")?.value?.trim();

        if(!studentName||!studentId||!file){if(typeof showToast==="function")showToast("Please complete all verification fields.","warning");return;}
        if(!file.type.startsWith("image/")||file.size>5*1024*1024){if(typeof showToast==="function")showToast("Student ID must be an image up to 5 MB.","warning");return;}

        submit.disabled=true;submit.innerHTML='<i class="fas fa-spinner fa-spin"></i> Submitting...';
        try{
            const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
            const path=`${currentUser.id}/${crypto.randomUUID()}.${ext}`;
            const upload=await supabaseClient.storage.from("student-ids").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
            if(upload.error)throw upload.error;
            const insert=await supabaseClient.from("campus_verifications").insert({
                user_id:currentUser.id,campus,student_name:studentName,student_id:studentId,id_image_path:path,status:"pending"
            });
            if(insert.error)throw insert.error;
            if(typeof showToast==="function")showToast("Student ID submitted for verification.","success");
            await renderGate();
        }catch(error){
            console.error("Campus verification submit error:",error);
            if(typeof showToast==="function")showToast(error?.message||"Could not submit verification.","error");
            submit.disabled=false;submit.innerHTML='<i class="fas fa-paper-plane"></i> Submit for Verification';
        }
    }

    function bind(){
        const button=document.getElementById("bottomCampusButton");
        if(!button||button.dataset.campusGate)return;
        button.dataset.campusGate="1";
        button.addEventListener("click",event=>{
            event.preventDefault();event.stopImmediatePropagation();renderGate();
            if(typeof openModal==="function")openModal("campusModal");
        },true);
    }
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();