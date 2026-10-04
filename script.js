/* =========================================================
   STUDENTKART - COMPLETE SCRIPT
   Notifications + Wishlist + Seller Profile + Inquiries
   ========================================================= */

const SUPABASE_URL =
    "https://yymzfjfkmsrymqhpnfqz.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_tEePI-aSGDkt_2S6oiEfPw_Hy_mEXkw";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

const STORAGE_BUCKET = "product-images";

let currentUser = null;
// ===============================
// CHAT SYSTEM
// ===============================

let currentChatInquiry = null;
let chatReplyTarget = null;
let chatRealtimeChannel = null;
let currentProducts = [];
let selectedMarketplaceCategory = "all";
let currentProduct = null;
let editingProductId = null;
let selectedInquiryProduct = null;
let currentSellerProfile = null;

let currentNotifications = [];
let selectedNotificationIds = new Set();
let notificationLongPressTimer = null;
let notificationLongPressTriggered = false;
let notificationRefreshTimer = null;
let notificationRealtimeChannel = null;
let productsRealtimeChannel = null;
let toastTimer = null;

// =========================================================
// SINGLE ACTIVE SESSION PER MOBILE NUMBER
// =========================================================
// Supabase allows multiple active sessions for the same account.
// GlobeDisc uses a realtime channel so a newer login can immediately
// ask any older active app session to sign out.
let singleSessionChannel = null;
let singleSessionUserId = null;

async function stopSingleSessionListener() {
    if (!singleSessionChannel) {
        singleSessionUserId = null;
        return;
    }

    try {
        await supabaseClient.removeChannel(singleSessionChannel);
    } catch (error) {
        console.warn("Could not remove single-session channel:", error);
    }

    singleSessionChannel = null;
    singleSessionUserId = null;
}

async function startSingleSessionListener(user, notifyOlderSessions = false) {
    if (!user?.id) return;

    if (
        singleSessionChannel &&
        singleSessionUserId === user.id
    ) {
        if (notifyOlderSessions) {
            try {
                await singleSessionChannel.send({
                    type: "broadcast",
                    event: "force_logout",
                    payload: {
                        reason: "new_login",
                        timestamp: Date.now()
                    }
                });
            } catch (error) {
                console.warn("Could not notify older session:", error);
            }
        }
        return;
    }

    await stopSingleSessionListener();

    const channelName = "globedisc-single-session-" + user.id;

    singleSessionChannel =
        supabaseClient.channel(channelName, {
            config: {
                private: true,
                broadcast: {
                    self: false
                }
            }
        });

    singleSessionUserId = user.id;

    singleSessionChannel.on(
        "broadcast",
        { event: "force_logout" },
        async () => {
            // This session is older than the newly authenticated session.
            // Clear the local session and return the user to the entry gate.
            try {
                await supabaseClient.auth.signOut({
                    scope: "local"
                });
            } catch (error) {
                console.warn(
                    "Forced logout could not clear Supabase session:",
                    error
                );
            }

            currentUser = null;
            localStorage.removeItem(STUDENTKART_GUEST_MODE_KEY);

            stopNotificationRefresh();

            currentNotifications = [];
            currentWishlist = [];

            closeAllModals();
            updateNavbar();
            updateNotificationNavbar();
            updateWishlistNavbar();
            updateWishlistButtons();

            showNewUserGate();

            showToast(
                "You're logged out because this mobile number was used to log in on another device.",
                "warning"
            );
        }
    );

    try {
        await new Promise((resolve, reject) => {
            let settled = false;

            const finish = (error) => {
                if (settled) return;
                settled = true;
                error ? reject(error) : resolve();
            };

            singleSessionChannel.subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    finish();
                } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    finish(new Error("Realtime channel status: " + status));
                }
            });
        });

        // Do not notify before the new session has successfully subscribed.
        // self:false prevents this newly logged-in session from receiving
        // its own force_logout message.
        if (notifyOlderSessions) {
            await singleSessionChannel.send({
                type: "broadcast",
                event: "force_logout",
                payload: {
                    reason: "new_login",
                    timestamp: Date.now()
                }
            });
        }
    } catch (error) {
        console.warn(
            "Single-session realtime setup failed:",
            error
        );
    }
}



/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatPrice(value) {

    const number = Number(value || 0);

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(number);
}

function formatDate(dateValue) {

    if (!dateValue) {
        return "Recently";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Recently";
    }

    return date.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getRelativeDate(dateValue) {

    if (!dateValue) {
        return "Recently";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Recently";
    }

    const diff =
        Date.now() - date.getTime();

    const seconds =
        Math.floor(diff / 1000);

    if (seconds < 60) {
        return "Just now";
    }

    const minutes =
        Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days =
        Math.floor(hours / 24);

    if (days < 7) {
        return `${days}d ago`;
    }

    return formatDate(dateValue);
}

function getInitials(name) {

    const value =
        String(name || "Student").trim();

    if (!value) {
        return "S";
    }

    const parts =
        value.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}

function getPlaceholderImage(name = "StudentKart") {

    const text =
        encodeURIComponent(
            String(name).slice(0, 24)
        );

    return (
        "https://placehold.co/900x650/e8f5ed/16834b" +
        "?text=" +
        text
    );
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message, type = "success") {

    const toast = $("toast");
    const icon = $("toastIcon");
    const text = $("toastMessage");

    if (!toast || !text) {
        return;
    }

    text.textContent = message;

    if (icon) {

        const iconElement =
            icon.querySelector("i");

        if (iconElement) {

            iconElement.className =
                type === "error"
                    ? "fas fa-circle-exclamation"
                    : type === "warning"
                        ? "fas fa-triangle-exclamation"
                        : "fas fa-check";
        }
    }

    toast.classList.remove("hidden");

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            toast.classList.add("hidden");

        }, 3200);
}


/* =========================================================
   MODALS
   ========================================================= */

let modalHistory = [];
let studentKartHistoryReady = false;
let studentKartHandlingPopState = false;
let studentKartSkipNextPopState = false;
let studentKartModalCloseTimers = new Map();

function ensureStudentKartHistory() {
    if (studentKartHistoryReady) {
        return;
    }

    const currentState = window.history.state;

    if (!currentState || currentState.studentKart !== true) {
        window.history.replaceState(
            { ...(currentState || {}), studentKart: true, modalId: null },
            "",
            window.location.href
        );
    }

    studentKartHistoryReady = true;
}


function setStudentKartModalHistory(modalId = null, modalStack = []) {
    ensureStudentKartHistory();

    const url = modalId
        ? window.location.pathname + window.location.search + "#" + modalId
        : window.location.pathname + window.location.search;

    window.history.replaceState(
        {
            studentKart: true,
            modalId: modalId || null,
            modalStack: Array.isArray(modalStack) ? modalStack.filter(Boolean) : []
        },
        "",
        url
    );
}

function openModal(id, options = {}) {

    const modal = $(id);

    if (!modal) {
        return;
    }

    ensureStudentKartHistory();

    const currentModal =
        document.querySelector(
            ".modal:not(.hidden)"
        );

    // If another modal is in the middle of its close animation, cancel that
    // animation and treat it as the real parent of the new modal. This keeps
    // modal navigation/history in the same order the user sees on screen.
    if (currentModal && currentModal.id !== id) {
        const pendingClose = studentKartModalCloseTimers.get(currentModal.id);
        if (pendingClose) {
            window.clearTimeout(pendingClose);
            studentKartModalCloseTimers.delete(currentModal.id);
        }
        currentModal.classList.remove("modal-closing");
    }

    if (
        currentModal &&
        currentModal.id !== id
    ) {
        modalHistory = modalHistory.filter(
            historyId => historyId !== id
        );
        modalHistory.push(currentModal.id);
        currentModal.classList.add("hidden");
        currentModal.classList.remove("modal-closing");
    }

    modal.classList.remove("modal-closing");
    modal.classList.remove("hidden");

    document.body.classList.add("modal-open");
    document.body.classList.add("studentkart-modal-navigation-hidden");

    if (!options.fromPopState && !studentKartHandlingPopState) {
        window.history.pushState(
            {
                studentKart: true,
                modalId: id,
                modalStack: [...modalHistory, id]
            },
            "",
            window.location.pathname + window.location.search + "#" + id
        );
    }
}

function closeModal(id, options = {}) {

    if (id === "productModal") {
        document.body.classList.remove("studentkart-product-details-open");
    }

    if (id === "chatModal") {
        document.body.classList.remove("studentkart-chat-open");
    }

    const modal = $(id);

    if (!modal || modal.classList.contains("hidden")) {
        return;
    }

    if (options.instant) {
        modal.classList.remove("modal-closing");
        modal.classList.add("hidden");

        const parentId = modalHistory.pop();

        if (parentId) {
            const parentModal = $(parentId);

            if (parentModal) {
                parentModal.classList.remove("modal-closing");
                parentModal.classList.remove("hidden");
                document.body.classList.add("modal-open");
                document.body.classList.add("studentkart-modal-navigation-hidden");

                if (!options.fromPopState && window.history.state?.studentKart) {
                    setStudentKartModalHistory(
                        parentId,
                        [parentId]
                    );
                }

                return;
            }
        }

        const anyOpen = document.querySelector(".modal:not(.hidden)");

        if (!anyOpen) {
            document.body.classList.remove("modal-open");
            document.body.classList.remove("studentkart-modal-navigation-hidden");

            if (!options.fromPopState && window.history.state?.studentKart && window.history.state?.modalId) {
                setStudentKartModalHistory(null, []);
            }
        }

        return;
    }

    modal.classList.add("modal-closing");

    const existingCloseTimer = studentKartModalCloseTimers.get(id);
    if (existingCloseTimer) {
        window.clearTimeout(existingCloseTimer);
    }

    const closeTimer = window.setTimeout(() => {
        studentKartModalCloseTimers.delete(id);
        modal.classList.remove("modal-closing");
        modal.classList.add("hidden");

        const parentId =
            modalHistory.pop();

        if (parentId) {
            const parentModal = $(parentId);

            if (parentModal) {
                parentModal.classList.remove("modal-closing");
                parentModal.classList.remove("hidden");
                document.body.classList.add("modal-open");
                document.body.classList.add("studentkart-modal-navigation-hidden");

                if (!options.fromPopState && window.history.state?.studentKart) {
                    setStudentKartModalHistory(
                        parentId,
                        [parentId]
                    );
                }

                return;
            }
        }

        const anyOpen =
            document.querySelector(
                ".modal:not(.hidden)"
            );

        if (!anyOpen) {
            document.body.classList.remove("modal-open");
            document.body.classList.remove("studentkart-modal-navigation-hidden");

            if (!options.fromPopState && window.history.state?.studentKart && window.history.state?.modalId) {
                setStudentKartModalHistory(null, []);
            }
        }
    }, 220);
    studentKartModalCloseTimers.set(id, closeTimer);
}

function closeAllModals(options = {}) {

    studentKartModalCloseTimers.forEach(timer => window.clearTimeout(timer));
    studentKartModalCloseTimers.clear();

    document.body.classList.remove("studentkart-product-details-open");
    document.body.classList.remove("studentkart-chat-open");

    modalHistory = [];

    document
        .querySelectorAll(".modal")
        .forEach(modal => {
            modal.classList.remove("modal-closing");
            modal.classList.add("hidden");
        });

    document.body.classList.remove("modal-open");
    document.body.classList.remove("studentkart-modal-navigation-hidden");

    if (!options.fromPopState && window.history.state?.studentKart && window.history.state?.modalId) {
        setStudentKartModalHistory(null, []);
    }
}


window.addEventListener("popstate", event => {
    /*
     * System/browser Back uses this same navigation stack as the
     * visible Chat back arrow.
     */
    const state = event.state;

    if (state?.studentKart === true) {
        studentKartHandlingPopState = true;

        // Search results are a real page-level navigation state too.
        // Restore the exact search page on browser/Android Forward, while
        // the normal Home state is restored when Back lands on the base page.
        if (state.page === "search") {
            studentKartHandlingPopState = false;
            showSearchResultsPage(state.searchQuery || "", { fromPopState: true });
            return;
        }

        // Category marketplace is a page-level navigation state rather than
        // a modal. Restore it directly when the user presses Android/browser Back.
        if (state.page === "category") {
            document.querySelectorAll(".modal").forEach(modal => {
                modal.classList.remove("modal-closing");
                modal.classList.add("hidden");
            });
            modalHistory = [];
            openCategoryPage(state.category || "Other", { fromPopState: true });
            studentKartHandlingPopState = false;
            return;
        }

        // Returning from a category page to the category picker/home must
        // first restore the normal page visibility.
        document.body.classList.remove("category-page-active");
        $("categoryPage")?.classList.add("hidden");
        document.querySelector("main")?.classList.remove("category-page-active");
        $("home")?.classList.remove("hidden");
        $("marketplace")?.classList.remove("hidden");
        $("how-it-works")?.classList.remove("hidden");

        const targetModalId = state.modalId || null;
        const targetModal = targetModalId ? $(targetModalId) : null;

        document.querySelectorAll(".modal").forEach(modal => {
            modal.classList.remove("modal-closing");
            modal.classList.add("hidden");
        });

        modalHistory = Array.isArray(state.modalStack)
            ? state.modalStack.filter(Boolean).slice(0, -1)
            : [];

        if (targetModal) {
            targetModal.classList.remove("modal-closing");
            targetModal.classList.remove("hidden");
            document.body.classList.add("modal-open");
            document.body.classList.add("studentkart-modal-navigation-hidden");

            if (targetModal.id === "chatModal") {
                document.body.classList.add("studentkart-chat-open");
            } else {
                document.body.classList.remove("studentkart-chat-open");
            }
        } else {
            document.body.classList.remove("modal-open");
            document.body.classList.remove("studentkart-modal-navigation-hidden");
            document.body.classList.remove("studentkart-chat-open");
            modalHistory = [];
        }

        studentKartHandlingPopState = false;
        return;
    }

    const openModalElement = document.querySelector(".modal:not(.hidden)");
    if (openModalElement) {
        closeAllModals({ fromPopState: true });
    }
});

ensureStudentKartHistory();


/* =========================================================
   LOCAL PROFILE
   ========================================================= */

function getProfileStorageKey() {

    return currentUser
        ? `studentkart_profile_${currentUser.id}`
        : null;
}

function getSavedProfile() {

    const key =
        getProfileStorageKey();

    if (!key) {
        return null;
    }

    try {

        const data =
            localStorage.getItem(key);

        return data
            ? JSON.parse(data)
            : null;

    } catch (error) {

        console.error(
            "Profile storage error:",
            error
        );

        return null;
    }
}

function saveProfile(profile) {

    const key =
        getProfileStorageKey();

    if (!key) {
        return;
    }

    try {

        localStorage.setItem(
            key,
            JSON.stringify(profile)
        );

    } catch (error) {

        console.error(
            "Could not save profile:",
            error
        );
    }
}

async function getUserProfile() {

    if (!currentUser) {
        return null;
    }

    const saved =
        getSavedProfile();

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "id,name,username,phone,college,state,city,area,email,avatar_url,created_at,updated_at"
                )
                .eq(
                    "id",
                    currentUser.id
                )
                .maybeSingle();

        if (!error && data) {

            saveProfile(data);

            return data;
        }

        // Backward-compatible fallback while the new username/phone
        // columns are being added to older StudentKart databases.
        if (error) {
            const fallbackResult = await supabaseClient
                .from("profiles")
                .select("id,name,college,email,avatar_url,created_at,updated_at")
                .eq("id", currentUser.id)
                .maybeSingle();

            if (!fallbackResult.error && fallbackResult.data) {
                // Merge locally/auth-saved newer fields when an older profiles
                // table does not yet have the newer columns.
                const mergedProfile = {
                    ...(saved || {}),
                    ...fallbackResult.data
                };
                saveProfile(mergedProfile);
                return mergedProfile;
            }
        }

    } catch (error) {

        console.error(
            "Profile fetch error:",
            error
        );
    }

    return (
        saved || {
            id: currentUser.id,
            name:
                currentUser.user_metadata
                    ?.name ||
                currentUser.email
                    ?.split("@")[0] ||
                "Student",
            username:
                currentUser.user_metadata?.username ||
                "",
            phone:
                currentUser.phone || currentUser.user_metadata?.phone ||
                "",
            college:
                currentUser.user_metadata
                    ?.college ||
                "",
            email:
                currentUser.email || "",
            avatar_url: "",
            created_at:
                currentUser.created_at
        }
    );
}


/* =========================================================
   WISHLIST — SUPABASE
   ========================================================= */

let currentWishlist = [];


/* -----------------------------------------
   LOAD WISHLIST
   ----------------------------------------- */

async function getWishlist() {

    if (!currentUser) {
        currentWishlist = [];
        return [];
    }

    try {

        const { data, error } =
            await supabaseClient
                .from("wishlists")
                .select("id, product_id, created_at")
                .eq(
                    "user_id",
                    currentUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (error) {
            throw error;
        }

        currentWishlist = data || [];

        return currentWishlist;

    } catch (error) {

        console.error(
            "Wishlist load error:",
            error
        );

        currentWishlist = [];

        return [];
    }
}


/* -----------------------------------------
   CHECK WISHLIST
   ----------------------------------------- */

function isWishlisted(productId) {

    return currentWishlist.some(
        item =>
            String(item.product_id) ===
            String(productId)
    );
}


/* -----------------------------------------
   NAVBAR COUNT
   ----------------------------------------- */

function updateWishlistNavbar() {

    const countElement =
        $("wishlistCount");

    if (!countElement) {
        return;
    }

    const count =
        currentWishlist.length;

    countElement.textContent =
        count > 99
            ? "99+"
            : String(count);

    countElement.classList.toggle(
        "hidden",
        count === 0
    );
}


/* -----------------------------------------
   UPDATE HEART BUTTONS
   ----------------------------------------- */

function updateWishlistButtons() {

    document
        .querySelectorAll(
            "[data-wishlist-id]"
        )
        .forEach(button => {

            const productId =
                button.dataset.wishlistId;

            const active =
                isWishlisted(productId);

            button.classList.toggle(
                "active",
                active
            );

            const icon =
                button.querySelector("i");

            if (icon) {

                icon.className =
                    active
                        ? "fas fa-heart"
                        : "far fa-heart";
            }

            button.setAttribute(
                "aria-label",
                active
                    ? "Remove from wishlist"
                    : "Add to wishlist"
            );
        });

    updateWishlistNavbar();
}


/* -----------------------------------------
   ADD TO WISHLIST
   ----------------------------------------- */

async function addToWishlist(productId) {

    if (!currentUser) {

        openModal("loginModal");

        showToast(
            "Please login to use wishlist",
            "warning"
        );

        return false;
    }

    try {

        const { data, error } =
            await supabaseClient
                .from("wishlists")
                .insert({
                    user_id:
                        currentUser.id,

                    product_id:
                        String(productId)
                })
                .select()
                .single();

        if (error) {

            if (
                error.code ===
                "23505"
            ) {

                await getWishlist();

                return true;
            }

            throw error;
        }

        currentWishlist.unshift(data);

        showToast(
            "Added to wishlist ❤️",
            "success"
        );

        return true;

    } catch (error) {

        console.error(
            "Add wishlist error:",
            error
        );

        showToast(
            "Could not add to wishlist",
            "error"
        );

        return false;
    }
}


/* -----------------------------------------
   TOGGLE WISHLIST
   ----------------------------------------- */

async function toggleWishlist(productId) {

    if (!productId) {
        return;
    }

    if (!currentUser) {

        openModal("loginModal");

        showToast(
            "Please login to use wishlist",
            "warning"
        );

        return;
    }

    const active =
        isWishlisted(productId);

    if (active) {

        await removeFromWishlist(
            productId
        );

    } else {

        await addToWishlist(
            productId
        );
    }

    await getWishlist();

    updateWishlistButtons();

    renderWishlist();
}

async function renderWishlist() {

    const container =
        $("wishlistContainer");

    if (!container) {
        return;
    }

    if (!currentUser) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="far fa-heart"></i>
                <h3>Your wishlist is empty</h3>
                <p>Please login to use your wishlist.</p>
            </div>
        `;

        return;
    }

    await getWishlist();

    if (!currentWishlist.length) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="far fa-heart"></i>
                <h3>Your wishlist is empty</h3>
                <p>Save products you want to check later.</p>
            </div>
        `;

        updateWishlistNavbar();

        return;
    }

    const wishlistProducts =
        currentWishlist
            .map(item => {

                return currentProducts.find(
                    product =>
                        String(product.id) ===
                        String(item.product_id)
                );

            })
            .filter(Boolean);

    if (!wishlistProducts.length) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="far fa-heart"></i>
                <h3>Your wishlist is empty</h3>
                <p>Saved products are no longer available.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        wishlistProducts
            .map(item => {

                const image =
                    item.image ||
                    getPlaceholderImage(
                        item.name
                    );

                return `
                    <article
                        class="product-card wishlist-product-card"
                        data-wishlist-product-id="${escapeHTML(item.id)}"
                    >

                        <div class="product-image-wrap">

                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(item.name)}"
                                class="product-image"
                                onerror="this.src='${getPlaceholderImage("StudentKart")}'"
                            >

                            <button
                                type="button"
                                class="wishlist-btn active"
                                data-wishlist-id="${escapeHTML(item.id)}"
                                aria-label="Remove from wishlist"
                            >
                                <i class="fas fa-heart"></i>
                            </button>

                        </div>

                        <div class="product-body">

                            <div class="product-meta">
                                <span>
                                    ${escapeHTML(
                    item.category ||
                    "Other"
                )}
                                </span>
                            </div>

                            <h3>
                                ${escapeHTML(
                    item.name
                )}
                            </h3>

                            <div class="product-price">
                                ${formatPrice(
                    item.price
                )}
                            </div>

                            <div class="product-location">
                                <i class="fas fa-location-dot"></i>
                                ${escapeHTML(
                    item.location ||
                    "Campus"
                )}
                            </div>

                            <button
                                type="button"
                                class="btn btn-outline btn-full"
                                data-wishlist-view="${escapeHTML(item.id)}"
                            >
                                View Product
                            </button>

                        </div>

                    </article>
                `;
            })
            .join("");

    updateWishlistButtons();
}
async function openWishlist(event) {

    if (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    if (!currentUser) {
        openModal("loginModal");

        showToast(
            "Please login to use wishlist",
            "warning"
        );

        return;
    }

    // Open immediately; load Supabase wishlist data in the background.
    openModal("wishlistModal");
    void renderWishlist();
}

async function removeFromWishlist(productId) {

    if (!currentUser) {
        showToast(
            "Please login to manage your wishlist",
            "warning"
        );
        return false;
    }

    try {

        const { error } =
            await supabaseClient
                .from("wishlists")
                .delete()
                .eq(
                    "user_id",
                    currentUser.id
                )
                .eq(
                    "product_id",
                    String(productId)
                );

        if (error) {
            throw error;
        }

        currentWishlist =
            currentWishlist.filter(
                item =>
                    String(item.product_id) !==
                    String(productId)
            );

        renderWishlist();

        updateWishlistButtons();

        showToast(
            "Removed from wishlist",
            "success"
        );

        return true;

    } catch (error) {

        console.error(
            "Remove wishlist error:",
            error
        );

        showToast(
            "Could not remove from wishlist",
            "error"
        );

        return false;
    }
}


/* =========================================================
   PRODUCT HELPERS
   ========================================================= */

function normalizeProduct(product) {

    if (!product) {
        return null;
    }

    return {
        ...product,

        id: product.id,

        name:
            product.name ||
            "Untitled Product",

        category:
            product.category ||
            "Other",

        price:
            Number(product.price || 0),

        location:
            product.location ||
            "Campus",

        condition:
            product.condition ||
            "Good",

        description:
            product.description ||
            "",

        image:
            product.image ||
            getPlaceholderImage(
                product.name
            ),

        seller:
            product.seller ||
            "Student",

        sellerEmail:
            product.seller_email ||
            "",

        userId:
            product.user_id ||
            null,

        createdAt:
            product.created_at,

        updatedAt:
            product.updated_at
    };
}

function getConditionClass(condition) {

    const value =
        String(condition || "")
            .toLowerCase();

    if (value.includes("new")) {
        return "condition-new";
    }

    if (
        value.includes("excellent")
    ) {
        return "condition-excellent";
    }

    if (
        value.includes("good")
    ) {
        return "condition-good";
    }

    return "condition-fair";
}

function getConditionIcon(condition) {

    const value =
        String(condition || "")
            .toLowerCase();

    if (value.includes("new")) {
        return "fa-star";
    }

    if (
        value.includes("excellent")
    ) {
        return "fa-circle-check";
    }

    if (
        value.includes("good")
    ) {
        return "fa-thumbs-up";
    }

    return "fa-circle-info";
}

function isMyProduct(product) {

    if (!currentUser || !product) {
        return false;
    }

    return (
        String(product.userId) ===
        String(currentUser.id)
    );
}


/* =========================================================
   AUTH
   ========================================================= */

async function getCurrentUser() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        const sessionUser =
            data?.session?.user ||
            null;

        if (!sessionUser) {
            currentUser = null;
            return null;
        }

        // getSession() reads the locally cached session. A deleted or
        // revoked Supabase user can still appear logged in until the
        // server validates that cached session.
        const {
            data: verifiedData,
            error: verifiedError
        } =
            await supabaseClient.auth.getUser();

        if (verifiedError || !verifiedData?.user) {
            console.warn(
                "Stored auth session is no longer valid. Clearing it.",
                verifiedError || "User not found"
            );

            await supabaseClient.auth.signOut({
                scope: "local"
            });

            currentUser = null;
            localStorage.removeItem(STUDENTKART_GUEST_MODE_KEY);
            return null;
        }

        currentUser = verifiedData.user;

        return currentUser;

    } catch (error) {

        console.error(
            "Session validation error:",
            error
        );

        try {
            await supabaseClient.auth.signOut({
                scope: "local"
            });
        } catch (signOutError) {
            console.warn(
                "Could not clear local auth session:",
                signOutError
            );
        }

        currentUser = null;

        return null;
    }
}

function updateNavbar() {

    const loginButton =
        $("loginButton");

    const signupButton =
        $("signupButton");

    const profileButton =
        $("profileButton");

    const footerLoginButton =
        $("footerLoginButton");

    const footerSignupButton =
        $("footerSignupButton");

    const footerProfileButton =
        $("footerProfileButton");

    const footerLogoutButton =
        $("footerLogoutButton");

    const sellButton =
        $("sellButton");

    if (currentUser) {

        loginButton?.classList.add(
            "hidden"
        );

        signupButton?.classList.add(
            "hidden"
        );

        profileButton?.classList.remove(
            "hidden"
        );

        footerLoginButton?.classList.add("hidden");
        footerSignupButton?.classList.add("hidden");
        footerProfileButton?.classList.remove("hidden");
        footerLogoutButton?.classList.remove("hidden");

        sellButton?.classList.remove(
            "hidden"
        );

    } else {

        loginButton?.classList.remove(
            "hidden"
        );

        signupButton?.classList.remove(
            "hidden"
        );

        profileButton?.classList.remove(
            "hidden"
        );

        footerLoginButton?.classList.remove("hidden");
        footerSignupButton?.classList.remove("hidden");
        footerProfileButton?.classList.add("hidden");
        footerLogoutButton?.classList.add("hidden");

        sellButton?.classList.remove(
            "hidden"
        );
    }

    updateWishlistNavbar();
    updateNotificationNavbar();
}


/* =========================================================
   LOAD PRODUCTS
   ========================================================= */

let marketplacePageSize = 40;
let marketplacePage = 0;
let marketplaceHasMore = true;
let marketplaceLoadingMore = false;

function ensureMarketplaceInfiniteScroll() {
    const container = $("productContainer");
    if (!container) return null;

    let sentinel = $("marketplaceInfiniteSentinel");
    if (!sentinel) {
        sentinel = document.createElement("div");
        sentinel.id = "marketplaceInfiniteSentinel";
        sentinel.className = "marketplace-infinite-sentinel";
        sentinel.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading more listings...</span>';
        container.parentElement?.appendChild(sentinel);
    }

    if (!sentinel.dataset.bound) {
        sentinel.dataset.bound = "true";
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                loadMoreProducts();
            }
        }, { rootMargin: "700px 0px" });
        observer.observe(sentinel);
    }

    return sentinel;
}

function updateMarketplaceInfiniteState() {
    const sentinel = $("marketplaceInfiniteSentinel");
    if (!sentinel) return;

    if (marketplaceLoadingMore) {
        sentinel.classList.remove("hidden");
        sentinel.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading more listings...</span>';
    } else if (!marketplaceHasMore) {
        sentinel.classList.remove("hidden");
        sentinel.innerHTML = '<span>✓ You have reached the end of the available listings.</span>';
    } else {
        sentinel.classList.remove("hidden");
        sentinel.innerHTML = '<span>Scroll for more listings</span>';
    }
}

async function fetchProductPage(page) {
    const from = page * marketplacePageSize;
    const to = from + marketplacePageSize - 1;

    const request = supabaseClient
        .from("products")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Marketplace request timed out")), 15000)
    );

    const { data, error } = await Promise.race([request, timeout]);
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    return {
        products: rows.map(normalizeProduct),
        hasMore: rows.length === marketplacePageSize
    };
}

async function loadProducts() {
    const container = $("productContainer");
    if (!container) return;

    marketplacePage = 0;
    marketplaceHasMore = true;
    marketplaceLoadingMore = false;
    currentProducts = [];

    const sentinel = $("marketplaceInfiniteSentinel");
    if (sentinel) sentinel.remove();

    container.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading marketplace...</p>
        </div>
    `;

    ensureMarketplaceInfiniteScroll();

    try {
        const result = await fetchProductPage(0);

        currentProducts = result.products;
        marketplaceHasMore = result.hasMore;
        marketplacePage = 0;

        updateStats();
        await applyFilters();
        updateMarketplaceInfiniteState();

        // If the first page is too short to fill the viewport, continue
        // fetching automatically until the viewport has enough content or
        // the database has no more active listings.
        if (marketplaceHasMore && container.scrollHeight <= window.innerHeight + 300) {
            await loadMoreProducts();
        }
    } catch (error) {
        console.error("Load products error:", error);

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Could not load products</h3>
                <p>${escapeHTML(error?.message || "Please refresh and try again.")}</p>
                <button type="button" class="btn btn-outline" id="retryMarketplaceButton">
                    <i class="fas fa-rotate"></i> Retry
                </button>
            </div>
        `;

        $("retryMarketplaceButton")?.addEventListener("click", loadProducts);
        showToast("Could not load marketplace", "error");
    }
}

async function loadMoreProducts() {
    if (marketplaceLoadingMore || !marketplaceHasMore) return;

    marketplaceLoadingMore = true;
    updateMarketplaceInfiniteState();

    try {
        const nextPage = marketplacePage + 1;
        const result = await fetchProductPage(nextPage);

        marketplacePage = nextPage;
        marketplaceHasMore = result.hasMore;

        if (result.products.length) {
            const existingIds = new Set(currentProducts.map(product => String(product.id)));
            result.products.forEach(product => {
                if (!existingIds.has(String(product.id))) {
                    currentProducts.push(product);
                }
            });

            updateStats();
            await applyFilters();
        }
    } catch (error) {
        console.error("Load more products error:", error);
        marketplaceHasMore = false;
        showToast("Could not load more listings. Try again.", "warning");
    } finally {
        marketplaceLoadingMore = false;
        updateMarketplaceInfiniteState();
    }
}


function updateStats() {
    const total = currentProducts.length;

    const products = document.querySelectorAll(
        "[data-stat-products]"
    );

    products.forEach(element => {
        element.textContent = total;
    });

    const totalListings = $("totalListings");

    if (totalListings) {
        totalListings.textContent = total;
    }
}

function startProductsRealtime() {
    if (productsRealtimeChannel) {
        supabaseClient.removeChannel(productsRealtimeChannel);
        productsRealtimeChannel = null;
    }

    productsRealtimeChannel = supabaseClient
        .channel("studentkart-products-realtime")
        .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "products"
        }, async payload => {
            console.log("Marketplace realtime update:", payload.eventType);
            await loadProducts();
        })
        .subscribe(status => {
            if (status === "SUBSCRIBED") {
                console.log("Marketplace realtime connected");
            }
        });
}

function stopProductsRealtime() {
    if (productsRealtimeChannel) {
        supabaseClient.removeChannel(productsRealtimeChannel);
        productsRealtimeChannel = null;
    }
}

let marketplaceFilterSnapshot = null;

function captureMarketplaceFilterSnapshot() {
    marketplaceFilterSnapshot = {};
    [
        "categoryFilter",
        "minPrice",
        "maxPrice",
        "locationFilter",
        "conditionFilter",
        "sortFilter"
    ].forEach(id => {
        const element = $(id);
        if (element) {
            marketplaceFilterSnapshot[id] = element.value;
        }
    });
}

function restoreMarketplaceFilterSnapshot() {
    if (!marketplaceFilterSnapshot) return;

    Object.entries(marketplaceFilterSnapshot).forEach(([id, value]) => {
        const element = $(id);
        if (element) {
            element.value = value;
        }
    });
}

const studentKartLocationGeoCache = new Map();

async function getStudentKartLocationTerms(location) {
    const raw = String(location || "").trim().toLowerCase();
    if (!raw) return [];

    if (studentKartLocationGeoCache.has(raw)) {
        return studentKartLocationGeoCache.get(raw);
    }

    const terms = new Set([raw]);

    try {
        const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=5&q=" + encodeURIComponent(location);
        const response = await fetch(url, {
            headers: { "Accept": "application/json" }
        });

        if (response.ok) {
            const results = await response.json();

            results.forEach(item => {
                const address = item.address || {};

                [
                    address.city,
                    address.town,
                    address.city_district,
                    address.municipality,
                    address.county,
                    address.state_district,
                    address.village,
                    address.suburb,
                    address.neighbourhood,
                    address.state
                ]
                    .filter(Boolean)
                    .forEach(value => terms.add(String(value).trim().toLowerCase()));

                if (item.display_name) {
                    String(item.display_name)
                        .split(",")
                        .map(value => value.trim().toLowerCase())
                        .filter(value => value.length >= 2)
                        .forEach(value => terms.add(value));
                }
            });
        }
    } catch (error) {
        console.debug("Location matching lookup unavailable:", error);
    }

    const finalTerms = [...terms].filter(Boolean);
    studentKartLocationGeoCache.set(raw, finalTerms);
    return finalTerms;
}

async function applyFilters() {

    const search =
        String(
            $("marketplaceSearch")?.value ||
            $("navbarSearchInput")?.value || ""
        )
            .trim()
            .toLowerCase();

    const category =
        $("categoryFilter")?.value ||
        selectedMarketplaceCategory || "all";

    const min =
        Number(
            $("minPrice")?.value || 0
        );

    const maxRaw =
        $("maxPrice")?.value ?? "";

    const max =
        maxRaw === ""
            ? Infinity
            : Number(maxRaw);

    const condition =
        $("conditionFilter")?.value || "all";

    const locationRaw =
        String(
            $("locationFilter")?.value || ""
        ).trim();

    const locationTerms =
        locationRaw
            ? await getStudentKartLocationTerms(locationRaw)
            : [];

    const sort =
        $("sortFilter")?.value || "newest";

    let filtered = [...currentProducts];

    if (search) {
        filtered = filtered.filter(product => {
            const haystack =
                [
                    product.name,
                    product.category,
                    product.location,
                    product.condition,
                    product.description,
                    product.seller
                ]
                    .join(" ")
                    .toLowerCase();

            return haystack.includes(search);
        });
    }

    if (category && category !== "all") {
        filtered = filtered.filter(
            product =>
                String(product.category).toLowerCase() ===
                String(category).toLowerCase()
        );
    }

    filtered = filtered.filter(
        product =>
            Number(product.price) >= min &&
            Number(product.price) <= max
    );

    if (condition && condition !== "all") {
        filtered = filtered.filter(
            product =>
                String(product.condition).toLowerCase() ===
                String(condition).toLowerCase()
        );
    }

    if (locationTerms.length) {
        filtered = filtered.filter(product => {
            const productLocation = String(product.location || "").toLowerCase();
            const productText = [
                product.location,
                product.description,
                product.name
            ].join(" ").toLowerCase();

            return locationTerms.some(term =>
                productLocation.includes(term) ||
                productText.includes(term)
            );
        });
    }

    if (sort === "price-low") {
        filtered.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sort === "price-high") {
        filtered.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sort === "oldest") {
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    updateFilterStatus(filtered.length);
    renderProducts(filtered);
}

function updateFilterStatus(count) {

    const status =
        $("filterStatus");

    if (!status) {
        return;
    }

    status.textContent =
        `${count} ${count === 1
            ? "listing"
            : "listings"
        } found`;
}


/* =========================================================
   SELLER TRIGGER
   ========================================================= */

function sellerTrigger(
    product,
    extraClass = ""
) {

    if (!product?.userId) {

        return `
            <span class="seller-name ${extraClass}">
                ${escapeHTML(
            product?.seller ||
            "Student"
        )}
            </span>
        `;
    }

    return `
        <button
            type="button"
            class="seller-trigger ${extraClass}"
            data-seller-id="${escapeHTML(
        product.userId
    )}">
            <span class="seller-avatar-small">
                ${product.avatarUrl
            ? `<img src="${escapeHTML(product.avatarUrl)}" alt="">`
            : escapeHTML(
                getInitials(
                    product.seller
                )
            )
        }
            </span>
            <span>
                ${escapeHTML(
            product.seller ||
            "Student"
        )}
            </span>
        </button>
    `;
}
/* =========================================================
   RENDER PRODUCTS
   ========================================================= */

function renderProducts(products, targetContainerId = "productContainer", targetEmptyId = "emptyState") {

    const container =
        $(targetContainerId);

    const empty =
        $(targetEmptyId);

    if (!container) {
        return;
    }

    if (!products.length) {

        container.innerHTML = "";

        if (empty) {
            empty.classList.remove(
                "hidden"
            );
        }

        return;
    }

    if (empty) {
        empty.classList.add(
            "hidden"
        );
    }

    container.innerHTML =
        products.map(product => {

            const image =
                product.image ||
                getPlaceholderImage(
                    product.name
                );

            const wished =
                isWishlisted(
                    product.id
                );

            return `
                <article
                    class="product-card"
                    data-product-id="${escapeHTML(
                product.id
            )}">

                    <div class="product-image-wrap">

                        <img
                            class="product-image"
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(product.name)}"
                            loading="lazy"
                            onerror="this.src='${getPlaceholderImage("StudentKart")}'">

                        <button
                            type="button"
                            class="wishlist-btn ${wished
                    ? "active"
                    : ""
                }"
                            data-wishlist-id="${escapeHTML(
                    product.id
                )}"
                            aria-label="${wished
                    ? "Remove from wishlist"
                    : "Add to wishlist"
                }">

                            <i class="${wished
                    ? "fas"
                    : "far"
                } fa-heart"></i>

                        </button>

                        <span
                            class="condition-badge ${getConditionClass(
                    product.condition
                )}">
                            <i class="fas ${getConditionIcon(
                    product.condition
                )}"></i>
                            ${escapeHTML(
                    product.condition
                )}
                        </span>

                    </div>

                    <div class="product-body">

                        <div class="product-meta">
                            <span>
                                ${escapeHTML(
                    product.category
                )}
                            </span>
                        </div>

                        <h3>
                            ${escapeHTML(
                    product.name
                )}
                        </h3>

                        <div class="product-price">
                            ${formatPrice(
                    product.price
                )}
                        </div>

                        <div class="product-location">
                            <i class="fas fa-location-dot"></i>
                            ${escapeHTML(
                    product.location
                )}
                        </div>

                        <div class="product-seller">
                            ${sellerTrigger(
                    product
                )}
                        </div>

                        <button
                            type="button"
                            class="btn btn-outline btn-full"
                            data-view-product="${escapeHTML(
                    product.id
                )}">
                            View Details
                        </button>

                    </div>

                </article>
            `;
        }).join("");

    updateWishlistButtons();
}


/* =========================================================
   PRODUCT DETAILS
   ========================================================= */

async function openProductDetails(productId) {

    let product =
        currentProducts.find(
            item =>
                String(item.id) ===
                String(productId)
        );

    if (!product) {

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("products")
                    .select("*")
                    .eq(
                        "id",
                        productId
                    )
                    .maybeSingle();

            if (error) {
                throw error;
            }

            product =
                normalizeProduct(data);

        } catch (error) {

            console.error(
                "Product details error:",
                error
            );

            showToast(
                "Could not open product",
                "error"
            );

            return;
        }
    }

    if (!product) {
        return;
    }

    currentProduct =
        product;

    const image =
        $("detailsImage");

    if (image) {

        image.src =
            product.image ||
            getPlaceholderImage(
                product.name
            );

        image.alt =
            product.name;
    }

    if ($("detailsCategory")) {
        $("detailsCategory")
            .textContent =
            product.category;
    }

    if ($("detailsCondition")) {
        $("detailsCondition")
            .textContent =
            product.condition;
    }

    if ($("detailsName")) {
        $("detailsName")
            .textContent =
            product.name;
    }

    if ($("detailsPrice")) {
        $("detailsPrice")
            .textContent =
            formatPrice(
                product.price
            );
    }

    if ($("detailsLocation")) {
        $("detailsLocation")
            .textContent =
            product.location;
    }

    if ($("detailsDescription")) {
        $("detailsDescription")
            .textContent =
            product.description ||
            "No description provided.";
    }

    if ($("detailsSeller")) {
        $("detailsSeller")
            .innerHTML =
            sellerTrigger(
                product
            );
    }

    if ($("detailsSellerAvatar")) {

        if (product.avatarUrl) {

            $("detailsSellerAvatar").innerHTML =
                `<img src="${escapeHTML(
                    product.avatarUrl
                )}" alt="">`;

        } else {

            $("detailsSellerAvatar")
                .textContent =
                getInitials(
                    product.seller
                );
        }
    }

    const profileButton =
        $("viewSellerProfileButton");

    if (profileButton) {

        if (product.userId) {

            profileButton.classList.remove(
                "hidden"
            );

            profileButton.disabled =
                false;

            // Bind directly to the current listing so the button
            // always opens the correct seller profile.
            profileButton.onclick = event => {
                event.preventDefault();
                event.stopPropagation();

                if (!currentProduct?.userId) {
                    return;
                }

                void openSellerProfile(
                    currentProduct.userId
                );
            };

        } else {

            profileButton.classList.add(
                "hidden"
            );

            profileButton.disabled =
                true;

            profileButton.onclick = null;
        }
    }

    const contactButton =
        $("contactSellerButton");

    if (contactButton) {

        const own =
            isMyProduct(product);

        const unavailable =
            !product.userId;

        contactButton.disabled =
            own || unavailable;

        contactButton.classList.toggle(
            "hidden",
            own
        );

        if (own) {

            contactButton.innerHTML =
                `<i class="fas fa-user"></i> Your Listing`;

        } else {

            contactButton.innerHTML =
                `<i class="fas fa-message"></i> Contact Seller`;
        }
    }

    openModal("productModal");

    // Product details is a dedicated full-screen experience.
    // Keep both floating navigation bars completely out of the way.
    document.body.classList.add("studentkart-product-details-open");
}

window.StudentKartOpenProductDetails = openProductDetails;

/* =========================================================
   SELLER PROFILE
   ========================================================= */

function ensureSellerProfileUI() {

    const existingModal = $("sellerProfileModal");

    // If the modal already exists (for example after SPA navigation or
    // an older cached DOM), repair the action row instead of returning.
    if (existingModal) {
        const actions = existingModal.querySelector(".seller-profile-actions");

        // Repair any previously rendered seller profile by removing the old contact action.
        existingModal.querySelector("#sellerProfileContactButton")?.remove();
        return;
    }

    const modal =
        document.createElement("div");

    modal.id =
        "sellerProfileModal";

    modal.className =
        "modal hidden";

    modal.innerHTML = `
        <div class="modal-overlay" data-close-modal></div>

        <div class="modal-content wide-modal seller-profile-modal">

            <button
                type="button"
                class="modal-close modal-back-button"
                data-close-modal
                aria-label="Back">
                <i class="fas fa-arrow-left"></i>
            </button>

            <div class="seller-profile-header">

                <div
                    id="sellerProfileAvatar"
                    class="seller-profile-avatar">
                    S
                </div>

                <div class="seller-profile-main">

                    <span class="section-label">
                        SELLER PROFILE
                    </span>

                    <h2 id="sellerProfileName">
                        Student
                    </h2>

                    <p id="sellerProfileCollege">
                        College
                    </p>

                </div>

            </div>

            <div class="seller-profile-stats">

                <div>
                    <strong
                        id="sellerProfileListingCount">
                        0
                    </strong>
                    <span>Listings</span>
                </div>

                <div>
                    <strong
                        id="sellerProfileMemberSince">
                        Recently
                    </strong>
                    <span>Member since</span>
                </div>

            </div>

            <div class="seller-profile-actions">
                <button type="button" class="btn btn-primary" id="sellerProfileChatButton">
                    <i class="fas fa-message"></i>
                    Chat with Seller
                </button>
            </div>

            <div class="seller-profile-listings-header">
                <h3>Listings by this seller</h3>
            </div>

            <div
                id="sellerProfileListings"
                class="seller-profile-listings">
            </div>

            <div class="seller-profile-safety">
                <div class="seller-profile-safety-title">
                    <i class="fas fa-shield-halved"></i>
                    <div>
                        <strong>Safety & Privacy</strong>
                        <span>Manage your interaction with this user</span>
                    </div>
                </div>
                <div class="seller-profile-safety-actions">
                    <button type="button" class="seller-profile-safety-button seller-profile-block-button" id="sellerProfileBlockButton">
                        <i class="fas fa-ban"></i>
                        <span>Block user</span>
                    </button>
                    <button type="button" class="seller-profile-safety-button seller-profile-report-button" id="sellerProfileReportButton">
                        <i class="fas fa-flag"></i>
                        <span>Report user</span>
                    </button>
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(modal);
}

async function getSellerProfileData(
    sellerId,
    fallbackProduct = null
) {

    if (!sellerId) {
        return null;
    }

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "id,name,username,phone,college,avatar_url,created_at"
                )
                .eq(
                    "id",
                    sellerId
                )
                .maybeSingle();

        if (!error && data) {
            return data;
        }

    } catch (error) {

        console.error(
            "Seller profile error:",
            error
        );
    }

    if (
        currentUser &&
        String(currentUser.id) ===
        String(sellerId)
    ) {

        const local =
            await getUserProfile();

        if (local) {
            return local;
        }
    }

    return {
        id: sellerId,
        name:
            fallbackProduct?.seller ||
            "Student",
        college:
            "",
        avatar_url:
            fallbackProduct?.avatarUrl ||
            "",
        created_at:
            fallbackProduct?.createdAt ||
            null
    };
}

async function openSellerProfile(
    sellerId
) {

    if (!sellerId) {
        return;
    }

    ensureSellerProfileUI();

    const fallback =
        currentProducts.find(
            product =>
                String(product.userId) ===
                String(sellerId)
        );

    currentSellerProfile =
        sellerId;



    const avatar =
        $("sellerProfileAvatar");

    const name =
        $("sellerProfileName");

    const college =
        $("sellerProfileCollege");

    const count =
        $("sellerProfileListingCount");

    const member =
        $("sellerProfileMemberSince");

    const listings =
        $("sellerProfileListings");

    const chatButton =
        $("sellerProfileChatButton");

    const contactButton =
        $("sellerProfileContactButton");

    const blockButton = $("sellerProfileBlockButton");
    const reportButton = $("sellerProfileReportButton");

    if (blockButton) {
        blockButton.onclick = async () => {
            if (!currentUser) {
                closeModal("sellerProfileModal");
                openModal("loginModal");
                showToast("Please login to block a user", "warning");
                return;
            }

            if (String(currentUser.id) === String(sellerId)) {
                showToast("You cannot block yourself", "warning");
                return;
            }

            const settings = getStudentKartSettings();
            const blockedUsers = Array.isArray(settings.privacy?.blockedUsers)
                ? settings.privacy.blockedUsers.map(String)
                : [];

            if (blockedUsers.includes(String(sellerId))) {
                showToast("User is already blocked", "info");
                return;
            }

            settings.privacy.blockedUsers = [...blockedUsers, String(sellerId)];
            blockButton.disabled = true;
            try {
                const saved = await saveStudentKartSettings(settings, true);
                if (!saved) return;
                closeModal("sellerProfileModal");
                showToast("User blocked", "success");
            } finally {
                blockButton.disabled = false;
            }
        };
    }

    if (reportButton) {
        reportButton.onclick = () => {
            const profileName = $("sellerProfileName")?.textContent?.trim() || "Student";
            const subject = encodeURIComponent("StudentKart User Report");
            const body = encodeURIComponent(
                "I want to report this StudentKart user.\n\n" +
                "User: " + profileName + "\n" +
                "User ID: " + sellerId + "\n\n" +
                "Reason:\n"
            );
            window.location.href =
                "mailto:rathodharish004@gmail.com?subject=" + subject + "&body=" + body;
        };
    }

    const startSellerChat = async () => {
        if (!currentUser) {
            closeModal("sellerProfileModal");
            openModal("loginModal");
            showToast("Please login to chat with the seller", "warning");
            return;
        }

        if (String(currentUser.id) === String(sellerId)) {
            showToast("You cannot chat with yourself", "warning");
            return;
        }

        // Seller profile chat must work even when no product inquiry exists yet.
        // Reuse/create the direct-chat inquiry container, then open the existing chat UI.
        await openStudentKartUserChat(sellerId);
    };

    if (chatButton) {
        chatButton.onclick = startSellerChat;
    }


    if (avatar) {
        avatar.textContent = "S";
    }

    if (name) {
        name.textContent =
            "Loading...";
    }

    if (college) {
        college.textContent =
            "Loading profile...";
    }

    if (count) {
        count.textContent =
            "0";
    }

    if (member) {
        member.textContent =
            "Recently";
    }

    if (listings) {

        listings.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading seller...</p>
            </div>
        `;
    }

    openModal(
        "sellerProfileModal"
    );

    const profile =
        await getSellerProfileData(
            sellerId,
            fallback
        );

    if (
        currentSellerProfile !==
        sellerId
    ) {
        return;
    }

    const sellerProducts =
        currentProducts.filter(
            product =>
                String(product.userId) ===
                String(sellerId)
        );

    if (avatar) {

        if (profile?.avatar_url) {

            avatar.innerHTML =
                `<img src="${escapeHTML(
                    profile.avatar_url
                )}" alt="">`;

        } else {

            avatar.textContent =
                getInitials(
                    profile?.name
                );
        }
    }

    if (name) {
        name.textContent =
            profile?.name ||
            fallback?.seller ||
            "Student";
    }

    if (college) {
        college.textContent =
            profile?.college ||
            "College not added";
    }

    if (count) {
        count.textContent =
            String(
                sellerProducts.length
            );
    }

    if (member) {
        member.textContent =
            profile?.created_at
                ? formatDate(
                    profile.created_at
                )
                : "Recently";
    }

    if (!listings) {
        return;
    }

    if (!sellerProducts.length) {

        listings.innerHTML = `
            <div class="notifications-empty">
                <i class="fas fa-box-open"></i>
                <h3>No listings yet</h3>
                <p>This seller has no active listings.</p>
            </div>
        `;

        return;
    }

    listings.innerHTML =
        sellerProducts
            .map(product => {

                const image =
                    product.image ||
                    getPlaceholderImage(
                        product.name
                    );

                return `
                    <article
                        class="product-card seller-listing-card"
                        data-seller-listing-id="${escapeHTML(
                    product.id
                )}">

                        <div class="product-image-wrap">

                            <img
                                class="product-image"
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(product.name)}"
                                onerror="this.src='${getPlaceholderImage("StudentKart")}'">

                        </div>

                        <div class="product-body">

                            <div class="product-meta">
                                <span>
                                    ${escapeHTML(
                    product.category
                )}
                                </span>
                            </div>

                            <h3>
                                ${escapeHTML(
                    product.name
                )}
                            </h3>

                            <div class="product-price">
                                ${formatPrice(
                    product.price
                )}
                            </div>

                            <div class="product-location">
                                <i class="fas fa-location-dot"></i>
                                ${escapeHTML(
                    product.location
                )}
                            </div>

                        </div>

                    </article>
                `;
            })
            .join("");
}


/* =========================================================
   INQUIRIES
   ========================================================= */

function contactSeller() {

    if (!currentUser) {

        openModal("loginModal");

        showToast(
            "Please login to contact the seller",
            "warning"
        );

        return;
    }

    if (!currentProduct) {
        return;
    }

    if (
        !currentProduct.userId ||
        isMyProduct(currentProduct)
    ) {
        return;
    }

    // Keep View Details mounted underneath the chat so the Home screen never flashes.
    // The Chat back button will return to this exact product details screen.
    window.studentKartReturnToProductDetails = currentProduct;

    // Open the existing WhatsApp-style direct chat with this seller.
    void openStudentKartUserChat(currentProduct.userId);
}

async function submitInquiry(event) {

    event.preventDefault();

    if (!currentUser) {

        showToast(
            "Please login first",
            "warning"
        );

        return;
    }

    if (
        !selectedInquiryProduct ||
        !selectedInquiryProduct.userId
    ) {

        showToast(
            "Seller information unavailable",
            "error"
        );

        return;
    }

    const message =
        $("inquiryMessage")
            ?.value
            ?.trim();

    if (!message) {

        showToast(
            "Please write a message",
            "warning"
        );

        return;
    }

    const submitButton =
        $("inquiryForm")
            ?.querySelector(
                'button[type="submit"]'
            );

    if (submitButton) {
        submitButton.disabled = true;
    }

    try {

        let inquiry = null;

        const {
            data: existingInquiry,
            error: existingInquiryError
        } =
            await supabaseClient
                .from("inquiries")
                .select("*")
                .eq("product_id", selectedInquiryProduct.id)
                .eq("buyer_id", currentUser.id)
                .eq("seller_id", selectedInquiryProduct.userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

        if (existingInquiryError) {
            throw existingInquiryError;
        }

        if (existingInquiry) {
            inquiry = existingInquiry;

            const { error: inquiryUpdateError } =
                await supabaseClient
                    .from("inquiries")
                    .update({
                        message,
                        status: "new"
                    })
                    .eq("id", existingInquiry.id);

            if (inquiryUpdateError) {
                throw inquiryUpdateError;
            }
        } else {
            const {
                data: newInquiry,
                error: inquiryInsertError
            } =
                await supabaseClient
                    .from("inquiries")
                    .insert({
                        product_id:
                            selectedInquiryProduct.id,

                        buyer_id:
                            currentUser.id,

                        seller_id:
                            selectedInquiryProduct.userId,

                        message,

                        status:
                            "new"
                    })
                    .select("*")
                    .single();

            if (inquiryInsertError) {
                throw inquiryInsertError;
            }

            inquiry = newInquiry;
        }

        const { error: messageError } =
            await supabaseClient
                .from("messages")
                .insert({
                    inquiry_id: inquiry.id,
                    sender_id: currentUser.id,
                    receiver_id: selectedInquiryProduct.userId,
                    message,
                    is_read: false
                });

        if (messageError) {
            throw messageError;
        }

        inquiry.product_name =
            selectedInquiryProduct.name || "Product Chat";

        closeModal("inquiryModal");

        await loadReceivedInquiries();
        await updateChatUnreadCount();
        await openChat(inquiry);

        showToast(
            "Inquiry sent — chat started",
            "success"
        );

    } catch (error) {

        console.error(
            "Inquiry error:",
            error
        );

        showToast(
            "Could not send inquiry",
            "error"
        );

    } finally {

        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

let inquiriesLoading = false;
let chatListOptimisticBusy = false;

async function loadReceivedInquiries() {

    if (!currentUser || inquiriesLoading || chatListOptimisticBusy) {
        return;
    }

    const container =
        $("inquiriesContainer");

    if (!container) {
        return;
    }

    // Keep the existing chat list visible while inquiry data refreshes in the background.
    inquiriesLoading = true;

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("inquiries")
                .select("*")
                .or(
                    `seller_id.eq.${currentUser.id},buyer_id.eq.${currentUser.id}`
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (error) {
            throw error;
        }

        let inquiries = data || [];

        // If the inquiry list is empty, rebuild the chat list from real messages.
        // This keeps the Chat button usable even when an old/hidden inquiry row
        // is missing while the messages themselves still exist.
        if (!inquiries.length) {
            const { data: messageRows, error: messageRowsError } = await supabaseClient
                .from("messages")
                .select("id,inquiry_id,sender_id,receiver_id,message,created_at,is_read")
                .or("sender_id.eq." + currentUser.id + ",receiver_id.eq." + currentUser.id)
                .order("created_at", { ascending: false })
                .limit(500);

            if (!messageRowsError && messageRows?.length) {
                const grouped = new Map();

                messageRows.forEach(row => {
                    const inquiryId = String(row.inquiry_id || "");
                    if (!inquiryId) return;

                    const otherId = String(row.sender_id) === String(currentUser.id)
                        ? row.receiver_id
                        : row.sender_id;

                    if (!grouped.has(inquiryId)) {
                        grouped.set(inquiryId, {
                            id: row.inquiry_id,
                            buyer_id: currentUser.id,
                            seller_id: otherId,
                            product_id: null,
                            created_at: row.created_at,
                            message: row.message || ""
                        });
                    }
                });

                const fallbackInquiries = Array.from(grouped.values());

                if (fallbackInquiries.length) {
                    inquiries = fallbackInquiries;
                }
            }
        }

        // Hidden-chat sync is optional. If the helper table is unavailable,
        // still show the user's real conversations instead of showing "No inquiries".
        const { data: hiddenChats, error: hiddenChatsError } =
            await supabaseClient
                .from("hidden_chats")
                .select("inquiry_id")
                .eq("user_id", currentUser.id);

        if (hiddenChatsError) {
            console.warn("Hidden chat filter unavailable; showing all conversations:", hiddenChatsError);
        }

        const hiddenInquiryIds = new Set(
            (hiddenChats || []).map(row => String(row.inquiry_id))
        );

        const visibleInquiries = inquiries.filter(
            inquiry => !hiddenInquiryIds.has(String(inquiry.id))
        );

        if (!visibleInquiries.length) {

            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-message"></i>
                    <h3>No inquiries yet</h3>
                    <p>Your buyer and seller conversations will appear here.</p>
                </div>
            `;

            return;
        }

        const productIds =
            [
                ...new Set(
                    visibleInquiries
                        .map(
                            inquiry =>
                                inquiry.product_id
                        )
                        .filter(Boolean)
                )
            ];

        let productsMap = {};

        if (productIds.length) {
            const {
                data: products
            } =
                await supabaseClient
                    .from("products")
                    .select("*")
                    .in("id", productIds);

            (products || [])
                .forEach(product => {
                    productsMap[
                        String(product.id)
                    ] =
                        normalizeProduct(
                            product
                        );
                });
        }

        const participantIds = [
            ...new Set(
                visibleInquiries
                    .flatMap(inquiry => [
                        inquiry.buyer_id,
                        inquiry.seller_id
                    ])
                    .filter(Boolean)
            )
        ];

        let profilesMap = {};

        if (participantIds.length) {
            const { data: profiles } =
                await supabaseClient
                    .from("profiles")
                    .select("id,name,username,phone,college,avatar_url")
                    .in("id", participantIds);

            (profiles || []).forEach(profile => {
                profilesMap[String(profile.id)] = profile;
            });
        }

        const inquiryIds = visibleInquiries.map(inquiry => inquiry.id);
        let latestMessages = {};
        let unreadCounts = {};

        if (inquiryIds.length) {
            const { data: messages } =
                await supabaseClient
                    .from("messages")
                    .select("inquiry_id,sender_id,receiver_id,message,created_at,is_read")
                    .in("inquiry_id", inquiryIds)
                    .order("created_at", { ascending: false });

            (messages || []).forEach(message => {
                if (!latestMessages[String(message.inquiry_id)]) {
                    latestMessages[String(message.inquiry_id)] = message;
                }

                // Only unread messages received by the current user
                // should contribute to the chat alert/count.
                if (
                    message.receiver_id === currentUser.id &&
                    message.is_read === false
                ) {
                    const key = String(message.inquiry_id);
                    unreadCounts[key] = (unreadCounts[key] || 0) + 1;
                }
            });
        }

        // WhatsApp-style ordering: the conversation with the newest
        // message is always shown at the top of the chat list.
        visibleInquiries.sort((a, b) => {
            const latestA =
                latestMessages[String(a.id)]?.created_at ||
                a.created_at ||
                "";
            const latestB =
                latestMessages[String(b.id)]?.created_at ||
                b.created_at ||
                "";

            return new Date(latestB).getTime() - new Date(latestA).getTime();
        });

        container.innerHTML =
            visibleInquiries.map(
                inquiry => {
                    const product =
                        productsMap[
                            String(
                                inquiry.product_id
                            )
                        ];

                    const otherUserId =
                        String(inquiry.buyer_id) === String(currentUser.id)
                            ? inquiry.seller_id
                            : inquiry.buyer_id;

                    const profile =
                        profilesMap[
                            String(otherUserId)
                        ];

                    const participantName =
                        profile?.username ||
                        profile?.name ||
                        (String(inquiry.buyer_id) === String(currentUser.id)
                            ? inquiry.seller_name
                            : inquiry.buyer_name) ||
                        "Student";

                    const participantRole =
                        String(inquiry.buyer_id) === String(currentUser.id)
                            ? "Seller"
                            : "Buyer";

                    const latest =
                        latestMessages[
                            String(inquiry.id)
                        ];

                    const preview =
                        latest?.message ||
                        inquiry.message ||
                        "Started a conversation";

                    const unread =
                        unreadCounts[
                            String(inquiry.id)
                        ] || 0;

                    const initials =
                        participantName
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map(name => name[0])
                            .join("")
                            .toUpperCase() || "S";

                    const timeText =
                        latest?.created_at ||
                        inquiry.created_at;

                    return `
                        <div
                            class="whatsapp-inquiry-card"
                            data-inquiry-id="${escapeHTML(inquiry.id)}"
                            data-chat-name="${escapeHTML([participantName, profile?.username || "", profile?.email || "", profile?.phone || ""].filter(Boolean).join(" "))}"
                            data-chat-preview="${escapeHTML(preview)}"
                            data-chat-unread="${unread > 0 ? "true" : "false"}"
                        >
                            <div class="chat-selection-indicator" aria-hidden="true"></div>
                            <div class="whatsapp-inquiry-avatar">
                                ${profile?.avatar_url
                                    ? `<img src="${escapeHTML(profile.avatar_url)}" alt="">`
                                    : escapeHTML(initials)}
                            </div>

                            <div class="whatsapp-inquiry-main">
                                <div class="whatsapp-inquiry-top">
                                    <strong>${escapeHTML(participantName)}</strong>
                                    <span class="whatsapp-inquiry-role">${escapeHTML(participantRole)}</span>
                                    <time>${escapeHTML(getRelativeDate(timeText))}</time>
                                </div>

                                <div class="whatsapp-inquiry-bottom">
                                    <div class="whatsapp-inquiry-preview">
                                        <span class="whatsapp-product-name">
                                            ${escapeHTML(product?.name || "Product")}
                                        </span>
                                        <span class="whatsapp-message-preview">
                                            ${escapeHTML(preview)}
                                        </span>
                                    </div>

                                    <div class="whatsapp-inquiry-meta">
                                        ${unread
                                            ? `<span class="whatsapp-unread">${unread > 99 ? "99+" : unread}</span>`
                                            : ""}
                                        <button
                                            type="button"
                                            class="whatsapp-chat-button"
                                            data-inquiry-action="chat"
                                            data-inquiry-id="${escapeHTML(inquiry.id)}"
                                            aria-label="Open chat with ${escapeHTML(participantName)}"
                                        >
                                            <i class="fas fa-message"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            ).join("");
        const filteredEmpty = document.createElement("div");
        filteredEmpty.id = "chatListFilteredEmpty";
        filteredEmpty.className = "chat-list-filtered-empty hidden";
        filteredEmpty.innerHTML = '<i class="fas fa-magnifying-glass"></i><strong>No chats found</strong><span>Try a different name or message.</span>';
        container.appendChild(filteredEmpty);
        setupChatListControls();
        bindChatLongPress();
        updateChatSelectionUI();
        applyChatListFilter();
    } catch (error) {

        console.error(
            "Inquiry loading error:",
            error
        );

        // Only show an error state when there is no existing chat list to preserve.
        if (!container.children.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-triangle-exclamation"></i>
                    <h3>Could not load inquiries</h3>
                    <p>Please try again.</p>
                </div>
            `;
        }
    } finally {
        inquiriesLoading = false;
    }
}

let chatSelectionMode = false;
const selectedChatIds = new Set();
let chatHoldTimer = null;
let chatHoldTriggered = false;

function updateChatSelectionUI() {
    const cancelButton = $("cancelChatSelectionButton");
    if (cancelButton) {
        cancelButton.classList.toggle(
            "hidden",
            !chatSelectionMode
        );
    }
    const container = $("inquiriesContainer");
    if (!container) return;
    container.classList.toggle("chat-selection-mode", chatSelectionMode);
    container.querySelectorAll(".whatsapp-inquiry-card").forEach(card => {
        card.classList.toggle("is-selected", selectedChatIds.has(String(card.dataset.inquiryId)));
        const indicator = card.querySelector(".chat-selection-indicator");
        if (indicator) indicator.textContent = selectedChatIds.has(String(card.dataset.inquiryId)) ? "✓" : "";
    });
    const count = $("selectedInquiryCount");
    if (count) {
        count.textContent = selectedChatIds.size + " selected";
        count.classList.toggle("hidden", !chatSelectionMode || selectedChatIds.size === 0);
    }
    document.querySelectorAll(".bulk-action-button").forEach(btn => {
        btn.classList.toggle("hidden", !chatSelectionMode || selectedChatIds.size === 0);
    });

    const selectedCards = Array.from(
        document.querySelectorAll(".whatsapp-inquiry-card")
    ).filter(card =>
        selectedChatIds.has(String(card.dataset.inquiryId))
    );

    const hasUnreadSelected = selectedCards.some(
        card => card.dataset.chatUnread === "true"
    );

    const markReadButton = $("bulkMarkReadButton");
    const markUnreadButton = $("bulkMarkUnreadButton");

    if (markReadButton) {
        markReadButton.classList.toggle(
            "hidden",
            !chatSelectionMode ||
            selectedChatIds.size === 0 ||
            !hasUnreadSelected
        );
    }

    if (markUnreadButton) {
        markUnreadButton.classList.toggle(
            "hidden",
            !chatSelectionMode ||
            selectedChatIds.size === 0 ||
            hasUnreadSelected
        );
    }
}

function exitChatSelectionMode() {
    chatSelectionMode = false;
    selectedChatIds.clear();
    updateChatSelectionUI();
}

function toggleChatSelection(id) {
    const key = String(id);
    if (selectedChatIds.has(key)) selectedChatIds.delete(key);
    else selectedChatIds.add(key);
    if (!selectedChatIds.size) chatSelectionMode = false;
    updateChatSelectionUI();
}

function enterChatSelectionMode(id) {
    chatSelectionMode = true;
    selectedChatIds.add(String(id));
    updateChatSelectionUI();
}

function bindChatLongPress() {
    const container = $("inquiriesContainer");
    if (!container || container.dataset.longPressBound) return;
    container.dataset.longPressBound = "true";

    const startHold = (event) => {
        const card = event.target.closest(".whatsapp-inquiry-card");
        if (!card) return;
        chatHoldTriggered = false;
        clearTimeout(chatHoldTimer);
        chatHoldTimer = setTimeout(() => {
            chatHoldTriggered = true;
            enterChatSelectionMode(card.dataset.inquiryId);
            if (navigator.vibrate) navigator.vibrate(35);
        }, 550);
    };
    const cancelHold = () => clearTimeout(chatHoldTimer);

    container.addEventListener("pointerdown", startHold);
    container.addEventListener("pointerup", cancelHold);
    container.addEventListener("pointercancel", cancelHold);
    container.addEventListener("pointerleave", cancelHold);

    container.addEventListener("click", (event) => {
        const card = event.target.closest(".whatsapp-inquiry-card");
        if (!card) return;
        if (chatHoldTriggered) {
            chatHoldTriggered = false;
            return;
        }
        if (chatSelectionMode) {
            event.preventDefault();
            toggleChatSelection(card.dataset.inquiryId);
            return;
        }
        const chatButton = event.target.closest(".whatsapp-chat-button");
        if (chatButton) return;
        card.querySelector(".whatsapp-chat-button")?.click();
    });

    container.addEventListener("contextmenu", (event) => {
        const card = event.target.closest(".whatsapp-inquiry-card");
        if (!card) return;
        event.preventDefault();
        enterChatSelectionMode(card.dataset.inquiryId);
    });
}

async function openStudentKartUserChat(userId) {
    if (!currentUser || !userId || String(userId) === String(currentUser.id)) return;

    try {
        // Reuse an existing conversation between these two students when possible.
        const pairFilter =
            "and(buyer_id.eq." + currentUser.id + ",seller_id.eq." + userId + ")," +
            "and(buyer_id.eq." + userId + ",seller_id.eq." + currentUser.id + ")";

        const { data: existingInquiries, error: lookupError } = await supabaseClient
            .from("inquiries")
            .select("*")
            .or(pairFilter)
            .order("created_at", { ascending: false })
            .limit(1);

        if (lookupError) throw lookupError;

        let inquiry = existingInquiries?.[0] || null;

        if (!inquiry) {
            // Direct chats use a null product_id. The inquiry row is only the
            // conversation container; actual messages live in messages.
            const { data: createdInquiry, error: createError } = await supabaseClient
                .from("inquiries")
                .insert({
                    product_id: null,
                    buyer_id: currentUser.id,
                    seller_id: userId,
                    message: "Direct chat",
                    status: "new"
                })
                .select("*")
                .single();

            if (createError) throw createError;
            inquiry = createdInquiry;
        }

        inquiry.product_name = "Direct Chat";
        inquiry.direct_user_name = "";

        const otherId =
            String(inquiry.seller_id) === String(currentUser.id)
                ? inquiry.buyer_id
                : inquiry.seller_id;

        const { data: otherProfile } = await supabaseClient
            .from("profiles")
            .select("id,name,username,avatar_url")
            .eq("id", otherId)
            .maybeSingle();

        inquiry.direct_user_name =
            otherProfile?.username ||
            otherProfile?.name ||
            "Student";

        await openChat(inquiry);

    } catch (error) {
        console.error("Open user chat error:", error);
        showToast(
            error?.message || "Could not open chat with this student",
            "error"
        );
    }
}

function applyChatListFilter() {
    const container = $("inquiriesContainer");
    if (!container) return;

    const activeTab =
        document.querySelector(".chat-list-tab.active")?.dataset.chatFilter || "all";

    const cards = container.querySelectorAll(".whatsapp-inquiry-card");
    let visible = 0;

    cards.forEach(card => {
        const matchesTab =
            activeTab !== "unread" ||
            card.dataset.chatUnread === "true";

        card.classList.toggle("chat-filter-hidden", !matchesTab);

        if (matchesTab) visible++;
    });

    const empty = $("chatListFilteredEmpty");
    if (empty) {
        empty.classList.toggle(
            "hidden",
            visible > 0 || !cards.length
        );
    }
}

let newChatSearchTimer = null;
let newChatSearchRequest = 0;

function clearNewChatUserSearch() {
    const input = $("newChatSearchInput");
    const results = $("newChatSearchResults");
    const clear = $("newChatSearchClear");

    if (input) input.value = "";
    if (clear) clear.classList.add("hidden");
    if (results) {
        results.innerHTML = "";
        results.classList.add("hidden");
    }
}

function renderNewChatUserSearchResults(users) {
    const results = $("newChatSearchResults");
    if (!results) return;

    if (!users?.length) {
        results.innerHTML = '<div class="chat-search-state">No registered user found for this number.</div>';
        results.classList.remove("hidden");
        return;
    }

    results.innerHTML = users.map(user => {
        const name = escapeHTML(user.name || "Student");
        const username = escapeHTML(user.username || "");
        const location = escapeHTML([user.area, user.city].filter(Boolean).join(", "));
        const initials = escapeHTML(getInitials(user.name || user.username || "Student"));
        const avatar = user.avatar_url
            ? '<img src="' + escapeHTML(user.avatar_url) + '" alt="">'
            : initials;

        return `
            <button type="button"
                class="chat-search-result"
                data-chat-search-user-id="${escapeHTML(user.id)}"
                role="option">
                <span class="chat-search-result-avatar">${avatar}</span>
                <span class="chat-search-result-info">
                    <span class="chat-search-result-name">${name}</span>
                    <span class="chat-search-result-number">${username}</span>
                    ${location ? '<span class="chat-search-result-location">' + location + '</span>' : ''}
                </span>
                <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
        `;
    }).join("");

    results.classList.remove("hidden");
}

async function searchNewChatUsersByPhone(query) {
    const digits = String(query || "").replace(/\D/g, "");
    const results = $("newChatSearchResults");
    const requestId = ++newChatSearchRequest;
    if (!results) return;

    results.innerHTML = '<div class="chat-search-state"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    results.classList.remove("hidden");

    try {
        let users = [];
        const rpc = await supabaseClient.rpc("search_chat_users_by_phone", {
            search_query: digits
        });

        if (!rpc.error && Array.isArray(rpc.data)) {
            users = rpc.data;
        } else {
            const fallback = await supabaseClient
                .from("profiles")
                .select("id,name,username,phone,avatar_url,city,area")
                .limit(200);
            if (fallback.error) throw fallback.error;

            const normalize = value => String(value || "").replace(/\D/g, "");
            users = (fallback.data || [])
                .filter(p => String(p.id) !== String(currentUser?.id))
                .filter(p => !digits ||
                    normalize(p.phone).includes(digits) ||
                    normalize(p.username).includes(digits))
                .slice(0, 10);
        }

        if (requestId !== newChatSearchRequest) return;
        renderNewChatUserSearchResults(users.slice(0, 10));
    } catch (error) {
        if (requestId !== newChatSearchRequest) return;
        console.error("New chat phone search error:", error);
        results.innerHTML = '<div class="chat-search-state">Could not search registered numbers. Please try again.</div>';
        results.classList.remove("hidden");
    }
}
function setupNewChatPhoneSearch() {
    const input = $("newChatSearchInput");
    const clear = $("newChatSearchClear");
    const results = $("newChatSearchResults");

    if (!input || input.dataset.bound === "true") return;
    input.dataset.bound = "true";

    input.addEventListener("input", () => {
        const value = input.value.trim();
        clear?.classList.toggle("hidden", !value);

        clearTimeout(newChatSearchTimer);
        newChatSearchTimer = setTimeout(() => {
            void searchNewChatUsersByPhone(value);
        }, 180);
    });

    input.addEventListener("focus", () => {
        clear?.classList.toggle("hidden", Boolean(input.value.trim()));
        clearTimeout(newChatSearchTimer);
        newChatSearchTimer = setTimeout(() => {
            void searchNewChatUsersByPhone(input.value.trim());
        }, 80);
    });

    input.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            clearNewChatUserSearch();
            input.blur();
        }
    });

    clear?.addEventListener("click", () => {
        clearTimeout(newChatSearchTimer);
        ++newChatSearchRequest;
        clearNewChatUserSearch();
        input.focus();
    });

    results?.addEventListener("click", async event => {
        const button = event.target.closest("[data-chat-search-user-id]");
        if (!button || !currentUser) return;

        const userId = button.dataset.chatSearchUserId;
        clearTimeout(newChatSearchTimer);
        ++newChatSearchRequest;
        results.classList.add("hidden");

        await openStudentKartUserChat(userId);
    });
}

function setupChatListControls() {
    document.querySelectorAll(".chat-list-tab").forEach(tab => {
        if (tab.dataset.bound) return;

        tab.dataset.bound = "true";

        tab.addEventListener("click", () => {
            document.querySelectorAll(".chat-list-tab").forEach(item => {
                const active = item === tab;
                item.classList.toggle("active", active);
                item.setAttribute(
                    "aria-selected",
                    active ? "true" : "false"
                );
            });

            applyChatListFilter();
        });
    });

    const refresh = $("chatListRefreshButton");

    if (refresh && !refresh.dataset.bound) {
        refresh.dataset.bound = "true";

        refresh.addEventListener("click", async () => {
            refresh.classList.add("is-loading");

            try {
                await loadReceivedInquiries();
            } finally {
                refresh.classList.remove("is-loading");
            }
        });
    }

    const close = $("chatListCloseButton");

    if (close && !close.dataset.bound) {
        close.dataset.bound = "true";
        close.addEventListener(
            "click",
            () => closeModal("inquiriesModal")
        );
    }

    applyChatListFilter();
    setupNewChatPhoneSearch();
}

async function getInquiryForChat(inquiryId) {

    if (!currentUser || !inquiryId) {
        return null;
    }

    try {
        const { data, error } =
            await supabaseClient
                .from("inquiries")
                .select("*")
                .eq("id", inquiryId)
                .maybeSingle();

        if (error) {
            throw error;
        }

        return data || null;

    } catch (error) {
        console.error(
            "Get inquiry for chat error:",
            error
        );

        showToast(
            "Could not open chat",
            "error"
        );

        return null;
    }
}


async function updateInquiryStatus(
    inquiryId,
    status
) {

    if (!currentUser || !inquiryId) {
        return;
    }

    try {

        const {
            error
        } =
            await supabaseClient
                .from("inquiries")
                .update({
                    status
                })
                .eq(
                    "id",
                    inquiryId
                )
                .eq(
                    "seller_id",
                    currentUser.id
                );

        if (error) {
            throw error;
        }

        await loadReceivedInquiries();

        await loadNotifications();

        showToast(
            "Inquiry status updated",
            "success"
        );

    } catch (error) {

        console.error(
            "Inquiry status error:",
            error
        );

        showToast(
            "Could not update inquiry",
            "error"
        );
    }
}


/* =========================================================
   IMAGE UPLOAD
   ========================================================= */

async function uploadProductImage(
    file
) {

    if (!file) {
        return null;
    }

    if (!currentUser) {
        throw new Error(
            "You must be logged in."
        );
    }

    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();

    const path =
        `${currentUser.id}/` +
        `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${extension}`;

    const {
        error
    } =
        await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(
                path,
                file,
                {
                    upsert: false,
                    contentType:
                        file.type
                }
            );

    if (error) {
        throw error;
    }

    const {
        data
    } =
        supabaseClient.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(path);

    return data?.publicUrl || null;
}

function getStoragePathFromPublicUrl(
    publicUrl
) {

    if (!publicUrl) {
        return null;
    }

    const marker =
        `/storage/v1/object/public/${STORAGE_BUCKET}/`;

    const index =
        publicUrl.indexOf(marker);

    if (index === -1) {
        return null;
    }

    return decodeURIComponent(
        publicUrl.slice(
            index + marker.length
        )
    );
}

async function deleteStorageImage(
    publicUrl
) {

    const path =
        getStoragePathFromPublicUrl(
            publicUrl
        );

    if (!path) {
        return;
    }

    try {

        await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .remove([path]);

    } catch (error) {

        console.error(
            "Storage delete error:",
            error
        );
    }
}

function handleImagePreview(event) {

    const file =
        event.target.files?.[0];

    const preview =
        $("imagePreview");

    if (!preview) {
        return;
    }

    if (!file) {

        preview.innerHTML = "";

        return;
    }

    const url =
        URL.createObjectURL(file);

    preview.innerHTML = `
        <img
            src="${url}"
            alt="Image preview">
    `;
}


/* =========================================================
   SELL / EDIT PRODUCT
   ========================================================= */

function openSellModal() {

    if (!currentUser) {

        openModal("loginModal");

        showToast(
            "Please login to sell an item",
            "warning"
        );

        return;
    }

    editingProductId = null;

    const form =
        $("sellForm");

    form?.reset();

    if ($("sellModalTitle")) {
        $("sellModalTitle")
            .textContent =
            "Sell an Item";
    }

    if ($("sellSubmitText")) {
        $("sellSubmitText")
            .textContent =
            "Publish Listing";
    }

    if ($("imagePreview")) {
        $("imagePreview")
            .innerHTML = "";
    }

    openModal("sellModal");
}

async function openEditProduct(
    productId
) {

    if (!currentUser) {
        openModal("loginModal");
        return;
    }

    let product =
        currentProducts.find(
            item =>
                String(item.id) ===
                String(productId)
        );

    // My Listings can contain a freshly loaded product that is not
    // present in the marketplace's currentProducts array. Fetch it
    // directly so Edit always opens the correct listing.
    if (!product) {
        const {
            data,
            error
        } =
            await supabaseClient
                .from("products")
                .select("*")
                .eq("id", productId)
                .eq("user_id", currentUser.id)
                .maybeSingle();

        if (error) {
            console.error(
                "Edit listing fetch error:",
                error
            );

            showToast(
                "Could not open listing",
                "error"
            );

            return;
        }

        product =
            data
                ? normalizeProduct(data)
                : null;
    }

    if (!product) {
        showToast(
            "Listing not found",
            "error"
        );
        return;
    }

    if (!isMyProduct(product)) {

        showToast(
            "You can only edit your own listing",
            "error"
        );

        return;
    }

    // Keep the locally loaded product in sync for image cleanup
    // and the rest of the listing flow.
    const existingIndex =
        currentProducts.findIndex(
            item =>
                String(item.id) ===
                String(product.id)
        );

    if (existingIndex >= 0) {
        currentProducts[existingIndex] =
            product;
    } else {
        currentProducts.push(product);
    }

    editingProductId =
        product.id;

    if ($("sellModalTitle")) {
        $("sellModalTitle")
            .textContent =
            "Edit Listing";
    }

    if ($("sellSubmitText")) {
        $("sellSubmitText")
            .textContent =
            "Update Listing";
    }

    if ($("productName")) {
        $("productName").value =
            product.name;
    }

    if ($("productCategory")) {
        $("productCategory").value =
            product.category;
    }

    if ($("productPrice")) {
        $("productPrice").value =
            product.price;
    }

    if ($("productLocation")) {
        $("productLocation").value =
            product.location;
    }

    if ($("productCondition")) {
        $("productCondition").value =
            product.condition;
    }

    if ($("productDescription")) {
        $("productDescription").value =
            product.description;
    }

    if ($("imagePreview")) {

        $("imagePreview").innerHTML =
            product.image
                ? `<img src="${escapeHTML(
                    product.image
                )}" alt="">`
                : "";
    }

    openModal("sellModal");
}

async function submitProduct(event) {

    event.preventDefault();

    if (!currentUser) {

        showToast(
            "Please login first",
            "warning"
        );

        return;
    }

    const name =
        $("productName")
            ?.value
            ?.trim();

    const category =
        $("productCategory")
            ?.value;

    const price =
        Number(
            $("productPrice")
                ?.value
        );

    const location =
        $("productLocation")
            ?.value
            ?.trim();

    const condition =
        $("productCondition")
            ?.value;

    const description =
        $("productDescription")
            ?.value
            ?.trim();

    const file =
        $("productImage")
            ?.files?.[0];

    if (
        !name ||
        !category ||
        !price ||
        !location ||
        !condition
    ) {

        showToast(
            "Please fill all required fields",
            "warning"
        );

        return;
    }

    const submitButton =
        $("sellForm")
            ?.querySelector(
                'button[type="submit"]'
            );

    if (submitButton) {
        submitButton.disabled = true;
    }

    let uploadedImage = null;

    try {

        const profile =
            await getUserProfile();

        if (file) {

            uploadedImage =
                await uploadProductImage(
                    file
                );
        }

        if (editingProductId) {

            const oldProduct =
                currentProducts.find(
                    item =>
                        String(item.id) ===
                        String(
                            editingProductId
                        )
                );

            const updateData = {
                name,
                category,
                price,
                location,
                condition,
                description,
                seller:
                    profile?.name ||
                    currentUser
                        .email
                        ?.split("@")[0] ||
                    "Student",
                seller_email:
                    currentUser.email ||
                    "",
                user_id:
                    currentUser.id,
                updated_at:
                    new Date().toISOString()
            };

            if (uploadedImage) {

                updateData.image =
                    uploadedImage;
            }

            const {
                error
            } =
                await supabaseClient
                    .from("products")
                    .update(
                        updateData
                    )
                    .eq(
                        "id",
                        editingProductId
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    );

            if (error) {
                throw error;
            }

            if (
                uploadedImage &&
                oldProduct?.image
            ) {

                await deleteStorageImage(
                    oldProduct.image
                );
            }

            showToast(
                "Listing updated successfully",
                "success"
            );

        } else {

            const {
                error
            } =
                await supabaseClient
                    .from("products")
                    .insert({
                        name,
                        category,
                        price,
                        location,
                        condition,
                        description,
                        image:
                            uploadedImage ||
                            getPlaceholderImage(
                                name
                            ),
                        seller:
                            profile?.name ||
                            currentUser
                                .email
                                ?.split("@")[0] ||
                            "Student",
                        seller_email:
                            currentUser.email ||
                            "",
                        user_id:
                            currentUser.id
                    });

            if (error) {
                throw error;
            }

            showToast(
                "Listing published successfully",
                "success"
            );
        }

        editingProductId = null;

        closeModal(
            "sellModal"
        );

        await loadProducts();

    } catch (error) {

        console.error(
            "Product submit error:",
            error
        );

        if (uploadedImage) {
            await deleteStorageImage(
                uploadedImage
            );
        }

        showToast(
            error?.message ||
            "Could not save listing",
            "error"
        );

    } finally {

        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

async function deleteProduct(
    productId
) {

    if (!currentUser) {
        return;
    }

    const product =
        currentProducts.find(
            item =>
                String(item.id) ===
                String(productId)
        );

    if (!product) {
        return;
    }

    if (!isMyProduct(product)) {

        showToast(
            "You can only delete your own listing",
            "error"
        );

        return;
    }

    const confirmed =
        window.confirm(
            "Delete this listing?"
        );

    if (!confirmed) {
        return;
    }

    try {

        const {
            error
        } =
            await supabaseClient
                .from("products")
                .delete()
                .eq(
                    "id",
                    productId
                )
                .eq(
                    "user_id",
                    currentUser.id
                );

        if (error) {
            throw error;
        }

        if (product.image) {
            await deleteStorageImage(
                product.image
            );
        }

        showToast(
            "Listing deleted",
            "success"
        );

        await loadProducts();

        await loadMyListings();

    } catch (error) {

        console.error(
            "Delete product error:",
            error
        );

        showToast(
            "Could not delete listing",
            "error"
        );
    }
}


/* =========================================================
   LOGIN / SIGNUP / LOGOUT
   ========================================================= */

function normalizeAuthPhone(raw) {
    let digits = String(raw || "").replace(/\D/g, "");

    // Accept both a plain Indian 10-digit number and an already-normalized +91 number.
    if (digits.startsWith("91") && digits.length === 12) {
        digits = digits.slice(2);
    }

    if (digits.length !== 10) return null;
    return "+91" + digits;
}

function getAuthPhoneFromUser(user = currentUser) {
    return normalizeAuthPhone(
        user?.phone ||
        user?.user_metadata?.phone ||
        getSavedProfile()?.phone ||
        ""
    );
}

// Supabase's hosted Phone provider can require an SMS provider in the dashboard.
// GlobeDisc does not use OTP: the user enters only a mobile number + 6-digit PIN.
// We therefore use a private deterministic email-shaped Auth identifier behind
// the scenes while keeping the real mobile number in profile metadata/database.
// The user never sees or enters this internal identifier.
function getInternalAuthEmail(phone) {
    const normalized = normalizeAuthPhone(phone);
    if (!normalized) return null;
    const digits = normalized.replace(/\D/g, "");
    return `${digits}@auth.globedisc.local`;
}

function isSixDigitPassword(value) { return /^\d{6}$/.test(String(value || "")); }

(function setupAuthPinInputs() {
    const apply = () => {
        ["loginIdentifier","loginPassword","signupIdentifier","signupPassword","signupPasswordConfirm","editProfileNewPassword","editProfileConfirmPassword"].forEach(id => {
            const el = document.getElementById(id);
            if (!el || el.dataset.pinGuardReady === "1") return;
            el.dataset.pinGuardReady = "1";
            el.addEventListener("input", () => {
                el.value = el.value.replace(/\D/g, "").slice(0, el.id.includes("Identifier") ? 10 : 6);
            });
        });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
    else apply();
})();

async function loginUser(event) {
    event.preventDefault();

    const phone = normalizeAuthPhone($("loginIdentifier")?.value);
    const password = $("loginPassword")?.value || "";
    const internalEmail = getInternalAuthEmail(phone);

    if (!phone) {
        showToast("Enter a valid 10-digit mobile number", "warning");
        return;
    }

    if (!internalEmail) {
        showToast("Could not prepare login", "error");
        return;
    }

    if (!isSixDigitPassword(password)) {
        showToast("Password must be exactly 6 digits", "warning");
        return;
    }

    const button = $("loginForm")?.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: internalEmail,
            password
        });

        if (error) throw error;

        closeModal("loginModal");
        localStorage.removeItem(STUDENTKART_GUEST_MODE_KEY);
        updateNavbar();
        showToast("Logged in successfully", "success");
    } catch (error) {
        console.error("Login error:", error);
        showToast(
            error?.message || "Could not login. Check your mobile number and password.",
            "error"
        );
    } finally {
        if (button) button.disabled = false;
    }
}

async function signupUser(event) {
    event.preventDefault();

    const phone = normalizeAuthPhone($("signupIdentifier")?.value);
    const password = $("signupPassword")?.value || "";
    const confirmPassword = $("signupPasswordConfirm")?.value || "";
    const internalEmail = getInternalAuthEmail(phone);

    if (!phone) {
        showToast("Enter a valid 10-digit mobile number", "warning");
        return;
    }

    if (!internalEmail) {
        showToast("Could not prepare account", "error");
        return;
    }

    if (!isSixDigitPassword(password) || !isSixDigitPassword(confirmPassword)) {
        showToast("Password must be exactly 6 digits", "warning");
        return;
    }

    if (password !== confirmPassword) {
        showToast("Passwords do not match", "warning");
        return;
    }

    const button = $("signupForm")?.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: internalEmail,
            password,
            options: {
                data: {
                    phone,
                    auth_phone: phone
                }
            }
        });

        if (error) throw error;

        // Email confirmation must be disabled in Supabase Auth settings for
        // this no-OTP/no-email flow. If a session is returned, finish setup.
        if (data?.user && data?.session) {
            await ensureProfileAfterPasswordSignup(data.user);
        }

        closeModal("signupModal");
        localStorage.removeItem(STUDENTKART_GUEST_MODE_KEY);
        updateNavbar();

        showToast(
            data?.session
                ? "Account created successfully"
                : "Account created. Disable email confirmation in Supabase, then login.",
            data?.session ? "success" : "warning"
        );
    } catch (error) {
        console.error("Signup error:", error);
        showToast(error?.message || "Could not create account", "error");
    } finally {
        if (button) button.disabled = false;
    }
}

async function ensureProfileAfterPasswordSignup(user) {
    if (!user) return;

    try {
        const { data: existingProfile, error: fetchError } =
            await supabaseClient
                .from("profiles")
                .select("id")
                .eq("id", user.id)
                .maybeSingle();

        if (fetchError) {
            console.error("Profile lookup error:", fetchError);
            return;
        }

        if (existingProfile) return;

        const metadata = user.user_metadata || {};

        const profile = {
            id: user.id,
            name: metadata.name || user.phone || "Student",
            username: user.phone || metadata.phone || "",
            college: metadata.college || "",
            state: metadata.state || "",
            city: metadata.city || "",
            area: metadata.area || "",
            email: user.email || "",
            phone: user.phone || metadata.phone || "",
            avatar_url: ""
        };

        const { error: profileError } =
            await supabaseClient.from("profiles").insert(profile);

        if (profileError) {
            console.error("Profile creation error:", profileError);
            return;
        }

        saveProfile(profile);
    } catch (error) {
        console.error("Ensure profile error:", error);
    }
}

function openLogoutConfirmation() {
    if (!currentUser) return;
    openModal("logoutConfirmModal");
}

async function logoutUser() {

    closeModal("logoutConfirmModal");
    stopNotificationRefresh();

    try {

        await supabaseClient.auth.signOut();

        localStorage.removeItem(STUDENTKART_GUEST_MODE_KEY);
        currentUser = null;
        currentNotifications = [];

        updateNavbar();
        updateNotificationNavbar();

        closeAllModals();

        // After logout, return the user to the same Welcome / Login / Sign Up / Guest gate.
        showNewUserGate();

        showToast(
            "Logged out successfully",
            "success"
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        showToast(
            "Could not logout",
            "error"
        );
    }
}


/* =========================================================
   PROFILE
   ========================================================= */

async function openProfile() {

    if (!currentUser) {

        openModal("loginModal");

        return;
    }

    await updateProfileUI();

    openModal("profileModal");
}

async function updateProfileUI() {

    const profile =
        await getUserProfile();

    if (!profile) {
        return;
    }

    if ($("profileName")) {

        $("profileName")
            .textContent =
            profile.name ||
            "Student";
    }

    if ($("profileCollege")) {

        $("profileCollege")
            .textContent =
            profile.college ||
            "College not added";
    }

    if ($("profileUsernameInfo")) {
        $("profileUsernameInfo").textContent = profile.username || "Not added";
    }

    if ($("profileCollegeInfo")) {

        $("profileCollegeInfo")
            .textContent =
            profile.college ||
            "Not added";
    }

    if ($("profilePhoneInfo")) {
        $("profilePhoneInfo").textContent = getStudentKartSettings().privacy.hidePhone
            ? "Hidden"
            : (profile.phone || currentUser.phone || "Not added");
    }

    if ($("profileAvatar")) {

        if (profile.avatar_url) {

            $("profileAvatar").innerHTML =
                `<img src="${escapeHTML(
                    profile.avatar_url
                )}" alt="">`;

        } else {

            $("profileAvatar")
                .textContent =
                getInitials(
                    profile.name
                );
        }
    }
}

function openEditProfile() {

    if (!currentUser) {
        return;
    }

    const profile =
        getSavedProfile();

    if ($("editProfileName")) {

        $("editProfileName").value =
            profile?.name ||
            currentUser
                .user_metadata
                ?.name ||
            "";
    }

    if ($("editProfileUsername")) {
        $("editProfileUsername").value = getAuthPhoneFromUser(currentUser) || profile?.username || "";
        $("editProfileUsername").readOnly = true;
        $("editProfileUsername").setAttribute("aria-readonly", "true");
    }
    if ($("editProfilePhone")) {
        $("editProfilePhone").value = profile?.phone || currentUser.phone || currentUser.user_metadata?.phone || "";
    }

    if ($("editProfileCollege")) {

        $("editProfileCollege").value =
            profile?.college ||
            currentUser
                .user_metadata
                ?.college ||
            "";

        $("editProfileState") && ($("editProfileState").value = profile?.state || currentUser.user_metadata?.state || "");
        $("editProfileCity") && ($("editProfileCity").value = profile?.city || currentUser.user_metadata?.city || "");
        $("editProfileArea") && ($("editProfileArea").value = profile?.area || currentUser.user_metadata?.area || "");
    }

    if ($("editAvatarPreview")) {

        $("editAvatarPreview").innerHTML =
            profile?.avatar_url
                ? `<img src="${escapeHTML(
                    profile.avatar_url
                )}" alt="">`
                : getInitials(
                    profile?.name
                );
    }

    openModal(
        "editProfileModal"
    );
}

function handleProfileImagePreview(
    event
) {

    const file =
        event.target.files?.[0];

    const preview =
        $("editAvatarPreview");

    if (!preview) {
        return;
    }

    if (!file) {
        return;
    }

    const url =
        URL.createObjectURL(file);

    preview.innerHTML =
        `<img src="${url}" alt="">`;
}

async function saveEditedProfile(
    event
) {

    event.preventDefault();

    if (!currentUser) {
        return;
    }

    const name = $("editProfileName")?.value?.trim();
    const phone = getAuthPhoneFromUser(currentUser) || "";
    const username = phone;
    const newPassword = $("editProfileNewPassword")?.value || "";
    const confirmPassword = $("editProfileConfirmPassword")?.value || "";
    const college = $("editProfileCollege")?.value?.trim();
    const state = $("editProfileState")?.value?.trim() || "";
    const city = $("editProfileCity")?.value?.trim() || "";
    const area = $("editProfileArea")?.value?.trim() || "";

    if (!name) {
        showToast("Name is required", "warning");
        return;
    }

    if (newPassword || confirmPassword) {
        if (!isSixDigitPassword(newPassword) || !isSixDigitPassword(confirmPassword)) {
            showToast("New password must be exactly 6 digits", "warning");
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast("New passwords do not match", "warning");
            return;
        }
    }

    const file = $("editProfileImage")?.files?.[0];

    // Optimistic UI: close immediately and show the new photo/name locally.
    // The Supabase upload/database sync continues in the background so the
    // user does not have to wait 2-3 seconds for the modal to close.
    const savedProfile = getSavedProfile() || {};
    const oldAvatarUrl = savedProfile.avatar_url || currentUser.user_metadata?.avatar_url || "";
    const previewAvatarUrl = file
        ? URL.createObjectURL(file)
        : oldAvatarUrl;

    const optimisticProfile = {
        ...savedProfile,
        id: currentUser.id,
        name,
        username,
        phone: getAuthPhoneFromUser(currentUser) || "",
        college,
        state,
        city,
        area,
        email: currentUser.email || "",
        avatar_url: previewAvatarUrl,
        updated_at: new Date().toISOString()
    };

    saveProfile(optimisticProfile);

    // Update visible profile UI immediately without waiting for Supabase.
    if ($("profileName")) $("profileName").textContent = name || "Student";
    if ($("profileCollege")) $("profileCollege").textContent = college || "College not added";
    if ($("profileUsernameInfo")) $("profileUsernameInfo").textContent = username || "Not added";
    if ($("profileCollegeInfo")) $("profileCollegeInfo").textContent = college || "Not added";
    if ($("profilePhoneInfo")) $("profilePhoneInfo").textContent = phone || "Not added";

    if ($("profileAvatar")) {
        if (previewAvatarUrl) {
            $("profileAvatar").innerHTML = `<img src="${escapeHTML(previewAvatarUrl)}" alt="">`;
        } else {
            $("profileAvatar").textContent = getInitials(name);
        }
    }

    closeModal("editProfileModal", { instant: true });

    // Change the authentication password only when the user entered a new one.
    // The password is never stored in the profile table or localStorage.
    if (newPassword) {
        try {
            const { error: passwordError } =
                await supabaseClient.auth.updateUser({
                    password: newPassword
                });

            if (passwordError) {
                throw passwordError;
            }

            $("editProfileNewPassword").value = "";
            $("editProfileConfirmPassword").value = "";
        } catch (passwordError) {
            console.error("Password update error:", passwordError);
            showToast(
                passwordError?.message || "Profile saved, but password could not be changed",
                "error"
            );
        }
    }

    // Everything below runs in the background.
    try {

        let avatarUrl = oldAvatarUrl;

        if (file) {
            const extension = file.name.split(".").pop().toLowerCase();
            const path = `${currentUser.id}/avatar-${Date.now()}.${extension}`;

            const { error: uploadError } = await supabaseClient
                .storage
                .from(STORAGE_BUCKET)
                .upload(path, file, {
                    upsert: false,
                    contentType: file.type
                });

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabaseClient.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(path);

            avatarUrl = data?.publicUrl || avatarUrl;
        }

        const profile = {
            ...optimisticProfile,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        };

        const { data: updatedProfile, error: profileUpdateError } =
            await supabaseClient
                .from("profiles")
                .update(profile)
                .eq("id", currentUser.id)
                .select("id")
                .maybeSingle();

        if (profileUpdateError) {
            if (
                profileUpdateError.code === "23505" &&
                String(profileUpdateError.message || "").toLowerCase().includes("username")
            ) {
                throw new Error("That username is already taken");
            }
            throw profileUpdateError;
        }

        if (!updatedProfile) {
            throw new Error(
                "Your profile row could not be updated. Please sign out and sign in again."
            );
        }

        // Auth metadata is secondary; do not make the UI wait for it.
        supabaseClient.auth.updateUser({
            data: {
                name,
                username,
                phone,
                college,
                state,
                city,
                area,
                avatar_url: avatarUrl
            }
        }).catch(error => {
            console.debug("Profile auth metadata update skipped:", error);
        });

        saveProfile(profile);

        // Replace the temporary blob URL with the permanent Supabase URL.
        if ($("profileAvatar")) {
            if (avatarUrl) {
                $("profileAvatar").innerHTML =
                    `<img src="${escapeHTML(avatarUrl)}" alt="">`;
            } else {
                $("profileAvatar").textContent = getInitials(name);
            }
        }

        showToast(
            newPassword
                ? "Profile and password updated successfully"
                : "Profile updated successfully",
            "success"
        );

        if (file && previewAvatarUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewAvatarUrl);
        }

    } catch (error) {

        console.error("Profile update error:", error);

        // Restore the previous saved avatar if the background save failed.
        const rollbackProfile = {
            ...optimisticProfile,
            avatar_url: oldAvatarUrl
        };
        saveProfile(rollbackProfile);

        if ($("profileAvatar")) {
            if (oldAvatarUrl) {
                $("profileAvatar").innerHTML =
                    `<img src="${escapeHTML(oldAvatarUrl)}" alt="">`;
            } else {
                $("profileAvatar").textContent = getInitials(name);
            }
        }

        const message = String(
            error?.message ||
            error?.details ||
            error?.hint ||
            "Unknown profile update error"
        );

        showToast("Profile update failed: " + message, "error");

        if (file && previewAvatarUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewAvatarUrl);
        }
    }
}


/* =========================================================
   MY LISTINGS
   ========================================================= */

async function loadMyListings() {

    if (!currentUser) {
        return;
    }

    const container =
        $("myListingsContainer");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading your listings...</p>
        </div>
    `;

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("products")
                .select("*")
                .eq(
                    "user_id",
                    currentUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (error) {
            throw error;
        }

        const products =
            (data || [])
                .map(normalizeProduct);

        if (!products.length) {

            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>You have no listings</h3>
                    <p>Create your first listing and start selling.</p>
                    <button
                        type="button"
                        class="btn btn-primary"
                        data-my-listings-sell>
                        Sell an Item
                    </button>
                </div>
            `;

            return;
        }

        container.innerHTML =
            products.map(product => {

                const image =
                    product.image ||
                    getPlaceholderImage(
                        product.name
                    );

                const wished =
                    isWishlisted(
                        product.id
                    );

                return `
                    <article
                        class="product-card"
                        data-my-listing-id="${escapeHTML(
                    product.id
                )}">

                        <div class="product-image-wrap">

                            <img
                                class="product-image"
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(product.name)}"
                                onerror="this.src='${getPlaceholderImage("StudentKart")}'">

                            <button
                                type="button"
                                class="wishlist-btn ${wished
                        ? "active"
                        : ""
                    }"
                                data-wishlist-id="${escapeHTML(
                        product.id
                    )}">
                                <i class="${wished
                        ? "fas"
                        : "far"
                    } fa-heart"></i>
                            </button>

                        </div>

                        <div class="product-body">

                            <div class="product-meta">
                                <span>
                                    ${escapeHTML(
                        product.category
                    )}
                                </span>
                            </div>

                            <h3>
                                ${escapeHTML(
                        product.name
                    )}
                            </h3>

                            <div class="product-price">
                                ${formatPrice(
                        product.price
                    )}
                            </div>

                            <div class="product-location">
                                <i class="fas fa-location-dot"></i>
                                ${escapeHTML(
                        product.location
                    )}
                            </div>

                            <div class="product-actions">

                                <button
                                    type="button"
                                    class="btn btn-outline"
                                    data-my-view="${escapeHTML(
                        product.id
                    )}">
                                    View
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-outline"
                                    data-my-edit="${escapeHTML(
                        product.id
                    )}">
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-danger"
                                    data-my-delete="${escapeHTML(
                        product.id
                    )}">
                                    Delete
                                </button>

                            </div>

                        </div>

                    </article>
                `;
            }).join("");

        updateWishlistButtons();

    } catch (error) {

        console.error(
            "My listings error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Could not load your listings</h3>
                <p>Please try again.</p>
            </div>
        `;
    }
}


/* =========================================================
   SEARCH
   ========================================================= */

function performSearch() {

    const heroSearch =
        $("heroSearch");

    const marketplaceSearch =
        $("marketplaceSearch");

    if (
        heroSearch &&
        marketplaceSearch
    ) {

        marketplaceSearch.value =
            heroSearch.value;
    }

    applyFilters();

    const marketplace =
        document.querySelector(
            "#marketplace"
        );

    marketplace?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function showHomePageFromCategory() {
    document.body.classList.remove("category-page-active");
    $("categoryPage")?.classList.add("hidden");
    document.querySelector("main")?.classList.remove("category-page-active");
    $("home")?.classList.remove("hidden");
    $("marketplace")?.classList.remove("hidden");
    $("how-it-works")?.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeCategoryPage() {
    document.body.classList.remove("category-page-active");
    $("categoryPage")?.classList.add("hidden");
    document.querySelector("main")?.classList.remove("category-page-active");
    $("home")?.classList.remove("hidden");
    $("marketplace")?.classList.remove("hidden");
    $("how-it-works")?.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function openCategoryPage(category, options = {}) {
    const selected = String(category || "Other").trim() || "Other";
    selectedMarketplaceCategory = selected;

    // Category pages are real navigation destinations, not just a visual
    // state. Create a browser history entry so Android/browser Back can
    // return to the category picker without requiring the on-page arrow.
    if (!options.fromPopState && !studentKartHandlingPopState) {
        ensureStudentKartHistory();

        const currentState = window.history.state;

        // The category picker is only a temporary selector. Do not leave its
        // modal history entry underneath the category page, otherwise Android
        // Back needs to be pressed twice (category -> picker -> home).
        const categoryState = {
            studentKart: true,
            modalId: null,
            modalStack: [],
            page: "category",
            category: selected
        };

        if (currentState?.studentKart === true &&
            currentState?.modalId === "categoryPickerModal") {
            window.history.replaceState(
                categoryState,
                "",
                window.location.pathname + window.location.search + "#category-" +
                    encodeURIComponent(selected)
            );
        } else {
            window.history.pushState(
                categoryState,
                "",
                window.location.pathname + window.location.search + "#category-" +
                    encodeURIComponent(selected)
            );
        }
    }

    $("categoryPickerModal")?.classList.add("hidden");
    document.body.classList.remove("modal-open");
    document.body.classList.remove("studentkart-modal-navigation-hidden");

    $("home")?.classList.add("hidden");
    $("marketplace")?.classList.add("hidden");
    $("how-it-works")?.classList.add("hidden");
    $("categoryPage")?.classList.remove("hidden");
    document.body.classList.add("category-page-active");
    document.querySelector("main")?.classList.add("category-page-active");

    const title = $("categoryPageTitle");
    const subtitle = $("categoryPageSubtitle");
    if (title) title.textContent = selected + " Marketplace";
    if (subtitle) subtitle.textContent = "Products listed in " + selected + " category";
    const navbarSubtitle = $("categoryPageNavbarSubtitle");
    if (navbarSubtitle) navbarSubtitle.textContent = "Products listed in " + selected + " category";

    const filtered = currentProducts.filter(product =>
        String(product.category || "").toLowerCase() === selected.toLowerCase()
    );

    const count = $("categoryPageCount");
    if (count) count.textContent = filtered.length + (filtered.length === 1 ? " listing" : " listings");

    renderProducts(filtered, "categoryProductContainer", "categoryEmptyState");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function getSearchResultMatches(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];

    const terms = q.split(/\s+/).filter(Boolean);
    const categoryQuery = ["books","electronics","vehicles","furniture","services","fashion","gaming","other"].includes(q);

    // Related-word expansion makes search useful for natural queries:
    // "phone" can find mobile/smartphone, "laptop" can find notebook, etc.
    const relatedMap = {
        phone:["phone","mobile","smartphone","iphone","android"],
        mobile:["mobile","phone","smartphone","iphone","android"],
        laptop:["laptop","notebook","macbook","computer"],
        computer:["computer","pc","laptop","notebook","desktop"],
        pc:["pc","computer","desktop","laptop"],
        bike:["bike","bicycle","cycle"],
        bicycle:["bicycle","bike","cycle"],
        cycle:["cycle","bicycle","bike"],
        car:["car","automobile","vehicle"],
        vehicle:["vehicle","car","scooter","bike"],
        scooter:["scooter","vehicle"],
        book:["book","books","textbook","notes","study"],
        books:["books","book","textbook","notes","study"],
        notes:["notes","book","books","study","textbook"],
        furniture:["furniture","chair","table","desk","bed"],
        chair:["chair","furniture","seat"],
        table:["table","desk","furniture"],
        headphones:["headphones","earphones","earbuds","airpods"],
        earphones:["earphones","headphones","earbuds","airpods"],
        earbuds:["earbuds","earphones","headphones","airpods"],
        camera:["camera","dslr","photography"],
        gaming:["gaming","game","playstation","xbox","console"],
        game:["game","gaming","playstation","xbox","console"]
    };

    const expandTerm = term => [...new Set(relatedMap[term] || [term])];
    const expandedTerms = terms.map(expandTerm);

    const scoreProduct = product => {
        const fields = [
            ["name", product.name, 12],
            ["category", product.category, 7],
            ["description", product.description, 5],
            ["location", product.location, 3],
            ["condition", product.condition, 2],
            ["seller", product.seller, 1]
        ];

        let score = 0;
        const name = String(product.name || "").toLowerCase();

        expandedTerms.forEach(group => {
            let best = 0;
            group.forEach(term => {
                fields.forEach(([, value, weight]) => {
                    const text = String(value || "").toLowerCase();
                    if (!text) return;
                    if (text === term) best = Math.max(best, weight + 8);
                    else if (text.startsWith(term)) best = Math.max(best, weight + 5);
                    else if (text.includes(term)) best = Math.max(best, weight);
                });
            });
            score += best;
        });

        if (name === q) score += 100;
        else if (name.startsWith(q)) score += 50;
        else if (name.includes(q)) score += 25;

        return score;
    };

    try {
        let request = supabaseClient
            .from("products")
            .select("*")
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(200);

        if (categoryQuery) {
            request = request.ilike("category", q);
        } else {
            // Require every original word to have at least one related
            // variant somewhere in the listing.
            expandedTerms.forEach(group => {
                const clauses = [];
                group.forEach(term => {
                    const safe = term.replace(/[\\%_]/g, "\\$&");
                    const pattern = "%" + safe + "%";
                    ["name","category","location","condition","description","seller"].forEach(field => {
                        clauses.push(field + ".ilike." + pattern);
                    });
                });
                request = request.or(clauses.join(","));
            });
        }

        const { data, error } = await request;
        if (error) throw error;

        return (Array.isArray(data) ? data : [])
            .map(normalizeProduct)
            .map(product => ({ product, score: scoreProduct(product) }))
            .filter(item => item.score > 0)
            .sort((a, b) =>
                b.score - a.score ||
                (new Date(b.product.createdAt || 0) - new Date(a.product.createdAt || 0))
            )
            .map(item => item.product);
    } catch (error) {
        console.warn("Database marketplace search failed, using loaded listings:", error);

        return [...currentProducts]
            .map(product => ({ product, score: scoreProduct(product) }))
            .filter(item => item.score > 0)
            .sort((a,b) => b.score - a.score)
            .map(item => item.product);
    }
}
async function fetchWithTimeout(url, options={}, timeout=9000){
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject)=>setTimeout(()=>reject(new Error("Request timeout")), timeout))
    ]);
}

async function fetchInternetSearchResults(query){
    const q=String(query||"").trim();
    if(!q) return {web:[], wiki:[]};

    const web=[];
    const seen=new Set();
    const addWeb=(item)=>{
        const title=String(item?.title||"").trim();
        const url=String(item?.url||"").trim();
        if(!title||!url||seen.has(url)) return;
        seen.add(url);
        web.push({
            title,
            url,
            snippet:String(item?.snippet||"").trim(),
            source:String(item?.source||"Web").trim()
        });
    };

    try{
        const url="https://api.duckduckgo.com/?q="+encodeURIComponent(q)+"&format=json&no_html=1&skip_disambig=0";
        const response=await fetchWithTimeout(url,{headers:{"Accept":"application/json"}},9000);
        if(response.ok){
            const data=await response.json();
            if(data?.AbstractURL){
                addWeb({
                    title:data.Heading||q,
                    url:data.AbstractURL,
                    snippet:data.AbstractText||"Related information from the web.",
                    source:data.AbstractSource||"DuckDuckGo"
                });
            }
            const flat=[];
            const flatten=(items)=>{
                (Array.isArray(items)?items:[]).forEach(item=>{
                    if(item?.Topics && Array.isArray(item.Topics)) flatten(item.Topics);
                    else flat.push(item);
                });
            };
            flatten(data?.RelatedTopics);
            flat.slice(0,14).forEach(item=>{
                addWeb({
                    title:item.Text?.split(" - ")[0]||item.Name||"",
                    url:item.FirstURL||"",
                    snippet:item.Text||"",
                    source:"Web"
                });
            });
        }
    }catch(error){
        console.debug("Internet search unavailable:",error);
    }

    const wiki=[];
    try{
        const url="https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch="+encodeURIComponent(q)+"&gsrlimit=8&prop=extracts|pageimages|coordinates|pageprops&exintro=1&explaintext=1&exsentences=5&piprop=thumbnail|name&pithumbsize=720&format=json&origin=*";
        const response=await fetchWithTimeout(url,{headers:{"Accept":"application/json"}},9000);
        if(response.ok){
            const data=await response.json();
            Object.values(data?.query?.pages||{}).forEach(page=>{
                const title=String(page?.title||"").trim();
                if(!title) return;
                const thumb=page?.thumbnail?.source||"";
                const coords=Array.isArray(page?.coordinates)&&page.coordinates[0] ? page.coordinates[0] : null;
                wiki.push({
                    title,
                    url:"https://en.wikipedia.org/wiki/"+encodeURIComponent(title.replace(/ /g,"_")),
                    snippet:String(page?.extract||"").trim(),
                    image:thumb,
                    latitude:coords?.lat ?? null,
                    longitude:coords?.lon ?? null,
                    wikibaseId:page?.pageprops?.wikibase_item||""
                });
            });
        }
    }catch(error){
        console.debug("Wikipedia rich search unavailable:",error);
    }

    return {web:web.slice(0,18),wiki:wiki.slice(0,8)};
}

async function enrichWikiFacts(items){
    const ids=[...new Set(items.map(item=>item.wikibaseId).filter(Boolean))].slice(0,6);
    if(!ids.length) return items;
    try{
        const url="https://www.wikidata.org/w/api.php?action=wbgetentities&ids="+encodeURIComponent(ids.join("|"))+"&props=claims|labels&languages=en&format=json&origin=*";
        const response=await fetchWithTimeout(url,{headers:{"Accept":"application/json"}},9000);
        if(!response.ok) return items;
        const data=await response.json();
        const entityLabels={};
        Object.values(data?.entities||{}).forEach(entity=>{
            const label=entity?.labels?.en?.value;
            if(entity?.id&&label) entityLabels[entity.id]=label;
        });
        const claimValue=(entity,p)=>{
            const claim=entity?.claims?.[p]?.[0];
            const value=claim?.mainsnak?.datavalue?.value;
            return value;
        };
        const formatDate=value=>{
            if(!value?.time) return "";
            const raw=String(value.time).replace(/^\+/,"");
            const match=raw.match(/^(\d{4})(?:-(\d{2})-(\d{2}))?/);
            if(!match) return "";
            return match[3]&&match[2] ? match[3]+"/"+match[2]+"/"+match[1] : match[1];
        };
        return items.map(item=>{
            const entity=data?.entities?.[item.wikibaseId];
            const dateValue=claimValue(entity,"P571")||claimValue(entity,"P580")||claimValue(entity,"P585")||claimValue(entity,"P1619");
            const locationValue=claimValue(entity,"P276")||claimValue(entity,"P131")||claimValue(entity,"P19")||claimValue(entity,"P17");
            const coordinates=claimValue(entity,"P625");
            const locationId=typeof locationValue==="string" ? locationValue : locationValue?.id;
            return {
                ...item,
                date:formatDate(dateValue),
                location:entityLabels[locationId] || (
                    (item.latitude!==null && item.longitude!==null)
                        ? "Coordinates: "+Number(item.latitude).toFixed(4)+", "+Number(item.longitude).toFixed(4)
                        : ""
                ),
                latitude:item.latitude ?? coordinates?.latitude ?? null,
                longitude:item.longitude ?? coordinates?.longitude ?? null
            };
        });
    }catch(error){
        console.debug("Wikidata facts unavailable:",error);
        return items;
    }
}

async function fetchInternetPanelData(mode, query){
    const q=String(query||"").trim();
    if(!q) return [];
    try{
        if(mode==="photos"){
            const url="https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch="+encodeURIComponent(q)+"&gsrnamespace=6&gsrlimit=12&prop=imageinfo|info&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*";
            const response=await fetchWithTimeout(url,{headers:{"Accept":"application/json"}},9000);
            if(!response.ok) return [];
            const data=await response.json();
            return Object.values(data?.query?.pages||{}).map(page=>{
                const info=page?.imageinfo?.[0]||{};
                const meta=info?.extmetadata||{};
                return {
                    title:String(page?.title||"").replace(/^File:/,""),
                    image:info?.thumburl||info?.url||"",
                    description:String(meta?.ImageDescription?.value||"").replace(/<[^>]+>/g,"").trim(),
                    date:String(meta?.DateTimeOriginal?.value||meta?.DateTime?.value||"").trim(),
                    source:"Wikimedia Commons"
                };
            }).filter(item=>item.image);
        }

        if(mode==="news"){
            const url="https://api.gdeltproject.org/api/v2/doc/doc?query="+encodeURIComponent(q)+"&mode=artlist&maxrecords=30&timespan=24h&format=json";
            const response=await fetchWithTimeout(url,{headers:{"Accept":"application/json"}},9000);
            if(!response.ok) return [];
            const data=await response.json();
            return (Array.isArray(data?.articles)?data.articles:[]).map(article=>({
                title:String(article?.title||"").trim(),
                url:String(article?.url||"").trim(),
                source:String(article?.domain||article?.sourcecountry||"News").trim(),
                date:String(article?.seendate||"").trim(),
                image:String(article?.socialimage||"").trim(),
                description:String(article?.snippet||"").trim()
            })).filter(item=>item.title&&item.url);
        }
    }catch(error){
        console.debug("Internet panel unavailable:",mode,error);
    }
    return [];
}

function renderInternetSearchResults(query, results){
    const container=$("searchResultsWebContainer");
    if(!container) return;
    const q=String(query||"").trim();
    const wiki=Array.isArray(results?.wiki)?results.wiki:[];
    const web=Array.isArray(results?.web)?results.web:[];

    const quickLinks=[
        ["All Web","all","fa-globe"],
        ["Photos","photos","fa-image"],
        ["Maps","https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q),"fa-location-dot","external"],
        ["News","news","fa-newspaper"],
        ["Dates","dates","fa-calendar-days"],
        ["YouTube","https://www.youtube.com/results?search_query="+encodeURIComponent(q),"fa-youtube","external"]
    ];

    const quick=quickLinks.map(item=>{
        const icon=item[2]==="fa-youtube" ? "fab fa-youtube" : "fas "+item[2];
        if(item[3]==="external"){
            return `<a class="internet-quick-link" href="${escapeHTML(item[1])}" target="_blank" rel="noopener noreferrer"><i class="${icon}"></i><span>${escapeHTML(item[0])}</span></a>`;
        }
        return `<button type="button" class="internet-quick-link" data-internet-scroll="${escapeHTML(item[1])}"><i class="${icon}"></i><span>${escapeHTML(item[0])}</span></button>`;
    }).join("");

    const wikiCards=wiki.map((item,index)=>{
        const hasLocation=item.latitude!==null&&item.longitude!==null;
        const mapUrl=hasLocation
            ? "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(item.latitude+","+item.longitude)
            : "https://www.google.com/maps/search/"+encodeURIComponent(item.title);
        return `
        <article class="internet-topic-card">
            ${item.image ? `<div class="internet-topic-photo"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy"></div>` : `<div class="internet-topic-photo internet-topic-photo-empty"><i class="fas fa-image"></i></div>`}
            <div class="internet-topic-body">
                <div class="internet-topic-kicker"><span>RELATED TOPIC</span><small>Wikipedia data</small></div>
                <h3>${escapeHTML(item.title)}</h3>
                <p>${escapeHTML(item.snippet||"Detailed information related to this topic.")}</p>
                <div class="internet-fact-row">
                    ${item.date ? `<span><i class="fas fa-calendar-days"></i>${escapeHTML(item.date)}</span>` : ""}
                    ${item.location ? `<span><i class="fas fa-location-dot"></i>${escapeHTML(item.location)}</span>` : ""}
                </div>
                <div class="internet-topic-actions">
                    <button type="button" data-internet-detail="${index}">More details <i class="fas fa-circle-info"></i></button>
                    <a href="${escapeHTML(mapUrl)}" target="_blank" rel="noopener noreferrer">Map <i class="fas fa-location-dot"></i></a>
                </div>
                <div class="internet-topic-detail hidden" data-internet-detail-panel="${index}">
                    <strong>Detailed information</strong>
                    <p>${escapeHTML(item.snippet||"No additional details are available.")}</p>
                    ${item.url ? `<small>Source: Wikipedia data copied into StudentKart</small>` : ""}
                </div>
            </div>
        </article>`;
    }).join("");

    const webCards=web.map((item,index)=>`
        <button type="button" class="internet-result-card" data-internet-web-detail="${index}">
            <span class="internet-result-icon"><i class="fas fa-globe"></i></span>
            <span class="internet-result-copy">
                <strong>${escapeHTML(item.title)}</strong>
                <small>${escapeHTML(item.source)}</small>
                <span>${escapeHTML(item.snippet||"Related information from the internet.")}</span>
            </span>
            <i class="fas fa-chevron-right internet-result-arrow"></i>
        </button>`).join("");

    container.innerHTML=`
        <div class="search-results-web-heading">
            <div>
                <span class="section-label">INTERNET RESULTS</span>
                <h2>Everything related to “${escapeHTML(q)}”</h2>
                <p>Internet information is collected into StudentKart. Maps and YouTube open externally.</p>
            </div>
            <div class="internet-quick-links">${quick}</div>
        </div>
        <div id="internetPanelContainer">
            <div class="internet-panel-card">
                <div class="internet-loading"><i class="fas fa-spinner fa-spin"></i> Collecting available internet information…</div>
            </div>
        </div>
        ${wiki.length ? `<div class="internet-subsection-heading"><span>TOPIC DETAILS</span><small>${wiki.length} related topics with photos and facts</small></div><div class="internet-topic-grid">${wikiCards}</div>` : ""}
        ${web.length ? `<div class="internet-subsection-heading"><span>WEB PAGES</span><small>Related information copied into StudentKart</small></div><div class="internet-results-grid">${webCards}</div>` : ""}
        <div id="internetInternalDetail" class="internet-internal-detail hidden"></div>`;

    const panel=container.querySelector("#internetPanelContainer");
    const showPanel=async mode=>{
        if(!panel) return;
        if(mode==="all"){
            panel.innerHTML=`<div class="internet-panel-card"><div class="internet-subsection-heading"><span>ALL WEB DATA</span><small>${web.length} web results + ${wiki.length} topic results</small></div><p>Relevant internet information is already displayed below in the StudentKart theme.</p></div>`;
            return;
        }
        if(mode==="dates"){
            const dated=wiki.filter(item=>item.date||item.location);
            panel.innerHTML=dated.length
                ? `<div class="internet-panel-card"><div class="internet-subsection-heading"><span>DATES & TIMELINE</span><small>Facts available from indexed topic data</small></div><div class="internet-date-grid">${dated.map(item=>`<div class="internet-date-card"><strong>${escapeHTML(item.title)}</strong>${item.date?`<span><i class="fas fa-calendar-days"></i>${escapeHTML(item.date)}</span>`:""}${item.location?`<span><i class="fas fa-location-dot"></i>${escapeHTML(item.location)}</span>`:""}</div>`).join("")}</div></div>`
                : `<div class="internet-panel-card"><strong>No date facts found for this search.</strong><p>Try a more specific search such as a person, place, event or historical topic.</p></div>`;
            return;
        }
        panel.innerHTML=`<div class="internet-panel-card"><div class="internet-loading"><i class="fas fa-spinner fa-spin"></i> Loading ${escapeHTML(mode)} inside StudentKart…</div></div>`;
        const data=await fetchInternetPanelData(mode,q);
        if(mode==="photos"){
            panel.innerHTML=data.length
                ? `<div class="internet-panel-card"><div class="internet-subsection-heading"><span>PHOTOS</span><small>Images copied from Wikimedia Commons</small></div><div class="internet-photo-grid">${data.map(item=>`<article class="internet-photo-card"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy"><strong>${escapeHTML(item.title)}</strong>${item.date?`<small>${escapeHTML(item.date)}</small>`:""}${item.description?`<p>${escapeHTML(item.description.slice(0,180))}</p>`:""}</article>`).join("")}</div></div>`
                : `<div class="internet-panel-card"><strong>No photos found.</strong><p>Try another search term.</p></div>`;
        }else{
            panel.innerHTML=data.length
                ? `<div class="internet-panel-card"><div class="internet-subsection-heading"><span>NEWS</span><small>News data copied into StudentKart</small></div><div class="internet-news-grid">${data.map(item=>`<article class="internet-news-card">${item.image?`<img src="${escapeHTML(item.image)}" alt="" loading="lazy">`:""}<div><small>${escapeHTML(item.source)} ${item.date?"• "+escapeHTML(item.date):""}</small><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.description||"News result from the web.")}</p></div></article>`).join("")}</div></div>`
                : `<div class="internet-panel-card"><strong>No news data found.</strong><p>The news provider did not return results for this search.</p></div>`;
        }
    };

    container.querySelectorAll("[data-internet-scroll]").forEach(button=>{
        button.addEventListener("click",()=>{
            const target=container.querySelector("#internetSection-"+button.dataset.internetScroll);
            target?.scrollIntoView({behavior:"smooth",block:"start"});
        });
    });
    container.querySelectorAll("[data-internet-detail]").forEach(button=>{
        button.addEventListener("click",()=>{
            const target=container.querySelector(`[data-internet-detail-panel="${button.dataset.internetDetail}"]`);
            target?.classList.toggle("hidden");
        });
    });
    container.querySelectorAll("[data-internet-web-detail]").forEach(button=>{
        button.addEventListener("click",()=>{
            const item=web[Number(button.dataset.internetWebDetail)];
            const detail=container.querySelector("#internetInternalDetail");
            if(!item||!detail) return;
            detail.classList.remove("hidden");
            detail.innerHTML=`<div class="internet-panel-card"><div class="internet-subsection-heading"><span>WEB DETAIL</span><small>${escapeHTML(item.source)}</small></div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.snippet||"No description available.")}</p><small>Data copied into StudentKart from the internet source.</small></div>`;
            detail.scrollIntoView({behavior:"smooth",block:"center"});
        });
    });

    const aggregatePanel=container.querySelector("#internetPanelContainer");
    if(aggregatePanel){
        Promise.all([
            fetchInternetPanelData("photos",q),
            fetchInternetPanelData("news",q)
        ]).then(([photos,news])=>{
            const dated=wiki.filter(item=>item.date||item.location);
            aggregatePanel.innerHTML=`
                <div class="internet-aggregate-head">
                    <span class="section-label">INTERNET KNOWLEDGE</span>
                    <strong>Information collected for “${escapeHTML(q)}”</strong>
                    <small>StudentKart has collected the available web, topic, photo, news, date and location information from its connected public sources.</small>
                </div>

                <section class="internet-aggregate-section" id="internetSection-all">
                    <div class="internet-subsection-heading"><span>ALL WEB</span><small>${web.length} web results • ${wiki.length} topic results</small></div>
                    <div class="internet-results-grid">
                        ${web.slice(0,12).map((item,index)=>`
                            <button type="button" class="internet-result-card" data-internet-web-detail="${index}">
                                <span class="internet-result-icon"><i class="fas fa-globe"></i></span>
                                <span class="internet-result-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.source)}</small><span>${escapeHTML(item.snippet||"Related internet information.")}</span></span>
                                <i class="fas fa-chevron-right internet-result-arrow"></i>
                            </button>`).join("") || '<div class="internet-panel-card"><strong>No direct web results found.</strong></div>'}
                    </div>
                </section>

                <section class="internet-aggregate-section" id="internetSection-photos">
                    <div class="internet-subsection-heading"><span>PHOTOS</span><small>${photos.length} images collected from Wikimedia Commons</small></div>
                    ${photos.length ? `<div class="internet-photo-grid">${photos.map(item=>`<article class="internet-photo-card"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy"><strong>${escapeHTML(item.title)}</strong>${item.date?`<small>${escapeHTML(item.date)}</small>`:""}${item.description?`<p>${escapeHTML(item.description.slice(0,180))}</p>`:""}</article>`).join("")}</div>` : '<div class="internet-panel-card"><strong>No public photos were returned for this term.</strong></div>'}
                </section>

                <section class="internet-aggregate-section" id="internetSection-news">
                    <div class="internet-subsection-heading"><span>NEWS</span><small>${news.length} recent indexed news results</small></div>
                    ${news.length ? `<div class="internet-news-grid">${news.map(item=>`<article class="internet-news-card">${item.image?`<img src="${escapeHTML(item.image)}" alt="" loading="lazy">`:""}<div><small>${escapeHTML(item.source)} ${item.date?"• "+escapeHTML(item.date):""}</small><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.description||"News result from the web.")}</p></div></article>`).join("")}</div>` : '<div class="internet-panel-card"><strong>No news data was returned by the connected news source.</strong><p>This does not mean there is no news on the internet; this source simply returned no accessible results for this query.</p></div>'}
                </section>

                <section class="internet-aggregate-section" id="internetSection-dates">
                    <div class="internet-subsection-heading"><span>DATES & LOCATIONS</span><small>${dated.length} topics with available facts</small></div>
                    ${dated.length ? `<div class="internet-date-grid">${dated.map(item=>`<div class="internet-date-card"><strong>${escapeHTML(item.title)}</strong>${item.date?`<span><i class="fas fa-calendar-days"></i>${escapeHTML(item.date)}</span>`:""}${item.location?`<span><i class="fas fa-location-dot"></i>${escapeHTML(item.location)}</span>`:""}</div>`).join("")}</div>` : '<div class="internet-panel-card"><strong>No structured date/location facts found.</strong></div>'}
                </section>
            `;
        }).catch(error=>{
            console.debug("Internet aggregate failed:",error);
            aggregatePanel.innerHTML=`<div class="internet-panel-card"><strong>Some internet sources could not be loaded.</strong><p>The StudentKart results already available above are still usable.</p></div>`;
        });
    }
}

async function showSearchResultsPage(query, options = {}) {
    const selected=String(query||"").trim();
    if(!selected) return;
    if(!options.fromPopState && !studentKartHandlingPopState){
        ensureStudentKartHistory();
        const state={studentKart:true,modalId:null,modalStack:[],page:"search",searchQuery:selected};
        const hash="#search-"+encodeURIComponent(selected);
        if(window.history.state?.page==="search") window.history.replaceState(state,"",window.location.pathname+window.location.search+hash);
        else window.history.pushState(state,"",window.location.pathname+window.location.search+hash);
    }
    document.querySelectorAll(".modal").forEach(modal=>{modal.classList.remove("modal-closing");modal.classList.add("hidden");});
    document.body.classList.remove("modal-open","studentkart-modal-navigation-hidden","category-page-active");
    document.querySelector("main")?.classList.remove("category-page-active");
    ["home","marketplace","how-it-works","categoryPage"].forEach(id=>$(id)?.classList.add("hidden"));
    document.body.classList.add("studentkart-search-results-active");
    document.querySelector(".mobile-bottom-nav")?.classList.add("hidden");
    $("searchResultsPage")?.classList.remove("hidden");
    const resultInput=$("searchResultsInput");
    if(resultInput) resultInput.value=selected;
    const title=$("searchResultsQuery"), subtitle=$("searchResultsNavbarSubtitle");
    if(title) title.textContent=selected;
    if(subtitle) subtitle.textContent="Internet + StudentKart results for “"+selected+"”";

    const resultContainer=$("searchResultsProductContainer");
    if(resultContainer){
        resultContainer.innerHTML='<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Searching marketplace…</p></div>';
    }

    const matches=await getSearchResultMatches(selected);
    const count=$("searchResultsCount");
    if(count) count.textContent=matches.length+(matches.length===1?" listing":" listings");
    renderProducts(matches,"searchResultsProductContainer","searchResultsEmptyState");
    const marketplaceLabel=$("searchResultsMarketplaceLabel");
    if(marketplaceLabel) marketplaceLabel.classList.toggle("hidden",matches.length===0);

    const webResults=await fetchInternetSearchResults(selected);
    const enriched=await enrichWikiFacts(webResults.wiki);
    if(document.getElementById("searchResultsPage")?.classList.contains("hidden")) return;
    renderInternetSearchResults(selected,{...webResults,wiki:enriched});
    window.scrollTo({top:0,behavior:"auto"});
}

function showHomePageFromSearch(options={}) {
    $("searchResultsPage")?.classList.add("hidden");
    document.body.classList.remove("studentkart-search-results-active");
    document.querySelector(".mobile-bottom-nav")?.classList.remove("hidden");
    $("categoryPage")?.classList.add("hidden");
    $("home")?.classList.remove("hidden");
    $("marketplace")?.classList.remove("hidden");
    $("how-it-works")?.classList.remove("hidden");
    document.body.classList.remove("category-page-active");
    document.querySelector("main")?.classList.remove("category-page-active");
    $("navbarSearchInput")&&( $("navbarSearchInput").value="" );
    $("heroSearchInput")&&( $("heroSearchInput").value="" );
    $("navbarSearchSuggestions")?.classList.add("hidden");
    $("heroSearchSuggestions")?.classList.add("hidden");
    window.scrollTo({top:0,behavior:options.fromPopState?"smooth":"auto"});
}



function selectCategory(category) {
    const selected = category || "all";
    if (selected === "all") {
        selectedMarketplaceCategory = "all";
        showHomePageFromCategory();
        modalHistory = [];
        setStudentKartModalHistory(null, []);
        applyFilters();
        return;
    }
    openCategoryPage(selected);
}


/* =========================================================
   NOTIFICATIONS UI
   ========================================================= */

function ensureNotificationsUI() {

    let button = $("notificationButton");

    if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.id = "notificationButton";
        button.className = "btn btn-outline nav-notification-button";
        button.setAttribute("aria-label", "Open Notifications");
        button.title = "Notifications";
        button.innerHTML = `
            <i class="fa-regular fa-bell"></i>
            <span class="notification-count hidden" id="notificationCount">0</span>
        `;
        document.querySelector(".nav-actions")?.appendChild(button);
    }

    if (!$("notificationsModal")) {
        const modal = document.createElement("div");
        modal.id = "notificationsModal";
        modal.className = "modal hidden";
        modal.innerHTML = `
            <div class="modal-overlay" data-close-modal></div>
            <div class="modal-content wide-modal notifications-modal-content">
                <button type="button" class="modal-close modal-back-button" data-close-modal aria-label="Back">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div class="notifications-header">
                    <div>
                        <span class="section-label">ALERTS</span>
                        <h2>Notifications</h2>
                        <p>Stay updated on your marketplace activity.</p>
                    </div>
                    <div id="notificationSelectionToolbar" class="notification-selection-toolbar hidden">
                        <span class="notification-selection-count"><span id="notificationSelectionCount">0</span> selected</span>
                        <button type="button" class="notification-action-box" id="selectAllNotificationsButton" title="Select all"><i class="fas fa-check-double"></i></button>
                        <button type="button" class="notification-action-box" id="markSelectedNotificationsButton" title="Mark as read"><i class="fas fa-check"></i></button>
                        <button type="button" class="notification-action-box danger" id="deleteSelectedNotificationsButton" title="Delete selected"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div id="notificationsContainer"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    if (!button.dataset.notificationBound) {
        button.dataset.notificationBound = "true";
        button.addEventListener("click", async () => {
            if (!currentUser) {
                openModal("loginModal");
                showToast("Please login to see notifications", "warning");
                return;
            }
            openModal("notificationsModal");
            await loadNotifications();
            renderNotifications();
        });
    }
}
function injectNotificationStyles() {

    if (
        $("studentkartNotificationStyles")
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "studentkartNotificationStyles";

    style.textContent = `

        .nav-notification-button {
            position: relative;
            width: 40px;
            min-width: 40px;
            padding: 9px;
        }

        .notification-count {
            position: absolute;
            top: -5px;
            right: -4px;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: #dc3545;
            color: #fff;
            border: 2px solid var(--nav);
            font-size: 9px;
            font-weight: 800;
        }

        .notifications-modal-content {
            width: min(720px, 94vw);
            max-height: 88vh;
            overflow-y: auto;
        }

        .notification-selection-toolbar {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            padding: 8px 24px;
            border-bottom: 1px solid var(--border);
            background: #fbfdfc;
        }

        .notification-selection-toolbar.hidden {
            display: none;
        }

        .notification-selection-count {
            margin-right: auto;
            color: var(--text);
            font-size: 11px;
            font-weight: 700;
        }

        body #notificationDeleteConfirmModal {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            min-height: 100vh !important;
            margin: 0 !important;
            padding: 20px !important;
            z-index: 999999 !important;
            box-sizing: border-box !important;
        }

        body #notificationDeleteConfirmModal.hidden {
            display: none !important;
        }

        body #notificationDeleteConfirmModal > .modal-overlay {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
        }

        body #notificationDeleteConfirmModal > .notification-confirm-modal {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            bottom: auto !important;
            left: auto !important;
            width: min(390px, 90vw) !important;
            max-width: 390px !important;
            max-height: 90vh !important;
            margin: 0 !important;
            transform: none !important;
            z-index: 1000000 !important;
            box-sizing: border-box !important;
        }

        .notification-confirm-icon {
            width: 48px;
            height: 48px;
            margin: 0 auto 12px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: #fff0f0;
            color: #d32f2f;
            font-size: 18px;
        }

        .notification-confirm-modal h3 {
            margin: 0 0 7px;
            color: var(--text);
            font-size: 18px;
        }

        .notification-confirm-modal p {
            margin: 0;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.6;
        }

        .notification-confirm-actions {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 20px;
        }

        .notification-confirm-actions .btn {
            min-width: 95px;
            height: 36px;
            font-size: 11px;
        }

        .notification-action-box {
            height: 32px;
            min-width: 34px;
            padding: 5px 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            border: 1px solid var(--border);
            border-radius: 7px;
            background: #fff;
            color: var(--text);
            font-size: 9px;
            font-weight: 700;
            cursor: pointer;
        }

        .notification-action-box i {
            font-size: 11px;
        }

        .notification-action-box:hover {
            border-color: var(--primary);
            color: var(--primary);
        }

        .notification-action-danger {
            color: #c62828;
        }

        .notification-action-danger:hover {
            border-color: #c62828;
            color: #c62828;
        }

        .notification-action-box:disabled {
            opacity: .45;
            cursor: not-allowed;
        }

        .notification-item {
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        }

        .notification-select-check {
            position: absolute;
            top: 8px;
            left: 8px;
            width: 20px;
            height: 20px;
            display: none;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--primary);
            border-radius: 50%;
            background: var(--primary);
            color: #fff;
            font-size: 10px;
        }

        .notification-item.notification-selected {
            border-color: inherit;
            background: inherit;
        }

        .notification-item.notification-selected .notification-select-check {
            display: inline-flex;
        }

        .notifications-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            padding: 24px 55px 18px 24px;
            border-bottom: 1px solid var(--border);
        }

        .notifications-header h2 {
            color: var(--text);
            font-size: 21px;
            margin-bottom: 4px;
        }

        .notifications-header p {
            color: var(--muted);
            font-size: 12px;
        }

        .notifications-header .btn {
            flex-shrink: 0;
            font-size: 11px;
        }

        .notifications-container {
            padding: 16px 24px 24px;
        }

        .notification-item {
            position: relative;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            width: 100%;
            padding: 14px;
            margin-bottom: 9px;
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 9px;
            text-align: left;
            cursor: pointer;
            transition: none;
        }

        .notification-item:hover {
            border-color: #bdd7c6;
            background: #f9fcfa;
        }

        .notification-item.unread {
            background: #f1f8f3;
            border-color: #c6dfce;
        }

        .notification-icon {
            width: 38px;
            height: 38px;
            display: grid;
            place-items: center;
            flex-shrink: 0;
            background: var(--primary-light);
            color: var(--primary);
            border-radius: 8px;
            font-size: 14px;
        }

        .notification-content {
            min-width: 0;
            flex: 1;
        }

        .notification-content strong {
            display: block;
            color: var(--text);
            font-size: 13px;
            margin-bottom: 3px;
        }

        .notification-content p {
            color: var(--text-soft);
            font-size: 11px;
            line-height: 1.5;
        }

        .notification-time {
            display: block;
            color: var(--muted);
            font-size: 9px;
            margin-top: 5px;
        }

        .notification-unread-dot {
            width: 7px;
            height: 7px;
            flex-shrink: 0;
            margin-top: 6px;
            background: var(--primary);
            border-radius: 50%;
        }

        .notification-delete-btn {
            width: 30px;
            height: 30px;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 2px;
            border: 1px solid var(--border);
            border-radius: 7px;
            background: #fff;
            color: #94a3b8;
            font-size: 11px;
            cursor: pointer;
            transition: .2s ease;
        }

        .notification-delete-btn:hover {
            color: #dc3545;
            border-color: #f1b8bf;
            background: #fff5f6;
        }

        .notifications-empty {
            padding: 50px 20px;
            text-align: center;
            color: var(--muted);
        }

        .notifications-empty i {
            display: block;
            margin-bottom: 12px;
            color: #cbd5d1;
            font-size: 38px;
        }

        .notifications-empty h3 {
            color: var(--text);
            font-size: 17px;
            margin-bottom: 5px;
        }

        .notifications-empty p {
            font-size: 12px;
        }

        @media(max-width:700px) {

            .notifications-header {
                flex-direction: column;
                align-items: stretch;
                padding-right: 50px;
            }

            .notifications-header .btn {
                width: 100%;
            }

            .notifications-container {
                padding: 14px 17px 20px;
            }

            .notification-delete-btn {
                width: 32px;
                height: 32px;
            }
        }

    `;

    document.head.appendChild(
        style
    );
}


/* =========================================================
   NOTIFICATION HELPERS
   ========================================================= */

function formatNotificationTime(dateValue) {

    if (!dateValue) {
        return "Recently";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Recently";
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 0) {
        return "Just now";
    }

    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) {
        return "Just now";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
        return `${days}d ago`;
    }

    return date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

function getNotificationIcon(
    type
) {

    switch (type) {

        case "inquiry":
            return "fa-message";

        case "inquiry_status":
            return "fa-arrows-rotate";

        case "wishlist":
            return "fa-heart";

        case "listing":
        case "listing_suspended":
        case "listing_restored":
            return type === "listing_suspended"
                ? "fa-ban"
                : type === "listing_restored"
                    ? "fa-circle-check"
                    : "fa-box";

        case "listing_appeal_submitted":
            return "fa-scale-balanced";

        case "listing_appeal_approved":
            return "fa-scale-balanced";

        case "listing_appeal_rejected":
            return "fa-circle-xmark";

        default:
            return "fa-bell";
    }
}

function updateNotificationNavbar() {

    const countElement =
        $("notificationCount");

    if (!countElement) {
        return;
    }

    const unread =
        currentNotifications.filter(
            notification =>
                !notification.is_read
        ).length;

    countElement.textContent =
        unread > 99
            ? "99+"
            : String(unread);

    countElement.classList.toggle(
        "hidden",
        unread === 0
    );
}

async function loadNotifications() {

    if (!currentUser) {

        currentNotifications = [];

        updateNotificationNavbar();

        return;
    }

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("notifications")
                .select("*")
                .eq(
                    "user_id",
                    currentUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(50);

        if (error) {
            throw error;
        }

        currentNotifications =
            data || [];

        updateNotificationNavbar();

        if (
            $("notificationsModal") &&
            !$("notificationsModal")
                .classList.contains("hidden")
        ) {

            renderNotifications();
        }

    } catch (error) {

        console.error(
            "Notification loading error:",
            error
        );

        currentNotifications = [];

        updateNotificationNavbar();
    }
}

function renderNotifications() {

    const container =
        $("notificationsContainer");

    if (!container) {
        return;
    }

    if (!currentUser) {

        container.innerHTML = `
            <div class="notifications-empty">
                <i class="far fa-bell"></i>
                <h3>Please login</h3>
                <p>Login to see your marketplace notifications.</p>
            </div>
        `;

        return;
    }

    if (!currentNotifications.length) {

        container.innerHTML = `
            <div class="notifications-empty">
                <i class="far fa-bell"></i>
                <h3>You're all caught up</h3>
                <p>New marketplace activity will appear here.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        currentNotifications
            .map(notification => {

                const unread =
                    !notification.is_read;

                return `
                    <div
                        class="notification-item ${unread
                        ? "unread"
                        : ""
                    }"
                        data-notification-id="${escapeHTML(
                        notification.id
                    )}">

                        <div class="notification-icon">
                            <i class="fas ${getNotificationIcon(
                        notification.type
                    )}"></i>
                        </div>

                        <div class="notification-content">

                            <strong>
                                ${escapeHTML(
                        notification.title
                    )}
                            </strong>

                            <p>
                                ${escapeHTML(
                        notification.message
                    )}
                            </p>

                            <span class="notification-time">
                                ${formatNotificationTime(
                        notification.created_at
                    )}
                            </span>

                        </div>
                        <span class="notification-select-check" aria-hidden="true"><i class="fas fa-check"></i></span>
${unread
                        ? `
                                    <span
                                        class="notification-unread-dot"
                                        title="Unread">
                                    </span>
                                `
                        : ""
                    }

                    </div>
                `;
            })
            .join("");

    // Re-apply the current selection immediately after rendering.
    // This keeps the checkmark visible even when notifications auto-refresh.
    updateNotificationSelectionUI();
}

function updateNotificationSelectionUI() {
    const toolbar = $("notificationSelectionToolbar");
    const count = $("notificationSelectionCount");
    const deleteButton = $("deleteSelectedNotificationsButton");

    document.querySelectorAll("[data-notification-id]").forEach(item => {
        item.classList.toggle("notification-selected", selectedNotificationIds.has(String(item.dataset.notificationId)));
    });

    const selectedCount = selectedNotificationIds.size;
    if (toolbar) toolbar.classList.toggle("hidden", selectedCount === 0);
    if (count) count.textContent = String(selectedCount);
    if (deleteButton) deleteButton.disabled = selectedCount === 0;
}

function toggleNotificationSelection(notificationId) {
    const id = String(notificationId || "");
    if (!id) return;
    if (selectedNotificationIds.has(id)) selectedNotificationIds.delete(id);
    else selectedNotificationIds.add(id);
    updateNotificationSelectionUI();
}

function clearNotificationSelection() {
    selectedNotificationIds.clear();
    updateNotificationSelectionUI();
}

function selectAllNotifications() {
    currentNotifications.forEach(notification => selectedNotificationIds.add(String(notification.id)));
    updateNotificationSelectionUI();
}

async function markSelectedNotificationsRead() {
    if (!currentUser || !selectedNotificationIds.size) return;

    const ids = Array.from(selectedNotificationIds);

    try {
        const { error } = await supabaseClient
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", currentUser.id)
            .in("id", ids);

        if (error) throw error;

        currentNotifications = currentNotifications.map(notification => {
            if (selectedNotificationIds.has(String(notification.id))) {
                return { ...notification, is_read: true };
            }
            return notification;
        });

        selectedNotificationIds.clear();
        updateNotificationNavbar();
        renderNotifications();
        updateNotificationSelectionUI();
        showToast(ids.length + " notification" + (ids.length === 1 ? "" : "s") + " marked as read", "success");
    } catch (error) {
        console.error("Mark selected notifications error:", error);
        showToast("Could not mark selected notifications as read", "error");
    }
}

function showNotificationDeleteConfirm(count) {
    return new Promise(resolve => {
        const existing = $("notificationDeleteConfirmModal");
        if (existing) {
            existing.remove();
        }

        const modal = document.createElement("div");
        modal.id = "notificationDeleteConfirmModal";
        modal.className = "modal hidden";
        modal.innerHTML = `
            <div class="modal-overlay" data-notification-confirm-cancel></div>
            <div class="modal-content notification-confirm-modal">
                <div class="notification-confirm-icon">
                    <i class="fas fa-trash"></i>
                </div>
                <h3>Delete notifications?</h3>
                <p>Are you sure you want to delete <strong>${count}</strong> selected notification${count === 1 ? "" : "s"}?</p>
                <div class="notification-confirm-actions">
                    <button type="button" class="btn btn-outline" data-notification-confirm-cancel>Cancel</button>
                    <button type="button" class="btn btn-danger" data-notification-confirm-delete>
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const finish = value => {
            modal.remove();
            resolve(value);
        };

        modal.querySelectorAll("[data-notification-confirm-cancel]").forEach(button => {
            button.addEventListener("click", () => finish(false));
        });

        modal.querySelector("[data-notification-confirm-delete]")?.addEventListener("click", () => finish(true));

        modal.classList.remove("hidden");
    });
}

async function deleteSelectedNotifications() {
    if (!currentUser || !selectedNotificationIds.size) return;
    const ids = Array.from(selectedNotificationIds);

    const confirmed = await showNotificationDeleteConfirm(ids.length);

    if (!confirmed) {
        return;
    }

    try {
        const { error } = await supabaseClient.from("notifications").delete().eq("user_id", currentUser.id).in("id", ids);
        if (error) throw error;

        currentNotifications = currentNotifications.filter(notification => !selectedNotificationIds.has(String(notification.id)));
        selectedNotificationIds.clear();
        updateNotificationNavbar();
        renderNotifications();
        updateNotificationSelectionUI();
        showToast(ids.length + " notification" + (ids.length === 1 ? "" : "s") + " deleted", "success");
    } catch (error) {
        console.error("Delete selected notifications error:", error);
        showToast("Could not delete selected notifications", "error");
    }
}

async function deleteNotification(notificationId) {

    if (!currentUser || !notificationId) {
        return false;
    }

    try {

        const { error } =
            await supabaseClient
                .from("notifications")
                .delete()
                .eq("id", notificationId)
                .eq("user_id", currentUser.id);

        if (error) {
            throw error;
        }

        currentNotifications =
            currentNotifications.filter(
                notification =>
                    String(notification.id) !==
                    String(notificationId)
            );

        updateNotificationNavbar();
        renderNotifications();

        showToast(
            "Notification deleted",
            "success"
        );

        return true;

    } catch (error) {

        console.error(
            "Delete notification error:",
            error
        );

        showToast(
            "Could not delete notification",
            "error"
        );

        return false;
    }
}


async function markNotificationAsRead(
    notificationId
) {

    if (
        !currentUser ||
        !notificationId
    ) {
        return;
    }

    try {

        const {
            error
        } =
            await supabaseClient
                .from("notifications")
                .update({
                    is_read: true
                })
                .eq(
                    "id",
                    notificationId
                )
                .eq(
                    "user_id",
                    currentUser.id
                );

        if (error) {
            throw error;
        }

        const notification =
            currentNotifications.find(
                item =>
                    String(item.id) ===
                    String(
                        notificationId
                    )
            );

        if (notification) {
            notification.is_read = true;
        }

        updateNotificationNavbar();
        renderNotifications();

        return notification;

    } catch (error) {

        console.error(
            "Mark notification error:",
            error
        );

        return null;
    }
}

async function markAllNotificationsAsRead() {

    if (!currentUser) {
        return;
    }

    const unread =
        currentNotifications.filter(
            notification =>
                !notification.is_read
        );

    if (!unread.length) {

        showToast(
            "No unread notifications",
            "success"
        );

        return;
    }

    try {

        const {
            error
        } =
            await supabaseClient
                .from("notifications")
                .update({
                    is_read: true
                })
                .eq(
                    "user_id",
                    currentUser.id
                )
                .eq(
                    "is_read",
                    false
                );

        if (error) {
            throw error;
        }

        currentNotifications =
            currentNotifications.map(
                notification => ({
                    ...notification,
                    is_read: true
                })
            );

        updateNotificationNavbar();
        renderNotifications();

        showToast(
            "All notifications marked as read",
            "success"
        );

    } catch (error) {

        console.error(
            "Mark all notifications error:",
            error
        );

        showToast(
            "Could not update notifications",
            "error"
        );
    }
}

async function openNotification(
    notificationId
) {

    const notification =
        currentNotifications.find(
            item =>
                String(item.id) ===
                String(notificationId)
        );

    if (!notification) {
        return;
    }

    await markNotificationAsRead(
        notificationId
    );

    if (
        notification.type === "listing_appeal_submitted" &&
        window.StudentKartAdminReports &&
        typeof window.StudentKartAdminReports.openAppeals === "function"
    ) {
        await window.StudentKartAdminReports.openAppeals();
        return;
    }

    if (
        notification.product_id
    ) {

        await openProductDetails(
            notification.product_id
        );

        return;
    }

    if (
        notification.inquiry_id
    ) {

        if (currentUser) {

            await loadReceivedInquiries();

            openModal(
                "inquiriesModal"
            );
        }

        return;
    }
}



function startNotificationRefresh() {

    stopNotificationRefresh();

    if (!currentUser) {
        return;
    }

    loadNotifications();

    notificationRealtimeChannel =
        supabaseClient
            .channel(
                `notifications-${currentUser.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${currentUser.id}`
                },
                payload => {

                    console.log(
                        "🔔 New notification:",
                        payload
                    );

                    if (payload.new) {
                        const settings = getStudentKartSettings();
                        const type = String(payload.new.type || payload.new.category || "").toLowerCase();
                        const shouldShow =
                            (type.includes("chat") && settings.notifications.chat) ||
                            (type.includes("wishlist") && settings.notifications.wishlist) ||
                            (type.includes("listing") && settings.notifications.listings) ||
                            (type.includes("interest") && settings.notifications.buyerSeller) ||
                            (type.includes("sold") && settings.notifications.sold) ||
                            (!type && settings.notifications.listings);

                        if (shouldShow) {
                            showNotificationPopup(payload.new.title, payload.new.message);
                        }

                        if (settings.notifications.push && "Notification" in window && Notification.permission === "granted") {
                            new Notification(payload.new.title || "StudentKart", {
                                body: payload.new.message || "You have a new StudentKart notification."
                            });
                        }

                        loadNotifications();
                    }
                }
            )
            .subscribe(status => {

                console.log(
                    "Notification realtime status:",
                    status
                );
            });
}


function stopNotificationRefresh() {

    if (
        notificationRefreshTimer
    ) {

        clearInterval(
            notificationRefreshTimer
        );

        notificationRefreshTimer =
            null;
    }

    if (
        notificationRealtimeChannel
    ) {

        supabaseClient.removeChannel(
            notificationRealtimeChannel
        );

        notificationRealtimeChannel =
            null;
    }
}


function showNotificationPopup(
    title,
    message
) {

    let popup =
        document.getElementById(
            "notificationPopup"
        );

    if (!popup) {

        popup =
            document.createElement("div");

        popup.id =
            "notificationPopup";

        popup.innerHTML = `
            <div class="notification-popup-icon">
                <i class="fas fa-bell"></i>
            </div>

            <div class="notification-popup-content">
                <strong></strong>
                <p></p>
            </div>

            <button
                type="button"
                class="notification-popup-close"
                aria-label="Close"
            >
                ×
            </button>
        `;

        document.body.appendChild(
            popup
        );

        popup
            .querySelector(
                ".notification-popup-close"
            )
            .addEventListener(
                "click",
                () => {

                    popup.classList.remove(
                        "show"
                    );

                }
            );
    }

    popup.querySelector(
        ".notification-popup-content strong"
    ).textContent =
        title ||
        "New Notification";

    popup.querySelector(
        ".notification-popup-content p"
    ).textContent =
        message ||
        "You have a new notification.";

    popup.classList.add(
        "show"
    );

    clearTimeout(
        popup.notificationTimer
    );

    popup.notificationTimer =
        setTimeout(
            () => {

                popup.classList.remove(
                    "show"
                );

            },
            5000
        );
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {
    /* Global wishlist delegation — works for dynamically rendered cards too. */
    
/* =========================================================
   PRODUCT IMAGE LONG-PRESS PREVIEW
   ========================================================= */
(() => {
    let pressTimer = null;
    let longPressTriggered = false;
    let pressTarget = null;

    function closeProductImagePreview() {
        const modal = $("productImagePreviewModal");
        if (!modal) return;
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("product-image-preview-open");
        const image = $("productImagePreview");
        if (image) image.src = "";
        const detailsImage = $("detailsImage");
        if (detailsImage) detailsImage.style.removeProperty("user-select");
    }

    function openProductImagePreview(source) {
        const modal = $("productImagePreviewModal");
        const preview = $("productImagePreview");
        if (!modal || !preview || !source) return;
        preview.src = source;
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("product-image-preview-open");
    }

    function clearPress() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        pressTarget = null;
    }

    document.addEventListener("pointerdown", event => {
        const image = event.target.closest(".product-card .product-image, #detailsImage");
        if (!image) return;
        pressTarget = image;
        longPressTriggered = false;
        clearPress();
        pressTarget = image;
        pressTimer = setTimeout(() => {
            if (!pressTarget) return;
            longPressTriggered = true;
            openProductImagePreview(pressTarget.currentSrc || pressTarget.src);
            if (navigator.vibrate) navigator.vibrate(20);
        }, 550);
    }, {passive:true});

    document.addEventListener("pointerup", clearPress, {passive:true});
    document.addEventListener("pointercancel", clearPress, {passive:true});
    document.addEventListener("pointerleave", clearPress, {passive:true});

    document.addEventListener("click", event => {
        if (event.target.closest("[data-close-product-image-preview]")) {
            event.preventDefault();
            closeProductImagePreview();
            return;
        }

        // Prevent the normal image click from firing immediately after
        // a successful long-press preview.
        if (
            longPressTriggered &&
            event.target.closest(".product-card .product-image, #detailsImage")
        ) {
            longPressTriggered = false;
            event.preventDefault();
            event.stopPropagation();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeProductImagePreview();
    });
})();
document.addEventListener("click", event => {
        const wishlistButton = event.target.closest("[data-wishlist-id]");
        if (!wishlistButton) return;

        // Wishlist buttons are rendered in several product containers.
        // Handle the click exactly once so multiple delegated listeners
        // cannot toggle add -> remove (or remove -> add) in the same click.
        event.preventDefault();
        event.stopImmediatePropagation();

        void toggleWishlist(wishlistButton.dataset.wishlistId);
    });


    $("mobileOtpForm")?.addEventListener("submit", verifyMobileOtp);
    $("resendMobileOtpButton")?.addEventListener("click", resendMobileOtp);


    $("otpForm")?.addEventListener("submit", verifyOtp);
    $("resendOtpButton")?.addEventListener("click", resendOtp);

    ensureSellerProfileUI();
    ensureNotificationsUI();


    /* -----------------------------------------
       GENERAL MODAL CLOSE
       ----------------------------------------- */

    document.addEventListener(
        "click",
        event => {

            const closeButton =
                event.target.closest(
                    "[data-close-modal]"
                );

            if (closeButton) {

                const modal =
                    closeButton.closest(
                        ".modal"
                    );

                if (modal) {
                    closeModal(
                        modal.id
                    );
                }
            }
        }
    );

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {
                closeAllModals();
            }
        }
    );


    /* -----------------------------------------
       LOGIN
       ----------------------------------------- */

    $("loginButton")
        ?.addEventListener(
            "click",
            () => {

                openModal(
                    "loginModal"
                );
            }
        );


    /* -----------------------------------------
       SIGNUP
       ----------------------------------------- */

    $("signupButton")
        ?.addEventListener(
            "click",
            () => {

                openModal(
                    "signupModal"
                );
            }
        );


    /* -----------------------------------------
       WISHLIST
       ----------------------------------------- */

    $("wishlistButton")
        ?.addEventListener(
            "click",
            openWishlist
        );


    /* -----------------------------------------
       NOTIFICATIONS
       ----------------------------------------- */

    $("notificationButton")
        ?.addEventListener(
            "click",
            async () => {

                if (!currentUser) {

                    openModal(
                        "loginModal"
                    );

                    showToast(
                        "Please login to see notifications",
                        "warning"
                    );

                    return;
                }

                await loadNotifications();

                renderNotifications();

                openModal(
                    "notificationsModal"
                );
            }
        );

    $("markAllNotificationsButton")
        ?.addEventListener(
            "click",
            markAllNotificationsAsRead
        );

    $("selectAllNotificationsButton")?.addEventListener("click", selectAllNotifications);
    $("markSelectedNotificationsReadButton")?.addEventListener("click", markSelectedNotificationsRead);
    $("deleteSelectedNotificationsButton")?.addEventListener("click", deleteSelectedNotifications);
    $("cancelNotificationSelectionButton")?.addEventListener("click", clearNotificationSelection);

    function beginNotificationLongPress(event) {
        const item = event.target.closest("[data-notification-id]");
        if (!item) return;

        notificationLongPressTriggered = false;
        clearTimeout(notificationLongPressTimer);

        // Require a deliberate 2-second hold before selecting.
        notificationLongPressTimer = setTimeout(() => {
            notificationLongPressTriggered = true;
            toggleNotificationSelection(item.dataset.notificationId);

            if (navigator.vibrate) {
                navigator.vibrate([40, 40, 40]);
            }
        }, 2000);
    }

    function endNotificationLongPress() {
        clearTimeout(notificationLongPressTimer);
    }

    $("notificationsContainer")?.addEventListener("touchstart", beginNotificationLongPress, { passive: true });
    $("notificationsContainer")?.addEventListener("touchend", endNotificationLongPress);
    $("notificationsContainer")?.addEventListener("touchcancel", endNotificationLongPress);

    $("notificationsContainer")?.addEventListener("pointerdown", event => {
        if (event.pointerType === "touch") return;
        beginNotificationLongPress(event);
    });

    $("notificationsContainer")?.addEventListener("pointerup", event => {
        if (event.pointerType === "touch") return;
        endNotificationLongPress();
    });

    $("notificationsContainer")?.addEventListener("pointercancel", event => {
        if (event.pointerType === "touch") return;
        endNotificationLongPress();
    });

    $("notificationsContainer")?.addEventListener("contextmenu", event => event.preventDefault());

    $("notificationsContainer")?.addEventListener("click", event => {
        const item = event.target.closest("[data-notification-id]");
        if (!item) return;

        event.preventDefault();
        event.stopPropagation();

        const id = item.dataset.notificationId;

        if (notificationLongPressTriggered) {
            notificationLongPressTriggered = false;
            return;
        }

        if (selectedNotificationIds.size > 0) {
            toggleNotificationSelection(id);
            return;
        }

        openNotification(id);
    });


    /* -----------------------------------------
       PROFILE
       ----------------------------------------- */

    $("profileButton")
        ?.addEventListener(
            "click",
            openProfile
        );


    /* -----------------------------------------
       SELL
       ----------------------------------------- */

    $("sellButton")
        ?.addEventListener(
            "click",
            openSellModal
        );

    $("heroSellButton")
        ?.addEventListener(
            "click",
            openSellModal
        );

    $("ctaSellButton")
        ?.addEventListener(
            "click",
            openSellModal
        );

    $("emptySellButton")
        ?.addEventListener(
            "click",
            openSellModal
        );


    /* -----------------------------------------
       HERO SEARCH
       ----------------------------------------- */

    $("heroSearchButton")
        ?.addEventListener(
            "click",
            performSearch
        );

    $("heroSearch")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {
                    performSearch();
                }
            }
        );


    /* -----------------------------------------
       MARKETPLACE FILTERS
       ----------------------------------------- */

    $("marketplaceSearch")
        ?.addEventListener(
            "input",
            () => {}
        );

    $("marketplaceSearchButton")
        ?.addEventListener(
            "click",
            () => {
                applyFilters();
                showToast("Search applied", "success");
            }
        );

    [
        "categoryFilter",
        "minPrice",
        "maxPrice",
        "locationFilter",
        "conditionFilter",
        "sortFilter"
    ]
        .forEach(id => {
            $(id)?.addEventListener(
                "input",
                () => {}
            );
        });

    $("bottomCategoriesButton")?.addEventListener("click", () => {
        const modal = $("categoryPickerModal");
        if (!modal) return;

        // Categories must work even when Settings, Chat, Profile, etc. is currently open.
        closeAllModals({ fromPopState: true });
        modal.classList.remove("modal-closing");
        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        document.body.classList.add("studentkart-modal-navigation-hidden");

        if (!studentKartHandlingPopState) {
            setStudentKartModalHistory("categoryPickerModal", ["categoryPickerModal"]);
        }
    });

    document.querySelectorAll(".category-picker-card").forEach(card => {
        card.addEventListener("click", () => openCategoryPage(card.dataset.category));
    });

    $("categoryPageBack")?.addEventListener("click", () => {
    // Category -> picker is one navigation step. Replace the current category
    // entry so browser/Android Back then goes to the real page before Categories.
    showHomePageFromCategory();
    const modal = $("categoryPickerModal");
    if (modal) {
        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        document.body.classList.add("studentkart-modal-navigation-hidden");
        modalHistory = [];
        setStudentKartModalHistory("categoryPickerModal", ["categoryPickerModal"]);
    }
});

    $("categoryPageBrowseAll")?.addEventListener("click", () => {
        showHomePageFromCategory();
        modalHistory = [];
        setStudentKartModalHistory(null, []);
        $("marketplace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    /* -----------------------------------------
       CATEGORY CARDS
       ----------------------------------------- */

    document
        .querySelectorAll(
            ".category-card"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    selectCategory(
                        card.dataset
                            .category
                    );
                }
            );
        });


    /* -----------------------------------------
       NEW USER ENTRY GATE
       ----------------------------------------- */

    $("newUserLoginButton")?.addEventListener("click", openLoginFromNewUserGate);
    $("newUserSignupButton")?.addEventListener("click", openSignupFromNewUserGate);
    $("newUserGuestButton")?.addEventListener("click", enterStudentKartGuestMode);

    /* -----------------------------------------
       AUTH FORMS
       ----------------------------------------- */

    $("loginForm")
        ?.addEventListener(
            "submit",
            loginUser
        );

    $("signupForm")
        ?.addEventListener(
            "submit",
            signupUser
        );

    $("switchToSignup")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                closeModal(
                    "loginModal"
                );

                openModal(
                    "signupModal"
                );
            }
        );

    $("switchToLogin")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                closeModal(
                    "signupModal"
                );

                openModal(
                    "loginModal"
                );
            }
        );


    /* -----------------------------------------
       SELL FORM
       ----------------------------------------- */

    $("sellForm")
        ?.addEventListener(
            "submit",
            submitProduct
        );

    $("productImage")?.addEventListener("change", event => {
        handleImagePreview(event);
        const file = event.target.files?.[0];
        const name = $("productImageFileName");
        if (name) name.textContent = file ? file.name : "No image selected";
    });

    $("productImageChooseButton")?.addEventListener("click", () => {
        $("productImage")?.click();
    });


    /* -----------------------------------------
       PRODUCT DETAILS
       ----------------------------------------- */

    $("contactSellerButton")
        ?.addEventListener(
            "click",
            contactSeller
        );


    /* -----------------------------------------
       INQUIRY
       ----------------------------------------- */

    $("inquiryForm")
        ?.addEventListener(
            "submit",
            submitInquiry
        );


    /* -----------------------------------------
       PROFILE ACTIONS
       ----------------------------------------- */

    $("editProfileButton")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    "profileModal"
                );

                openEditProfile();
            }
        );

    $("myListingsButton")
        ?.addEventListener(
            "click",
            async () => {

                await loadMyListings();

                openModal(
                    "myListingsModal"
                );
            }
        );

    $("myInquiriesButton")
        ?.addEventListener(
            "click",
            async () => {

                await loadReceivedInquiries();

                openModal(
                    "inquiriesModal"
                );
            }
        );

    $("chatButton")
        ?.addEventListener(
            "click",
            () => {

                if (!currentUser) {
                    openModal("loginModal");
                    showToast("Please login to chat", "warning");
                    return;
                }

                // The Chat button is a user gesture, so it is a safe place
                // to request browser notification permission for incoming messages.
                if ("Notification" in window && Notification.permission === "default") {
                    Notification.requestPermission().catch(() => {});
                }

                // Open the Chat section immediately on the first tap.
                setupChatListControls();
                openModal("inquiriesModal");

                // Refresh chat list silently after the section is visible.
                void loadReceivedInquiries().catch(error => {
                    console.error("Chat section background refresh error:", error);
                });
            }
        );

    $("logoutButton")
        ?.addEventListener(
            "click",
            openLogoutConfirmation
        );

    $("logoutConfirmCancel")
        ?.addEventListener(
            "click",
            () => closeModal("logoutConfirmModal")
        );

    $("logoutConfirmButton")
        ?.addEventListener(
            "click",
            logoutUser
        );


    /* -----------------------------------------
       EDIT PROFILE
       ----------------------------------------- */

    // Edit Profile submit is handled by the global capture listener below.

    $("editProfileImage")
        ?.addEventListener(
            "change",
            handleProfileImagePreview
        );


    /* -----------------------------------------
       FOOTER AUTH
       ----------------------------------------- */

    $("footerLoginButton")
        ?.addEventListener(
            "click",
            () => openModal("loginModal")
        );

    $("footerSignupButton")
        ?.addEventListener(
            "click",
            () => openModal("signupModal")
        );

    $("footerProfileButton")
        ?.addEventListener(
            "click",
            () => openModal("profileModal")
        );

    $("footerLogoutButton")
        ?.addEventListener(
            "click",
            () => $("logoutButton")?.click()
        );


    /* -----------------------------------------
       WISHLIST CONTAINER
       ----------------------------------------- */

    $("wishlistContainer")
        ?.addEventListener(
            "click",
            event => {

                const removeButton =
                    event.target.closest(
                        "[data-wishlist-id]"
                    );

                if (removeButton) {

                    event.stopPropagation();

                    removeFromWishlist(
                        removeButton.dataset
                            .wishlistId
                    );

                    return;
                }

                const viewButton =
                    event.target.closest(
                        "[data-wishlist-view]"
                    );

                if (viewButton) {

                    openProductDetails(
                        viewButton.dataset
                            .wishlistView
                    );
                }
            }
        );


    /* -----------------------------------------
       MARKETPLACE PRODUCTS
       ----------------------------------------- */

    $("productContainer")
        ?.addEventListener(
            "click",
            event => {

                const sellerButton =
                    event.target.closest(
                        "[data-seller-id]"
                    );

                if (sellerButton) {

                    event.stopPropagation();

                    openSellerProfile(
                        sellerButton.dataset
                            .sellerId
                    );

                    return;
                }

                const wishlistButton =
                    event.target.closest(
                        "[data-wishlist-id]"
                    );

                if (wishlistButton) {

                    event.stopPropagation();

                    toggleWishlist(
                        wishlistButton.dataset
                            .wishlistId
                    );

                    return;
                }

                const viewButton =
                    event.target.closest(
                        "[data-view-product]"
                    );

                if (viewButton) {

                    openProductDetails(
                        viewButton.dataset
                            .viewProduct
                    );
                }
            }
        );


    /* -----------------------------------------
       CATEGORY PAGE PRODUCTS
       ----------------------------------------- */

    $("categoryProductContainer")
        ?.addEventListener(
            "click",
            event => {

                const sellerButton =
                    event.target.closest(
                        "[data-seller-id]"
                    );

                if (sellerButton) {

                    event.stopPropagation();

                    openSellerProfile(
                        sellerButton.dataset
                            .sellerId
                    );

                    return;
                }

                const wishlistButton =
                    event.target.closest(
                        "[data-wishlist-id]"
                    );

                if (wishlistButton) {

                    event.stopPropagation();

                    toggleWishlist(
                        wishlistButton.dataset
                            .wishlistId
                    );

                    return;
                }

                const viewButton =
                    event.target.closest(
                        "[data-view-product]"
                    );

                if (viewButton) {

                    event.stopPropagation();

                    openProductDetails(
                        viewButton.dataset
                            .viewProduct
                    );
                }
            }
        );


    /* -----------------------------------------
       MY LISTINGS
       ----------------------------------------- */

    $("myListingsContainer")
        ?.addEventListener(
            "click",
            event => {

                const sellButton =
                    event.target.closest(
                        "[data-my-listings-sell]"
                    );

                if (sellButton) {

                    closeModal(
                        "myListingsModal"
                    );

                    openSellModal();

                    return;
                }

                const wishlist =
                    event.target.closest(
                        "[data-wishlist-id]"
                    );

                if (wishlist) {

                    toggleWishlist(
                        wishlist.dataset
                            .wishlistId
                    );

                    return;
                }

                const view =
                    event.target.closest(
                        "[data-my-view]"
                    );

                if (view) {

                    openProductDetails(
                        view.dataset
                            .myView
                    );

                    return;
                }

                const edit =
                    event.target.closest(
                        "[data-my-edit]"
                    );

                if (edit) {

                    const productId =
                        edit.dataset.myEdit;

                    closeModal(
                        "myListingsModal"
                    );

                    // closeModal finishes its animation/history update
                    // asynchronously. Wait for it before opening Edit,
                    // otherwise the old modal's popstate can immediately
                    // close the Edit modal again.
                    window.setTimeout(() => {
                        openEditProduct(productId);
                    }, 260);

                    return;
                }

                const deleteButton =
                    event.target.closest(
                        "[data-my-delete]"
                    );

                if (deleteButton) {

                    deleteProduct(
                        deleteButton.dataset
                            .myDelete
                    );
                }
            }
        );


    /* -----------------------------------------
       SELLER PROFILE LISTINGS
       ----------------------------------------- */

    $("sellerProfileListings")
        ?.addEventListener(
            "click",
            event => {

                const card =
                    event.target.closest(
                        "[data-seller-listing-id]"
                    );

                if (!card) {
                    return;
                }

                const id =
                    card.dataset
                        .sellerListingId;

                openProductDetails(id);
            }
        );


    /* -----------------------------------------
       INQUIRIES
       ----------------------------------------- */

    $("inquiriesContainer")
        ?.addEventListener(
            "click",
            async event => {

                const button =
                    event.target.closest(
                        "[data-inquiry-action]"
                    );

                const card =
                    event.target.closest(
                        ".whatsapp-inquiry-card"
                    );

                if (!button && !card) {
                    return;
                }

                // In chat selection mode, a normal card/button click must
                // select/deselect the chat instead of opening it. The
                // dedicated long-press handler will handle the selection.
                if (chatSelectionMode) {
                    event.preventDefault();
                    return;
                }

                const action =
                    button?.dataset.inquiryAction ||
                    "chat";

                const inquiryId =
                    button?.dataset.inquiryId ||
                    card?.dataset.inquiryId;

                if (action === "chat") {

                    const inquiry =
                        await getInquiryForChat(
                            inquiryId
                        );

                    if (!inquiry) {
                        return;
                    }

                    const product =
                        currentProducts.find(
                            item =>
                                String(item.id) ===
                                String(inquiry.product_id)
                        );

                    inquiry.product_name =
                        product?.name ||
                        "Product Chat";

                    openChat(inquiry);
                    return;
                }

                if (action === "status") {

                    await updateInquiryStatus(
                        inquiryId,
                        button.dataset.status
                    );
                }
            }
        );
}


/* =========================================================
   AUTH LISTENER
   ========================================================= */

async function handleAuthStateChange(event, session) {
    currentUser = session?.user || null;

    if (currentUser) {
        await startSingleSessionListener(
            currentUser,
            event === "SIGNED_IN"
        );
        applyStudentKartSettings();
        await ensureProfileAfterPasswordSignup(currentUser);

        updateNavbar();
        startNotificationRefresh();
        await getWishlist();
        updateWishlistButtons();

        // Start chat unread notifications for this logged-in user.
        await updateChatUnreadCount();
        await startChatUnreadRealtime();
    } else {
        document.body.classList.remove("studentkart-dark");
        await stopSingleSessionListener();
        stopNotificationRefresh();

        if (window.chatUnreadChannel) {
            await supabaseClient.removeChannel(
                window.chatUnreadChannel
            );
            window.chatUnreadChannel = null;
        }

        const chatBadge = $("chatUnreadCount");
        if (chatBadge) {
            chatBadge.textContent = "0";
            chatBadge.classList.add("hidden");
        }

        currentNotifications = [];
        updateNotificationNavbar();
        currentWishlist = [];
        updateWishlistNavbar();
        updateWishlistButtons();
        updateNavbar();
    }

    if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setTimeout(loadProducts, 0);
    }
}

function setupAuthListener() {
    /*
     * IMPORTANT: Supabase documents a deadlock risk when async Supabase
     * calls are awaited directly inside onAuthStateChange. Keep the
     * callback synchronous and defer all async work to the next task.
     */
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;

        setTimeout(() => {
            void handleAuthStateChange(event, session).catch(error => {
                console.error("Deferred auth state handling failed:", error);
            });
        }, 0);
    });
}



/* =========================================================
   NEW USER ENTRY GATE
   ========================================================= */
const STUDENTKART_GUEST_MODE_KEY = "studentkart_guest_mode";

function isStudentKartGuestMode() {
    return localStorage.getItem(STUDENTKART_GUEST_MODE_KEY) === "true";
}

function enterStudentKartGuestMode() {
    localStorage.setItem(STUDENTKART_GUEST_MODE_KEY, "true");
    hideNewUserGate();
    showToast("Continuing as guest", "success");
}

let studentKartGateScrollY = 0;

function showNewUserGate() {
    const gate = $("newUserGate");
    if (!gate || currentUser || isStudentKartGuestMode()) return;

    studentKartGateScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("new-user-gate-lock");
    document.body.style.top = `-${studentKartGateScrollY}px`;
    gate.classList.remove("hidden");
    document.body.classList.add("new-user-gate-open");
}

function hideNewUserGate() {
    const gate = $("newUserGate");
    if (gate) gate.classList.add("hidden");

    document.body.classList.remove("new-user-gate-open");
    document.documentElement.classList.remove("new-user-gate-lock");
    document.body.style.top = "";

    if (studentKartGateScrollY) {
        window.scrollTo(0, studentKartGateScrollY);
    }
}

function openLoginFromNewUserGate() {
    hideNewUserGate();
    openModal("loginModal");
}

function openSignupFromNewUserGate() {
    hideNewUserGate();
    openModal("signupModal");
}

/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeStudentKart() {

    try {

        ensureSellerProfileUI();

        ensureNotificationsUI();

        await getCurrentUser();

        if (currentUser) {
            localStorage.removeItem(STUDENTKART_GUEST_MODE_KEY);
            applyStudentKartSettings();
        }

        updateNavbar();

        if (!currentUser && !isStudentKartGuestMode()) {
            showNewUserGate();
        }

        setupEventListeners();

        setupAuthListener();

        await loadProducts();
        startProductsRealtime();

        if (currentUser) {
            await getWishlist();
            updateWishlistButtons();

            await loadNotifications();

            startNotificationRefresh();

            // Restore chat unread state on page refresh.
            await updateChatUnreadCount();
            await startChatUnreadRealtime();
        }

    } catch (error) {

        console.error(
            error
        );

        showToast(
            "StudentKart could not initialize",
            "error"
        );
    }
}


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.openModal =
    openModal;

window.closeModal =
    closeModal;

window.closeAllModals =
    closeAllModals;

window.toggleWishlist =
    toggleWishlist;

window.openWishlist =
    openWishlist;

window.removeFromWishlist =
    removeFromWishlist;

window.openProductDetails =
    openProductDetails;

window.openSellerProfile =
    openSellerProfile;

window.openSellModal =
    openSellModal;

window.openProfile =
    openProfile;

window.selectCategory =
    selectCategory;

window.performSearch =
    performSearch;

window.loadNotifications =
    loadNotifications;

window.markNotificationAsRead =
    markNotificationAsRead;

window.markAllNotificationsAsRead =
    markAllNotificationsAsRead;

window.openNotification =
    openNotification;


/* =========================================================
   EDIT PROFILE SUBMIT SAFETY HANDLER
   =========================================================
   Keep this outside setupEventListeners() so Edit Profile still
   responds even if another optional UI initializer fails.
   ========================================================= */
document.addEventListener("submit", event => {
    const form = event.target;
    if (form?.id !== "editProfileForm") return;
    saveEditedProfile(event);
}, true);

/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeStudentKart
    );

} else {

    initializeStudentKart();
}
// ===============================
// AUTO DATA REFRESH
// ===============================
let studentKartAutoRefreshTimer = null;
let studentKartAutoRefreshBusy = false;

async function refreshStudentKartData() {
    if (studentKartAutoRefreshBusy || document.hidden) return;
    studentKartAutoRefreshBusy = true;

    try {
        // Keep live activity synchronized without reloading the whole page.
        await loadNotifications();

        if (currentUser) {
            await updateChatUnreadCount();
            await loadReceivedInquiries();
        }
    } catch (error) {
        console.error("Auto refresh error:", error);
    } finally {
        studentKartAutoRefreshBusy = false;
    }
}

function startStudentKartAutoRefresh() {
    if (studentKartAutoRefreshTimer) {
        clearInterval(studentKartAutoRefreshTimer);
    }

    // Default: refresh live data every 2 seconds.
    studentKartAutoRefreshTimer = setInterval(
        refreshStudentKartData,
        2000
    );
}

startStudentKartAutoRefresh();

// ===============================
// CHAT SYSTEM FUNCTIONS
// ===============================

async function openInquiryChat(inquiryId) {
    if (!currentUser) {
        openModal("loginModal");
        showToast("Please login to chat", "warning");
        return;
    }

    try {
        const inquiry = await getInquiryForChat(inquiryId);

        if (!inquiry) {
            showToast("Conversation not found", "error");
            return;
        }

        let productName = "Product Chat";

        const { data: product } = await supabaseClient
            .from("products")
            .select("name")
            .eq("id", inquiry.product_id)
            .maybeSingle();

        if (product?.name) {
            productName = product.name;
        }

        inquiry.product_name = productName;
        await openChat(inquiry);
    } catch (error) {
        console.error("Open chat error:", error);
        showToast("Could not open chat", "error");
    }
}

async function removeHiddenChat(inquiryId) {
    if (!currentUser || !inquiryId) return;

    const { error } = await supabaseClient
        .from("hidden_chats")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("inquiry_id", inquiryId);

    if (error) {
        console.error("Unhide chat error:", error);
    }
}

async function deleteChatForMe() {
    if (!currentUser || !currentChatInquiry?.id) return;

    const inquiryId = currentChatInquiry.id;

    const { error } = await supabaseClient
        .from("hidden_chats")
        .upsert(
            {
                user_id: currentUser.id,
                inquiry_id: inquiryId
            },
            {
                onConflict: "user_id,inquiry_id"
            }
        );

    if (error) {
        console.error("Delete chat for me error:", error);
        showToast("Could not delete chat", "error");
        return;
    }

    closeChatDeleteMenu();
    stopChatRealtime();
    currentChatInquiry = null;
    closeModal("chatModal");
    await updateChatUnreadCount();
    await loadReceivedInquiries();
    showToast("Chat deleted for you", "success");
}

async function deleteChatForEveryone() {
    if (!currentUser || !currentChatInquiry?.id) return;

    const inquiryId = currentChatInquiry.id;

    const confirmed = window.confirm(
        "Delete this entire conversation for everyone? This cannot be undone."
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("messages")
        .delete()
        .eq("inquiry_id", inquiryId);

    if (error) {
        console.error("Delete chat for everyone error:", error);
        showToast("Could not delete conversation", "error");
        return;
    }

    await removeHiddenChat(inquiryId);
    closeChatDeleteMenu();
    stopChatRealtime();
    currentChatInquiry = null;
    closeModal("chatModal");
    await updateChatUnreadCount();
    await loadReceivedInquiries();
    showToast("Chat deleted for everyone", "success");
}

function getSelectedInquiryIds() {
    // Chat list now uses long-press selection instead of checkboxes.
    return Array.from(selectedChatIds);
}

function updateBulkInquiryToolbar() {
    const ids = getSelectedInquiryIds();
    const count = ids.length;

    const countEl = $("selectedInquiryCount");
    const markButton = $("bulkMarkRepliedButton");
    const deleteButton = $("bulkDeleteForMeButton");

    if (countEl) {
        countEl.textContent = count + (count === 1 ? " selected" : " selected");
        countEl.classList.toggle("hidden", count === 0);
    }

    if (markButton) markButton.classList.toggle("hidden", count === 0);
    if (deleteButton) deleteButton.classList.toggle("hidden", count === 0);

    document.querySelectorAll(".whatsapp-inquiry-card").forEach(card => {
        card.classList.toggle(
            "is-selected",
            selectedChatIds.has(String(card.dataset.inquiryId))
        );
    });
}

async function bulkMarkInquiriesRead() {
    const ids = getSelectedInquiryIds();
    if (!ids.length || !currentUser) return;

    // Update the visible UI immediately; sync Supabase in the background.
    chatListOptimisticBusy = true;

    const selectedCards = Array.from(document.querySelectorAll(".whatsapp-inquiry-card"))
        .filter(card => ids.includes(String(card.dataset.inquiryId)));

    selectedCards.forEach(card => {
        card.dataset.chatUnread = "false";
        card.querySelector(".chat-unread-badge")?.remove();
        card.querySelector(".whatsapp-inquiry-unread")?.remove();
    });

    exitChatSelectionMode();
    applyChatListFilter();
    updateChatUnreadCount();

    showToast(
        ids.length + " chat" + (ids.length === 1 ? "" : "s") + " marked as read",
        "success"
    );

    const { error } = await supabaseClient
        .from("messages")
        .update({ is_read: true })
        .in("inquiry_id", ids)
        .eq("receiver_id", currentUser.id)
        .eq("is_read", false);

    if (error) {
        console.error("Bulk mark read error:", error);
        showToast("Sync failed. Refreshing chat list...", "error");
    }

    chatListOptimisticBusy = false;

    if (error) {
        await loadReceivedInquiries();
        await updateChatUnreadCount();
    }
}

async function bulkMarkInquiriesUnread() {
    const ids = getSelectedInquiryIds();
    if (!ids.length || !currentUser) return;

    const { data: receivedMessages, error: fetchError } =
        await supabaseClient
            .from("messages")
            .select("id,inquiry_id,created_at")
            .in("inquiry_id", ids)
            .eq("receiver_id", currentUser.id)
            .order("created_at", { ascending: false });

    if (fetchError) {
        console.error("Bulk mark unread fetch error:", fetchError);
        showToast("Could not mark selected chats as unread", "error");
        return;
    }

    const latestMessageIds = [];
    const seenInquiryIds = new Set();

    (receivedMessages || []).forEach(message => {
        const inquiryId = String(message.inquiry_id);
        if (!seenInquiryIds.has(inquiryId)) {
            seenInquiryIds.add(inquiryId);
            latestMessageIds.push(message.id);
        }
    });

    if (!latestMessageIds.length) {
        showToast("No received messages in the selected chats", "warning");
        return;
    }

    const { error } = await supabaseClient
        .from("messages")
        .update({ is_read: false })
        .in("id", latestMessageIds)
        .eq("receiver_id", currentUser.id);

    if (error) {
        console.error("Bulk mark unread error:", error);
        showToast("Could not mark selected chats as unread", "error");
        return;
    }

    showToast(
        ids.length + " chat" + (ids.length === 1 ? "" : "s") + " marked as unread",
        "success"
    );

    exitChatSelectionMode();
    await updateChatUnreadCount();
    await loadReceivedInquiries();
}

async function bulkMarkInquiriesReplied() {
    const ids = getSelectedInquiryIds();
    if (!ids.length || !currentUser) return;

    const { error } = await supabaseClient
        .from("inquiries")
        .update({ status: "replied" })
        .in("id", ids)
        .eq("seller_id", currentUser.id);

    if (error) {
        console.error("Bulk mark replied error:", error);
        showToast("Could not update selected chats", "error");
        return;
    }

    showToast(ids.length + " chat" + (ids.length === 1 ? "" : "s") + " marked replied", "success");
    await loadReceivedInquiries();
}

async function bulkDeleteInquiriesForMe() {
    const ids = getSelectedInquiryIds();
    if (!ids.length || !currentUser) return;

    const confirmed = window.confirm(
        "Delete " + ids.length + " selected chat" + (ids.length === 1 ? "" : "s") + " for you?"
    );

    if (!confirmed) return;

    // Keep auto-refresh from restoring the chats before the database sync finishes.
    chatListOptimisticBusy = true;

    // Hide selected chats immediately so the action feels instant.
    const selectedCards = Array.from(document.querySelectorAll(".whatsapp-inquiry-card"))
        .filter(card => ids.includes(String(card.dataset.inquiryId)));

    selectedCards.forEach(card => card.remove());

    exitChatSelectionMode();
    applyChatListFilter();
    updateChatUnreadCount();

    showToast(
        ids.length + " chat" + (ids.length === 1 ? "" : "s") + " deleted for you",
        "success"
    );

    const rows = ids.map(inquiryId => ({
        user_id: currentUser.id,
        inquiry_id: inquiryId
    }));

    const { error } = await supabaseClient
        .from("hidden_chats")
        .upsert(rows, { onConflict: "user_id,inquiry_id" });

    if (error) {
        console.error("Bulk delete for me error:", error);
        showToast("Delete sync failed. Refreshing chat list...", "error");
    }

    chatListOptimisticBusy = false;

    if (error) {
        await loadReceivedInquiries();
        await updateChatUnreadCount();
    }
}

function closeChatDeleteMenu() {
    const menu = $("chatDeleteMenu");
    if (menu) {
        menu.classList.add("hidden");
    }
}

async function loadChatContactProfile() {
    const otherUserId = window.currentChatOtherUserId;
    if (!otherUserId) return;

    try {
        const fallback = currentProducts.find(
            product => String(product.userId) === String(otherUserId)
        );
        const profile = await getSellerProfileData(otherUserId, fallback);
        if (!profile) return;

        const name = profile.name || "Student";
        const college = profile.college || "College not added";

        const avatarUrl =
            profile.avatar_url ||
            fallback?.avatarUrl ||
            fallback?.avatar_url ||
            "";

        console.log("Chat avatar:", avatarUrl);

        ["chatProfileName"].forEach(id => {
            const el = $(id);
            if (el) el.textContent = name;
        });

        const collegeEl = $("chatProfileCollege");
        if (collegeEl) collegeEl.textContent = college;

        const profileImg = $("chatProfileAvatarImage");
        const profileIcon = $("chatProfileAvatarIcon");
        if (profileImg && profileIcon) {
            profileImg.src = avatarUrl;
            profileIcon.style.display = avatarUrl ? "none" : "";
        }

        const headerImg = $("chatAvatarImage");
        const headerIcon = $("chatAvatarIcon");
        if (headerImg && headerIcon) {
            headerImg.src = avatarUrl;
            headerIcon.style.display = avatarUrl ? "none" : "";
        }

    } catch (error) {
        console.warn("Chat contact profile refresh error:", error);
    }
}

function isChatUserBlocked(userId) {
    if (!userId || !currentUser) return false;
    const blocked = getStudentKartSettings()?.privacy?.blockedUsers;
    return Array.isArray(blocked) && blocked.map(String).includes(String(userId));
}

async function blockCurrentChatUser() {
    if (!currentUser || !currentChatInquiry) return;
    const otherUserId = window.currentChatOtherUserId ||
        (String(currentChatInquiry.seller_id) === String(currentUser.id)
            ? currentChatInquiry.buyer_id
            : currentChatInquiry.seller_id);

    if (!otherUserId || String(otherUserId) === String(currentUser.id)) {
        showToast("User information unavailable", "warning");
        return;
    }

    if (isChatUserBlocked(otherUserId)) {
        showToast("User is already blocked", "info");
        return;
    }

    const settings = getStudentKartSettings();
    settings.privacy.blockedUsers = [
        ...(Array.isArray(settings.privacy.blockedUsers) ? settings.privacy.blockedUsers.map(String) : []),
        String(otherUserId)
    ];

    const saved = await saveStudentKartSettings(settings, true);
    if (!saved) {
        showToast("Could not block this user", "error");
        return;
    }

    closeChatDeleteMenu();
    closeModal("chatModal");
    showToast("User blocked. You will not be able to message this user.", "success");
}

function openChat(inquiry) {

    if (!currentUser) {
        openModal("loginModal");
        showToast("Please login first", "warning");
        return;
    }

    if (!inquiry || !inquiry.id) {
        showToast("Chat information unavailable", "error");
        return;
    }

    const otherParticipantId =
        String(inquiry.seller_id) === String(currentUser.id)
            ? inquiry.buyer_id
            : inquiry.seller_id;

    if (isChatUserBlocked(otherParticipantId)) {
        showToast("This user is blocked. Unblock them from Privacy & Safety to chat again.", "warning");
        return;
    }

    currentChatInquiry = inquiry;
    clearChatMessageSelection();

    if ($("chatProductName")) {
        $("chatProductName").textContent =
            inquiry.product_name || "Product Chat";
    }

    if ($("chatUserName")) {
        const otherUser =
            inquiry.direct_user_name ||
            (
                inquiry.seller_id === currentUser.id
                    ? "Buyer"
                    : "Seller"
            );

        $("chatUserName").textContent = otherUser;
    }

    // Store the other participant so the chat header can open their profile.
    window.currentChatOtherUserId =
        String(inquiry.seller_id) === String(currentUser.id)
            ? inquiry.buyer_id
            : inquiry.seller_id;

    void loadChatContactProfile();

    /*
     * Chat is a child of the Chats list. Keep that relationship explicit
     * so Android/browser Back restores the chat list instead of Home.
     */
    const chatListIsOpen = Boolean(
        document.getElementById("inquiriesModal") &&
        !document.getElementById("inquiriesModal").classList.contains("hidden")
    );

    if (chatListIsOpen) {
        /*
         * Normalize the current history entry first. This prevents stale
         * modal entries from accumulating when Chat is opened repeatedly.
         * Then openModal() creates exactly ONE Chat entry on top of Chats.
         */
        modalHistory = [];

        ensureStudentKartHistory();
        window.history.replaceState(
            {
                studentKart: true,
                modalId: "inquiriesModal",
                modalStack: ["inquiriesModal"]
            },
            "",
            window.location.pathname + window.location.search + "#inquiriesModal"
        );
    }

    openModal("chatModal");

    document.body.classList.add("studentkart-chat-open");

    // Open instantly; all database work continues silently in the background.
    void (async () => {
        try {
            await removeHiddenChat(inquiry.id);
            await markChatMessagesRead(inquiry.id);
            await Promise.all([
                loadReceivedInquiries(),
                updateChatUnreadCount(),
                loadChatMessages()
            ]);
        } catch (error) {
            console.error("Background chat open refresh error:", error);
        }
    })();

    void startChatPresence(window.currentChatOtherUserId);
    startChatRealtime();
}



// Open the other participant's profile by tapping the chat header.
function showChatsFromChat() {
    const chatModal = $("chatModal");
    const inquiriesModal = $("inquiriesModal");

    if (!chatModal || !inquiriesModal) return;

    chatModal.classList.remove("modal-closing");
    chatModal.classList.add("hidden");

    inquiriesModal.classList.remove("modal-closing");
    inquiriesModal.classList.remove("hidden");

    document.body.classList.add("modal-open");
    document.body.classList.add("studentkart-modal-navigation-hidden");
    document.body.classList.remove("studentkart-chat-open");

    modalHistory = [];

    ensureStudentKartHistory();
    window.history.replaceState(
        {
            studentKart: true,
            modalId: "inquiriesModal",
            modalStack: ["inquiriesModal"]
        },
        "",
        window.location.pathname + window.location.search + "#inquiriesModal"
    );
}

$("chatModal")?.querySelector(".chat-person")?.addEventListener("click", async () => {
    if (!currentChatInquiry || !currentUser) return;

    const otherUserId =
        window.currentChatOtherUserId ||
        (
            String(currentChatInquiry.seller_id) === String(currentUser.id)
                ? currentChatInquiry.buyer_id
                : currentChatInquiry.seller_id
        );

    if (!otherUserId) {
        showToast("User profile unavailable", "warning");
        return;
    }

    await openSellerProfile(otherUserId);
});

$("chatModal")?.querySelector(".chat-person")?.style.setProperty("cursor", "pointer");



$("chatVoiceCallButton")?.addEventListener("click", () => {
    showToast("Voice calls will be available soon.", "info");
});

$("chatVideoCallButton")?.addEventListener("click", () => {
    showToast("Video calls will be available soon.", "info");
});

// The send button is the chat form's submit button.
// Do not intercept its click here; otherwise typed messages never reach
// the form submit handler.



$("chatBackButton")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    const chatModal = $("chatModal");
    if (!chatModal || chatModal.classList.contains("hidden")) return;

    const parentId = modalHistory.length
        ? modalHistory[modalHistory.length - 1]
        : "inquiriesModal";

    const parentModal = $(parentId) || $("inquiriesModal");

    chatModal.classList.remove("modal-closing");
    chatModal.classList.add("hidden");
    document.body.classList.remove("studentkart-chat-open");

    if (parentModal) {
        parentModal.classList.remove("modal-closing");
        parentModal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        document.body.classList.add("studentkart-modal-navigation-hidden");
        modalHistory = [];
        setStudentKartModalHistory(parentModal.id, [parentModal.id]);
    } else {
        modalHistory = [];
        document.body.classList.remove("modal-open");
        document.body.classList.remove("studentkart-modal-navigation-hidden");
        setStudentKartModalHistory(null, []);
    }
});


let selectedChatMessageIds = new Set();

function getHiddenChatMessageKey() {
    return currentUser && currentChatInquiry
        ? "studentkart-hidden-messages-" + String(currentUser.id) + "-" + String(currentChatInquiry.id)
        : "";
}

function getHiddenChatMessageIds() {
    const key = getHiddenChatMessageKey();
    if (!key) return new Set();
    try {
        const raw = JSON.parse(localStorage.getItem(key) || "[]");
        return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
        return new Set();
    }
}

function saveHiddenChatMessageIds(ids) {
    const key = getHiddenChatMessageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}


let chatSwipeStartX = 0;
let chatSwipeStartY = 0;
let chatSwipeMessageEl = null;
let chatSwipeMoved = false;

function startChatSwipeReply(event) {
    const messageEl = event.target.closest(".chat-message");
    if (!messageEl || selectedChatMessageIds.size > 0) return;
    chatSwipeMessageEl = messageEl;
    chatSwipeStartX = event.clientX;
    chatSwipeStartY = event.clientY;
    chatSwipeMoved = false;
}

function moveChatSwipeReply(event) {
    if (!chatSwipeMessageEl || selectedChatMessageIds.size > 0) return;
    const dx = event.clientX - chatSwipeStartX;
    const dy = event.clientY - chatSwipeStartY;
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 8) return;
    // Horizontal swipe has started, so cancel long-press selection detection.
    clearTimeout(chatLongPressTimer);
    chatLongPressTriggered = false;
    chatSwipeMoved = true;
    if (dx > 0 && dx < 72) {
        chatSwipeMessageEl.style.transform = "translateX(" + dx + "px)";
    }
}

function endChatSwipeReply(event) {
    if (!chatSwipeMessageEl) return;
    const messageEl = chatSwipeMessageEl;
    const dx = event.clientX - chatSwipeStartX;
    const dy = event.clientY - chatSwipeStartY;
    const shouldReply = chatSwipeMoved && dx >= 55 && Math.abs(dx) > Math.abs(dy) * 1.25;

    messageEl.style.transform = "";
    chatSwipeMessageEl = null;
    chatSwipeMoved = false;

    if (!shouldReply || selectedChatMessageIds.size > 0) return;

    const bubble = messageEl.querySelector(".chat-message-bubble");
    const text = bubble?.textContent?.trim() ||
        (messageEl.dataset.messageType === "image" ? "Photo" :
        messageEl.dataset.messageType === "video" ? "Video" : "Message");
    const input = $("chatInput");
    if (!input) return;

    chatReplyTarget = { id: messageEl.dataset.messageId || "", text, mediaType: messageEl.dataset.messageType || "text", mediaUrl: messageEl.querySelector(".chat-message-image, .chat-message-video source")?.src || "" };
    setChatReplyPreview(text, "Replying to message");
    input.focus();
    showToast("Reply ready", "success");
}

let chatLongPressTimer = null;
let chatLongPressTriggered = false;

function updateChatMessageSelectionUI() {
    document.querySelectorAll("#chatMessages .chat-message").forEach(messageEl => {
        messageEl.classList.toggle(
            "chat-message-selected",
            selectedChatMessageIds.has(String(messageEl.dataset.messageId))
        );
    });
    const count = $("chatMessageSelectionHeaderCount");
    const header = $("chatMessageSelectionHeader");
    if (count) count.textContent = String(selectedChatMessageIds.size);
    if (header) header.classList.toggle("hidden", selectedChatMessageIds.size === 0);
}

function toggleChatMessageSelection(messageId) {
    const id = String(messageId);
    if (selectedChatMessageIds.has(id)) selectedChatMessageIds.delete(id);
    else selectedChatMessageIds.add(id);
    updateChatMessageSelectionUI();
}

function clearChatMessageSelection() {
    selectedChatMessageIds.clear();
    updateChatMessageSelectionUI();
}

function beginChatMessageLongPress(event) {
    const messageEl = event.target.closest(".chat-message");
    if (!messageEl || !messageEl.dataset.messageId) return;
    chatLongPressTriggered = false;
    clearTimeout(chatLongPressTimer);
    chatLongPressTimer = setTimeout(() => {
        chatLongPressTriggered = true;
        // A long-press enters selection mode; it must not immediately
        // toggle an already-selected message back off.
        if (!selectedChatMessageIds.has(String(messageEl.dataset.messageId))) {
            toggleChatMessageSelection(messageEl.dataset.messageId);
        }
        if (navigator.vibrate) navigator.vibrate(35);
    }, 800);
}

function endChatMessageLongPress() {
    clearTimeout(chatLongPressTimer);
}

$("chatMessages")?.addEventListener("pointerdown", startChatSwipeReply);
$("chatMessages")?.addEventListener("pointermove", moveChatSwipeReply);
$("chatMessages")?.addEventListener("pointerup", endChatSwipeReply);
$("chatMessages")?.addEventListener("pointercancel", endChatSwipeReply);

$("chatMessages")?.addEventListener("pointerdown", beginChatMessageLongPress);
$("chatMessages")?.addEventListener("pointerup", endChatMessageLongPress);
$("chatMessages")?.addEventListener("pointercancel", endChatMessageLongPress);
$("chatMessages")?.addEventListener("pointerleave", endChatMessageLongPress);

// Prevent Chrome's native image long-press/context menu so a deliberate hold
// selects the chat message instead.
$("chatMessages")?.addEventListener("contextmenu", event => {
    const messageEl = event.target.closest(".chat-message");
    if (!messageEl) return;
    event.preventDefault();
    event.stopPropagation();
    if (messageEl.dataset.messageId && !selectedChatMessageIds.has(String(messageEl.dataset.messageId))) {
        chatLongPressTriggered = true;
        toggleChatMessageSelection(messageEl.dataset.messageId);
        if (navigator.vibrate) navigator.vibrate(35);
    }
});

$("chatMessages")?.addEventListener("click", async event => {
    const quoted = event.target.closest(".chat-quoted-message");
    if (quoted) {
        event.preventDefault();
        event.stopPropagation();
        locateQuotedChatMessage(quoted.dataset.replyToId);
        return;
    }
    const profileButton = event.target.closest("#chatViewProfileButton");
    if (profileButton) {
        event.preventDefault();
        event.stopPropagation();

        const inquiry = currentChatInquiry;
        const otherUserId =
            window.currentChatOtherUserId ||
            (
                inquiry
                    ? (
                        String(inquiry.seller_id) === String(currentUser?.id)
                            ? inquiry.buyer_id
                            : inquiry.seller_id
                    )
                    : null
            );

        if (!otherUserId) {
            showToast("User profile unavailable", "warning");
            return;
        }

        window.currentChatOtherUserId = String(otherUserId);

        if (profileButton.disabled) return;

        const originalHtml = profileButton.innerHTML;
        profileButton.disabled = true;
        profileButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening...';

        try {
            await openSellerProfile(String(otherUserId));
        } catch (error) {
            console.error("Chat View Profile error:", error);
            showToast("Could not open profile. Please try again.", "error");
        } finally {
            profileButton.disabled = false;
            profileButton.innerHTML = originalHtml;
        }
        return;
    }

    const messageEl = event.target.closest(".chat-message");
    if (!messageEl) return;

    if (chatLongPressTriggered) {
        chatLongPressTriggered = false;
        return;
    }

    if (selectedChatMessageIds.size > 0) {
        // Selection mode must completely consume the click. The media viewer
        // is registered on the same #chatMessages element later in the script,
        // so stopPropagation() alone is not enough; stopImmediatePropagation()
        // prevents that later listener from opening the photo/video.
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleChatMessageSelection(messageEl.dataset.messageId);
        return;
    }
});

$("clearChatSelectionButton")?.addEventListener("click", clearChatMessageSelection);
$("chatMessageSelectionCancel")?.addEventListener("click", clearChatMessageSelection);
$("chatHeaderReplySelected")?.addEventListener("click", replyToSelectedChatMessage);
$("chatHeaderCopySelected")?.addEventListener("click", copySelectedChatMessages);
$("chatHeaderDeleteSelected")?.addEventListener("click", openSelectedChatDeletePopup);
$("chatHeaderMoreSelected")?.addEventListener("click", () => {
    const actions = $("chatSelectionHeaderMoreMenu");
    if (actions) actions.classList.toggle("hidden");
});
$("copySelectedChatButton")?.addEventListener("click", copySelectedChatMessages);
$("replySelectedChatButton")?.addEventListener("click", replyToSelectedChatMessage);
$("deleteSelectedChatForMeButton")?.addEventListener("click", deleteSelectedChatMessagesForMe);
$("deleteSelectedChatButton")?.addEventListener("click", deleteSelectedChatMessagesForEveryone);

function getSelectedChatMessageElements() {
    return Array.from(
        document.querySelectorAll("#chatMessages .chat-message")
    ).filter(messageEl =>
        selectedChatMessageIds.has(String(messageEl.dataset.messageId))
    );
}

async function copySelectedChatMessages() {
    const messages = getSelectedChatMessageElements()
        .map(el => el.querySelector(".chat-message-bubble")?.textContent?.trim())
        .filter(Boolean);

    if (!messages.length) return;

    const textToCopy = messages.join("\n");

    try {
        await navigator.clipboard.writeText(textToCopy);
    } catch (error) {
        const helper = document.createElement("textarea");
        helper.value = textToCopy;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
    }

    showToast(
        messages.length + " message" + (messages.length === 1 ? "" : "s") + " copied",
        "success"
    );
}

function replyToSelectedChatMessage() {
    const messages = getSelectedChatMessageElements();
    if (!messages.length) return;

    const target = messages[messages.length - 1];
    const bubble = target.querySelector(".chat-message-bubble");
    const input = $("chatInput");

    if (!bubble || !input) return;

    const quoted = bubble.textContent.trim();
    chatReplyTarget = { id: target.dataset.messageId || "", text: quoted, mediaType: target.dataset.messageType || "text", mediaUrl: target.querySelector(".chat-message-image, .chat-message-video source")?.src || "" };
    input.value = "";
    setChatReplyPreview(quoted, "Replying to message");
    input.focus();
    clearChatMessageSelection();
    showToast("Reply ready", "success");
}

function openSelectedChatDeletePopup() {
    if (!selectedChatMessageIds.size) return;
    const modal = $("chatSelectionDeleteModal");
    const text = $("chatSelectionDeleteText");
    const count = selectedChatMessageIds.size;
    if (text) {
        text.textContent = "Choose how you want to delete " + count + " selected message" + (count === 1 ? "" : "s") + ".";
    }
    if (modal) {
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
    }
}

function closeSelectedChatDeletePopup() {
    const modal = $("chatSelectionDeleteModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
    }
}

async function deleteSelectedChatMessagesForMe() {
    if (!currentUser || !selectedChatMessageIds.size) return;

    const ids = Array.from(selectedChatMessageIds).map(String);
    const hidden = getHiddenChatMessageIds();
    ids.forEach(id => hidden.add(id));
    saveHiddenChatMessageIds(hidden);

    closeSelectedChatDeletePopup();
    selectedChatMessageIds.clear();
    await loadChatMessages();
    showToast(ids.length + " message" + (ids.length === 1 ? "" : "s") + " deleted for you", "success");
}

async function deleteSelectedChatMessagesForEveryone() {
    if (!currentUser || !selectedChatMessageIds.size) return;

    const selectedElements = getSelectedChatMessageElements();
    const ownIds = selectedElements
        .filter(el => String(el.dataset.senderId) === String(currentUser.id))
        .map(el => el.dataset.messageId)
        .filter(Boolean);

    if (!ownIds.length) {
        closeSelectedChatDeletePopup();
        showToast("Delete for Everyone is only available for messages you sent", "warning");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("messages")
            .delete()
            .in("id", ownIds)
            .eq("sender_id", currentUser.id);

        if (error) throw error;

        closeSelectedChatDeletePopup();
        selectedChatMessageIds.clear();
        await loadChatMessages();

        const extra = ownIds.length < selectedElements.length
            ? " Received messages were kept in the chat."
            : "";
        showToast(
            ownIds.length + " message" + (ownIds.length === 1 ? "" : "s") +
            " deleted for everyone." + extra,
            "success"
        );
    } catch (error) {
        console.error("Delete for everyone error:", error);
        showToast("Could not delete selected messages for everyone", "error");
    }
}

$("deleteSelectedChatForMePopup")?.addEventListener("click", deleteSelectedChatMessagesForMe);
$("deleteSelectedChatForEveryonePopup")?.addEventListener("click", deleteSelectedChatMessagesForEveryone);
$("cancelSelectedChatDelete")?.addEventListener("click", closeSelectedChatDeletePopup);
document.addEventListener("click", event => {
    if (event.target.closest("[data-close-selection-delete]")) closeSelectedChatDeletePopup();
});


function parseChatImageMessage(value) {
    const raw = String(value || "");
    const prefix = "__STUDENTKART_IMAGE__";
    if (!raw.startsWith(prefix)) return null;
    try {
        const data = JSON.parse(raw.slice(prefix.length));
        if (!data?.url) return null;
        return { url: data.url, caption: data.caption || "" };
    } catch {
        return null;
    }
}

function createChatReplyMessage(message, replyTarget) {
    return "__STUDENTKART_REPLY__" + JSON.stringify({
        replyTo: { id: String(replyTarget?.id || ""), text: String(replyTarget?.text || "").slice(0, 500), mediaType: replyTarget?.mediaType || "text", mediaUrl: replyTarget?.mediaUrl || "" },
        content: String(message || "")
    });
}

function parseChatReplyMessage(value) {
    const raw = String(value || "");
    const prefix = "__STUDENTKART_REPLY__";
    if (!raw.startsWith(prefix)) return null;
    try { const data = JSON.parse(raw.slice(prefix.length)); return data?.replyTo ? { replyTo: data.replyTo, content: String(data.content || "") } : null; } catch { return null; }
}

function createChatImageMessage(url, caption = "", mediaType = "image") {
    return "__STUDENTKART_MEDIA__" + JSON.stringify({
        url,
        caption: String(caption || "").slice(0, 1000),
        mediaType: mediaType === "video" ? "video" : "image"
    });
}

function parseChatMediaMessage(value) {
    const raw = String(value || "");
    const prefixes = ["__STUDENTKART_MEDIA__", "__STUDENTKART_IMAGE__"];
    const prefix = prefixes.find(item => raw.startsWith(item));
    if (!prefix) return null;
    try {
        const data = JSON.parse(raw.slice(prefix.length));
        if (!data?.url) return null;
        return {
            url: data.url,
            caption: data.caption || "",
            mediaType: data.mediaType === "video" ? "video" : "image"
        };
    } catch {
        return null;
    }
}

function locateQuotedChatMessage(messageId) {
    const id = String(messageId || "").trim();
    if (!id) return;

    const messages = Array.from(document.querySelectorAll("#chatMessages .chat-message"));
    const target = messages.find(el => String(el.dataset.messageId || "") === id);

    if (!target) {
        showToast("Original message is not available", "warning");
        return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("chat-quoted-target-highlight");
    target.classList.add("chat-quoted-target-highlight");

    window.clearTimeout(window.__studentKartQuotedHighlightTimer);
    window.__studentKartQuotedHighlightTimer = window.setTimeout(() => {
        target.classList.remove("chat-quoted-target-highlight");
    }, 1600);
}

async function loadChatMessages() {

    if (!currentChatInquiry || !currentUser) return;

    const container = $("chatMessages");
    if (!container) return;

    /*
     * Message refresh is intentionally silent.
     * Keep the current chat visible while Supabase fetches in the
     * background so realtime refreshes never show a loading bubble.
     */
    try {
        const { data, error } = await supabaseClient
            .from("messages")
            .select("*")
            .eq("inquiry_id", currentChatInquiry.id)
            .order("created_at", { ascending: true });

        if (error) throw error;

        const hiddenMessageIds = getHiddenChatMessageIds();
        const visibleMessages = (data || []).filter(message => !hiddenMessageIds.has(String(message.id)));

        const nextSignature = JSON.stringify(visibleMessages.map(message => [
            message.id,
            message.updated_at || message.created_at,
            message.message,
            message.is_read
        ]));

        if (container.dataset.messageSignature === nextSignature) return;
        container.dataset.messageSignature = nextSignature;

        const profileIntro = container.querySelector("#chatProfileIntro");
        const profileIntroHtml = profileIntro ? profileIntro.outerHTML : "";

        if (!visibleMessages || visibleMessages.length === 0) {
            container.innerHTML = profileIntroHtml + `
                <div class="chat-empty">
                    <i class="fas fa-comment-dots"></i>
                    <p>No messages yet.</p>
                    <span>Start the conversation below.</span>
                </div>`;
            return;
        }



        container.innerHTML = profileIntroHtml + visibleMessages.map(message => {
            const isMine = message.sender_id === currentUser.id;
            const reply = parseChatReplyMessage(message.message);
            const actualMessage = reply ? reply.content : message.message;
            const image = parseChatMediaMessage(actualMessage);
            let content = "";
            let replyHtml = "";
            if (reply) {
                const quoted = reply.replyTo || {};
                const quotedText = quoted.text || (quoted.mediaType === "video" ? "Video" : quoted.mediaType === "image" ? "Photo" : "Message");
                replyHtml = '<div class="chat-quoted-message" data-reply-to-id="' + escapeHtml(String(quoted.id || "")) + '" role="button" tabindex="0"><span class="chat-quoted-line"></span><div class="chat-quoted-content"><strong>Replying to</strong><span>' + escapeHtml(quotedText).slice(0, 180) + '</span></div></div>';
            }

            if (image) {
                const safeUrl = escapeHtml(image.url);
                const caption = image.caption
                    ? `<div class="chat-image-caption">${escapeHtml(image.caption)}</div>`
                    : "";

                if (image.mediaType === "video") {
                    content = `
                        <video class="chat-message-video" controls playsinline preload="metadata">
                            <source src="${safeUrl}">
                            Your browser does not support video playback.
                        </video>
                        ${caption}
                    `;
                } else {
                    content = `
                        <img class="chat-message-image"
                             src="${safeUrl}"
                             alt="Shared photo"
                             loading="lazy"
                             data-chat-image="${safeUrl}">
                        ${caption}
                    `;
                }
            } else {
                content = `<div class="chat-message-bubble">${escapeHtml(actualMessage)}</div>`;
            }

            return `
                <div class="chat-message ${isMine ? "chat-message-own sent" : "chat-message-other received"}"
                     data-message-id="${escapeHtml(String(message.id))}"
                     data-sender-id="${escapeHtml(String(message.sender_id || ""))}"
                     data-message-type="${image ? image.mediaType : "text"}">
                    <span class="chat-message-selection-check" aria-hidden="true"><i class="fas fa-check"></i></span>
                    ${replyHtml}
                    ${content}
                    <small class="chat-message-time">
                        ${formatChatTime(message.created_at)}
                    </small>
                </div>`;
        }).join("");

        updateChatMessageSelectionUI();
        scrollChatToBottom();

    } catch (error) {
        console.error("Load chat messages error:", error);
        const profileIntro = container.querySelector("#chatProfileIntro");
        container.innerHTML = (profileIntro ? profileIntro.outerHTML : "") + `
            <div class="chat-empty">
                Could not load messages.
            </div>`;
    } finally {
        /* No visible loading state here — chat refresh stays in background. */
    }
}

async function sendChatMessage(event) {

    event.preventDefault();

    if (!currentUser || !currentChatInquiry) return;

    const chatOtherUserId = window.currentChatOtherUserId ||
        (String(currentChatInquiry.seller_id) === String(currentUser.id)
            ? currentChatInquiry.buyer_id
            : currentChatInquiry.seller_id);

    if (isChatUserBlocked(chatOtherUserId)) {
        showToast("This user is blocked. Unblock them from Privacy & Safety to send messages.", "warning");
        return;
    }

    const input = $("chatInput");
    const imageInput = $("chatImageInput");
    const cameraInput = $("chatCameraInput");
    const videoInput = $("chatVideoInput");
    const selectedFile =
        imageInput?.files?.[0] ||
        cameraInput?.files?.[0] ||
        videoInput?.files?.[0] ||
        null;
    const message = input?.value.trim() || "";

    if (!message && !selectedFile) return;

    const isSeller = currentChatInquiry.seller_id === currentUser.id;
    const receiverId = isSeller
        ? currentChatInquiry.buyer_id
        : currentChatInquiry.seller_id;

    if (!receiverId) {
        showToast("Receiver information unavailable", "error");
        return;
    }

    const sendButton = $("chatForm")?.querySelector('button[type="submit"]');
    const originalSendHtml = sendButton?.innerHTML;

    if (sendButton) {
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        await removeHiddenChat(currentChatInquiry.id);

        let messageToSend = message;

        if (selectedFile) {
            const isImage = selectedFile.type.startsWith("image/");
            const isVideo = selectedFile.type.startsWith("video/");

            if (!isImage && !isVideo) {
                throw new Error("Please select an image or video.");
            }

            const maxSize = isVideo
                ? 50 * 1024 * 1024
                : 8 * 1024 * 1024;

            if (selectedFile.size > maxSize) {
                throw new Error(isVideo
                    ? "Video must be 50 MB or smaller."
                    : "Image must be 8 MB or smaller.");
            }

            showChatUploadStatus(isVideo ? "Uploading video…" : "Uploading photo…", isVideo);
            const imageUrl = await uploadProductImage(selectedFile);

            if (!imageUrl) throw new Error("Could not upload media.");

            messageToSend = createChatImageMessage(
                imageUrl,
                message,
                isVideo ? "video" : "image"
            );
        }

        // Wrap the outgoing message with reply metadata only after media/text content is ready.
        if (chatReplyTarget) {
            messageToSend = createChatReplyMessage(messageToSend, chatReplyTarget);
        }

        const { error } = await supabaseClient
            .from("messages")
            .insert({
                inquiry_id: currentChatInquiry.id,
                sender_id: currentUser.id,
                receiver_id: receiverId,
                message: messageToSend
            });

        if (error) throw error;

        if (input) input.value = "";
        clearChatImageSelection();
        clearChatReplyPreview();
        removeChatUploadStatus();

        await loadChatMessages();

    } catch (error) {
        console.error("Send chat message error:", error);
        removeChatUploadStatus();
        showToast(error?.message || "Could not send message", "error");
    } finally {
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.innerHTML = originalSendHtml || '<i class="fas fa-paper-plane"></i>';
        }
    }
}

function showChatUploadStatus(text, isVideo = false) {
    const container = $("chatMessages");
    if (!container) return;

    removeChatUploadStatus();

    const status = document.createElement("div");
    status.id = "chatUploadStatus";
    status.className = "chat-upload-status chat-message chat-message-own sent";
    status.innerHTML = `
        <div class="chat-upload-bubble">
            <div class="chat-upload-media">
                <i class="fas ${isVideo ? "fa-video" : "fa-image"}"></i>
            </div>
            <div class="chat-upload-info">
                <strong>${escapeHtml(text)}</strong>
                <span>Sending securely…</span>
                <div class="chat-upload-progress"><span></span></div>
            </div>
            <i class="fas fa-spinner fa-spin chat-upload-spinner"></i>
        </div>`;

    container.appendChild(status);
    scrollChatToBottom();
}

function removeChatUploadStatus() {
    $("chatUploadStatus")?.remove();
}

function clearChatImageSelection() {
    const input = $("chatImageInput");
    const cameraInput = $("chatCameraInput");
    const videoInput = $("chatVideoInput");
    const preview = $("chatImagePreview");
    const image = $("chatImagePreviewImg");
    const name = $("chatImagePreviewName");

    if (input) input.value = "";
    if (cameraInput) cameraInput.value = "";
    if (videoInput) videoInput.value = "";

    if (image) {
        if (image.src.startsWith("blob:")) {
            URL.revokeObjectURL(image.src);
        }
        image.src = "";
    }

    if (name) name.textContent = "";
    preview?.classList.add("hidden");
}

function isVideoPreviewFile(file) {
    return Boolean(file?.type?.startsWith("video/"));
}

function showChatImageSelection(file) {
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
        showToast("Please select an image or video", "warning");
        return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast(
            isVideo ? "Video must be 50 MB or smaller" : "Image must be 8 MB or smaller",
            "warning"
        );
        clearChatImageSelection();
        return;
    }

    const preview = $("chatImagePreview");
    const image = $("chatImagePreviewImg");
    const name = $("chatImagePreviewName");

    if (image) {
        if (image.src.startsWith("blob:")) {
            URL.revokeObjectURL(image.src);
        }

        if (isImage) {
            image.src = URL.createObjectURL(file);
            image.classList.remove("hidden");
        } else {
            image.src = "";
            image.classList.add("hidden");
        }
    }

    if (name) {
        name.textContent = file.name || (isVideo ? "Selected video" : "Selected image");
    }

    preview?.classList.remove("hidden");
}

function clearChatReplyPreview() {
    chatReplyTarget = null;
    $("chatReplyPreview")?.classList.add("hidden");
    const text = $("chatReplyText");
    if (text) text.textContent = "";
}

function setChatReplyPreview(text, label = "Replying") {
    const preview = $("chatReplyPreview");
    const labelEl = $("chatReplyLabel");
    const textEl = $("chatReplyText");
    if (!preview || !textEl) return;
    if (labelEl) labelEl.textContent = label;
    textEl.textContent = String(text || "").slice(0, 180);
    preview.classList.remove("hidden");
}



let chatPresenceChannel = null;
let chatPresenceHeartbeat = null;
let chatPresenceOtherUserId = null;

function formatChatLastSeen(value) {
    if (!value) return "Offline";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Offline";

    const diff = Date.now() - date.getTime();
    if (diff < 60 * 1000) return "Last seen just now";
    if (diff < 60 * 60 * 1000) {
        return "Last seen " + Math.max(1, Math.floor(diff / 60000)) + "m ago";
    }
    if (diff < 24 * 60 * 60 * 1000) {
        return "Last seen " + Math.floor(diff / 3600000) + "h ago";
    }

    return "Last seen " + date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short"
    });
}

function setChatPresenceStatus(online, lastSeen = null) {
    const status = $("chatUserStatus");
    const wrapper = $("chatPresenceStatus");
    if (!status || !wrapper) return;

    wrapper.classList.toggle("chat-presence-online", Boolean(online));

    if (online) {
        status.textContent = "Online";
        $("chatHeaderOnlineDot")?.classList.remove("hidden");
        return;
    }

    status.textContent = formatChatLastSeen(lastSeen);
    $("chatHeaderOnlineDot")?.classList.add("hidden");
}

function getStoredChatLastSeen(userId) {
    if (!userId) return null;
    try {
        return localStorage.getItem("studentkart_last_seen_" + userId);
    } catch {
        return null;
    }
}

function saveChatLastSeen(userId, value) {
    if (!userId || !value) return;
    try {
        localStorage.setItem("studentkart_last_seen_" + userId, value);
    } catch {}
}

async function stopChatPresence() {
    if (chatPresenceHeartbeat) {
        clearInterval(chatPresenceHeartbeat);
        chatPresenceHeartbeat = null;
    }

    if (chatPresenceChannel) {
        try {
            await supabaseClient.removeChannel(chatPresenceChannel);
        } catch (error) {
            console.warn("Chat presence cleanup error:", error);
        }
        chatPresenceChannel = null;
    }

    chatPresenceOtherUserId = null;
}

async function startChatPresence(otherUserId) {
    await stopChatPresence();

    if (!currentUser || !otherUserId) return;

    chatPresenceOtherUserId = String(otherUserId);
    setChatPresenceStatus(
        false,
        getStoredChatLastSeen(chatPresenceOtherUserId)
    );

    const ids = [
        String(currentUser.id),
        String(otherUserId)
    ].sort();

    const channel = supabaseClient.channel(
        "studentkart-presence-" + ids.join("-"),
        {
            config: {
                presence: {
                    key: String(currentUser.id)
                }
            }
        }
    );

    chatPresenceChannel = channel;

    channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const other = state[chatPresenceOtherUserId];

        if (other && other.length) {
            setChatPresenceStatus(true);
            return;
        }

        const lastSeen = getStoredChatLastSeen(chatPresenceOtherUserId);
        setChatPresenceStatus(false, lastSeen);
    });

    channel.on("presence", { event: "leave" }, event => {
        const leftUserId = String(event?.key || "");
        if (leftUserId !== chatPresenceOtherUserId) return;

        const now = new Date().toISOString();
        saveChatLastSeen(chatPresenceOtherUserId, now);
        setChatPresenceStatus(false, now);
    });

    channel.on("presence", { event: "join" }, event => {
        const joinedUserId = String(event?.key || "");
        if (joinedUserId === chatPresenceOtherUserId) {
            setChatPresenceStatus(true);
        }
    });

    channel.subscribe(async status => {
        if (status !== "SUBSCRIBED") return;

        try {
            await channel.track({
                user_id: String(currentUser.id),
                online_at: new Date().toISOString()
            });
        } catch (error) {
            console.warn("Chat presence track error:", error);
        }
    });

    chatPresenceHeartbeat = window.setInterval(async () => {
        if (!chatPresenceChannel) return;
        try {
            await chatPresenceChannel.track({
                user_id: String(currentUser.id),
                online_at: new Date().toISOString()
            });
        } catch {}
    }, 30000);
}

function startChatRealtime() {

    stopChatRealtime();

    if (!currentUser || !currentChatInquiry) {
        return;
    }

    const channelName =
        `chat-user-${currentUser.id}-${currentChatInquiry.id}`;

    chatRealtimeChannel =
        supabaseClient
            .channel(channelName)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages"
                },
                async payload => {

                    const message = payload?.new;

                    if (!message) {
                        return;
                    }

                    // RLS already limits which message rows this user can receive.
                    // Keep a client-side guard so unrelated accessible rows never
                    // affect the currently open conversation.
                    const isMyMessage =
                        message.sender_id === currentUser.id ||
                        message.receiver_id === currentUser.id;

                    const isCurrentChat =
                        String(message.inquiry_id) ===
                        String(currentChatInquiry?.id);

                    if (!isMyMessage || !isCurrentChat) {
                        return;
                    }

                    console.log("💬 Realtime chat message received:", message);

                    await loadChatMessages();

                    if (
                        message.receiver_id === currentUser.id &&
                        message.is_read === false
                    ) {
                        await markChatMessagesRead(
                            currentChatInquiry.id
                        );
                    }

                    await updateChatUnreadCount();
                }
            )
            .subscribe(status => {

                console.log(
                    "Chat realtime status:",
                    status
                );

                if (status === "SUBSCRIBED") {
                    console.log("✅ Chat realtime connected");
                    // Catch messages that arrived immediately before subscription.
                    loadChatMessages();
                }

                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    console.error(
                        "❌ Chat realtime connection failed:",
                        status
                    );
                }
            });
}


function stopChatRealtime() {

    if (chatRealtimeChannel) {

        supabaseClient.removeChannel(
            chatRealtimeChannel
        );

        chatRealtimeChannel = null;
    }
}


function scrollChatToBottom() {

    const container = $("chatMessages");

    if (!container) {
        return;
    }

    container.scrollTop =
        container.scrollHeight;
}


function formatChatTime(dateString) {

    if (!dateString) {
        return "";
    }

    return new Date(dateString).toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


// Chat form
$("chatForm")?.addEventListener(
    "submit",
    sendChatMessage
);

$("chatInput")?.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;

    event.preventDefault();

    const form = $("chatForm");
    if (!form) return;

    if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
    } else {
        sendChatMessage(event);
    }
});

function closeChatAttachmentMenu() {
    const menu = $("chatAttachmentMenu");
    const button = $("chatAttachButton");
    menu?.classList.add("hidden");
    button?.setAttribute("aria-expanded", "false");
}

function openChatFilePicker(inputId, accept, capture = null) {
    const input = $(inputId);
    if (!input) return;

    input.value = "";
    input.accept = accept;

    if (capture) input.setAttribute("capture", capture);
    else input.removeAttribute("capture");

    input.click();
    closeChatAttachmentMenu();
}

$("chatAttachButton")?.addEventListener("click", event => {
    event.stopPropagation();
    const menu = $("chatAttachmentMenu");
    if (!menu) return;

    const willOpen = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !willOpen);
    $("chatAttachButton")?.setAttribute("aria-expanded", String(willOpen));
});

$("chatCameraOption")?.addEventListener("click", () => {
    openChatFilePicker("chatCameraInput", "image/*", "environment");
});

$("chatPhotoVideoOption")?.addEventListener("click", () => {
    openChatFilePicker("chatImageInput", "image/*,video/*");
});

$("chatVideoOption")?.addEventListener("click", () => {
    openChatFilePicker("chatVideoInput", "video/*", "environment");
});

document.addEventListener("click", event => {
    const wrap = document.querySelector(".chat-attach-wrap");
    if (wrap && !wrap.contains(event.target)) closeChatAttachmentMenu();
});

function handleChatMediaInput(event) {
    const file = event.target.files?.[0];
    event.target.removeAttribute("capture");
    showChatImageSelection(file);
}

$("chatImageInput")?.addEventListener("change", handleChatMediaInput);
$("chatCameraInput")?.addEventListener("change", handleChatMediaInput);
$("chatVideoInput")?.addEventListener("change", handleChatMediaInput);
$("removeChatImage")?.addEventListener("click", clearChatImageSelection);

$("chatEmojiButton")?.addEventListener("click", () => {
    $("chatEmojiPicker")?.classList.toggle("hidden");
});

$("chatEmojiPicker")?.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const input = $("chatInput");
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + button.textContent + input.value.slice(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + button.textContent.length;
});

$("cancelChatReply")?.addEventListener("click", clearChatReplyPreview);

document.addEventListener("click", event => {
    const picker = $("chatEmojiPicker");
    const button = $("chatEmojiButton");
    if (picker && !picker.contains(event.target) && event.target !== button && !button?.contains(event.target)) {
        picker.classList.add("hidden");
    }
});

$("chatMessages")?.addEventListener("click", event => {
    const image = event.target.closest("[data-chat-image]");
    if (!image) return;
    const url = image.getAttribute("data-chat-image");
    if (!url) return;
    const viewer = document.createElement("div");
    viewer.className = "chat-image-viewer";
    viewer.innerHTML = '<button type="button" aria-label="Close"><i class="fas fa-xmark"></i></button><img alt="Shared photo">';
    viewer.querySelector("img").src = url;
    document.body.appendChild(viewer);
    const close = () => viewer.remove();
    viewer.addEventListener("click", event => {
        if (event.target === viewer || event.target.closest("button")) close();
    });
});


$("selectAllInquiries")?.addEventListener(
    "change",
    event => {
        document.querySelectorAll(".inquiry-select-checkbox").forEach(box => {
            box.checked = event.target.checked;
        });
        updateBulkInquiryToolbar();
    }
);

document.addEventListener("change", event => {
    if (event.target.matches(".inquiry-select-checkbox")) {
        updateBulkInquiryToolbar();
    }
});

$("cancelChatSelectionButton")?.addEventListener(
    "click",
    () => exitChatSelectionMode()
);

$("bulkMarkReadButton")?.addEventListener(
    "click",
    bulkMarkInquiriesRead
);

$("bulkMarkUnreadButton")?.addEventListener(
    "click",
    bulkMarkInquiriesUnread
);

$("bulkMarkRepliedButton")?.addEventListener(
    "click",
    bulkMarkInquiriesReplied
);

$("bulkDeleteForMeButton")?.addEventListener(
    "click",
    bulkDeleteInquiriesForMe
);

$("chatDeleteButton")?.addEventListener(
    "click",
    () => {
        $("chatDeleteMenu")?.classList.toggle("hidden");
    }
);

$("deleteChatForMeButton")?.addEventListener(
    "click",
    deleteChatForMe
);

$("deleteChatForEveryoneButton")?.addEventListener(
    "click",
    deleteChatForEveryone
);

$("blockChatUserButton")?.addEventListener(
    "click",
    blockCurrentChatUser
);


// Stop realtime when chat closes
const originalCloseModal =
    window.closeModal;

if (typeof originalCloseModal === "function") {

    window.closeModal =
        function (modalId) {

            if (modalId === "chatModal") {
                stopChatRealtime();
                currentChatInquiry = null;
                closeChatDeleteMenu();
            }

            return originalCloseModal(modalId);
        };
}

/* RECEIVED INQUIRIES ACTION HANDLER
 *
 * Chat actions are handled by the inquiriesContainer listener above.
 * Do not add another document-level chat handler here: two handlers
 * opening the same inquiry create duplicate Chat history entries.
 */

/* =========================================================
   CHAT UNREAD NOTIFICATIONS
   ========================================================= */

async function showChatBrowserNotification(message) {
    if (!currentUser || !message) return;
    if (message.receiver_id !== currentUser.id) return;
    if (currentChatInquiry && String(message.inquiry_id) === String(currentChatInquiry.id)) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    let body = String(message.message || "You have received a new message.");
    if (body.startsWith("__STUDENTKART_MEDIA__") || body.startsWith("__STUDENTKART_IMAGE__")) {
        try {
            const prefix = body.startsWith("__STUDENTKART_MEDIA__")
                ? "__STUDENTKART_MEDIA__"
                : "__STUDENTKART_IMAGE__";
            const media = JSON.parse(body.slice(prefix.length));
            body = media.mediaType === "video" ? "Sent you a video." : "Sent you a photo.";
            if (media.caption) body += " " + media.caption;
        } catch {
            body = "You have received a new media message.";
        }
    }

    try {
        new Notification("StudentKart • New message", {
            body: body.slice(0, 180),
            tag: "studentkart-chat-" + String(message.inquiry_id || message.id || Date.now()),
            renotify: true
        });
    } catch (error) {
        console.warn("Chat browser notification error:", error);
    }
}

async function updateChatUnreadCount() {
    if (!currentUser) return;

    const badge = $("chatUnreadCount");
    if (!badge) return;

    try {
        const { count, error } = await supabaseClient
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("receiver_id", currentUser.id)
            .eq("is_read", false);

        if (error) throw error;

        const unread = count || 0;
        const label = unread > 99 ? "99+" : String(unread);

        badge.textContent = label;
        badge.classList.toggle("hidden", unread === 0);

        const bottomBadge = $("chatBottomUnreadCount");
        if (bottomBadge) {
            bottomBadge.textContent = label;
            bottomBadge.classList.toggle("hidden", unread === 0);
        }
    } catch (error) {
        console.error("Chat unread count error:", error);
    }
}

async function markChatMessagesRead(inquiryId) {
    if (!currentUser || !inquiryId) return;

    try {
        const { error } = await supabaseClient
            .from("messages")
            .update({ is_read: true })
            .eq("inquiry_id", inquiryId)
            .eq("receiver_id", currentUser.id)
            .eq("is_read", false);

        if (error) throw error;

        // Verify that Supabase actually persisted the read state.
        // This prevents a stale unread badge when an UPDATE policy blocks
        // the write or when another realtime refresh races with this one.
        const { data: remainingUnread, error: verifyError } =
            await supabaseClient
                .from("messages")
                .select("id")
                .eq("inquiry_id", inquiryId)
                .eq("receiver_id", currentUser.id)
                .eq("is_read", false);

        if (verifyError) {
            throw verifyError;
        }

        const unreadRemaining = remainingUnread?.length || 0;

        if (unreadRemaining > 0) {
            console.warn(
                "⚠️ Some chat messages are still unread after mark-read:",
                unreadRemaining
            );
        }

        await updateChatUnreadCount();

        // Force the visible chat badge/list state to match the verified
        // database state immediately.
        const badge = $("chatUnreadCount");
        if (badge && unreadRemaining === 0) {
            badge.textContent = "0";
            badge.classList.add("hidden");
        }

        document
            .querySelectorAll(".whatsapp-unread")
            .forEach(element => {
                element.remove();
            });

        await loadReceivedInquiries();
    } catch (error) {
        console.error("Mark chat messages read error:", error);
        showToast("Could not sync chat read status", "error");
    }
}

async function startChatUnreadRealtime() {
    if (!currentUser) return;

    if (window.chatUnreadChannel) {
        await supabaseClient.removeChannel(window.chatUnreadChannel);
    }

    window.chatUnreadChannel = supabaseClient
        .channel("chat-unread-" + currentUser.id)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages",
                filter: "receiver_id=eq." + currentUser.id
            },
            async payload => {
                console.log("🔔 New unread chat message:", payload);

                if (payload?.new?.inquiry_id) {
                    await removeHiddenChat(payload.new.inquiry_id);
                }

                await updateChatUnreadCount();
                await loadReceivedInquiries();

                const isOpenChatMessage =
                    currentChatInquiry &&
                    payload?.new?.inquiry_id === currentChatInquiry.id;

                if (!isOpenChatMessage) {
                    showToast("💬 New chat message received", "success");
                    showChatBrowserNotification(payload?.new);
                }
            }
        )
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "messages",
                filter: "receiver_id=eq." + currentUser.id
            },
            async payload => {
                const message = payload?.new;

                if (!message) {
                    return;
                }

                // Keep unread badges/inbox previews synchronized when a
                // message is marked read from another tab or device.
                if (
                    message.receiver_id === currentUser.id &&
                    payload?.old?.is_read !== message.is_read
                ) {
                    console.log("🔄 Chat read status synced:", message);

                    await updateChatUnreadCount();
                    await loadReceivedInquiries();
                }
            }
        )
        .on(
            "postgres_changes",
            {
                event: "DELETE",
                schema: "public",
                table: "messages"
            },
            async payload => {
                const oldMessage = payload?.old;

                if (!oldMessage) {
                    return;
                }

                const affectsCurrentUser =
                    oldMessage.sender_id === currentUser.id ||
                    oldMessage.receiver_id === currentUser.id;

                if (!affectsCurrentUser) {
                    return;
                }

                console.log("🗑️ Chat message deleted:", oldMessage);

                // When a conversation is deleted for everyone, hide the
                // conversation from this user's inbox as well.
                if (oldMessage.inquiry_id) {
                    const { error: hideError } = await supabaseClient
                        .from("hidden_chats")
                        .upsert(
                            {
                                user_id: currentUser.id,
                                inquiry_id: oldMessage.inquiry_id
                            },
                            {
                                onConflict: "user_id,inquiry_id"
                            }
                        );

                    if (hideError) {
                        console.error(
                            "Sync deleted chat visibility error:",
                            hideError
                        );
                    }
                }

                if (
                    currentChatInquiry &&
                    String(oldMessage.inquiry_id) ===
                        String(currentChatInquiry.id)
                ) {
                    await loadChatMessages();
                }

                await updateChatUnreadCount();
                await loadReceivedInquiries();
            }
        )
        .subscribe(status => {
            console.log("Chat unread realtime status:", status);

            if (status === "SUBSCRIBED") {
                updateChatUnreadCount();
                loadReceivedInquiries();
            }
        });
}



/* =========================================================
   MODAL BACK + HOME NAVIGATION
   ========================================================= */
function goToHomeFromModal() {
    if (typeof closeAllModals === "function") {
        closeAllModals();
    }

    // Return to the app's real Home state without creating another history entry.
    setStudentKartModalHistory(null, []);

    window.setTimeout(() => {
        const homeSection = document.getElementById("home");
        if (homeSection) {
            homeSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }, 20);
}

function addHomeButtonsToBackArrows(root = document) {
    root.querySelectorAll(".modal-back-button").forEach(backButton => {
        if (backButton.nextElementSibling?.classList.contains("modal-home-button")) {
            return;
        }

        const homeButton = document.createElement("button");
        homeButton.type = "button";
        homeButton.className = "modal-close modal-home-button";
        homeButton.setAttribute("aria-label", "Home");
        homeButton.title = "Home";
        homeButton.innerHTML = '<i class="fas fa-house"></i>';

        homeButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            goToHomeFromModal();
        });

        backButton.insertAdjacentElement("afterend", homeButton);
    });
}

/* India-wide dynamic location suggestions for marketplace filters */
let studentKartLocationSearchTimer = null;
let studentKartLocationSearchController = null;

let studentKartVillageDuckDBPromise = null;
let studentKartVillageDuckDB = null;
let studentKartVillageDuckDBConnection = null;

const STUDENTKART_LGD_VILLAGES_PARQUET =
    "https://raw.githubusercontent.com/vanga/india-local-government-directory/main/data/lgd_villages.parquet";

async function getStudentKartVillageDuckDB() {
    if (studentKartVillageDuckDBConnection) {
        return studentKartVillageDuckDBConnection;
    }

    if (studentKartVillageDuckDBPromise) {
        return studentKartVillageDuckDBPromise;
    }

    studentKartVillageDuckDBPromise = (async () => {
        const duckdb = await import(
            "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.5.5/+esm"
        );

        const bundle = await duckdb.selectBundle(
            duckdb.getJsDelivrBundles()
        );

        const workerURL = URL.createObjectURL(
            new Blob(
                [`importScripts("${bundle.mainWorker}");`],
                { type: "text/javascript" }
            )
        );

        const worker = new Worker(workerURL);
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);

        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(workerURL);

        await db.registerFileURL(
            "studentkart-lgd-villages.parquet",
            STUDENTKART_LGD_VILLAGES_PARQUET,
            duckdb.DuckDBDataProtocol.HTTP,
            false
        );

        const connection = await db.connect();

        studentKartVillageDuckDB = db;
        studentKartVillageDuckDBConnection = connection;

        return connection;
    })()
        .catch(error => {
            console.error("StudentKart LGD village database failed:", error);
            studentKartVillageDuckDBPromise = null;
            throw error;
        });

    return studentKartVillageDuckDBPromise;
}

async function searchStudentKartLGDVillages(query) {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) return [];

    try {
        const connection = await getStudentKartVillageDuckDB();

        const statement = await connection.prepare(`
            SELECT
                village_name,
                subdistrict_name,
                district_name,
                state_name
            FROM "studentkart-lgd-villages.parquet"
            WHERE
                lower(village_name) LIKE ?
                OR lower(subdistrict_name) LIKE ?
                OR lower(district_name) LIKE ?
                OR lower(state_name) LIKE ?
            ORDER BY
                CASE
                    WHEN lower(village_name) = ? THEN 0
                    WHEN lower(subdistrict_name) = ? THEN 1
                    WHEN lower(district_name) = ? THEN 2
                    WHEN lower(state_name) = ? THEN 3
                    ELSE 4
                END,
                village_name
            LIMIT 80
        `);

        const likeQuery = "%" + q + "%";

        const result = await statement.query(
            likeQuery,
            likeQuery,
            likeQuery,
            likeQuery,
            q,
            q,
            q,
            q
        );

        await statement.close();

        return result.toArray()
            .map(row => {
                const village = String(row.village_name || "").trim();
                const subdistrict = String(row.subdistrict_name || "").trim();
                const district = String(row.district_name || "").trim();
                const state = String(row.state_name || "").trim();

                if (!village) return "";

                const hierarchy = [...new Set([
                    subdistrict,
                    district,
                    state
                ].filter(Boolean))];

                return hierarchy.length
                    ? village + " — " + hierarchy.join(", ")
                    : village;
            })
            .filter(Boolean);
    } catch (error) {
        console.debug("LGD village search unavailable:", error);
        return [];
    }
}

function renderStudentKartLocationSuggestions(values) {
    const box = $("studentkartLocationSuggestions");
    if (!box) return;

    const uniqueValues = [...new Set(values.filter(Boolean))].slice(0, 50);

    if (!uniqueValues.length) {
        box.innerHTML = '<div class="studentkart-location-empty">No matching Indian locations found</div>';
        box.classList.remove("hidden");
        return;
    }

    box.innerHTML = uniqueValues.map(value => {
        const parts = String(value).split(" — ");
        const place = parts[0] || value;
        const hierarchyText = parts.slice(1).join(" — ");

        const hierarchy = hierarchyText
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);

        const subdistrict = hierarchy[0] || "";
        const district = hierarchy[1] || "";
        const state = hierarchy[2] || "";

        return '<button type="button" class="studentkart-location-option" data-location-value="' +
            escapeHTML(value) +
            '">' +
            '<span class="studentkart-location-place">' +
                '<i class="fas fa-location-dot"></i> ' +
                escapeHTML(place) +
            '</span>' +
            (subdistrict
                ? '<span class="studentkart-location-level"><b>Sub-district:</b> ' +
                    escapeHTML(subdistrict) + '</span>'
                : '') +
            (district
                ? '<span class="studentkart-location-level"><b>District:</b> ' +
                    escapeHTML(district) + '</span>'
                : '') +
            (state
                ? '<span class="studentkart-location-level"><b>State:</b> ' +
                    escapeHTML(state) + '</span>'
                : '') +
        '</button>';
    }).join("");

    box.classList.remove("hidden");

    box.querySelectorAll(".studentkart-location-option").forEach(option => {
        option.addEventListener("click", () => {
            const input = $("locationFilter");
            if (input) input.value = option.dataset.locationValue || "";
            box.classList.add("hidden");
            if (typeof applyMarketplaceFilters === "function") {
                applyMarketplaceFilters();
            }
        });
    });
}
async function searchStudentKartIndiaLocations(query) {
    const list = $("studentkartLocationList");
    const input = $("locationFilter");
    if (!input) return;

    const q = String(query || "").trim();
    if (q.length < 2) {
        $("studentkartLocationSuggestions")?.classList.add("hidden");
        return;
    }

    if (studentKartLocationSearchController) {
        studentKartLocationSearchController.abort();
    }
    studentKartLocationSearchController = new AbortController();

    try {
        const nominatimURL =
            "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=20&dedupe=1&q=" +
            encodeURIComponent(q);

        const nominatimPromise = fetch(nominatimURL, {
            signal: studentKartLocationSearchController.signal,
            headers: { "Accept": "application/json" }
        })
            .then(response => response.ok ? response.json() : [])
            .catch(error => {
                if (error?.name !== "AbortError") {
                    console.debug("Nominatim location search unavailable:", error);
                }
                return [];
            });

        const lgdPromise = searchStudentKartLGDVillages(q);

        const [nominatimResults, lgdValues] = await Promise.all([
            nominatimPromise,
            lgdPromise
        ]);

        const nominatimValues = nominatimResults.map(item => {
            const address = item?.address || {};

            const place = String(
                address.village ||
                address.hamlet ||
                address.town ||
                address.city ||
                address.municipality ||
                address.suburb ||
                address.neighbourhood ||
                String(item?.display_name || "").split(",")[0] ||
                ""
            ).trim();

            const subDistrict = String(
                address.subdistrict ||
                address.state_district ||
                address.county ||
                address.city_district ||
                ""
            ).trim();

            const district = String(
                address.district ||
                address.state_district ||
                address.county ||
                address.city_district ||
                ""
            ).trim();

            const state = String(address.state || "").trim();

            if (!place) return "";

            const hierarchy = [...new Set([
                subDistrict,
                district,
                state
            ].filter(Boolean))];

            return hierarchy.length
                ? place + " — " + hierarchy.join(", ")
                : String(item.display_name || "").replace(/, India$/i, "").trim();
        }).filter(Boolean);

        const currentOptions = list
            ? [...list.options].map(option => option.value)
            : [];

        const mergedValues = [...new Set([
            ...lgdValues,
            ...nominatimValues,
            ...currentOptions
        ])]
            .filter(Boolean)
            .slice(0, 100);

        renderStudentKartLocationSuggestions(mergedValues);

        if (list) {
            list.innerHTML = mergedValues
                .map(value => '<option value="' + escapeHTML(value) + '"></option>')
                .join("");
        }
    } catch (error) {
        if (error?.name !== "AbortError") {
            console.debug("India location suggestions unavailable:", error);
        }
    }
}
function setupStudentKartIndiaLocationSearch() {
    const input = $("locationFilter");
    if (!input) return;

    input.addEventListener("input", () => {
        clearTimeout(studentKartLocationSearchTimer);
        const query = input.value.trim();

        if (query.length < 2) {
            $("studentkartLocationSuggestions")?.classList.add("hidden");
            return;
        }

        studentKartLocationSearchTimer = setTimeout(() => {
            searchStudentKartIndiaLocations(query);
        }, 250);
    });

    input.addEventListener("focus", () => {
        if (input.value.trim().length >= 2) {
            searchStudentKartIndiaLocations(input.value.trim());
        }
    });

    document.addEventListener("click", event => {
        const wrap = document.querySelector(".marketplace-location-search-wrap");
        const box = $("studentkartLocationSuggestions");
        if (wrap && box && !wrap.contains(event.target)) {
            box.classList.add("hidden");
        }
    });
}
let studentKartAllIndiaCitiesCache = null;
let studentKartAllIndiaInstitutionsCache = null;
let studentKartInstitutionLoadPromise = null;

async function loadAllIndiaCityDataset() {
    if (studentKartAllIndiaCitiesCache) return studentKartAllIndiaCitiesCache;

    try {
        const response = await fetch("https://raw.githubusercontent.com/nshntarora/Indian-Cities-JSON/master/cities.json", {
            headers: { "Accept": "application/json" },
            cache: "force-cache"
        });
        if (!response.ok) throw new Error("City dataset request failed");

        const data = await response.json();
        const cities = Array.isArray(data)
            ? data.map(item => item?.name).filter(Boolean)
            : [];

        studentKartAllIndiaCitiesCache = [...new Set([
            ...STUDENTKART_INDIA_CITIES,
            ...cities
        ])].sort((a, b) => a.localeCompare(b, "en"));

        return studentKartAllIndiaCitiesCache;
    } catch (error) {
        console.debug("All-India city dataset unavailable:", error);
        studentKartAllIndiaCitiesCache = [...STUDENTKART_INDIA_CITIES];
        return studentKartAllIndiaCitiesCache;
    }
}

async function loadAllIndiaInstitutionDataset() {
    if (studentKartAllIndiaInstitutionsCache) return studentKartAllIndiaInstitutionsCache;
    if (studentKartInstitutionLoadPromise) return studentKartInstitutionLoadPromise;

    studentKartInstitutionLoadPromise = fetch(
        "https://raw.githubusercontent.com/brahmjotsingh0/aishe-institutions-list/main/data/institutions.json",
        { headers: { "Accept": "application/json" }, cache: "force-cache" }
    )
        .then(response => {
            if (!response.ok) throw new Error("Institution dataset request failed");
            return response.json();
        })
        .then(data => {
            const institutions = Array.isArray(data)
                ? data.map(item => item?.name || item?.institutionName).filter(Boolean)
                : [];

            studentKartAllIndiaInstitutionsCache = [...new Set([
                ...STUDENTKART_INSTITUTIONS,
                ...institutions
            ])].sort((a, b) => a.localeCompare(b, "en"));

            return studentKartAllIndiaInstitutionsCache;
        })
        .catch(error => {
            console.debug("All-India institution dataset unavailable:", error);
            studentKartAllIndiaInstitutionsCache = [...STUDENTKART_INSTITUTIONS];
            return studentKartAllIndiaInstitutionsCache;
        })
        .finally(() => {
            studentKartInstitutionLoadPromise = null;
        });

    return studentKartInstitutionLoadPromise;
}

function setupEditProfileCityLocationPicker() {
    const input = $("editProfileCity");
    const list = $("studentkartCityList");
    const locationButton = $("editProfileCityLocationButton");
    const suggestions = $("editProfileCitySuggestions");
    const collegeInput = $("editProfileCollege");
    const institutionList = $("studentkartInstitutionList");
    if (!input || !list) return;

    let cityTimer = null;
    let controller = null;
    let institutionTimer = null;

    const renderCities = values => {
        const merged = [...new Set(
            values.map(value => String(value || "").trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "en"));

        list.innerHTML = merged
            .map(city => '<option value="' + escapeHTML(city) + '"></option>')
            .join("");
    };

    const renderCitySuggestions = values => {
        if (!suggestions) return;

        const merged = [...new Set(values.filter(Boolean))].slice(0, 50);

        if (!merged.length) {
            suggestions.innerHTML = '<div class="profile-city-suggestion-empty">' +
                '<i class="fas fa-location-dot"></i> City not found in the selected State / Union Territory' +
                '</div>';
            suggestions.classList.remove("hidden");
            return;
        }

        suggestions.innerHTML = merged.map(value => {
            const parts = String(value).split(" — ");
            const place = parts[0] || value;
            const hierarchy = parts.slice(1).join(" — ").split(",").map(x => x.trim()).filter(Boolean);

            return '<button type="button" class="profile-city-suggestion" data-city-value="' +
                escapeHTML(value) + '">' +
                '<span class="profile-city-suggestion-place"><i class="fas fa-location-dot"></i> ' +
                    escapeHTML(place) + '</span>' +
                (hierarchy[0] ? '<span><b>Sub-district:</b> ' + escapeHTML(hierarchy[0]) + '</span>' : '') +
                (hierarchy[1] ? '<span><b>District:</b> ' + escapeHTML(hierarchy[1]) + '</span>' : '') +
                (hierarchy[2] ? '<span><b>State:</b> ' + escapeHTML(hierarchy[2]) + '</span>' : '') +
            '</button>';
        }).join("");

        suggestions.classList.remove("hidden");

        suggestions.querySelectorAll(".profile-city-suggestion").forEach(option => {
            option.addEventListener("click", () => {
                input.value = option.dataset.cityValue || "";
                suggestions.classList.add("hidden");
            });
        });
    };

    const renderInstitutions = values => {
        if (!institutionList) return;
        const merged = [...new Set(
            values.map(value => String(value || "").trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "en"));

        institutionList.innerHTML = merged
            .map(name => '<option value="' + escapeHTML(name) + '"></option>')
            .join("");
    };

    const stateInput = $("editProfileState");

    const getSelectedState = () =>
        String(stateInput?.value || "").trim();

    const normalizeLocationState = value =>
        String(value || "")
            .trim()
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const isSameState = (value, selectedState) => {
        if (!selectedState) return true;
        const a = normalizeLocationState(value);
        const b = normalizeLocationState(selectedState);
        return a === b ||
            a.includes(b) ||
            b.includes(a);
    };

    const getStateFromLocationValue = value => {
        const parts = String(value || "").split(" — ");
        const hierarchy = parts.slice(1).join(" — ")
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
        return hierarchy[2] || "";
    };

    const filterCityValuesForState = (values, selectedState) => {
        if (!selectedState) return values;
        return values.filter(value =>
            isSameState(getStateFromLocationValue(value), selectedState)
        );
    };

    const searchCities = async query => {
        const q = String(query || "").trim();
        const selectedState = getSelectedState();

        if (!selectedState) {
            suggestions?.classList.add("hidden");
            showToast("Please select a State / Union Territory first", "warning");
            return;
        }

        if (controller) controller.abort();
        controller = new AbortController();

        try {
            // Search Nominatim with the selected state in the query so
            // results belong to the chosen State/UT.
            const nominatimURL =
                "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=40&dedupe=1&q=" +
                encodeURIComponent((q || "") + ", " + selectedState + ", India");

            const nominatimPromise = fetch(nominatimURL, {
                signal: controller.signal,
                headers: { "Accept": "application/json" }
            })
                .then(response => response.ok ? response.json() : [])
                .catch(error => {
                    if (error?.name !== "AbortError") {
                        console.debug("City geocoding unavailable:", error);
                    }
                    return [];
                });

            const lgdPromise = q.length >= 2
                ? searchStudentKartLGDVillages(q)
                : Promise.resolve([]);

            const [nominatimResults, lgdValues] = await Promise.all([
                nominatimPromise,
                lgdPromise
            ]);

            const geoValues = nominatimResults.map(item => {
                const address = item?.address || {};
                const place = String(
                    address.village || address.hamlet || address.town ||
                    address.city || address.municipality || address.suburb ||
                    address.neighbourhood ||
                    String(item?.display_name || "").split(",")[0] || ""
                ).trim();

                const subdistrict = String(
                    address.subdistrict || address.state_district ||
                    address.county || address.city_district || ""
                ).trim();

                const district = String(
                    address.district || address.state_district ||
                    address.county || address.city_district || ""
                ).trim();

                const state = String(address.state || selectedState).trim();

                if (!place || !isSameState(state, selectedState)) return "";

                const hierarchy = [...new Set([
                    subdistrict,
                    district,
                    state
                ].filter(Boolean))];

                return hierarchy.length
                    ? place + " — " + hierarchy.join(", ")
                    : place;
            }).filter(Boolean);

            const stateSpecificLGDValues = q.length >= 2
                ? lgdValues.filter(value =>
                    isSameState(getStateFromLocationValue(value), selectedState)
                )
                : [];

            const values = [...new Set([
                ...stateSpecificLGDValues,
                ...geoValues
            ])].slice(0, 100);

            if (!values.length && q.length >= 2) {
                renderCitySuggestions([]);
                renderCities([]);
                return;
            }

            renderCitySuggestions(values);
            renderCities(values);
        } catch (error) {
            if (error?.name !== "AbortError") {
                console.debug("Edit profile city search unavailable:", error);
            }
            renderCitySuggestions([]);
            renderCities([]);
        }
    };

    const refreshCitiesForSelectedState = async () => {
        const selectedState = getSelectedState();
        input.value = "";
        suggestions?.classList.add("hidden");

        if (!selectedState) {
            renderCities([]);
            return;
        }

        // Fetch a state-scoped set immediately. Users can then type a
        // city/district/village name to narrow the list further.
        await searchCities("");
    };

    stateInput?.addEventListener("change", refreshCitiesForSelectedState);

    input.addEventListener("focus", () => {
        if (!getSelectedState()) {
            suggestions?.classList.add("hidden");
            return;
        }
        if (input.value.trim().length >= 1) {
            searchCities(input.value.trim());
        }
    });

    input.addEventListener("input", () => {
        clearTimeout(cityTimer);
        const query = input.value.trim();

        if (!getSelectedState()) {
            suggestions?.classList.add("hidden");
            return;
        }

        if (query.length < 2) {
            suggestions?.classList.add("hidden");
            return;
        }

        cityTimer = setTimeout(() => searchCities(query), 180);
    });

    document.addEventListener("click", event => {
        if (suggestions && !suggestions.parentElement?.contains(event.target)) {
            suggestions.classList.add("hidden");
        }
    });

    collegeInput?.addEventListener("focus", () => {
        renderInstitutions(STUDENTKART_INSTITUTIONS);
    });

    collegeInput?.addEventListener("input", () => {
        clearTimeout(institutionTimer);
        institutionTimer = setTimeout(() => searchInstitutions(collegeInput.value), 180);
    });

    const searchInstitutions = async query => {
        const dataset = await loadAllIndiaInstitutionDataset();
        const q = String(query || "").trim().toLowerCase();

        if (!q) {
            renderInstitutions(dataset);
            return;
        }

        const matches = dataset
            .filter(name => name.toLowerCase().includes(q))
            .slice(0, 200);

        renderInstitutions(matches.length ? matches : dataset);
    };

    locationButton?.addEventListener("click", () => {
        if (!navigator.geolocation) {
            showToast("Location is not supported by this browser", "warning");
            return;
        }

        locationButton.disabled = true;
        showToast("Getting your current city...", "info");

        navigator.geolocation.getCurrentPosition(async position => {
            try {
                const { latitude, longitude } = position.coords;
                const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=" +
                    encodeURIComponent(latitude) + "&lon=" + encodeURIComponent(longitude) + "&zoom=10";
                const response = await fetch(url, { headers: { "Accept": "application/json" } });

                if (!response.ok) throw new Error("Reverse geocoding failed");

                const result = await response.json();
                const address = result.address || {};
                const city = address.city || address.town || address.municipality ||
                    address.city_district || address.county || address.village || "";

                if (city) {
                    const hierarchy = [
                        address.subdistrict || address.state_district || address.county || address.city_district,
                        address.district || address.state_district || address.county || address.city_district,
                        address.state
                    ].filter(Boolean);

                    input.value = hierarchy.length
                        ? city + " — " + [...new Set(hierarchy)].join(", ")
                        : city;

                    suggestions?.classList.add("hidden");
                    renderCities([input.value, ...(await loadAllIndiaCityDataset())]);
                    showToast("Current city selected: " + city, "success");

                    if ($("editProfileState") && address.state) {
                        const stateOption = [...$("editProfileState").options]
                            .find(option => option.value.toLowerCase() === String(address.state).toLowerCase());
                        if (stateOption) $("editProfileState").value = stateOption.value;
                    }
                } else {
                    showToast("Could not identify your city", "warning");
                }
            } catch (error) {
                console.error("Edit profile location error:", error);
                showToast("Could not get your current city", "error");
            } finally {
                locationButton.disabled = false;
            }
        }, error => {
            console.warn("Edit profile geolocation error:", error);
            locationButton.disabled = false;
            showToast("Location permission was denied or unavailable", "warning");
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        });
    });

    renderCities(STUDENTKART_INDIA_CITIES);
    renderInstitutions(STUDENTKART_INSTITUTIONS);
}

function setupSellProductLocationPicker() {
    const input = $("productLocation");
    const button = $("productLocationButton");
    const suggestions = $("productLocationSuggestions");
    if (!input || !button || !suggestions) return;

    let timer = null;
    let controller = null;

    const renderSuggestions = values => {
        const unique = [...new Set(values.filter(Boolean))].slice(0, 80);

        if (!unique.length) {
            suggestions.innerHTML = '<div class="product-location-suggestion-empty"><i class="fas fa-location-dot"></i> No matching Indian locations found</div>';
            suggestions.classList.remove("hidden");
            return;
        }

        suggestions.innerHTML = unique.map(value => {
            const parts = String(value).split(" — ");
            const place = parts[0] || value;
            const hierarchy = (parts.slice(1).join(" — ") || "")
                .split(",")
                .map(item => item.trim())
                .filter(Boolean);

            return '<button type="button" class="product-location-suggestion" data-location-value="' +
                escapeHTML(value) + '">' +
                '<span class="product-location-suggestion-place"><i class="fas fa-location-dot"></i> ' +
                escapeHTML(place) + '</span>' +
                hierarchy.map((item, index) =>
                    '<span><b>' + (index === hierarchy.length - 1 ? "State" : index === hierarchy.length - 2 ? "District" : "Area") +
                    ':</b> ' + escapeHTML(item) + '</span>'
                ).join("") +
                '</button>';
        }).join("");

        suggestions.classList.remove("hidden");

        suggestions.querySelectorAll(".product-location-suggestion").forEach(option => {
            option.addEventListener("click", () => {
                input.value = option.dataset.locationValue || "";
                suggestions.classList.add("hidden");
            });
        });
    };

    const searchLocations = async query => {
        const q = String(query || "").trim();
        if (q.length < 2) {
            suggestions.classList.add("hidden");
            return;
        }

        if (controller) controller.abort();
        controller = new AbortController();

        try {
            const nominatimURL =
                "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=30&dedupe=1&q=" +
                encodeURIComponent(q + ", India");

            const nominatimPromise = fetch(nominatimURL, {
                signal: controller.signal,
                headers: { "Accept": "application/json" }
            }).then(response => response.ok ? response.json() : []).catch(error => {
                if (error?.name !== "AbortError") console.debug("Sell location search unavailable:", error);
                return [];
            });

            const lgdPromise = searchStudentKartLGDVillages(q);
            const [nominatimResults, lgdValues] = await Promise.all([nominatimPromise, lgdPromise]);

            const geoValues = nominatimResults.map(item => {
                const address = item?.address || {};
                const place = String(
                    address.village || address.hamlet || address.town || address.city ||
                    address.municipality || address.suburb || address.neighbourhood ||
                    String(item?.display_name || "").split(",")[0] || ""
                ).trim();
                const area = String(address.subdistrict || address.state_district || address.county || address.city_district || "").trim();
                const district = String(address.district || address.state_district || address.county || address.city_district || "").trim();
                const state = String(address.state || "").trim();
                if (!place) return "";
                const hierarchy = [...new Set([area, district, state].filter(Boolean))];
                return hierarchy.length ? place + " — " + hierarchy.join(", ") : place;
            }).filter(Boolean);

            renderSuggestions([...new Set([...lgdValues, ...geoValues])]);
        } catch (error) {
            if (error?.name !== "AbortError") console.debug("Sell location search error:", error);
        }
    };

    input.addEventListener("input", () => {
        clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < 2) {
            suggestions.classList.add("hidden");
            return;
        }
        timer = setTimeout(() => searchLocations(query), 180);
    });

    input.addEventListener("focus", () => {
        if (input.value.trim().length >= 2) searchLocations(input.value.trim());
    });

    button.addEventListener("click", () => {
        if (!navigator.geolocation) {
            showToast("Location is not supported by this browser", "warning");
            return;
        }

        button.disabled = true;
        showToast("Fetching your real location...", "info");

        navigator.geolocation.getCurrentPosition(async position => {
            try {
                const { latitude, longitude } = position.coords;
                const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=" +
                    encodeURIComponent(latitude) + "&lon=" + encodeURIComponent(longitude) + "&zoom=10";
                const response = await fetch(url, { headers: { "Accept": "application/json" } });
                if (!response.ok) throw new Error("Reverse geocoding failed");

                const result = await response.json();
                const address = result.address || {};
                const place = address.city || address.town || address.municipality ||
                    address.village || address.suburb || address.city_district || "";
                const area = address.subdistrict || address.state_district || address.county || address.city_district || "";
                const district = address.district || address.state_district || address.county || address.city_district || "";
                const state = address.state || "";

                if (!place) throw new Error("Could not identify your location");

                const hierarchy = [...new Set([area, district, state].filter(Boolean))];
                input.value = hierarchy.length ? place + " — " + hierarchy.join(", ") : place;
                suggestions.classList.add("hidden");
                showToast("Real location fetched: " + place, "success");
            } catch (error) {
                console.error("Sell location error:", error);
                showToast("Could not fetch your real location", "error");
            } finally {
                button.disabled = false;
            }
        }, error => {
            console.warn("Sell geolocation error:", error);
            button.disabled = false;
            showToast("Location permission was denied or unavailable", "warning");
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        });
    });

    document.addEventListener("click", event => {
        if (!input.parentElement?.contains(event.target)) {
            suggestions.classList.add("hidden");
        }
    });
}

function populateStudentKartIndiaData() {
    const stateSelects = ["signupState","editProfileState"];
    const cityLists = ["studentkartCityList"];
    const institutionLists = ["studentkartInstitutionList"];
    const locationList = $("studentkartLocationList");

    stateSelects.forEach(id => {
        const select = $(id);
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">Select state / UT</option>' +
            STUDENTKART_INDIA_STATES.map(state =>
                '<option value="' + escapeHTML(state) + '">' + escapeHTML(state) + '</option>'
            ).join("");
        if (current) select.value = current;
    });

    cityLists.forEach(id => {
        const list = $(id);
        if (!list) return;
        list.innerHTML = STUDENTKART_INDIA_CITIES
            .map(city => '<option value="' + escapeHTML(city) + '"></option>')
            .join("");
    });

    institutionLists.forEach(id => {
        const list = $(id);
        if (!list) return;
        list.innerHTML = STUDENTKART_INSTITUTIONS
            .map(name => '<option value="' + escapeHTML(name) + '"></option>')
            .join("");
    });

    // Searchable marketplace location list: India-wide cities + universities.
    if (locationList) {
        const locationOptions = [...new Set([
            ...STUDENTKART_INDIA_CITIES,
            ...STUDENTKART_INSTITUTIONS
        ])].sort((a, b) => a.localeCompare(b, "en"));
        locationList.innerHTML = locationOptions
            .map(value => '<option value="' + escapeHTML(value) + '"></option>')
            .join("");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateStudentKartIndiaData();
    setupEditProfileCityLocationPicker();
    setupSellProductLocationPicker();
    setupStudentKartIndiaLocationSearch();
    addHomeButtonsToBackArrows();

    const modalObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    addHomeButtonsToBackArrows(node);
                }
            });
        });
    });

    modalObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
});


/* Navbar search panel */
document.addEventListener("DOMContentLoaded", () => {
    const navSearchButton = document.getElementById("navSearchButton");
    const searchPanel = document.getElementById("navbarSearchPanel");
    const searchInput = document.getElementById("navbarSearchInput");
    const searchSubmit = document.getElementById("navbarSearchSubmit");
    const filterButton = document.getElementById("navbarFilterButton");
    const filterPanel = document.getElementById("navbarFilterPanel");
    const filterClose = document.getElementById("navbarFilterClose");
    const marketplaceSearch = document.getElementById("marketplaceSearch");

    if (!navSearchButton || !searchPanel || !searchInput) return;

    const runSearch = () => {
        if (marketplaceSearch) marketplaceSearch.value = searchInput.value;
        applyFilters();
        document.getElementById("marketplace")?.scrollIntoView({behavior:"smooth",block:"start"});
    };

    navSearchButton.addEventListener("click", () => {
        const opening = searchPanel.classList.contains("hidden");
        searchPanel.classList.toggle("hidden");
        if (opening) setTimeout(() => searchInput.focus(), 80);
    });

    searchInput.addEventListener("input", () => {
        if (marketplaceSearch) marketplaceSearch.value = searchInput.value;
    });

    searchInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            runSearch();
        } else if (event.key === "Escape") {
            searchPanel.classList.add("hidden");
        }
    });

    searchSubmit?.addEventListener("click", runSearch);

    filterButton?.addEventListener("click", () => {
        filterPanel?.classList.toggle("hidden");
    });

    filterClose?.addEventListener("click", () => {
        filterPanel?.classList.add("hidden");
    });

    ["categoryFilter","minPrice","maxPrice","locationFilter","conditionFilter","sortFilter"].forEach(id => {
        $(id)?.addEventListener("change", applyFilters);
    });

    ["minPrice","maxPrice"].forEach(id => {
        $(id)?.addEventListener("input", applyFilters);
    });

    $("applyMarketplaceFilters")?.addEventListener("click", () => {
        applyFilters();
        filterPanel?.classList.add("hidden");
        showToast("Filters applied", "success");
    });

    $("cancelMarketplaceFilters")?.addEventListener("click", () => {
        const search = $("navbarSearchInput");
        if (search) search.value = "";
        ["minPrice","maxPrice","locationFilter"].forEach(id => { const el=$(id); if(el) el.value=""; });
        const category=$("categoryFilter"); if(category) category.value="all";
        const condition=$("conditionFilter"); if(condition) condition.value="all";
        const sort=$("sortFilter"); if(sort) sort.value="newest";
        selectedMarketplaceCategory="all";
        applyFilters();
        filterPanel?.classList.add("hidden");
    });
});


/* =========================================================
   STUDENTKART TOUCH RIPPLE
   Replaces the browser's default blue tap flash with a
   small teal ripple exactly where the user touches/clicks.
   ========================================================= */
/* =========================================================
   STUDENTKART TOUCH FEEDBACK + SOFT CLICK SOUND
   ========================================================= */
/* Lightweight tap feedback: visual only.
   Audio feedback was removed because creating/resuming WebAudio on every
   tap adds unnecessary work on mobile and makes the UI feel delayed. */
document.addEventListener("pointerdown", event => {
    const target = event.target.closest(".btn, button, .category-card, a");
    if (!target || target.disabled) return;

    const rect = target.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "sk-ripple";

    ripple.style.left = (event.clientX - rect.left) + "px";
    ripple.style.top = (event.clientY - rect.top) + "px";

    target.appendChild(ripple);

    window.setTimeout(() => ripple.remove(), 170);


});


/* Mobile bottom Profile button */
const bottomProfileButton = $("bottomProfileButton");
if (bottomProfileButton) {
    bottomProfileButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (!currentUser) {
            openModal("loginModal");
            showToast("Please login to view your profile", "warning");
            return;
        }

        await openProfile();
    });
}

const bottomSettingsButton = $("bottomSettingsButton");
if (bottomSettingsButton) {
    bottomSettingsButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openModal("settingsModal");
    });
}

const bottomWishlistButton = $("bottomWishlistButton");
if (bottomWishlistButton) {
    bottomWishlistButton.addEventListener("click", event => {
        openWishlist(event);
    });
}

/* =========================================================
   SETTINGS — REAL USER PREFERENCES
   Persisted in Supabase Auth user_metadata with local fallback.
   ========================================================= */

const STUDENTKART_INDIA_STATES = [
"Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
"Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
];

const STUDENTKART_INDIA_CITIES = [
"Agra","Ahmedabad","Ajmer","Aligarh","Allahabad","Amritsar","Aurangabad","Bengaluru","Bhopal","Bhubaneswar","Chandigarh","Chennai","Coimbatore","Cuttack","Dehradun","Delhi","Dhanbad","Dharwad","Dimapur","Faridabad","Gandhinagar","Ghaziabad","Gorakhpur","Gurugram","Guwahati","Gwalior","Hubballi","Hyderabad","Imphal","Indore","Jaipur","Jalandhar","Jammu","Jamshedpur","Jodhpur","Kanpur","Kochi","Kolkata","Kota","Kozhikode","Lucknow","Ludhiana","Madurai","Mangaluru","Meerut","Mumbai","Mysuru","Nagpur","Nashik","Navi Mumbai","Noida","Patna","Pimpri-Chinchwad","Pune","Raipur","Rajkot","Ranchi","Rourkela","Salem","Siliguri","Srinagar","Surat","Thane","Thiruvananthapuram","Tiruchirappalli","Udaipur","Vadodara","Varanasi","Vasai-Virar","Vijayawada","Visakhapatnam","Warangal"
];

const STUDENTKART_INSTITUTIONS = [
"Indian Institute of Technology Bombay (IIT Bombay)","Indian Institute of Technology Delhi (IIT Delhi)","Indian Institute of Technology Madras (IIT Madras)","Indian Institute of Technology Kanpur (IIT Kanpur)","Indian Institute of Technology Kharagpur (IIT Kharagpur)","Indian Institute of Technology Roorkee (IIT Roorkee)","Indian Institute of Technology Guwahati (IIT Guwahati)","Indian Institute of Technology Hyderabad (IIT Hyderabad)","Indian Institute of Science Bengaluru (IISc)","Indian Institute of Information Technology Hyderabad (IIIT Hyderabad)","National Institute of Technology Karnataka (NITK)","National Institute of Technology Tiruchirappalli (NIT Trichy)","National Institute of Technology Warangal (NIT Warangal)","University of Delhi","Jawaharlal Nehru University (JNU)","University of Mumbai","Savitribai Phule Pune University","University of Hyderabad","Banaras Hindu University (BHU)","Aligarh Muslim University (AMU)","Jamia Millia Islamia","University of Calcutta","University of Madras","Anna University","Jadavpur University","Osmania University","Panjab University","University of Rajasthan","University of Lucknow","University of Kerala","University of Mysore","Andhra University","University of Allahabad","Gauhati University","Utkal University","Ranchi University","Patna University","Mahatma Gandhi University","Goa University","Manipal Academy of Higher Education (MAHE)","Manipal University Jaipur","G H Raisoni University","G H Raisoni College of Engineering","Symbiosis International University","Symbiosis Institute of Technology","Amity University","Lovely Professional University (LPU)","Chandigarh University","Sharda University","Ashoka University","Christ University","Jain University","PES University","RV University","Bangalore University","SRM Institute of Science and Technology","Vellore Institute of Technology (VIT)","Sathyabama Institute of Science and Technology","Kalinga Institute of Industrial Technology (KIIT)","Siksha 'O' Anusandhan","Amity University Noida","Bennett University","Galgotias University","Shiv Nadar University","Graphic Era University","UPES Dehradun","Thapar Institute of Engineering and Technology","Chitkara University","Lovely Professional University","MIT World Peace University","MIT Art Design and Technology University","Bharati Vidyapeeth","D Y Patil University","NMIMS University","K J Somaiya Institute of Engineering and Information Technology","Somaiya Vidyavihar University","Tata Institute of Social Sciences (TISS)","St. Xavier's College Mumbai","St. Xavier's College Kolkata","Fergusson College","Modern College of Arts Science and Commerce","Ramnarain Ruia Autonomous College","K J Somaiya College of Arts and Commerce","Wilson College Mumbai","Mithibai College","Jai Hind College","Hindu College Delhi","Hansraj College","Ramjas College","Sri Venkateswara College Delhi","Lady Shri Ram College for Women","St. Stephen's College Delhi","Christ University Bengaluru","Mount Carmel College Bengaluru","St Joseph's University Bengaluru","Maharaja Sayajirao University of Baroda","Nirma University","Gujarat University","Sardar Patel University","Manipal University Bengaluru","KIIT University","Amrita Vishwa Vidyapeetham","SRM University","PSG College of Technology","Loyola College Chennai","Madras Christian College","Coimbatore Institute of Technology","VIT Vellore","National Institute of Fashion Technology (NIFT)","National Law University Delhi","National Law School of India University","Indian Statistical Institute"
];

const STUDENTKART_SETTINGS_DEFAULTS = {
    notifications: {
        chat: true,
        wishlist: true,
        listings: true,
        buyerSeller: true,
        sold: true,
        push: false
    },
    privacy: {
        profileVisibility: "students",
        hidePhone: false,
        hideEmail: false,
        blockedUsers: []
    },
    location: {
        state: "",
        city: "",
        area: "",
        latitude: null,
        longitude: null,
        distanceKm: 10
    },
    preferences: {
        theme: "light",
        language: "en",
        vibration: true
    }
};

function deepCloneSettings(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergeSettings(base, extra) {
    if (!extra || typeof extra !== "object") return base;
    Object.keys(extra).forEach(key => {
        if (extra[key] && typeof extra[key] === "object" && !Array.isArray(extra[key])) {
            base[key] = mergeSettings(base[key] || {}, extra[key]);
        } else {
            base[key] = extra[key];
        }
    });
    return base;
}

function getStudentKartSettings() {
    const metadata = currentUser?.user_metadata?.studentkart_settings;
    let local = null;
    try {
        local = currentUser
            ? JSON.parse(localStorage.getItem(`studentkart_settings_${currentUser.id}`) || "null")
            : null;
    } catch (_) {}
    return mergeSettings(
        deepCloneSettings(STUDENTKART_SETTINGS_DEFAULTS),
        metadata || local || {}
    );
}

async function saveStudentKartSettings(nextSettings, silent = false) {
    if (!currentUser) return false;

    const settings = mergeSettings(
        deepCloneSettings(STUDENTKART_SETTINGS_DEFAULTS),
        nextSettings
    );

    try {
        localStorage.setItem(
            `studentkart_settings_${currentUser.id}`,
            JSON.stringify(settings)
        );
    } catch (_) {}

    const { data, error } = await supabaseClient.auth.updateUser({
        data: {
            ...(currentUser.user_metadata || {}),
            studentkart_settings: settings
        }
    });

    if (error) {
        console.error("Settings save error:", error);
        if (!silent) showToast("Could not save setting to your account", "error");
        return false;
    }

    if (data?.user) currentUser = data.user;
    if (!silent) showToast("Setting saved", "success");
    applyStudentKartSettings();
    return true;
}

function applyStudentKartSettings() {
    if (!currentUser) return;
    const settings = getStudentKartSettings();
    const theme = settings.preferences.theme === "dark";
    document.body.classList.toggle("studentkart-dark", theme);
    document.documentElement.lang = settings.preferences.language === "hi" ? "hi" : "en";

    const rows = {
        "chat-notifications": settings.notifications.chat,
        "wishlist-notifications": settings.notifications.wishlist,
        "listing-notifications": settings.notifications.listings,
        "buyer-seller-notifications": settings.notifications.buyerSeller,
        "sold-notifications": settings.notifications.sold,
        "push-notifications": settings.notifications.push,
        "vibration": settings.preferences.vibration,
        "hide-phone": settings.privacy.hidePhone,
        "hide-email": settings.privacy.hideEmail
    };

    Object.entries(rows).forEach(([action, enabled]) => {
        const row = document.querySelector(`[data-setting-action="${action}"]`);
        const sw = row?.querySelector(".settings-switch");
        if (sw) {
            sw.dataset.enabled = enabled ? "true" : "false";
            sw.querySelector("span")?.style.setProperty("transform", enabled ? "translateX(18px)" : "translateX(0)");
            sw.style.background = enabled ? "#0f8b8d" : "#d9e3e8";
        }
    });

    const profileVisibilityRow = document.querySelector('[data-setting-action="profile-visibility"]');
    const profileVisibilitySmall = profileVisibilityRow?.querySelector("small");
    if (profileVisibilitySmall) {
        const labels = { public: "Anyone can see your profile", students: "Visible to StudentKart users", private: "Profile visibility is limited" };
        profileVisibilitySmall.textContent = labels[settings.privacy.profileVisibility] || "Control profile visibility";
    }
    const blockedRow = document.querySelector('[data-setting-action="blocked-users"]');
    const blockedSmall = blockedRow?.querySelector("small");
    if (blockedSmall) {
        const count = Array.isArray(settings.privacy.blockedUsers) ? settings.privacy.blockedUsers.length : 0;
        blockedSmall.textContent = count ? count + " blocked account" + (count === 1 ? "" : "s") : "No blocked accounts";
    }

    const themeRow = document.querySelector('[data-setting-action="theme"]');
    const themeSmall = themeRow?.querySelector("small");
    if (themeSmall) themeSmall.textContent = theme === "dark" ? "Dark mode is active" : "Light mode is active";
}

async function settingsToggle(path) {
    const settings = getStudentKartSettings();
    const parts = path.split(".");
    let obj = settings;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    const key = parts[parts.length - 1];
    obj[key] = !Boolean(obj[key]);
    return saveStudentKartSettings(settings);
}

function openSettingsActionModal({title, description="", fields=[], options=[], danger=false, confirmText="Save", onConfirm}) {
    let modal = $("settingsActionModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "settingsActionModal";
        modal.className = "modal hidden";
        document.body.appendChild(modal);
    }

    const fieldHTML = fields.map(field => {
        const type = field.type || "text";
        if (type === "textarea") {
            return `<label class="settings-action-field"><span>${escapeHTML(field.label)}</span><textarea id="settingsAction_${escapeHTML(field.id)}" placeholder="${escapeHTML(field.placeholder || "")}">${escapeHTML(field.value || "")}</textarea></label>`;
        }
        return `<label class="settings-action-field"><span>${escapeHTML(field.label)}</span><input id="settingsAction_${escapeHTML(field.id)}" type="${type}" value="${escapeHTML(field.value || "")}" placeholder="${escapeHTML(field.placeholder || "")}"></label>`;
    }).join("");

    const optionHTML = options.length
        ? `<div class="settings-action-options">${options.map(option =>
            `<button type="button" class="settings-action-option" data-settings-option="${escapeHTML(option.value)}"><i class="fas ${escapeHTML(option.icon || "fa-circle") }"></i><span><b>${escapeHTML(option.label)}</b><small>${escapeHTML(option.description || "")}</small></span><i class="fas fa-chevron-right"></i></button>`
        ).join("")}</div>`
        : "";

    modal.innerHTML = `
        <div class="modal-overlay" data-settings-action-close></div>
        <div class="modal-content settings-action-modal-content">
            <div class="settings-action-header">
                <div>
                    <span class="section-label">STUDENTKART</span>
                    <h2>${escapeHTML(title)}</h2>
                    <p>${escapeHTML(description)}</p>
                </div>
                <button type="button" class="modal-close" data-settings-action-close aria-label="Close">&times;</button>
            </div>
            <div class="settings-action-body">${fieldHTML}${optionHTML}</div>
            <div class="settings-action-footer">
                <button type="button" class="btn btn-outline" data-settings-action-close>Cancel</button>
                ${fields.length ? `<button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" id="settingsActionConfirm">${escapeHTML(confirmText)}</button>` : ""}
            </div>
        </div>`;

    modal.querySelectorAll("[data-settings-action-close]").forEach(btn => {
        btn.addEventListener("click", () => closeModal("settingsActionModal"));
    });

    modal.querySelectorAll("[data-settings-option]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const value = btn.dataset.settingsOption;
            await onConfirm?.(value);
            closeModal("settingsActionModal");
        });
    });

    modal.querySelector("#settingsActionConfirm")?.addEventListener("click", async () => {
        const values = {};
        fields.forEach(field => {
            const el = $(`settingsAction_${field.id}`);
            values[field.id] = el?.value?.trim() || "";
        });
        const ok = await onConfirm?.(values);
        if (ok !== false) closeModal("settingsActionModal");
    });

    openModal("settingsActionModal");
}

async function settingsEmail() {
    if (!currentUser) return;
    openSettingsActionModal({
        title: "Change Email",
        description: "Update the email connected to your StudentKart account.",
        fields: [{id:"email", label:"New Email Address", type:"email", value:currentUser.email || "", placeholder:"you@example.com"}],
        confirmText: "Update Email",
        onConfirm: async values => {
            if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(values.email)) {
                showToast("Please enter a valid email address", "warning"); return false;
            }
            const {data,error}=await supabaseClient.auth.updateUser({email:values.email.toLowerCase()});
            if(error){showToast(error.message||"Could not update email","error");return false;}
            if(data?.user) currentUser=data.user;
            showToast("Email update started. Check your confirmation email if required.","success");
        }
    });
}

async function settingsMobile() {
    if (!currentUser) return;
    openSettingsActionModal({
        title: "Change Mobile Number",
        description: "Enter your mobile number with country code.",
        fields: [{id:"phone", label:"Mobile Number", type:"tel", value:currentUser.phone || "", placeholder:"+919876543210"}],
        confirmText: "Update Mobile",
        onConfirm: async values => {
            const phone=values.phone.replace(/\\s+/g,"");
            if(!/^\\+?[1-9]\\d{9,14}$/.test(phone)){showToast("Enter a valid mobile number with country code","warning");return false;}
            const {data,error}=await supabaseClient.auth.updateUser({phone});
            if(error){showToast(error.message||"Could not update mobile number","error");return false;}
            if(data?.user) currentUser=data.user;
            showToast("Mobile update started. OTP verification may be required.","success");
        }
    });
}

function settingsCollege() {
    closeModal("settingsModal");
    openEditProfile?.();
}

async function settingsLocationCurrent() {
    if (!navigator.geolocation) { showToast("Location is not supported by this browser","warning"); return; }
    showToast("Requesting your current location...","info");
    navigator.geolocation.getCurrentPosition(async position => {
        const settings=getStudentKartSettings();
        settings.location.latitude=Number(position.coords.latitude.toFixed(6));
        settings.location.longitude=Number(position.coords.longitude.toFixed(6));
        await saveStudentKartSettings(settings,true);
        showToast("Current location saved","success");
    }, error => {
        console.warn("Geolocation error",error);
        showToast("Location permission was denied or unavailable","warning");
    }, {enableHighAccuracy:true,timeout:10000,maximumAge:300000});
}

async function settingsLocationDetails() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Change Location",
        description:"Set the area you want StudentKart to use for local listings.",
        fields:[
            {id:"state",label:"State",value:settings.location.state},
            {id:"city",label:"City",value:settings.location.city},
            {id:"area",label:"Area",value:settings.location.area}
        ],
        confirmText:"Save Location",
        onConfirm:async values=>{
            settings.location.state=values.state;
            settings.location.city=values.city;
            settings.location.area=values.area;
            await saveStudentKartSettings(settings);
        }
    });
}

async function settingsDistance() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Nearby Listings Distance",
        description:"Choose how far StudentKart should search around your preferred location.",
        options:[5,10,25,50,100].map(km=>({value:String(km),label:km+" km",description:"Show listings within "+km+" km",icon:"fa-route"})),
        onConfirm:async value=>{
            settings.location.distanceKm=Number(value);
            await saveStudentKartSettings(settings);
        }
    });
}

async function settingsLocationPermission() {
    openSettingsActionModal({
        title:"Location Permission",
        description:"StudentKart uses browser location access only when you request your current location.",
        options:[
            {value:"request",label:"Request Location Access",description:"Ask the browser for location permission",icon:"fa-location-crosshairs"},
            {value:"status",label:"Check Permission Status",description:"See whether location access is allowed",icon:"fa-circle-info"}
        ],
        onConfirm:async value=>{
            if(value==="request"){ settingsLocationCurrent(); return; }
            try {
                const result=await navigator.permissions.query({name:"geolocation"});
                showToast("Location permission: "+result.state,"info");
            } catch(_) { showToast("Manage location access from your browser site settings.","info"); }
        }
    });
}

async function settingsTheme() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Appearance",
        description:"Choose how StudentKart should look on your device.",
        options:[
            {value:"light",label:"Light Mode",description:"Clean light StudentKart interface",icon:"fa-sun"},
            {value:"dark",label:"Dark Mode",description:"Dark interface for low-light use",icon:"fa-moon"}
        ],
        onConfirm:async value=>{settings.preferences.theme=value;await saveStudentKartSettings(settings);}
    });
}

async function settingsLanguage() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Language",
        description:"Choose your preferred app language.",
        options:[
            {value:"en",label:"English",description:"Use English throughout the interface",icon:"fa-language"},
            {value:"hi",label:"Hindi",description:"Hindi preference (interface translation can be expanded)",icon:"fa-language"}
        ],
        onConfirm:async value=>{settings.preferences.language=value;await saveStudentKartSettings(settings);}
    });
}

async function settingsProfileVisibility() {
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Profile Visibility",
        description:"Choose who can discover your StudentKart profile.",
        options:[
            {value:"public",label:"Public",description:"Anyone using StudentKart can see your profile",icon:"fa-earth-asia"},
            {value:"students",label:"Students",description:"Keep your profile visible to the StudentKart community",icon:"fa-user-group"},
            {value:"private",label:"Private",description:"Limit profile visibility",icon:"fa-lock"}
        ],
        onConfirm:async value=>{settings.privacy.profileVisibility=value;await saveStudentKartSettings(settings);}
    });
}

async function settingsBlockedUsers() {
    const settings = getStudentKartSettings();
    const blocked = Array.isArray(settings.privacy?.blockedUsers)
        ? settings.privacy.blockedUsers.map(String).filter(Boolean)
        : [];

    let profiles = [];
    if (blocked.length) {
        try {
            const { data, error } = await supabaseClient
                .from("profiles")
                .select("id,name,username,email,phone,avatar_url,college,city")
                .in("id", blocked);

            if (!error && Array.isArray(data)) {
                profiles = data;
            }
        } catch (error) {
            console.error("Blocked users profile load error:", error);
        }
    }

    const profileMap = new Map(
        profiles.map(profile => [String(profile.id), profile])
    );

    const blockedOptions = blocked.map(id => {
        const profile = profileMap.get(id);
        const name =
            profile?.name ||
            profile?.username ||
            "Blocked User";
        const contact =
            profile?.username
                ? "@" + profile.username
                : profile?.email ||
                    profile?.phone ||
                    "Blocked account";

        return {
            value: "unblock:" + id,
            label: name,
            description: contact,
            icon: "fa-user-check"
        };
    });

    openSettingsActionModal({
        title: "Blocked Users",
        description: blocked.length
            ? "These accounts are blocked. Tap a user to unblock them."
            : "You have not blocked any users yet.",
        options: blockedOptions,
        fields: [{
            id: "user",
            label: "Block another user",
            placeholder: "Enter User ID"
        }],
        confirmText: "Block User",
        onConfirm: async value => {
            if (typeof value === "string" && value.startsWith("unblock:")) {
                const id = value.slice(8);

                settings.privacy = settings.privacy || {};
                settings.privacy.blockedUsers =
                    (Array.isArray(settings.privacy.blockedUsers)
                        ? settings.privacy.blockedUsers.map(String)
                        : []
                    ).filter(x => x !== id);

                const saved = await saveStudentKartSettings(settings, true);

                if (!saved) {
                    showToast("Could not unblock this user", "error");
                    return false;
                }

                showToast("User unblocked", "success");
                return;
            }

            if (value && value.user) {
                const id = value.user.trim();

                if (!id) {
                    showToast("Enter a User ID", "warning");
                    return false;
                }

                settings.privacy = settings.privacy || {};
                const currentBlocked = Array.isArray(settings.privacy.blockedUsers)
                    ? settings.privacy.blockedUsers.map(String)
                    : [];

                if (currentBlocked.includes(id)) {
                    showToast("User is already blocked", "info");
                    return false;
                }

                settings.privacy.blockedUsers = [...currentBlocked, id];

                const saved = await saveStudentKartSettings(settings, true);

                if (!saved) {
                    showToast("Could not block this user", "error");
                    return false;
                }

                showToast("User blocked", "success");
            }
        }
    });
}
async function settingsReportProblem() {
    openSettingsActionModal({
        title:"Report a Problem",
        description:"Tell us what went wrong. Your email app will open with the report ready to send.",
        fields:[
            {id:"subject",label:"Subject",value:"StudentKart Problem Report"},
            {id:"message",label:"What happened?",type:"textarea",placeholder:"Describe the problem..."}
        ],
        confirmText:"Prepare Report",
        onConfirm:async values=>{
            const subject=encodeURIComponent(values.subject||"StudentKart Problem Report");
            const body=encodeURIComponent(values.message||"");
            window.location.href="mailto:rathodharish004@gmail.com?subject="+subject+"&body="+body;
        }
    });
}

async function settingsLoginSessions() {
    const {data,error}=await supabaseClient.auth.getSession();
    const expires=data?.session?.expires_at?new Date(data.session.expires_at*1000).toLocaleString("en-IN"):"Unknown";
    openSettingsActionModal({
        title:"Login Session",
        description:error?"Could not read your current session.":"This browser currently has an active StudentKart session.",
        options:error?[]:[{value:"current",label:"Current Session Active",description:"Session expiry: "+expires,icon:"fa-circle-check"}],
        onConfirm:async()=>{}
    });
}

async function settingsLogoutAll() {
    openSettingsActionModal({
        title:"Logout From All Devices",
        description:"This will sign out the current account. Continue only if you want to end your StudentKart session.",
        options:[
            {value:"logout",label:"Logout From All Devices",description:"End the current Supabase session",icon:"fa-right-from-bracket"}
        ],
        onConfirm:async value=>{
            if(value!=="logout")return;
            const {error}=await supabaseClient.auth.signOut();
            if(error){showToast(error.message||"Could not logout","error");return;}
            showToast("Logged out successfully","success");
        }
    });
}

function settingsAccountSecurity() {
    if (!currentUser) return;
    openSettingsActionModal({
        title:"Account Security",
        description:"Review the security state of your StudentKart account.",
        options:[
            {value:"email",label:"Email",description:(currentUser.email||"Not added")+" · "+(currentUser.email_confirmed_at?"Verified":"Verification may be required"),icon:"fa-envelope"},
            {value:"phone",label:"Mobile",description:(currentUser.phone||"Not added")+" · "+(currentUser.phone_confirmed_at?"Verified":"Verification may be required"),icon:"fa-mobile-screen"},
            {value:"session",label:"Session",description:"Your current authenticated session is active",icon:"fa-shield-halved"}
        ],
        onConfirm:async()=>{}
    });
}

function settingsDeleteAccount() {
    openSettingsActionModal({
        title:"Delete Account",
        description:"Account deletion is permanent. Send a deletion request so it can be processed safely on the server.",
        fields:[{id:"confirm",label:"Type DELETE to continue",placeholder:"DELETE"}],
        confirmText:"Request Deletion",
        danger:true,
        onConfirm:async values=>{
            if(values.confirm!=="DELETE"){showToast("Type DELETE exactly to continue","warning");return false;}
            const subject=encodeURIComponent("StudentKart account deletion request");
            const body=encodeURIComponent("Please delete my StudentKart account. Account ID: "+(currentUser?.id||"unknown"));
            window.location.href="mailto:rathodharish004@gmail.com?subject="+subject+"&body="+body;
            showToast("Deletion request prepared","warning");
        }
    });
}
async function handleSettingAction(action) {
    if (!currentUser && action !== "developer") {
        closeModal("settingsModal");
        openModal("loginModal");
        return;
    }

    if (action === "edit-profile" || action === "college" || action === "profile-photo") {
        closeModal("settingsModal");
        openEditProfile?.();
        return;
    }

    if (action === "email") return settingsEmail();
    if (action === "mobile") return settingsMobile();

    if (["chat-notifications", "wishlist-notifications", "listing-notifications", "buyer-seller-notifications", "sold-notifications"].includes(action)) {
        const map = {
            "chat-notifications": "chat",
            "wishlist-notifications": "wishlist",
            "listing-notifications": "listings",
            "buyer-seller-notifications": "buyerSeller",
            "sold-notifications": "sold"
        };
        return settingsToggle(`notifications.${map[action]}`);
    }

    if (action === "push-notifications") {
        const settings = getStudentKartSettings();
        if (!settings.notifications.push && "Notification" in window) {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                showToast("Browser notification permission was not granted", "warning");
                return;
            }
        }
        return settingsToggle("notifications.push");
    }

    if (action === "profile-visibility") return settingsProfileVisibility();
    if (action === "hide-phone") return settingsToggle("privacy.hidePhone");
    if (action === "hide-email") return settingsToggle("privacy.hideEmail");
    if (action === "blocked-users") return settingsBlockedUsers();

    if (action === "report-problem") {
        const body = encodeURIComponent("StudentKart problem report:\n\n");
        window.location.href = `mailto:rathodharish004@gmail.com?subject=StudentKart%20Problem%20Report&body=${body}`;
        return;
    }

    if (action === "developer") {
        closeModal("settingsModal");
        const title = $("footerInfoTitle"), body = $("footerInfoBody");
        if (title) title.textContent = "Developer — Harish Rathod";
        if (body) body.innerHTML = `
            <div class="developer-page">
                <div class="developer-hero">
                    <div class="developer-hero-photo">
                        <img src="assets/developer-photo.jpg" alt="Harish Rathod — StudentKart Developer">
                        <span class="developer-status"><i class="fas fa-circle"></i> Building StudentKart</span>
                    </div>
                    <div class="developer-hero-copy">
                        <span class="developer-eyebrow"><i class="fas fa-code"></i> STUDENTKART DEVELOPER</span>
                        <h2>Harish <span>Rathod</span></h2>
                        <h3>Founder & Developer</h3>
                        <p>I’m a BCA student building practical technology products while learning, experimenting and improving one feature at a time.</p>
                        <div class="developer-mini-tags">
                            <span><i class="fas fa-graduation-cap"></i> BCA Student</span>
                            <span><i class="fas fa-laptop-code"></i> Web Development</span>
                            <span><i class="fas fa-shield-halved"></i> Cybersecurity Learner</span>
                        </div>
                    </div>
                </div>

                <div class="developer-section">
                    <div class="developer-section-heading">
                        <span class="section-label">ABOUT THE DEVELOPER</span>
                        <h3>From learning to building</h3>
                    </div>
                    <p>Harish Rathod is the founder and developer behind StudentKart. The project combines a student-focused marketplace with authentication, listings, wishlist, search, notifications and chat features.</p>
                    <p>The goal is to keep learning practical: understand a problem, build a feature, test it, fix what breaks and keep improving the product.</p>
                </div>

                <div class="developer-section">
                    <div class="developer-section-heading">
                        <span class="section-label">WHAT I WORK ON</span>
                        <h3>Current focus</h3>
                    </div>
                    <div class="developer-feature-grid">
                        <div class="developer-feature-card"><i class="fas fa-store"></i><div><strong>StudentKart</strong><span>Marketplace, listings and student-first UX</span></div></div>
                        <div class="developer-feature-card"><i class="fas fa-comments"></i><div><strong>Real-time Features</strong><span>Chat, inquiries and notifications</span></div></div>
                        <div class="developer-feature-card"><i class="fas fa-mobile-screen"></i><div><strong>Responsive UI</strong><span>Mobile-friendly and desktop-ready interfaces</span></div></div>
                        <div class="developer-feature-card"><i class="fas fa-shield-halved"></i><div><strong>Cybersecurity</strong><span>Learning networking, Linux and web security fundamentals</span></div></div>
                    </div>
                </div>

                <div class="developer-section">
                    <div class="developer-section-heading">
                        <span class="section-label">TECH STACK</span>
                        <h3>What powers StudentKart</h3>
                    </div>
                    <div class="developer-stack">
                        <span><i class="fab fa-html5"></i> HTML5</span>
                        <span><i class="fab fa-css3-alt"></i> CSS3</span>
                        <span><i class="fab fa-js"></i> JavaScript</span>
                        <span><i class="fas fa-database"></i> Supabase</span>
                        <span><i class="fab fa-github"></i> GitHub</span>
                        <span><i class="fas fa-icons"></i> Font Awesome</span>
                        <span><i class="fas fa-mobile-screen-button"></i> PWA</span>
                    </div>
                </div>


                <div class="developer-vision">
                    <i class="fas fa-lightbulb"></i>
                    <div>
                        <span class="section-label">VISION</span>
                        <p>“StudentKart is being built to make campus life more connected, convenient and student-friendly.”</p>
                    </div>
                </div>

                <div class="developer-footer-card">
                    <div>
                        <strong>Harish Rathod</strong>
                        <span>Founder & Developer · StudentKart</span>
                    </div>
                    <a href="mailto:rathodharish004@gmail.com" class="btn btn-primary"><i class="fas fa-envelope"></i> Contact</a>
                </div>
            </div>
        `;
        openModal("footerInfoModal");
        return;
    }

    if (action === "how" || action === "safety-tips" || action === "safety-about" || action === "about" ||
        action === "terms" || action === "privacy-policy" || action === "contact") {
        const map = {
            how: "how",
            "safety-tips": "safety",
            "safety-about": "safety",
            about: "about",
            terms: "terms",
            "privacy-policy": "privacy",
            contact: "contact"
        };
        closeModal("settingsModal");
        document.querySelector(`[data-footer-info="${map[action]}"]`)?.click();
        return;
    }

    if (action === "current-location") return settingsLocationCurrent();
    if (action === "change-location" || action === "state-city-area") return settingsLocationDetails();
    if (action === "nearby-distance") return settingsDistance();
    if (action === "location-permission") return settingsLocationPermission();

    if (action === "theme") return settingsTheme();
    if (action === "language") return settingsLanguage();
    if (action === "vibration") return settingsToggle("preferences.vibration");

    if (action === "login-sessions") return settingsLoginSessions();
    if (action === "logout-all") return settingsLogoutAll();
    if (action === "account-security") return settingsAccountSecurity();
    if (action === "delete-account") return settingsDeleteAccount();

    if (action === "logout") {
        closeModal("settingsModal");
        $("logoutButton")?.click();
        return;
    }
}

const SETTINGS_SECTION_TEMPLATES = {
    account: {
        title: "Account", icon: "fa-user", subtitle: "Manage your profile and account details.",
        html: `
            <button class="settings-row" type="button" data-setting-action="edit-profile"><span><i class="fas fa-pen"></i><b>Edit Profile</b><small>Update your profile details</small></span><i class="fas fa-chevron-right"></i></button>
        `
    },
    notifications: {
        title: "Notifications", icon: "fa-bell", subtitle: "Manage all notification preferences.",
        html: `
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="chat-notifications"><span><i class="fas fa-message"></i><b>New Chat Messages</b><small>Get notified about new chats</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="wishlist-notifications"><span><i class="fa-regular fa-heart"></i><b>Wishlist Updates</b><small>Updates about saved listings</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="listing-notifications"><span><i class="fas fa-box"></i><b>Listing Updates</b><small>Updates about your listings</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="buyer-seller-notifications"><span><i class="fas fa-handshake"></i><b>Interested Buyer/Seller</b><small>Get notified about interest</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="sold-notifications"><span><i class="fas fa-circle-check"></i><b>Sold Listing</b><small>Get notified when listings are sold</small></span><span class="settings-switch"><span></span></span></button>
            <button class="settings-row settings-toggle-row" type="button" data-setting-action="push-notifications"><span><i class="fas fa-mobile-screen-button"></i><b>Push Notifications</b><small>Allow StudentKart notifications</small></span><span class="settings-switch"><span></span></span></button>`
    },
    privacy: {title:"Privacy & Safety",icon:"fa-shield-halved",subtitle:"Control your privacy and safety preferences.",html:`
        <button class="settings-row" type="button" data-setting-action="profile-visibility"><span><i class="fas fa-eye"></i><b>Who Can See My Profile</b><small>Control profile visibility</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row settings-toggle-row" type="button" data-setting-action="hide-phone"><span><i class="fas fa-phone"></i><b>Hide Phone Number</b><small>Control phone visibility</small></span><span class="settings-switch"><span></span></span></button>
        <button class="settings-row settings-toggle-row" type="button" data-setting-action="hide-email"><span><i class="fas fa-envelope"></i><b>Hide Email</b><small>Control email visibility</small></span><span class="settings-switch"><span></span></span></button>
        <button class="settings-row" type="button" data-setting-action="blocked-users"><span><i class="fas fa-user-slash"></i><b>Blocked Users</b><small>Manage blocked accounts</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="report-problem"><span><i class="fas fa-flag"></i><b>Report a Problem</b><small>Tell us about an issue</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="safety-tips"><span><i class="fas fa-lock"></i><b>Safety Tips</b><small>Stay safe while buying and selling</small></span><i class="fas fa-chevron-right"></i></button>`},
    location:{title:"Location",icon:"fa-location-dot",subtitle:"Manage location and nearby listing preferences.",html:`
        <button class="settings-row" type="button" data-setting-action="current-location"><span><i class="fas fa-location-crosshairs"></i><b>Current Location</b><small>Use your current area</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="change-location"><span><i class="fas fa-map-pin"></i><b>Change Location</b><small>Choose a different location</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="state-city-area"><span><i class="fas fa-map"></i><b>State / City / Area</b><small>Set your preferred area</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="nearby-distance"><span><i class="fas fa-route"></i><b>Nearby Listings Distance</b><small>Choose your search radius</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="location-permission"><span><i class="fas fa-location-dot"></i><b>Location Permission</b><small>Manage location access</small></span><i class="fas fa-chevron-right"></i></button>`},
    preferences:{title:"App Preferences",icon:"fa-palette",subtitle:"Customize how StudentKart looks and behaves.",html:`
        <button class="settings-row" type="button" data-setting-action="theme"><span><i class="fas fa-moon"></i><b>Dark Mode / Light Mode</b><small>Choose your app appearance</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="language"><span><i class="fas fa-language"></i><b>Language</b><small>Choose your preferred language</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row settings-toggle-row" type="button" data-setting-action="vibration"><span><i class="fas fa-mobile-screen-button"></i><b>Vibration / Notification Preferences</b><small>Manage interaction feedback</small></span><span class="settings-switch"><span></span></span></button>`},
    security:{title:"Security",icon:"fa-lock",subtitle:"Manage account sessions and security.",html:`
        <button class="settings-row" type="button" data-setting-action="login-sessions"><span><i class="fas fa-laptop"></i><b>Login Sessions</b><small>View active sessions</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="logout-all"><span><i class="fas fa-right-from-bracket"></i><b>Logout from All Devices</b><small>Sign out of other sessions</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="account-security"><span><i class="fas fa-shield"></i><b>Account Security</b><small>Review account security</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row danger-row" type="button" data-setting-action="delete-account"><span><i class="fas fa-trash-can"></i><b>Delete Account</b><small>Permanently remove your account</small></span><i class="fas fa-chevron-right"></i></button>`},
    about:{title:"About & Support",icon:"fa-circle-info",subtitle:"Explore StudentKart information, help and support.",html:`        <button class="settings-row" type="button" data-setting-action="how"><span><i class="fas fa-route"></i><b>How It Works</b><small>Learn how buying and selling works</small></span><i class="fas fa-chevron-right"></i></button>

        <button class="settings-row" type="button" data-setting-action="about"><span><i class="fas fa-circle-info"></i><b>About StudentKart</b><small>Learn more about StudentKart</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="terms"><span><i class="fas fa-file-contract"></i><b>Terms & Conditions</b><small>Platform terms</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="privacy-policy"><span><i class="fas fa-user-shield"></i><b>Privacy Policy</b><small>How information is handled</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="safety-about"><span><i class="fas fa-shield-heart"></i><b>Safety</b><small>Safe buying and selling guidance</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="developer"><span><i class="fas fa-code"></i><b>Developer</b><small>Meet the creator of StudentKart</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row" type="button" data-setting-action="contact"><span><i class="fas fa-headset"></i><b>Contact Us</b><small>Get in touch with StudentKart</small></span><i class="fas fa-chevron-right"></i></button>
        <div class="settings-version"><span>App Version</span><strong>1.0.0</strong></div>`},
    "account-actions":{title:"Account Actions",icon:"fa-door-open",subtitle:"Manage your account session.",html:`
        <button class="settings-row" type="button" data-setting-action="logout"><span><i class="fas fa-right-from-bracket"></i><b>Logout</b><small>Sign out of this account</small></span><i class="fas fa-chevron-right"></i></button>
        <button class="settings-row danger-row" type="button" data-setting-action="delete-account"><span><i class="fas fa-trash-can"></i><b>Delete Account</b><small>This action cannot be undone</small></span><i class="fas fa-chevron-right"></i></button>`}
};

document.addEventListener("click", event => {
    const sectionButton = event.target.closest("[data-settings-section]");
    if (!sectionButton) return;
    event.preventDefault();
    event.stopPropagation();
    const key = sectionButton.dataset.settingsSection;
    const config = SETTINGS_SECTION_TEMPLATES[key];
    if (!config) return;
    closeModal("settingsModal");
    const title = $("settingsDetailTitle"), subtitle = $("settingsDetailSubtitle"), icon = $("settingsDetailIcon"), content = $("settingsDetailContent");
    if (title) title.textContent = config.title;
    if (subtitle) subtitle.textContent = config.subtitle;
    if (icon) icon.className = "fas " + config.icon;
    if (content) content.innerHTML = config.html;
    openModal("settingsDetailModal");
});

document.addEventListener("click", event => {
    const row = event.target.closest("[data-setting-action]");
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    handleSettingAction(row.dataset.settingAction);
});



const footerInfoContent = {
    about: {
        title: "About StudentKart",
        body: `
            <div class="info-intro">StudentKart is a student-focused marketplace designed to make campus buying, selling, renting and discovering useful products easier.</div>
            <div class="info-section">
                <h3><i class="fas fa-store"></i> What is StudentKart?</h3>
                <p>StudentKart brings student-to-student listings into one simple place. Students can browse products, compare listings, save favourites, chat with sellers and publish their own listings.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-bullseye"></i> Our Purpose</h3>
                <p>Our goal is to make useful products and services around student communities easier to discover, while keeping the buying and selling process simple and organized.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-handshake"></i> How StudentKart Works</h3>
                <p>StudentKart connects buyers and sellers. It does not act as the buyer or seller in a transaction. Users are responsible for checking products, sellers, prices and transaction details before making a deal.</p>
            </div>
        `
    },
    how: {
        title: "How It Works",
        body: `
            <div class="info-section">
                <h3><i class="fas fa-cart-shopping"></i> Buying on StudentKart</h3>
                <ol class="info-steps">
                    <li>Browse the marketplace or choose a category.</li>
                    <li>Search and filter listings to find what you need.</li>
                    <li>Open a listing and check its price, condition, location and seller details.</li>
                    <li>Contact the seller through StudentKart chat.</li>
                    <li>Discuss the product and agree on the transaction details before paying.</li>
                </ol>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-tag"></i> Selling on StudentKart</h3>
                <ol class="info-steps">
                    <li>Sign in to your StudentKart account.</li>
                    <li>Select <strong>Sell</strong> and add the product details.</li>
                    <li>Add the name, category, price, location, condition, description and photos.</li>
                    <li>Publish your listing.</li>
                    <li>Respond to interested buyers through chat and complete the transaction safely.</li>
                </ol>
            </div>
            <div class="info-note"><i class="fas fa-circle-info"></i><span>Always inspect an item and confirm the final price, payment method and meeting details before completing a transaction.</span></div>
        `
    },
    safety: {
        title: "Safety",
        body: `
            <div class="info-intro">A few simple precautions can help make buying and selling safer on StudentKart.</div>
            <div class="info-section">
                <h3><i class="fas fa-location-dot"></i> Meet Safely</h3>
                <p>Whenever possible, meet in a safe, public and well-known place. If you are inspecting an item, check it carefully before completing the transaction.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-lock"></i> Protect Your Account</h3>
                <ul class="info-list">
                    <li>Never share your password, OTP or verification code.</li>
                    <li>Do not give anyone access to your account.</li>
                    <li>Avoid publishing sensitive personal information in listings, profiles or chats.</li>
                </ul>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-triangle-exclamation"></i> Watch for Suspicious Activity</h3>
                <ul class="info-list">
                    <li>Be careful with requests for advance payments or unusual payment methods.</li>
                    <li>Do not rush into urgent transfers without verifying the details.</li>
                    <li>Be cautious of offers that seem unusually good or inconsistent with the listing.</li>
                </ul>
            </div>
            <div class="info-note warning"><i class="fas fa-flag"></i><span>If a user or listing appears suspicious, stop the transaction and use the available reporting options.</span></div>
        `
    },
    contact: {
        title: "Contact Us",
        body: `
            <div class="info-intro">Need help, found a bug or have a feature suggestion? You can contact the StudentKart team directly.</div>
            <div class="info-contact-card">
                <div class="info-contact-icon"><i class="fas fa-envelope"></i></div>
                <div><span>Email</span><a href="mailto:rathodharish004@gmail.com">rathodharish004@gmail.com</a></div>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-headset"></i> What You Can Contact Us About</h3>
                <ul class="info-list">
                    <li>General feedback and suggestions</li>
                    <li>Bug or technical problem reports</li>
                    <li>Account-related questions</li>
                    <li>Ideas for improving StudentKart</li>
                </ul>
            </div>
            <div class="info-note"><i class="fas fa-circle-info"></i><span>When reporting a problem, include a short description of what happened and the page or feature where you experienced it.</span></div>
        `
    },
    privacy: {
        title: "Privacy Policy",
        body: `
            <div class="info-intro">StudentKart uses information needed to provide account, marketplace and communication features.</div>
            <div class="info-section">
                <h3><i class="fas fa-database"></i> Information Used</h3>
                <p>Account and profile information may be used for features such as authentication, profiles, listings, wishlist, chat and notifications. Information required for a feature may be stored or processed by the services used to operate StudentKart.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-eye"></i> Information You Share</h3>
                <p>StudentKart aims to show only the information needed for marketplace and communication features. Please do not publish sensitive information in your profile, listing descriptions, chat messages or images.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-shield-halved"></i> Keep Your Account Secure</h3>
                <p>Keep your login credentials and OTPs private. If you believe your account or personal information has been exposed, contact StudentKart support.</p>
            </div>
        `
    },
    terms: {
        title: "Terms & Conditions",
        body: `
            <div class="info-intro">By using StudentKart, you agree to use the platform lawfully, honestly and respectfully.</div>
            <div class="info-section">
                <h3><i class="fas fa-user-check"></i> User Responsibilities</h3>
                <ul class="info-list">
                    <li>Provide genuine and accurate information in listings.</li>
                    <li>Use StudentKart only for lawful activities.</li>
                    <li>Do not use the platform for scams, impersonation, harassment or prohibited transactions.</li>
                    <li>Do not intentionally misrepresent a product or service.</li>
                </ul>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-receipt"></i> Transactions</h3>
                <p>Buyers and sellers are responsible for verifying the listing, product condition, identity, price, payment details and other transaction terms before completing a deal.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-users"></i> StudentKart's Role</h3>
                <p>StudentKart provides a platform for users to connect. StudentKart does not become a party to transactions between users. Users are responsible for their own buying and selling decisions.</p>
            </div>
            <div class="info-section">
                <h3><i class="fas fa-shield-halved"></i> Platform Protection</h3>
                <p>StudentKart may restrict or remove content or accounts when necessary to protect users or maintain the platform.</p>
            </div>
        `
    }
}
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-footer-info]").forEach(button => {
        button.addEventListener("click", () => {
            const key = button.dataset.footerInfo;
            const info = footerInfoContent[key];
            if (!info) return;

            const title = document.getElementById("footerInfoTitle");
            const body = document.getElementById("footerInfoBody");
            if (title) title.textContent = info.title;
            if (body) body.innerHTML = info.body.replace(/\n/g, "<br>");

            openModal("footerInfoModal");
        });
    });
});

/* =========================================================
   FINAL NAVBAR SCROLL BEHAVIOR
   Hide navbar while scrolling down, reveal it while scrolling up.
   Bottom floating navigation is intentionally untouched.
   ========================================================= */
(function initNavbarScrollBehavior() {
    let lastScrollY = window.scrollY || 0;
    let scrollTicking = false;
    const DOWN_THRESHOLD = 8;
    const TOP_OFFSET = 12;

    function updateNavbarScrollState() {
        const navbar = document.querySelector(".navbar");
        if (!navbar) {
            scrollTicking = false;
            return;
        }

        const currentY = Math.max(0, window.scrollY || 0);
        const hasBlockingView =
            document.body.classList.contains("studentkart-modal-navigation-hidden") ||
            document.body.classList.contains("studentkart-product-details-open") ||
            document.body.classList.contains("studentkart-chat-open") ||
            document.body.classList.contains("category-page-active") ||
            !!document.querySelector(".modal:not(.hidden)") ||
            !!document.querySelector("#categoryPage:not(.hidden)");

        if (currentY <= TOP_OFFSET) {
            navbar.classList.remove("navbar-scroll-hidden");
        } else if (!hasBlockingView && currentY > lastScrollY + DOWN_THRESHOLD) {
            navbar.classList.add("navbar-scroll-hidden");
        } else if (currentY < lastScrollY - DOWN_THRESHOLD) {
            navbar.classList.remove("navbar-scroll-hidden");
        }

        lastScrollY = currentY;
        scrollTicking = false;
    }

    function onScroll() {
        if (!scrollTicking) {
            window.requestAnimationFrame(updateNavbarScrollState);
            scrollTicking = true;
        }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
        lastScrollY = window.scrollY || 0;
        if (lastScrollY <= TOP_OFFSET) {
            document.querySelector(".navbar")?.classList.remove("navbar-scroll-hidden");
        }
    }, { passive: true });
})();


/* FINAL FLOATING CHAT BUTTON REPAIR */
(function repairFloatingChatButton(){
  function bind(){
    const bottomChat = document.querySelector('.bottom-chat-nav-item');
    if(!bottomChat || bottomChat.dataset.skChatBound === '1') return;
    bottomChat.dataset.skChatBound = '1';
    bottomChat.removeAttribute('onclick');
    bottomChat.addEventListener('click', function(event){
      event.preventDefault();
      event.stopPropagation();
      if(typeof openModal !== 'function') return;
      if(!currentUser){
        openModal('loginModal');
        if(typeof showToast === 'function') showToast('Please login to chat','warning');
        return;
      }
      openModal('inquiriesModal');
    }, {passive:false});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();


/* =========================================================
   CAMPUS QUICK BUTTON
   ========================================================= */
(function initCampusQuickButton(){
    const campuses = [
        "Manipal University",
        "G H Raisoni University",
        "University of Mumbai",
        "Savitribai Phule Pune University",
        "Other Campus"
    ];

    function updateCampusLabel(){
        const label=document.getElementById("bottomCampusLabel");
        const selected=localStorage.getItem("studentkartCampus");
        if(label) label.textContent=selected ? "Campus" : "Campus";
    }

    function renderCampusPicker(){
        const list=document.getElementById("campusPickerList");
        if(!list) return;
        const selected=localStorage.getItem("studentkartCampus") || "";
        list.innerHTML=campuses.map(c=>`
            <button type="button" class="campus-picker-option ${selected===c ? "is-selected" : ""}" data-campus="${escapeHTML(c)}">
                <span class="campus-picker-icon"><i class="fas fa-building-columns"></i></span>
                <span><strong>${escapeHTML(c)}</strong><small>${selected===c ? "Currently selected" : "Select this campus"}</small></span>
                <i class="fas fa-chevron-right campus-picker-arrow"></i>
            </button>`).join("");
        list.querySelectorAll("[data-campus]").forEach(btn=>{
            btn.addEventListener("click",()=>{
                const campus=btn.dataset.campus || "";
                localStorage.setItem("studentkartCampus",campus);
                closeModal("campusModal");
                updateCampusLabel();
                if(typeof showToast==="function") showToast("Campus set to "+campus,"success");
            });
        });
    }

    document.addEventListener("DOMContentLoaded",()=>{
        const button=document.getElementById("bottomCampusButton");
        if(!button) return;
        updateCampusLabel();
        button.addEventListener("click",()=>{
            renderCampusPicker();
            openModal("campusModal");
        });
    });
})();
 
/* Homepage search suggestions */
document.addEventListener("DOMContentLoaded", () => {
    const input=document.getElementById("heroSearchInput");
    const panel=document.getElementById("heroSearchSuggestions");
    if(!input||!panel)return;

    const iconFor=category=>{
        const map={Books:"fa-book",Electronics:"fa-laptop",Vehicles:"fa-motorcycle",Furniture:"fa-couch",Services:"fa-handshake",Fashion:"fa-shirt"};
        return map[category]||"fa-globe";
    };

    let suggestionTimer=null;
    let suggestionController=null;

    const addUnique=(out,seen,value,title,meta,icon)=>{
        const clean=String(value||"").trim();
        if(!clean)return;
        const key=clean.toLowerCase();
        if(seen.has(key))return;
        seen.add(key);
        out.push({value:clean,title:title||clean,meta:meta||"Search StudentKart",icon:icon||"fa-globe"});
    };

    const fetchWorldSuggestions=async query=>{
        const q=String(query||"").trim();
        if(q.length<2)return [];
        if(suggestionController)suggestionController.abort();
        suggestionController=new AbortController();
        try{
            const urls=[
                "https://suggestqueries.google.com/complete/search?client=firefox&q="+encodeURIComponent(q),
                "https://en.wikipedia.org/w/api.php?action=opensearch&search="+encodeURIComponent(q)+"&limit=30&namespace=0&format=json&origin=*"
            ];
            const results=await Promise.allSettled(urls.map(url=>fetchWithTimeout(url,{signal:suggestionController.signal,headers:{"Accept":"application/json"}},5000)));
            const out=[];
            const seen=new Set();
            for(const result of results){
                if(result.status!=="fulfilled"||!result.value.ok)continue;
                try{
                    const data=await result.value.json();
                    const values=Array.isArray(data?.[1])?data[1]:[];
                    values.forEach(value=>{
                        const clean=String(value||"").trim();
                        const key=clean.toLowerCase();
                        if(clean&&!seen.has(key)){seen.add(key);out.push(clean);}
                    });
                }catch{}
            }
            return out;
        }catch(error){
            if(error?.name!=="AbortError")console.debug("World search suggestions unavailable:",error);
            return [];
        }
    };

    const getLocalSuggestions=query=>{
        const q=String(query||"").trim().toLowerCase();
        const seen=new Set(),out=[];
        if(!q){
            [...currentProducts].slice(0,5).forEach(p=>{
                const name=String(p.name||"").trim(),cat=String(p.category||"").trim(),loc=String(p.location||"").trim();
                if(name) addUnique(out,seen,name,name,cat+(loc?" • "+loc:""),iconFor(cat));
            });
            ["Books","Electronics","Vehicles","Furniture","Services","Fashion"].forEach(cat=>{
                addUnique(out,seen,cat,cat,"Browse marketplace category",iconFor(cat));
            });
            return out.slice(0,8);
        }

        [...currentProducts].forEach(p=>{
            const name=String(p.name||"").trim(),cat=String(p.category||"").trim(),loc=String(p.location||"").trim();
            const hay=[name,cat,loc,String(p.description||"")].join(" ").toLowerCase();
            if(hay.includes(q))addUnique(out,seen,name,name,cat+(loc?" • "+loc:""),iconFor(cat));
        });

        ["Books","Electronics","Vehicles","Furniture","Services","Fashion"].forEach(cat=>{
            if(cat.toLowerCase().includes(q))addUnique(out,seen,cat,cat,"Browse category","fa-layer-group");
        });

        return out;
    };

    const hide=()=>{
        panel.classList.add("hidden");
        panel.innerHTML="";
        input.removeAttribute("aria-activedescendant");
    };

    const render=async()=>{
        const query=input.value.trim();
        if(!query){hide();return;}

        const local=getLocalSuggestions(query);
        const world=await fetchWorldSuggestions(query);
        if(input.value.trim()!==query)return;

        const seen=new Set();
        const list=[];

        // Use only natural/local and real public-web suggestions. No generated question prefixes.        local.forEach(x=>addUnique(list,seen,x.value,x.title,x.meta,x.icon));
        world.forEach(title=>addUnique(list,seen,title,title,"Web search suggestion","fa-globe"));

        const limited=list.slice(0,20);
        if(!limited.length){hide();return;}

        panel.innerHTML=limited.map((x,i)=>'<button type="button" class="hero-search-suggestion" id="heroSearchSuggestion-'+i+'" role="option" aria-selected="false" data-suggestion-value="'+escapeHTML(x.value)+'"><span class="hero-search-suggestion-icon"><i class="fas '+x.icon+'"></i></span><span class="hero-search-suggestion-copy"><span class="hero-search-suggestion-title">'+escapeHTML(x.title)+'</span><span class="hero-search-suggestion-meta">'+escapeHTML(x.meta)+'</span></span><i class="fas fa-chevron-right hero-search-suggestion-arrow"></i></button>').join("");
        panel.classList.remove("hidden");

        panel.querySelectorAll(".hero-search-suggestion").forEach(b=>{
            b.addEventListener("mousedown",e=>e.preventDefault());
            b.addEventListener("click",()=>{
                const value=b.dataset.suggestionValue||"";
                input.value=value;
                hide();
                if(typeof showSearchResultsPage==="function")showSearchResultsPage(value);
                else if(typeof applyFilters==="function")applyFilters();
            });
        });
    };

    let active=-1;
    const move=d=>{
        const items=[...panel.querySelectorAll(".hero-search-suggestion")];
        if(!items.length)return;
        active=(active+d+items.length)%items.length;
        items.forEach((x,i)=>{
            const on=i===active;
            x.classList.toggle("is-active",on);
            x.setAttribute("aria-selected",on?"true":"false");
        });
        input.setAttribute("aria-activedescendant",items[active].id);
    };

    input.addEventListener("input",()=>{
        active=-1;
        clearTimeout(suggestionTimer);
        suggestionTimer=setTimeout(render,160);
    });
    input.addEventListener("focus",()=>{
        if(input.value.trim())render();
    });
    input.addEventListener("keydown",e=>{
        if(e.key==="ArrowDown"){e.preventDefault();move(1)}
        else if(e.key==="ArrowUp"){e.preventDefault();move(-1)}
        else if(e.key==="Enter"){
            e.preventDefault();
            const a=panel.querySelector(".hero-search-suggestion.is-active");
            const value=a?.dataset.suggestionValue||input.value.trim();
            if(!value)return;
            input.value=value;
            hide();
            if(typeof showSearchResultsPage==="function")showSearchResultsPage(value);
            else if(typeof applyFilters==="function")applyFilters();
        }else if(e.key==="Escape"){hide();input.blur();}
    });
    input.addEventListener("blur",()=>setTimeout(hide,150));
});

/* Scrollable category bar navigation */
document.addEventListener("DOMContentLoaded",()=>{
    document.querySelectorAll(".category-scroll-box").forEach(button=>{
        if(button.dataset.skCategoryBound==="1")return;
        button.dataset.skCategoryBound="1";
        button.addEventListener("click",event=>{
            event.preventDefault();
            event.stopPropagation();
            const category=button.dataset.category||"All";
            selectCategory(category.toLowerCase()==="all"?"all":category);
        });
    });

    $("categoryPageBack")?.addEventListener("click",()=>{
        if(window.history.state?.studentKart && window.history.state?.page==="category"){
            window.history.back();
        }else{
            showHomePageFromCategory();
        }
    });
});

/* Homepage search strip + restored filter controls */
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("heroSearchInput");
    const searchButton = document.getElementById("heroSearchButton");
    const filterButton = document.getElementById("heroFilterButton");
    const filterPanel = document.getElementById("heroFilterPanel");
    const filterClose = document.getElementById("heroFilterClose");
    const filterApply = document.getElementById("heroFilterApply");
    const filterClear = document.getElementById("heroFilterClear");

    const syncHeroFilters = () => {
        const map = [
            ["heroFilterCategory", "categoryFilter"],
            ["heroFilterMin", "minPrice"],
            ["heroFilterMax", "maxPrice"],
            ["heroFilterLocation", "locationFilter"],
            ["heroFilterCondition", "conditionFilter"],
            ["heroFilterSort", "sortFilter"]
        ];
        map.forEach(([from, to]) => {
            const source = document.getElementById(from);
            const target = document.getElementById(to);
            if (source && target) target.value = source.value;
        });
    };

    const runHeroSearch = () => {
        const value = searchInput?.value?.trim() || "";
        if (!value) return;
        if (typeof showSearchResultsPage === "function") showSearchResultsPage(value);
    };

    filterButton?.addEventListener("click", event => {
        event.preventDefault();
        filterPanel?.classList.toggle("hidden");
    });

    filterClose?.addEventListener("click", () => filterPanel?.classList.add("hidden"));

    filterApply?.addEventListener("click", () => {
        syncHeroFilters();
        const searchTarget = document.getElementById("marketplaceSearch") || document.getElementById("navbarSearchInput");
        if (searchTarget && searchInput) searchTarget.value = searchInput.value.trim();
        if (typeof applyFilters === "function") applyFilters();
        filterPanel?.classList.add("hidden");
        document.getElementById("marketplace")?.scrollIntoView({behavior:"smooth", block:"start"});
        if (typeof showToast === "function") showToast("Filters applied", "success");
    });

    filterClear?.addEventListener("click", () => {
        ["heroFilterCategory","heroFilterCondition","heroFilterSort"].forEach(id => {
            const el=document.getElementById(id); if(el) el.value=id==="heroFilterCategory"||id==="heroFilterCondition"?"all":"newest";
        });
        ["heroFilterMin","heroFilterMax","heroFilterLocation"].forEach(id => {
            const el=document.getElementById(id); if(el) el.value="";
        });
        syncHeroFilters();
        if (searchInput) searchInput.value="";
        const searchTarget = document.getElementById("marketplaceSearch") || document.getElementById("navbarSearchInput");
        if (searchTarget) searchTarget.value="";
        if (typeof applyFilters === "function") applyFilters();
    });

    searchButton?.addEventListener("click", runHeroSearch);
    searchInput?.addEventListener("keydown", event => {
        if (event.key === "Enter") runHeroSearch();
    });
});


/* Search-results live suggestions */
document.addEventListener("DOMContentLoaded", () => {
    const input=$("searchResultsInput"), panel=$("searchResultsSuggestions");
    if(!input||!panel)return;
    const iconFor=category=>{
        const map={Books:"fa-book",Electronics:"fa-laptop",Vehicles:"fa-motorcycle",Furniture:"fa-couch",Services:"fa-handshake",Fashion:"fa-shirt"};
        return map[category]||"fa-tag";
    };
    const getSuggestions=query=>{
        const q=String(query||"").trim().toLowerCase();
        const seen=new Set(),out=[];
        const add=(value,title,meta,icon)=>{
            const clean=String(value||"").trim();
            const key=clean.toLowerCase();
            if(!key||seen.has(key))return;
            seen.add(key);
            out.push({value:clean,title:title||clean,meta:meta||"Search StudentKart",icon:icon||"fa-tag"});
        };
        if(!q){
            [...currentProducts].slice(0,5).forEach(p=>{
                const name=String(p.name||"").trim(),cat=String(p.category||"").trim(),loc=String(p.location||"").trim();
                if(name) add(name,name,cat+(loc?" • "+loc:""),iconFor(cat));
            });
            return out.slice(0,8);
        }
        [...currentProducts].forEach(p=>{
            const name=String(p.name||"").trim(),cat=String(p.category||"").trim(),loc=String(p.location||"").trim();
            const hay=[name,cat,loc,String(p.description||"")].join(" ").toLowerCase();
            if(hay.includes(q)) add(name,name,cat+(loc?" • "+loc:""),iconFor(cat));
        });
        ["Books","Electronics","Vehicles","Furniture","Services","Fashion"].forEach(cat=>{
            if(cat.toLowerCase().includes(q)) add(cat,cat,"Browse category","fa-layer-group");
        });
        return out.slice(0,7);
    };
    const hide=()=>{panel.classList.add("hidden");panel.innerHTML="";input.removeAttribute("aria-activedescendant");};
    const render=()=>{
        const list=getSuggestions(input.value);
        if(!list.length){hide();return;}
        panel.innerHTML=list.map((x,i)=>'<button type="button" class="hero-search-suggestion" id="searchResultsSuggestion-'+i+'" role="option" aria-selected="false" data-suggestion-value="'+escapeHTML(x.value)+'"><span class="hero-search-suggestion-icon"><i class="fas '+x.icon+'"></i></span><span class="hero-search-suggestion-copy"><span class="hero-search-suggestion-title">'+escapeHTML(x.title)+'</span><span class="hero-search-suggestion-meta">'+escapeHTML(x.meta)+'</span></span><i class="fas fa-chevron-right hero-search-suggestion-arrow"></i></button>').join("");
        panel.classList.remove("hidden");
        panel.querySelectorAll(".hero-search-suggestion").forEach(b=>{
            b.addEventListener("mousedown",e=>e.preventDefault());
            b.addEventListener("click",()=>{
                const value=b.dataset.suggestionValue||"";
                input.value=value;hide();
                if(typeof showSearchResultsPage==="function")showSearchResultsPage(value);
            });
        });
    };
    let active=-1;
    const move=d=>{
        const items=[...panel.querySelectorAll(".hero-search-suggestion")];if(!items.length)return;
        active=(active+d+items.length)%items.length;
        items.forEach((x,i)=>{const on=i===active;x.classList.toggle("is-active",on);x.setAttribute("aria-selected",on?"true":"false");});
        input.setAttribute("aria-activedescendant",items[active].id);
    };
    input.addEventListener("input",()=>{active=-1;render();});
    input.addEventListener("focus",()=>{if(input.value.trim())render();});
    input.addEventListener("keydown",e=>{
        if(e.key==="ArrowDown"){e.preventDefault();move(1)}
        else if(e.key==="ArrowUp"){e.preventDefault();move(-1)}
        else if(e.key==="Enter"){e.preventDefault();const a=panel.querySelector(".hero-search-suggestion.is-active");const value=a?.dataset.suggestionValue||input.value.trim();if(!value)return;input.value=value;hide();if(typeof showSearchResultsPage==="function")showSearchResultsPage(value);}
        else if(e.key==="Escape"){hide();input.blur();}
    });
    input.addEventListener("blur",()=>setTimeout(hide,150));
});

/* Search results navigation */
document.addEventListener("DOMContentLoaded", () => {
    const goBackFromSearch = () => {
        if (window.history.state?.page === "search") window.history.back();
        else showHomePageFromSearch();
    };
    $("searchResultsBackTop")?.addEventListener("click", goBackFromSearch);
    $("searchResultsBack")?.addEventListener("click", goBackFromSearch);
    const resultInput=$("searchResultsInput");
    const runResultSearch=()=>{ const q=resultInput?.value?.trim(); if(q) showSearchResultsPage(q); };
    $("searchResultsSearchButton")?.addEventListener("click",runResultSearch);
    resultInput?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();runResultSearch();}});
    const resultFilterPanel=$("searchResultsFilterPanel");
    $("searchResultsFilterButton")?.addEventListener("click",()=>resultFilterPanel?.classList.toggle("hidden"));
    $("searchResultsFilterClose")?.addEventListener("click",()=>resultFilterPanel?.classList.add("hidden"));
    $("searchResultsFilterClear")?.addEventListener("click",()=>{
        ["searchResultsFilterCategory","searchResultsFilterCondition","searchResultsFilterSort"].forEach(id=>{
            const el=$(id); if(el) el.value=id==="searchResultsFilterSort"?"newest":"all";
        });
        ["searchResultsFilterMin","searchResultsFilterMax","searchResultsFilterLocation"].forEach(id=>{const el=$(id);if(el)el.value=""});
    });
    $("searchResultsFilterApply")?.addEventListener("click",()=>{
        const q=resultInput?.value?.trim(); if(!q) return;
        const matches=getSearchResultMatches(q).filter(p=>{
            const cat=$("searchResultsFilterCategory")?.value||"all";
            const cond=$("searchResultsFilterCondition")?.value||"all";
            const min=Number($("searchResultsFilterMin")?.value||0);
            const max=Number($("searchResultsFilterMax")?.value||0);
            const loc=String($("searchResultsFilterLocation")?.value||"").trim().toLowerCase();
            const price=Number(p.price)||0;
            return (cat==="all"||String(p.category||"").toLowerCase()===cat.toLowerCase()) &&
                   (cond==="all"||String(p.condition||"").toLowerCase()===cond.toLowerCase()) &&
                   (!min||price>=min) && (!max||price<=max) &&
                   (!loc||[p.location,p.name,p.description].join(" ").toLowerCase().includes(loc));
        }).sort((a,b)=>{
            const s=$("searchResultsFilterSort")?.value||"newest";
            if(s==="price-low") return (Number(a.price)||0)-(Number(b.price)||0);
            if(s==="price-high") return (Number(b.price)||0)-(Number(a.price)||0);
            return new Date(b.createdAt)-new Date(a.createdAt);
        });
        const count=$("searchResultsCount"); if(count) count.textContent=matches.length+(matches.length===1?" listing":" listings");
        renderProducts(matches,"searchResultsProductContainer","searchResultsEmptyState");
        resultFilterPanel?.classList.add("hidden");
    });
        $("searchResultsBrowseAll")?.addEventListener("click", () => {
        showHomePageFromSearch();
        document.getElementById("marketplace")?.scrollIntoView({behavior:"smooth",block:"start"});
    });
});


/* =========================================================
   GLOBAL DISCOVERY HOMEPAGE
   ========================================================= */
async function resolveNewsLocation(){
    const profile=typeof getSavedProfile==="function" ? getSavedProfile() : null;
    const saved={area:String(profile?.area||"").trim(),city:String(profile?.city||"").trim(),state:String(profile?.state||"").trim()};
    if(!navigator.geolocation) return saved;
    try{
        const position=await new Promise(function(resolve,reject){
            navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,maximumAge:600000,timeout:5000});
        });
        const lat=Number(position.coords.latitude);
        const lon=Number(position.coords.longitude);
        if(!Number.isFinite(lat)||!Number.isFinite(lon)) return saved;
        const reverseUrl="https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lon)+"&zoom=10&addressdetails=1";
        const response=await fetchWithTimeout(reverseUrl,{headers:{"Accept":"application/json","Accept-Language":"en-IN"}},6000);
        if(!response.ok) return saved;
        const address=(await response.json()).address||{};
        return {area:String(address.suburb||address.neighbourhood||address.town||address.village||saved.area).trim(),city:String(address.city||address.town||address.municipality||address.county||saved.city).trim(),state:String(address.state||saved.state).trim()};
    }catch(error){
        return saved;
    }
}
async function loadGlobalDiscoveryHomepage(){
    const grid=$("worldNewsGrid");
    if(!grid) return;

    const locationPromise=resolveNewsLocation();
    const area="";
    const city="";
    const state="";
    const city=location.city;
    const state=location.state;

    // Hyperlocal-first: the most specific saved place is always searched first.
    // We do not pretend to know exact GPS distance; this is based on the user's
    // saved area/city/state hierarchy.
    const localLabel=area || city || state || "your area";
    const locationTerms=[area,city,state].filter(Boolean);

    const cleanPart=value=>String(value||"").replace(/["\\]/g,"").trim();
    const localQueries=locationTerms.length
        ? [
            '"' + cleanPart(area||city) + '"',
            area && city ? '"' + cleanPart(area) + '" "' + cleanPart(city) + '"' : '',
            area && state ? '"' + cleanPart(area) + '" "' + cleanPart(state) + '"' : '',
            city ? '"' + cleanPart(city) + '" local news' : '',
            city ? '"' + cleanPart(city) + '" latest news' : '',
            area ? '"' + cleanPart(area) + '" latest news' : ''
          ].filter(Boolean)
        : [];

    // Titwala sits in the Kalyan-Titwala/Thane news belt. When the user's
    // saved area is Titwala, add the immediate local corridor without allowing
    // it to outrank Titwala itself.
    const localName=(area+" "+city).toLowerCase();
    if(localName.includes("titwala")){
        localQueries.push(
            '"Titwala" "Kalyan"',
            '"Titwala" "Thane"',
            '"Titwala" "Kalyan-Dombivli"',
            '"Titwala" railway',
            '"Titwala" civic',
            '"Titwala" Maharashtra'
        );
    }

    const scopes=[
        {
            key:"local",
            label:localLabel + " • Nearby",
            icon:"fa-location-dot",
            queries:localQueries,
            emptyText:"Add your city or area in Profile to see nearby news first."
        },
        {
            key:"nearby",
            label:city ? city + " & Nearby" : "Nearby",
            icon:"fa-map-location-dot",
            queries:city
                ? [
                    '"' + cleanPart(city) + '" local news',
                    '"' + cleanPart(city) + '" latest news',
                    '"' + cleanPart(city) + '" civic',
                    '"' + cleanPart(city) + '" traffic',
                    '"' + cleanPart(city) + '" railway',
                    '"' + cleanPart(city) + '" Maharashtra'
                  ]
                : [],
            emptyText:""
        },
        {
            key:"state",
            label:state ? state + " Regional",
            icon:"fa-map",
            queries:state
                ? [
                    '"' + cleanPart(state) + '" latest news',
                    '"' + cleanPart(state) + '" local news',
                    '"' + cleanPart(state) + '" regional news'
                  ]
                : ["Maharashtra latest news","Maharashtra regional news"],
            emptyText:""
        },
        {
            key:"india",
            label:"India",
            icon:"fa-flag",
            queries:["India latest news","India local news","India breaking news"],
            emptyText:""
        },
        {
            key:"world",
            label:"World",
            icon:"fa-earth-americas",
            queries:[
                "world latest news",
                "international latest news",
                "technology science AI space",
                "business economy markets",
                "sports entertainment culture"
            ],
            emptyText:""
        }
    ];

    let seenUrls=new Set();
    let activeScopeIndex=0;
    let loadingScope=false;
    let allLoadedItems=[];
    const scopeQueues=new Map();
    const scopeFetched=new Set();

    const topicRules=[
        {title:"Technology & Science",query:["technology","science","ai","artificial intelligence","space","nasa","chip","software"],icon:"fa-microchip"},
        {title:"Business & Economy",query:["business","economy","market","markets","finance","company","trade","oil"],icon:"fa-chart-line"},
        {title:"Sports & Culture",query:["sports","football","cricket","tennis","culture","entertainment","music","film"],icon:"fa-futbol"},
        {title:"General",query:["government","politics","education","health","weather","city","india"],icon:"fa-newspaper"}
    ];

    const classify=item=>{
        const hay=(String(item?.title||"")+" "+String(item?.description||"")).toLowerCase();
        let best=topicRules[topicRules.length-1], bestScore=0;
        topicRules.forEach(rule=>{
            const score=rule.query.reduce((sum,word)=>sum+(hay.includes(word)?1:0),0);
            if(score>bestScore){best=rule;bestScore=score;}
        });
        return {...item,topic:best.title,topicIcon:best.icon};
    };

    const renderUnavailable=()=>{
        grid.innerHTML='<div class="world-news-empty"><i class="fas fa-cloud-arrow-down"></i><h3>Latest updates are temporarily unavailable</h3><p>Live news sources could not be reached. Try again in a moment.</p><button type="button" class="btn btn-outline" id="refreshWorldNews"><i class="fas fa-rotate"></i> Try again</button></div>';
        $("refreshWorldNews")?.addEventListener("click",loadGlobalDiscoveryHomepage);
    };

    const scopeBackgroundLoads=new Map();

    const runNewsQueries=async(queries,timeout=4500)=>{
        const results=await Promise.allSettled(
            queries.map(async query=>{
                const newsFunctionUrl=SUPABASE_URL+"/functions/v1/global-news?q="+encodeURIComponent(query);
                const response=await fetchWithTimeout(newsFunctionUrl,{
                    headers:{
                        "apikey":SUPABASE_KEY,
                        "Authorization":"Bearer "+SUPABASE_KEY,
                        "Accept":"application/json"
                    }
                },timeout);
                if(!response.ok) throw new Error("News function returned HTTP "+response.status);
                return response.json();
            })
        );

        const items=[];
        results.forEach(result=>{
            if(result.status!=="fulfilled") return;
            const articles=Array.isArray(result.value?.articles) ? result.value.articles : [];
            articles.forEach(article=>{
                const key=String(article?.url||"").trim().replace(/[?#].*$/,"");
                if(!key || seenUrls.has(key)) return;
                seenUrls.add(key);
                if(article?.title && article?.url) items.push(classify(article));
            });
        });

        items.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
        return items;
    };

    const fetchScope=async(scope)=>{
        const existingQueue=scopeQueues.get(scope.key);
        if(existingQueue && existingQueue.length) return existingQueue;

        const background=scopeBackgroundLoads.get(scope.key);
        if(existingQueue && background){
            await background.catch(()=>[]);
            return scopeQueues.get(scope.key)||[];
        }

        const queries=Array.isArray(scope.queries) ? scope.queries.filter(Boolean) : [];
        if(!queries.length) return [];

        // First paint uses only the two fastest/most relevant queries.
        // The remaining queries continue in the background, so users never
        // wait for every source before seeing the first stories.
        const initialQueries=queries.slice(0,2);
        const remainingQueries=queries.slice(2);

        const initialItems=await runNewsQueries(initialQueries,4500);
        scopeQueues.set(scope.key,initialItems);

        if(remainingQueries.length){
            const backgroundPromise=runNewsQueries(remainingQueries,9000)
                .then(items=>{
                    const current=scopeQueues.get(scope.key)||[];
                    const merged=[...current,...items].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
                    scopeQueues.set(scope.key,merged);
                    return merged;
                })
                .catch(()=>scopeQueues.get(scope.key)||[])
                .finally(()=>scopeBackgroundLoads.delete(scope.key));
            scopeBackgroundLoads.set(scope.key,backgroundPromise);
        }

        return initialItems;
    };

    const articleHtml=(item,featured=false)=>{
        const image=item.image
            ? '<img src="'+escapeHTML(item.image)+'" alt="" loading="lazy">'
            : '<div class="'+(featured?"world-news-image-placeholder":"world-news-card-placeholder")+'"><i class="fas '+escapeHTML(item.topicIcon)+'"></i></div>';
        return featured
            ? '<article class="world-news-featured">'+image+'<div class="world-news-featured-body"><div class="world-news-meta"><span><i class="fas '+escapeHTML(item.topicIcon)+'"></i>'+escapeHTML(item.topic)+'</span><span>'+escapeHTML(item.source)+'</span></div><h3>'+escapeHTML(item.title)+'</h3><p>'+escapeHTML(item.description||"Latest details from the reported story.")+'</p><a href="'+escapeHTML(item.url)+'" target="_blank" rel="noopener noreferrer">Read full story <i class="fas fa-arrow-up-right-from-square"></i></a></div></article>'
            : '<article class="world-news-card">'+image+'<div class="world-news-card-body"><div class="world-news-meta"><span>'+escapeHTML(item.topic)+'</span><small>'+escapeHTML(item.source)+'</small></div><h3>'+escapeHTML(item.title)+'</h3>'+(item.description?'<p>'+escapeHTML(item.description)+'</p>':'')+'<a href="'+escapeHTML(item.url)+'" target="_blank" rel="noopener noreferrer">Details <i class="fas fa-arrow-right"></i></a></div></article>';
    };

    const appendScope=(scope,items)=>{
        if(!items.length) return;

        const section=document.createElement("section");
        section.className="world-news-scope";
        section.dataset.scope=scope.key;

        const heading=document.createElement("div");
        heading.className="world-news-scope-heading";
        const subtitle=scope.key==="local"
            ? "Hyperlocal stories from your saved area"
            : scope.key==="nearby"
                ? "Local coverage around your city"
                : "Wider coverage as you explore";
        heading.innerHTML='<div><span class="world-news-scope-icon"><i class="fas '+escapeHTML(scope.icon)+'"></i></span><div><strong>'+escapeHTML(scope.label)+'</strong><small>'+subtitle+'</small></div></div><span class="world-news-scope-count">'+items.length+' stories</span>';
        section.appendChild(heading);

        if(scope.key==="local" && allLoadedItems.length===0 && items[0]){
            const featuredWrap=document.createElement("div");
            featuredWrap.innerHTML=articleHtml(items[0],true);
            section.appendChild(featuredWrap.firstElementChild);

            const cards=document.createElement("div");
            cards.className="world-news-card-grid";
            cards.innerHTML=items.slice(1).map(item=>articleHtml(item,false)).join("");
            section.appendChild(cards);
        }else{
            const cards=document.createElement("div");
            cards.className="world-news-card-grid";
            cards.innerHTML=items.map(item=>articleHtml(item,false)).join("");
            section.appendChild(cards);
        }

        grid.appendChild(section);
        allLoadedItems.push(...items);
    };

    const appendLoader=()=>{
        const loader=document.createElement("div");
        loader.id="worldNewsMoreLoader";
        loader.className="world-news-more-loader";
        loader.innerHTML='<i class="fas fa-spinner fa-spin"></i><span>Loading more nearby news…</span>';
        grid.appendChild(loader);
        return loader;
    };

    const loadNextScope=async()=>{
        if(loadingScope) return;
        loadingScope=true;

        const loader=appendLoader();

        try{
            // Consume a large batch from the current scope first. This keeps
            // Titwala news on screen for much longer before widening outward.
            while(activeScopeIndex<scopes.length){
                const scope=scopes[activeScopeIndex];
                const queue=await fetchScope(scope);

                if(queue.length){
                    const batch=queue.splice(0,24);
                    scopeQueues.set(scope.key,queue);
                    appendScope(scope,batch);

                    // If the same scope still has stories, keep loading that
                    // scope on the next scroll instead of jumping to India.
                    if(queue.length){
                        loader.remove();
                        const sentinel=document.createElement("div");
                        sentinel.id="worldNewsLoadMoreSentinel";
                        sentinel.className="world-news-load-more-sentinel";
                        grid.appendChild(sentinel);
                        newsObserver.observe(sentinel);
                        return;
                    }
                }

                activeScopeIndex++;
            }

            loader.remove();

            const endNote=document.createElement("div");
            endNote.className="world-news-refresh";
            endNote.innerHTML='<button type="button" class="btn btn-outline" id="refreshWorldNews"><i class="fas fa-rotate"></i> Refresh live news</button>';
            grid.appendChild(endNote);
            $("refreshWorldNews")?.addEventListener("click",loadGlobalDiscoveryHomepage);
        }catch(error){
            console.error("News scope failed:",error);
            loader.remove();

            if(!allLoadedItems.length){
                renderUnavailable();
            }else{
                activeScopeIndex++;
                setTimeout(loadNextScope,50);
            }
        }finally{
            loadingScope=false;
        }
    };

    const newsObserver=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
            if(entry.isIntersecting){
                const sentinel=entry.target;
                newsObserver.unobserve(sentinel);
                sentinel.remove();
                loadNextScope();
            }
        });
    },{root:null,rootMargin:"1200px 0px",threshold:0});

    try{
        // Resolve location with a short race, then paint immediately.
        // If permission/reverse-geocoding is slow, the saved profile location
        // remains the fallback rather than blocking the news UI.
        const resolvedLocation=await Promise.race([
            locationPromise,
            new Promise(resolve=>setTimeout(()=>resolve({
                area:String(getSavedProfile?.()?.area||"").trim(),
                city:String(getSavedProfile?.()?.city||"").trim(),
                state:String(getSavedProfile?.()?.state||"").trim()
            }),1800))
        ]);

        const resolvedArea=String(resolvedLocation?.area||"").trim();
        const resolvedCity=String(resolvedLocation?.city||"").trim();
        const resolvedState=String(resolvedLocation?.state||"").trim();

        // Rebuild the scope queries from the fast location result.
        const localLabelFast=resolvedArea||resolvedCity||resolvedState||"your area";
        const locationPartsFast=[resolvedArea,resolvedCity,resolvedState].filter(Boolean);
        scopes[0].label=localLabelFast+" • Nearby";
        scopes[0].queries=[
            resolvedArea ? '"'+cleanPart(resolvedArea)+'"' : "",
            resolvedArea&&resolvedCity ? '"'+cleanPart(resolvedArea)+'" "'+cleanPart(resolvedCity)+'"' : "",
            resolvedCity ? '"'+cleanPart(resolvedCity)+'" local news' : ""
        ].filter(Boolean);

        scopes[1].label=resolvedCity ? resolvedCity+" & Nearby" : "Nearby";
        scopes[1].queries=resolvedCity ? [
            '"'+cleanPart(resolvedCity)+'" latest news',
            '"'+cleanPart(resolvedCity)+'" local news',
            '"'+cleanPart(resolvedCity)+'" civic',
            '"'+cleanPart(resolvedCity)+'" traffic',
            '"'+cleanPart(resolvedCity)+'" railway',
            '"'+cleanPart(resolvedCity)+'" Maharashtra'
        ] : [];

        scopes[2].label=resolvedState ? resolvedState+" Regional" : "Maharashtra Regional";
        scopes[2].queries=resolvedState ? [
            '"'+cleanPart(resolvedState)+'" latest news',
            '"'+cleanPart(resolvedState)+'" local news',
            '"'+cleanPart(resolvedState)+'" regional news'
        ] : ["Maharashtra latest news","Maharashtra regional news"];

        const cacheKey="globedisc_news_cache_v2_"+[resolvedArea,resolvedCity,resolvedState].join("|").toLowerCase();
        let cached=[];
        try{
            cached=JSON.parse(localStorage.getItem(cacheKey)||"[]");
            if(!Array.isArray(cached)) cached=[];
        }catch(_){cached=[];}

        const startText=locationPartsFast.length
            ? "Showing nearby news instantly. More stories are loading in the background."
            : "Showing the latest news. Add your area/city in Profile for hyperlocal news.";

        grid.innerHTML="";
        if(cached.length){
            appendScope(scopes[0],cached.slice(0,24));
            activeScopeIndex=1;
            setTimeout(()=>loadNextScope(),0);
        }else{
            grid.innerHTML='<div class="world-news-loading"><i class="fas fa-spinner fa-spin"></i><h3>'+escapeHTML(startText)+'</h3><p>Getting the first nearby stories…</p></div>';
            if(!locationPartsFast.length) activeScopeIndex=1;
            grid.innerHTML="";
            await loadNextScope();
        }

        // Keep a small instant-start cache for the next visit.
        const firstScopeItems=scopeQueues.get("local")||[];
        if(firstScopeItems.length){
            try{localStorage.setItem(cacheKey,JSON.stringify(firstScopeItems.slice(0,24)));}catch(_){}
        }
    }catch(error){
        console.error("Global discovery feed failed:",error);
        renderUnavailable();
    }
}
document.addEventListener("DOMContentLoaded",()=>{loadGlobalDiscoveryHomepage();});


/* =========================================================
   SEARCH RESULTS — MOBILE/HOME SEARCH SYNC
   ========================================================= */
(function () {
    const SEARCH_CATEGORIES = [
        ["Books", "fa-book"],
        ["Electronics", "fa-laptop"],
        ["Vehicles", "fa-car"],
        ["Furniture", "fa-couch"],
        ["Services", "fa-briefcase"],
        ["Fashion", "fa-shirt"],
        ["Gaming", "fa-gamepad"],
        ["Other", "fa-layer-group"]
    ];

    function scrollSearchToTop(input) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(() => {
            try {
                input?.focus({ preventScroll: true });
            } catch (_) {
                input?.focus();
            }
        }, 180);
    }

    function resultSuggestionIcon(category) {
        const found = SEARCH_CATEGORIES.find(
            item => item[0].toLowerCase() === String(category || "").toLowerCase()
        );
        return found?.[1] || "fa-magnifying-glass";
    }

    function buildSearchSuggestions(query) {
        const q = String(query || "").trim().toLowerCase();
        const output = [];
        const seen = new Set();

        const add = (value, title, meta, icon) => {
            const key = String(value || "").trim().toLowerCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            output.push({ value: String(value).trim(), title, meta, icon });
        };

        const products = Array.isArray(currentProducts) ? currentProducts : [];

        if (!q) {
            products.slice(0, 5).forEach(product => {
                const name = String(product?.name || "").trim();
                const category = String(product?.category || "").trim();
                const location = String(product?.location || "").trim();
                if (name) {
                    add(
                        name,
                        name,
                        [category, location].filter(Boolean).join(" • ") || "StudentKart listing",
                        resultSuggestionIcon(category)
                    );
                }
            });

            SEARCH_CATEGORIES.forEach(([category, icon]) => {
                add(category, category, "Browse marketplace category", icon);
            });

            return output.slice(0, 8);
        }

        products.forEach(product => {
            const name = String(product?.name || "").trim();
            const category = String(product?.category || "").trim();
            const location = String(product?.location || "").trim();
            const haystack = [
                name,
                category,
                location,
                product?.condition,
                product?.description
            ].join(" ").toLowerCase();

            if (name.toLowerCase().includes(q) || category.toLowerCase().includes(q) || haystack.includes(q)) {
                add(
                    name || category,
                    name || category,
                    [category, location].filter(Boolean).join(" • ") || "StudentKart listing",
                    resultSuggestionIcon(category)
                );
            }
        });

        SEARCH_CATEGORIES.forEach(([category, icon]) => {
            if (category.toLowerCase().includes(q)) {
                add(category, category, "Browse marketplace category", icon);
            }
        });

        if (!output.length) {
            add(query, query, "Search StudentKart and the internet", "fa-globe");
        }

        return output.slice(0, 8);
    }

    function renderResultSuggestions() {
        const input = document.getElementById("searchResultsInput");
        const panel = document.getElementById("searchResultsSuggestions");
        if (!input || !panel) return;

        const suggestions = buildSearchSuggestions(input.value);

        if (!suggestions.length) {
            panel.classList.add("hidden");
            panel.innerHTML = "";
            return;
        }

        panel.innerHTML = suggestions.map(item => `
            <button type="button" class="hero-search-suggestion" data-search-result-suggestion="${escapeHTML(item.value)}">
                <span class="suggestion-icon"><i class="fas ${escapeHTML(item.icon)}"></i></span>
                <span class="suggestion-content">
                    <strong>${escapeHTML(item.title)}</strong>
                    <small>${escapeHTML(item.meta)}</small>
                </span>
                <i class="fas fa-arrow-up-right-from-square suggestion-arrow"></i>
            </button>
        `).join("");

        panel.classList.remove("hidden");

        panel.querySelectorAll("[data-search-result-suggestion]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();

                const value = button.dataset.searchResultSuggestion || "";
                input.value = value;
                panel.classList.add("hidden");

                // Replace the current search history entry so selecting a
                // suggestion feels like continuing the same search screen.
                showSearchResultsPage(value);
                window.setTimeout(() => scrollSearchToTop(input), 40);
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        // Keep the main search bar at the top when the user opens it.
        const homeSearch = document.getElementById("heroSearchInput");
        homeSearch?.addEventListener("click", () => scrollSearchToTop(homeSearch));
        homeSearch?.addEventListener("focus", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });

        // The bottom marketplace button opens the separate marketplace page.
        document.getElementById("bottomMarketplaceButton")?.addEventListener("click", () => {
            window.location.href = "marketplace.html";
        });

        // Android/browser Back should restore the normal search position.
        window.addEventListener("popstate", () => {
            window.setTimeout(() => {
                const resultsPage = document.getElementById("searchResultsPage");
                if (!resultsPage?.classList.contains("hidden")) {
                    window.scrollTo({ top: 0, behavior: "auto" });
                }
            }, 40);
        });

        const input = document.getElementById("searchResultsInput");
        if (!input) return;

        input.addEventListener("click", () => {
            scrollSearchToTop(input);
            renderResultSuggestions();
        });

        input.addEventListener("focus", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            renderResultSuggestions();
        });

        input.addEventListener("input", () => {
            renderResultSuggestions();
        });

        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                const value = input.value.trim();
                if (!value) return;
                document.getElementById("searchResultsSuggestions")?.classList.add("hidden");
                showSearchResultsPage(value);
                window.setTimeout(() => scrollSearchToTop(input), 40);
            }

            if (event.key === "Escape") {
                document.getElementById("searchResultsSuggestions")?.classList.add("hidden");
            }
        });

        document.addEventListener("click", event => {
            const panel = document.getElementById("searchResultsSuggestions");
            const wrap = input.closest(".hero-search-input-wrap");
            if (panel && wrap && !wrap.contains(event.target)) {
                panel.classList.add("hidden");
            }
        });
    });
})();