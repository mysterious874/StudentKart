/* =========================================================
   STUDENTKART — ADMIN CAMPUS VERIFICATION PANEL
   Secure admin-only review UI
   ========================================================= */
(function () {
    const esc = (value) => typeof escapeHTML === "function"
        ? escapeHTML(value)
        : String(value ?? "").replace(/[&<>"']/g, c => ({
            "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
        }[c]));

    let adminReady = false;

    function addStyles() {
        if (document.getElementById("studentkartAdminVerificationStyles")) return;
        const style = document.createElement("style");
        style.id = "studentkartAdminVerificationStyles";
        style.textContent = `
            .sk-admin-gate{margin-top:14px;padding:14px;border:1px solid #dce7ed;border-radius:15px;background:#fff}
            .sk-admin-gate h4{margin:0 0 5px;color:#102a43;font-size:14px}
            .sk-admin-gate p{margin:0;color:#718083;font-size:12px;line-height:1.45}
            .sk-admin-list{display:grid;gap:12px;margin-top:14px}
            .sk-admin-card{border:1px solid #dce7ed;border-radius:16px;padding:14px;background:#fff}
            .sk-admin-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
            .sk-admin-card strong{color:#102a43;font-size:14px}
            .sk-admin-meta{margin-top:5px;color:#64748b;font-size:11px;line-height:1.5}
            .sk-admin-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase}
            .sk-admin-status.pending{background:#fff7e8;color:#9a6700}
            .sk-admin-status.approved{background:#eaf9f0;color:#187a43}
            .sk-admin-status.rejected{background:#fff0f0;color:#b42318}
            .sk-admin-id-preview{width:100%;max-height:240px;object-fit:contain;margin-top:11px;border-radius:12px;background:#f7f9fa;border:1px solid #e5eaed}
            .sk-admin-actions{display:flex;gap:8px;margin-top:11px}
            .sk-admin-actions button{flex:1}
            .sk-admin-reject{margin-top:9px;display:none}
            .sk-admin-reject input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d8e5e4;border-radius:10px}
            .sk-admin-empty{text-align:center;padding:24px 12px;color:#718083;font-size:13px}
            .sk-admin-tabs{display:flex;gap:7px;margin-top:12px}
            .sk-admin-tab{border:1px solid #dce7ed;background:#fff;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:700;cursor:pointer}
            .sk-admin-tab.active{background:#eaf9f7;border-color:#0f8b8d;color:#0f7779}
            .sk-admin-refresh{margin-top:10px}
            @media(max-width:520px){.sk-admin-actions{flex-direction:column}}
        `;
        document.head.appendChild(style);
    }

    async function isAdmin() {
        if (!currentUser || typeof supabaseClient === "undefined") return false;
        const { data, error } = await supabaseClient
            .from("admin_users")
            .select("id")
            .eq("id", currentUser.id)
            .maybeSingle();
        if (error) {
            console.warn("Admin membership check:", error);
            return false;
        }
        return !!data;
    }

    async function ensureAdminButton() {
        const list = document.getElementById("campusPickerList");
        if (!list || !currentUser) return;
        if (!(await isAdmin())) return;

        const existing = document.getElementById("campusAdminPanelButton");
        if (existing) return;

        const wrap = document.createElement("div");
        wrap.className = "sk-admin-gate";
        wrap.innerHTML = `
            <h4><i class="fas fa-shield-halved"></i> Admin tools</h4>
            <p>Review campus verification requests securely.</p>
            <button type="button" class="btn btn-primary btn-full" id="campusAdminPanelButton" style="margin-top:10px">
                <i class="fas fa-user-check"></i> Open Verification Panel
            </button>`;
        list.appendChild(wrap);
        document.getElementById("campusAdminPanelButton")?.addEventListener("click", openAdminPanel);
    }

    async function openAdminPanel() {
        if (!(await isAdmin())) {
            showToast?.("Admin access required.", "error");
            return;
        }

        const list = document.getElementById("campusPickerList");
        if (!list) return;

        addStyles();
        list.innerHTML = `
            <div class="campus-verification-card">
                <h3><i class="fas fa-user-shield"></i> Verification Admin</h3>
                <p class="campus-verification-campus">Review student ID submissions and approve or reject campus verification.</p>
                <div class="sk-admin-tabs">
                    <button type="button" class="sk-admin-tab active" data-admin-filter="pending">Pending</button>
                    <button type="button" class="sk-admin-tab" data-admin-filter="all">All</button>
                </div>
                <button type="button" class="btn btn-outline btn-full sk-admin-refresh" id="campusAdminRefresh">
                    <i class="fas fa-rotate"></i> Refresh
                </button>
                <div id="campusAdminList" class="sk-admin-list">
                    <div class="sk-admin-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
                </div>
            </div>`;

        let filter = "pending";
        const load = () => loadRequests(filter);
        document.querySelectorAll("[data-admin-filter]").forEach(button => {
            button.addEventListener("click", () => {
                filter = button.dataset.adminFilter || "pending";
                document.querySelectorAll("[data-admin-filter]").forEach(b => b.classList.toggle("active", b === button));
                load();
            });
        });
        document.getElementById("campusAdminRefresh")?.addEventListener("click", load);
        await load();
    }

    async function loadRequests(filter) {
        const target = document.getElementById("campusAdminList");
        if (!target) return;

        let query = supabaseClient
            .from("campus_verifications")
            .select("id,user_id,campus,student_name,student_id,document_path,status,rejection_reason,created_at,updated_at")
            .order("created_at", { ascending:false })
            .limit(50);

        if (filter === "pending") query = query.eq("status", "pending");

        const { data, error } = await query;
        if (error) {
            console.error("Admin verification load:", error);
            target.innerHTML = `<div class="sk-admin-empty">Could not load requests.<br><small>${esc(error.message)}</small></div>`;
            return;
        }

        if (!data?.length) {
            target.innerHTML = `<div class="sk-admin-empty"><i class="fas fa-circle-check"></i><br>No ${filter === "pending" ? "pending " : ""}verification requests.</div>`;
            return;
        }

        target.innerHTML = "";
        for (const item of data) {
            target.appendChild(await createRequestCard(item));
        }
    }

    async function createRequestCard(item) {
        const card = document.createElement("div");
        card.className = "sk-admin-card";

        let imageUrl = "";
        if (item.document_path) {
            const signed = await supabaseClient.storage.from("student-id-cards").createSignedUrl(item.document_path, 300);
            imageUrl = signed?.data?.signedUrl || "";
        }

        card.innerHTML = `
            <div class="sk-admin-card-head">
                <div>
                    <strong>${esc(item.student_name || "Student")}</strong>
                    <div class="sk-admin-meta">
                        Campus: ${esc(item.campus)}<br>
                        Student ID: ${esc(item.student_id || "—")}<br>
                        Submitted: ${esc(new Date(item.created_at).toLocaleString("en-IN"))}
                    </div>
                </div>
                <span class="sk-admin-status ${esc(item.status)}">${esc(item.status)}</span>
            </div>
            ${imageUrl ? `<img class="sk-admin-id-preview" src="${esc(imageUrl)}" alt="Private student ID">` : `<div class="sk-admin-meta" style="margin-top:10px">Student ID image unavailable.</div>`}
            ${item.rejection_reason ? `<div class="campus-gate-note" style="margin-top:10px"><strong>Reason:</strong> ${esc(item.rejection_reason)}</div>` : ""}
            ${item.status === "pending" ? `
                <div class="sk-admin-reject" id="rejectBox-${esc(item.id)}">
                    <input type="text" maxlength="250" placeholder="Reason for rejection">
                </div>
                <div class="sk-admin-actions">
                    <button type="button" class="btn btn-primary" data-admin-approve><i class="fas fa-check"></i> Approve</button>
                    <button type="button" class="btn btn-outline" data-admin-reject><i class="fas fa-xmark"></i> Reject</button>
                </div>` : ""}
        `;

        card.querySelector("[data-admin-approve]")?.addEventListener("click", () => updateRequest(item, "approved", "", card));
        card.querySelector("[data-admin-reject]")?.addEventListener("click", () => {
            const box = card.querySelector(".sk-admin-reject");
            if (box.style.display !== "block") {
                box.style.display = "block";
                box.querySelector("input")?.focus();
                return;
            }
            const reason = box.querySelector("input")?.value.trim();
            if (!reason) {
                showToast?.("Add a rejection reason.", "warning");
                return;
            }
            updateRequest(item, "rejected", reason, card);
        });

        return card;
    }

    async function updateRequest(item, status, reason, card) {
        const buttons = card.querySelectorAll("button");
        buttons.forEach(button => button.disabled = true);

        const { error } = await supabaseClient
            .from("campus_verifications")
            .update({
                status,
                rejection_reason: status === "rejected" ? reason : null,
                updated_at: new Date().toISOString()
            })
            .eq("id", item.id)
            .eq("status", "pending");

        if (error) {
            console.error("Admin verification update:", error);
            showToast?.(error.message || "Could not update verification.", "error");
            buttons.forEach(button => button.disabled = false);
            return;
        }

        showToast?.(status === "approved" ? "Campus verification approved." : "Verification rejected.", "success");
        await loadRequests("pending");
    }

    async function boot() {
        addStyles();
        if (currentUser) {
            await ensureAdminButton();
        }
    }

    window.StudentKartAdminVerification = { openAdminPanel, isAdmin, boot };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, {once:true});
    } else {
        boot();
    }
})();