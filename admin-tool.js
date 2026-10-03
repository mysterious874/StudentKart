/* =========================================================
   STUDENTKART — ADMIN TOOL
   Adds a secure admin-only entry inside Settings.
   ========================================================= */
(function () {
    const ADMIN_EMAIL = "rathodharish004@gmail.com";
    let booted = false;

    function addStyles() {
        if (document.getElementById("studentkartAdminToolStyles")) return;
        const style = document.createElement("style");
        style.id = "studentkartAdminToolStyles";
        style.textContent = `
            .sk-admin-settings-card{border:1px solid #cfe9e7!important;background:linear-gradient(135deg,#f0fbfa,#f8fbff)!important}
            .sk-admin-settings-card b{color:#0f7779}
            .sk-admin-settings-badge{display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:4px 8px;border-radius:999px;background:#e0f7f5;color:#0f7779;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
            .sk-admin-tool-modal .modal-content{max-width:720px}
            .sk-admin-dashboard{display:grid;gap:14px}
            .sk-admin-live-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
            .sk-admin-live-stat{padding:12px;border:1px solid #dce7ed;border-radius:14px;background:#f8fbff;text-align:center}
            .sk-admin-live-stat strong{display:block;font-size:21px;color:#102a43;line-height:1.1}
            .sk-admin-live-stat span{display:block;margin-top:5px;font-size:9px;color:#718083;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
            .sk-admin-live-stat.pending strong{color:#c56a00}
            .sk-admin-stats-loading{opacity:.6}
            @media(max-width:620px){.sk-admin-live-stats{grid-template-columns:1fr 1fr}}
            .sk-admin-user-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.sk-admin-user-stats>div{padding:12px;border:1px solid #dce7ed;border-radius:14px;background:#f8fbff;text-align:center}.sk-admin-user-stats strong{display:block;font-size:20px;color:#102a43}.sk-admin-user-stats span{font-size:10px;color:#718083}@media(max-width:520px){.sk-admin-user-stats{grid-template-columns:1fr 1fr}.sk-admin-user-stats>div:last-child{grid-column:1/-1}}

            .sk-admin-dashboard-hero{padding:18px;border-radius:18px;background:linear-gradient(135deg,#102a43,#0f8b8d);color:#fff}
            .sk-admin-dashboard-hero h3{margin:0;font-size:20px}
            .sk-admin-dashboard-hero p{margin:6px 0 0;color:#d9f5f3;font-size:12px;line-height:1.5}
            .sk-admin-dashboard-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
            .sk-admin-dashboard-card{border:1px solid #dce7ed;border-radius:16px;padding:15px;background:#fff;text-align:left}
            .sk-admin-dashboard-card i{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#e8f8f7;color:#0f8b8d;margin-bottom:10px}
            .sk-admin-dashboard-card strong{display:block;color:#102a43;font-size:14px}
            .sk-admin-dashboard-card span{display:block;margin-top:4px;color:#718083;font-size:11px;line-height:1.45}
            .sk-admin-dashboard-actions{display:grid;gap:9px}
            @media(max-width:560px){.sk-admin-dashboard-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    async function checkAdmin() {
        if (typeof supabaseClient === "undefined") return false;
        let user = window.currentUser;
        if (!user) {
            try {
                const result = await supabaseClient.auth.getUser();
                user = result?.data?.user || null;
            } catch (_) {}
        }
        if (!user) return false;
        if ((user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false;

        const { data, error } = await supabaseClient
            .from("admin_users")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
            console.warn("Admin tool check:", error);
            return false;
        }
        return !!data;
    }

    async function loadLiveStats(modal) {
        const stats = modal?.querySelector("#adminLiveStats");
        if (!stats) return;
        const count = async (table, filter) => {
            let query = supabaseClient.from(table).select("*", {count:"exact", head:true});
            if (filter) query = filter(query);
            const result = await query;
            if (result.error) throw result.error;
            return Number(result.count || 0);
        };
        try {
            const [users, listings, reports, verification] = await Promise.all([
                count("profiles"),
                count("products"),
                count("reports", q => q.eq("status","pending")),
                count("campus_verifications", q => q.eq("status","pending"))
            ]);
            modal.querySelector("#adminStatUsers").textContent = users;
            modal.querySelector("#adminStatListings").textContent = listings;
            modal.querySelector("#adminStatReports").textContent = reports;
            modal.querySelector("#adminStatVerification").textContent = verification;
        } catch (error) {
            console.warn("Admin live stats:", error);
            ["adminStatUsers","adminStatListings","adminStatReports","adminStatVerification"].forEach(id=>{
                const el=modal.querySelector("#"+id);
                if(el) el.textContent="—";
            });
        } finally {
            stats.classList.remove("sk-admin-stats-loading");
        }
    }

    function openDashboard() {
        document.getElementById("settingsDetailModal")?.classList.add("hidden");
        let modal = document.getElementById("adminToolModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "adminToolModal";
            modal.className = "modal sk-admin-tool-modal hidden";
            modal.innerHTML = `
                <div class="modal-overlay" data-close-admin-tool></div>
                <div class="modal-content">
                    <div class="settings-page-header">
                        <div class="settings-title-wrap">
                            <div class="settings-icon"><i class="fas fa-shield-halved"></i></div>
                            <div>
                                <span class="section-label">STUDENTKART ADMIN</span>
                                <h2>Admin Tool</h2>
                                <p>Manage trusted campus operations.</p>
                            </div>
                        </div>
                        <button type="button" class="modal-close" data-close-admin-tool aria-label="Close">&times;</button>
                    </div>
                    <div class="sk-admin-dashboard">
                        <div class="sk-admin-dashboard-hero">
                            <h3><i class="fas fa-user-shield"></i> Administrator Access</h3>
                            <p>Signed in as ${ADMIN_EMAIL}. Admin controls are protected by the Supabase admin_users table.</p>
                        </div>

                        <div class="sk-admin-live-stats sk-admin-stats-loading" id="adminLiveStats">
                            <div class="sk-admin-live-stat"><strong id="adminStatUsers">—</strong><span>Users</span></div>
                            <div class="sk-admin-live-stat"><strong id="adminStatListings">—</strong><span>Listings</span></div>
                            <div class="sk-admin-live-stat pending"><strong id="adminStatReports">—</strong><span>Pending Reports</span></div>
                            <div class="sk-admin-live-stat pending"><strong id="adminStatVerification">—</strong><span>Pending Verification</span></div>
                        </div>
                        <div class="sk-admin-dashboard-grid">
                            <button type="button" class="sk-admin-dashboard-card" id="adminVerificationTool">
                                <i class="fas fa-user-check"></i><strong>Campus Verification</strong>
                                <span>Review student ID verification requests.</span>
                            </button>
                            <button type="button" class="sk-admin-dashboard-card" id="adminUsersTool"><i class="fas fa-users"></i><strong>Users</strong><span>View registered StudentKart profiles.</span></button>
                            <button type="button" class="sk-admin-dashboard-card" id="adminListingsTool"><i class="fas fa-box-open"></i><strong>Listings</strong><span>Review marketplace listings.</span></button>
                            <button type="button" class="sk-admin-dashboard-card" id="adminReportsTool"><i class="fas fa-flag"></i><strong>Reports</strong><span>Review and moderate reports.</span></button>
                        </div>
                        <button type="button" class="btn btn-outline btn-full" id="adminCloseDashboard"><i class="fas fa-arrow-left"></i> Back</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const close = () => modal.classList.add("hidden");
            modal.querySelectorAll("[data-close-admin-tool]").forEach(el => el.addEventListener("click", close));
            modal.querySelector("#adminCloseDashboard")?.addEventListener("click", close);
            modal.querySelector("#adminVerificationTool")?.addEventListener("click", async () => {
                close();
                const campusModal = document.getElementById("campusModal");
                if (campusModal) campusModal.classList.remove("hidden");
                if (window.StudentKartAdminVerification?.openAdminPanel) {
                    await window.StudentKartAdminVerification.openAdminPanel();
                }
            });
        }
        modal.classList.remove("hidden");
        void loadLiveStats(modal);
    }

    async function ensureButton() {
        if (booted) return;
        if (!(await checkAdmin())) return;
        const grid = document.querySelector("#settingsModal .settings-grid");
        if (!grid || document.getElementById("settingsAdminToolButton")) return;

        const section = document.createElement("section");
        section.className = "settings-group sk-admin-settings-card";
        section.innerHTML = `
            <button class="settings-section-button" type="button" id="settingsAdminToolButton">
                <span><i class="fas fa-shield-halved"></i><b>Admin Tool <span class="sk-admin-settings-badge">Admin</span></b><small>Manage verification and platform moderation</small></span>
                <i class="fas fa-chevron-right"></i>
            </button>`;
        grid.appendChild(section);
        section.querySelector("#settingsAdminToolButton")?.addEventListener("click", openDashboard);
        booted = true;
    }

    async function boot() { addStyles(); await ensureButton(); }
    window.StudentKartAdminTool = { boot, checkAdmin, openDashboard };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
    else boot();

    let attempts = 0;
    const timer = setInterval(async () => {
        attempts++;
        await boot();
        if (booted || attempts >= 20) clearInterval(timer);
    }, 1000);

    const attachAuthListener = () => {
        if (typeof supabaseClient === "undefined") return;
        try {
            supabaseClient.auth.onAuthStateChange(() => {
                booted = false;
                setTimeout(boot, 250);
            });
        } catch (_) {}
    };
    attachAuthListener();
})();
