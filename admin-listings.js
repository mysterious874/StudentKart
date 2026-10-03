/* =========================================================
   STUDENTKART — ADMIN LISTINGS
   Admin-only marketplace listing viewer.
   ========================================================= */
(function () {
    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, c => ({
            "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
        }[c]));
    }

    async function openListings() {
        if (!window.StudentKartAdminTool || !(await window.StudentKartAdminTool.checkAdmin())) {
            window.showToast?.("Admin access required.", "error");
            return;
        }

        let modal = document.getElementById("adminListingsModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "adminListingsModal";
            modal.className = "modal sk-admin-tool-modal hidden";
            modal.innerHTML = `
                <div class="modal-overlay" data-close-admin-listings></div>
                <div class="modal-content">
                    <div class="settings-page-header">
                        <div class="settings-title-wrap">
                            <div class="settings-icon"><i class="fas fa-box-open"></i></div>
                            <div>
                                <span class="section-label">STUDENTKART ADMIN</span>
                                <h2>Listings</h2>
                                <p>Review marketplace listings.</p>
                            </div>
                        </div>
                        <button type="button" class="modal-close" data-close-admin-listings aria-label="Close">&times;</button>
                    </div>
                    <div class="sk-admin-listings-toolbar">
                        <input id="adminListingsSearch" type="search" placeholder="Search listings, category, location or seller..." autocomplete="off">
                        <button type="button" class="btn btn-outline" id="adminListingsRefresh">
                            <i class="fas fa-rotate"></i> Refresh
                        </button>
                    </div>
                    <div id="adminListingsCount" class="sk-admin-meta" style="margin-top:10px"></div>
                    <div id="adminListingsList" class="sk-admin-list">
                        <div class="sk-admin-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            modal.querySelector("[data-close-admin-listings]")?.addEventListener("click", () => modal.classList.add("hidden"));
            modal.querySelector("#adminListingsRefresh")?.addEventListener("click", load);
            modal.querySelector("#adminListingsSearch")?.addEventListener("input", render);
        }

        modal.classList.remove("hidden");
        await load();

        async function load() {
            const list = modal.querySelector("#adminListingsList");
            if (!list) return;
            list.innerHTML = '<div class="sk-admin-empty"><i class="fas fa-spinner fa-spin"></i> Loading listings...</div>';

            const { data, error } = await supabaseClient
                .from("products")
                .select("id,name,category,price,location,condition,description,image,seller,seller_email,user_id,created_at,updated_at")
                .order("created_at", { ascending: false })
                .limit(100);

            if (error) {
                console.error("Admin listings load:", error);
                list.innerHTML = `<div class="sk-admin-empty">Could not load listings.<br><small>${esc(error.message)}</small></div>`;
                modal.querySelector("#adminListingsCount").textContent = "";
                return;
            }

            modal._adminListingsData = data || [];
            render();
        }

        function render() {
            const all = modal._adminListingsData || [];
            const q = (modal.querySelector("#adminListingsSearch")?.value || "").toLowerCase().trim();
            const rows = all.filter(p => [
                p.name, p.category, p.location, p.condition, p.seller, p.seller_email, p.description
            ].some(v => String(v || "").toLowerCase().includes(q)));

            modal.querySelector("#adminListingsCount").textContent =
                `${rows.length} listing${rows.length === 1 ? "" : "s"} shown · latest 100 loaded`;

            const list = modal.querySelector("#adminListingsList");
            if (!rows.length) {
                list.innerHTML = '<div class="sk-admin-empty"><i class="fas fa-box-open"></i><br>No matching listings.</div>';
                return;
            }

            list.innerHTML = rows.map(p => {
                const price = Number(p.price || 0).toLocaleString("en-IN");
                const image = p.image || "";
                return `
                    <article class="sk-admin-card">
                        <div class="sk-admin-card-head">
                            <div style="min-width:0">
                                <strong>${esc(p.name || "Untitled Product")}</strong>
                                <div class="sk-admin-meta">
                                    ₹${price} · ${esc(p.category || "Other")} · ${esc(p.condition || "Good")}<br>
                                    Location: ${esc(p.location || "Not added")}<br>
                                    Seller: ${esc(p.seller || "Student")}${p.seller_email ? " · " + esc(p.seller_email) : ""}<br>
                                    Listed: ${esc(new Date(p.created_at).toLocaleString("en-IN"))}
                                </div>
                            </div>
                        </div>
                        ${image ? `<img class="sk-admin-id-preview" src="${esc(image)}" alt="${esc(p.name || "Listing")}" loading="lazy" style="max-height:190px">` : ""}
                        ${p.description ? `<div class="sk-admin-meta" style="margin-top:10px">${esc(p.description)}</div>` : ""}
                    </article>`;
            }).join("");
        }
    }

    window.StudentKartAdminListings = { openListings };

    document.addEventListener("click", event => {
        if (event.target.closest("#adminListingsTool")) openListings();
    });
})();