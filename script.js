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
let toastTimer = null;


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
            ".modal:not(.hidden):not(.modal-closing)"
        );

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

    window.setTimeout(() => {
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
}

function closeAllModals(options = {}) {

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
async function openWishlist() {

    if (!currentUser) {

        openModal("loginModal");

        showToast(
            "Please login to use wishlist",
            "warning"
        );

        return;
    }

    await renderWishlist();

    openModal("wishlistModal");
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

        currentUser =
            data?.session?.user ||
            null;

        return currentUser;

    } catch (error) {

        console.error(
            "Session error:",
            error
        );

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

async function loadProducts() {

    const container =
        $("productContainer");

    try {

        if (container) {

            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading marketplace...</p>
                </div>
            `;
        }

        const {
            data,
            error
        } =
            await supabaseClient
                .from("products")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (error) {
            throw error;
        }

        currentProducts =
            (data || [])
                .map(normalizeProduct);

        updateStats();

        applyFilters();

    } catch (error) {

        console.error(
            "Load products error:",
            error
        );

        if (container) {

            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-triangle-exclamation"></i>
                    <h3>Could not load products</h3>
                    <p>Please refresh and try again.</p>
                </div>
            `;
        }

        showToast(
            "Could not load marketplace",
            "error"
        );
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

function renderProducts(products) {

    const container =
        $("productContainer");

    const empty =
        $("emptyState");

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

        } else {

            profileButton.classList.add(
                "hidden"
            );

            profileButton.disabled =
                true;
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
}


/* =========================================================
   SELLER PROFILE
   ========================================================= */

function ensureSellerProfileUI() {

    if ($("sellerProfileModal")) {
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

    if (chatButton) {
        chatButton.onclick = async () => {
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

            const { data: inquiry } = await supabaseClient
                .from("inquiries")
                .select("*")
                .eq("buyer_id", currentUser.id)
                .eq("seller_id", sellerId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!inquiry) {
                showToast("Open a product and send an inquiry to start chatting with this seller.", "warning");
                return;
            }

            await openChat(inquiry);
        };
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

    selectedInquiryProduct =
        currentProduct;

    if ($("inquiryProductName")) {

        $("inquiryProductName")
            .textContent =
            currentProduct.name;
    }

    if ($("inquiryProductPrice")) {

        $("inquiryProductPrice")
            .textContent =
            formatPrice(
                currentProduct.price
            );
    }

    if ($("inquiryMessage")) {

        $("inquiryMessage")
            .value = "";
    }

    openModal("inquiryModal");
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

        const inquiries =
            data || [];

        const { data: hiddenChats, error: hiddenChatsError } =
            await supabaseClient
                .from("hidden_chats")
                .select("inquiry_id")
                .eq("user_id", currentUser.id);

        if (hiddenChatsError) {
            throw hiddenChatsError;
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

async function searchStudentKartUsers(query) {
    const box = $("chatUserSearchResults"); if (!box || !currentUser) return;
    const q = String(query || "").trim();
    if (q.length < 2) { box.innerHTML = ""; box.classList.add("hidden"); return; }
    box.classList.remove("hidden"); box.innerHTML = '<div class="chat-user-search-loading"><i class="fas fa-spinner fa-spin"></i><span>Finding students...</span></div>';
    try {
        const p = "%" + q.replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";
        const r = await supabaseClient.from("profiles").select("id,name,username,phone,email,college,avatar_url,city,area").or("username.ilike."+p+",phone.ilike."+p+",email.ilike."+p+",name.ilike."+p).neq("id", currentUser.id).limit(20);
        if (r.error) throw r.error;
        if (!r.data?.length) { box.innerHTML = '<div class="chat-user-search-empty"><i class="fas fa-user-slash"></i><strong>No student found</strong><span>Try username, mobile or email.</span></div>'; return; }
        box.innerHTML = '<div class="chat-user-search-title"><span>STUDENTKART USERS</span><small>'+r.data.length+' result'+(r.data.length===1?"":"s")+'</small></div>'+r.data.map(x=>{const n=x.username||x.name||"Student";const s=x.username&&x.name?x.name:(x.email||x.phone||x.college||"");const a=x.avatar_url?'<img src="'+escapeHTML(x.avatar_url)+'" alt="">':'<span>'+escapeHTML(getInitials(n))+'</span>';return '<button type="button" class="chat-user-search-card" data-user-search-id="'+escapeHTML(x.id)+'"><span class="chat-user-search-avatar">'+a+'</span><span class="chat-user-search-main"><strong>'+escapeHTML(n)+'</strong><small>'+escapeHTML(s)+'</small></span><i class="fas fa-chevron-right"></i></button>';}).join("");
        box.querySelectorAll("[data-user-search-id]").forEach(c => {
            c.addEventListener("click", async () => {
                const targetId = c.dataset.userSearchId;
                box.classList.add("hidden");
                box.innerHTML = "";
                const searchInput = $("chatListSearchInput");
                if (searchInput) searchInput.value = "";
                await openStudentKartUserChat(targetId);
            });
        });
    } catch(e) { console.error("Student search error:",e); box.innerHTML='<div class="chat-user-search-empty error"><i class="fas fa-triangle-exclamation"></i><strong>Search unavailable</strong><span>Please try again.</span></div>'; }
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

async function openStudentKartUserProfile(id) {
    if (!id) return; if (String(id)===String(currentUser?.id)) return openProfile();
    const r=await supabaseClient.from("profiles").select("id,name,username,phone,email,college,avatar_url,city,area").eq("id",id).maybeSingle();
    if(r.error||!r.data){showToast("Could not open student profile","error");return;}
    ensureStudentSearchProfileUI(); const x=r.data;
    $("studentSearchProfileAvatar").innerHTML=x.avatar_url?'<img src="'+escapeHTML(x.avatar_url)+'" alt="">':escapeHTML(getInitials(x.username||x.name)); $("studentSearchProfileName").textContent=x.name||"Student"; $("studentSearchProfileUsername").textContent=x.username?"@"+x.username:"Username not added"; $("studentSearchProfileCollege").textContent=x.college||"College not added"; $("studentSearchProfileContact").textContent=x.email||x.phone||"Contact not added"; $("studentSearchProfileLocation").textContent=[x.area,x.city].filter(Boolean).join(", ")||"Location not added"; openModal("studentSearchProfileModal");
}
function ensureStudentSearchProfileUI(){
    if($("studentSearchProfileModal"))return; const m=document.createElement("div"); m.id="studentSearchProfileModal";m.className="modal hidden";m.innerHTML='<div class="modal-overlay" data-close-modal></div><div class="modal-content student-search-profile-modal"><button type="button" class="modal-close modal-back-button" data-close-modal aria-label="Back"><i class="fas fa-arrow-left"></i></button><div class="student-search-profile-head"><div id="studentSearchProfileAvatar" class="student-search-profile-avatar"></div><span class="section-label">STUDENTKART USER</span><h2 id="studentSearchProfileName">Student</h2><p id="studentSearchProfileUsername">@username</p></div><div class="student-search-profile-info"><div><i class="fas fa-graduation-cap"></i><span id="studentSearchProfileCollege">College not added</span></div><div><i class="fas fa-location-dot"></i><span id="studentSearchProfileLocation">Location not added</span></div><div><i class="fas fa-address-card"></i><span id="studentSearchProfileContact">Contact not added</span></div></div></div>';document.body.appendChild(m);
}

function applyChatListFilter() {
    const container = $("inquiriesContainer");
    if (!container) return;

    const query = ($("chatListSearchInput")?.value || "").trim().toLowerCase();
    const activeTab = document.querySelector(".chat-list-tab.active")?.dataset.chatFilter || "all";
    const cards = container.querySelectorAll(".whatsapp-inquiry-card");
    let visible = 0;

    cards.forEach(card => {
        const haystack = [
            card.dataset.chatName || "",
            card.dataset.chatPreview || "",
            card.querySelector(".whatsapp-product-name")?.textContent || ""
        ].join(" ").toLowerCase();

        const matchesSearch = !query || haystack.includes(query);
        const matchesTab = activeTab !== "unread" || card.dataset.chatUnread === "true";
        const show = matchesSearch && matchesTab;

        card.classList.toggle("chat-filter-hidden", !show);
        if (show) visible++;
    });

    const empty = $("chatListFilteredEmpty");
    if (empty) empty.classList.toggle("hidden", visible > 0 || !cards.length);
}

function setupChatListControls() {
    const input = $("chatListSearchInput");
    const clear = $("chatListSearchClear");
    if (input && !input.dataset.bound) {
        input.dataset.bound = "true";
        input.addEventListener("input", () => {
            clear?.classList.toggle("hidden", !input.value);
            applyChatListFilter();
            searchStudentKartUsers(input.value);
        });
    }

    if (clear && !clear.dataset.bound) {
        clear.dataset.bound = "true";
        clear.addEventListener("click", () => {
            if (!input) return;
            input.value = "";
            clear.classList.add("hidden");
            $("chatUserSearchResults")?.classList.add("hidden");
            $("chatUserSearchResults") && ($("chatUserSearchResults").innerHTML = "");
            applyChatListFilter();
            input.focus();
        });
    }

    document.querySelectorAll(".chat-list-tab").forEach(tab => {
        if (tab.dataset.bound) return;
        tab.dataset.bound = "true";
        tab.addEventListener("click", () => {
            document.querySelectorAll(".chat-list-tab").forEach(item => {
                const active = item === tab;
                item.classList.toggle("active", active);
                item.setAttribute("aria-selected", active ? "true" : "false");
            });
            applyChatListFilter();
        });
    });

    const refresh = $("chatListRefreshButton");
    if (refresh && !refresh.dataset.bound) {
        refresh.dataset.bound = "true";
        refresh.addEventListener("click", async () => {
            refresh.classList.add("is-loading");
            try { await loadReceivedInquiries(); }
            finally { refresh.classList.remove("is-loading"); }
        });
    }

    const close = $("chatListCloseButton");
    if (close && !close.dataset.bound) {
        close.dataset.bound = "true";
        close.addEventListener("click", () => closeModal("inquiriesModal"));
    }

    applyChatListFilter();
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

function normalizeAuthEmail(raw) {
    const value = String(raw || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

async function loginUser(event) {
    event.preventDefault();

    const email = normalizeAuthEmail($("loginIdentifier")?.value);
    const password = $("loginPassword")?.value || "";

    if (!email || !password) {
        showToast("Enter your email and password", "warning");
        return;
    }

    const button = $("loginForm")?.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        closeModal("loginModal");
        showToast("Logged in successfully", "success");
    } catch (error) {
        console.error("Login error:", error);
        showToast(error?.message || "Could not login. Check your email and password.", "error");
    } finally {
        if (button) button.disabled = false;
    }
}

async function signupUser(event) {
    event.preventDefault();

    const name = $("signupName")?.value?.trim();
    const college = $("signupCollege")?.value?.trim();
    const email = normalizeAuthEmail($("signupIdentifier")?.value);
    const password = $("signupPassword")?.value || "";

    if (!name || !college || !state || !city || !email || !password) {
        showToast("Please fill all fields correctly", "warning");
        return;
    }

    if (password.length < 6) {
        showToast("Password must be at least 6 characters", "warning");
        return;
    }

    const button = $("signupForm")?.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { name, college, state, city, area }
            }
        });

        if (error) throw error;

        if (data?.user && data?.session) {
            await ensureProfileAfterPasswordSignup(data.user);
        }

        closeModal("signupModal");

        showToast(
            data?.session
                ? "Account created successfully"
                : "Account created. Check your email to confirm, then login.",
            "success"
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
            name: metadata.name || user.email?.split("@")[0] || "Student",
            college: metadata.college || "",
            state: metadata.state || "",
            city: metadata.city || "",
            area: metadata.area || "",
            email: user.email || "",
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

async function logoutUser() {

    stopNotificationRefresh();

    try {

        await supabaseClient.auth.signOut();

        currentUser = null;
        currentNotifications = [];

        updateNavbar();
        updateNotificationNavbar();

        closeAllModals();

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

    if ($("profileEmailInfo")) {

        $("profileEmailInfo")
            .textContent =
            currentUser.email ||
            profile.email ||
            "Not available";
    }

    if ($("profilePhoneInfo")) {
        $("profilePhoneInfo").textContent = profile.phone || currentUser.phone || "Not added";
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
        $("editProfileUsername").value = profile?.username || currentUser.user_metadata?.username || "";
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

    if ($("editProfileEmail")) {

        $("editProfileEmail").value =
            currentUser.email ||
            "";
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
    const username = $("editProfileUsername")?.value?.trim()?.toLowerCase() || "";
    const phone = $("editProfilePhone")?.value?.trim() || "";
    const college = $("editProfileCollege")?.value?.trim();
    const state = $("editProfileState")?.value?.trim() || "";
    const city = $("editProfileCity")?.value?.trim() || "";
    const area = $("editProfileArea")?.value?.trim() || "";

    if (!name) {
        showToast("Name is required", "warning");
        return;
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
        phone,
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
    if ($("profileEmailInfo")) $("profileEmailInfo").textContent = currentUser.email || "Not available";
    if ($("profilePhoneInfo")) $("profilePhoneInfo").textContent = phone || currentUser.phone || "Not added";

    if ($("profileAvatar")) {
        if (previewAvatarUrl) {
            $("profileAvatar").innerHTML = `<img src="${escapeHTML(previewAvatarUrl)}" alt="">`;
        } else {
            $("profileAvatar").textContent = getInitials(name);
        }
    }

    closeModal("editProfileModal", { instant: true });
    showToast(
        file ? "Profile photo updating..." : "Profile updated",
        "success"
    );

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

        showToast("Profile updated successfully", "success");

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

function selectCategory(
    category
) {

    selectedMarketplaceCategory =
        category || "all";

    const filter =
        $("categoryFilter");

    if (filter) {
        filter.value = category;
    }

    applyFilters();

    document
        .querySelector(
            "#marketplace"
        )
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
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
            return "fa-box";

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
    document.addEventListener("click", event => {
        const wishlistButton = event.target.closest("[data-wishlist-id]");
        if (!wishlistButton) return;

        event.preventDefault();
        event.stopPropagation();

        toggleWishlist(wishlistButton.dataset.wishlistId);
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

    $("profileButton")
        ?.addEventListener(
            "click",
            () => {
                if (currentUser) {
                    openModal("profileModal");
                    loadProfile?.();
                } else {
                    openModal("loginModal");
                }
            }
        );

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

    const filterMenu =
        document.querySelector(".marketplace-filter-menu");

    filterMenu?.addEventListener("toggle", () => {
        if (filterMenu.open) {
            captureMarketplaceFilterSnapshot();
        }
    });

    $("applyMarketplaceFilters")
        ?.addEventListener(
            "click",
            () => {
                applyFilters();
                filterMenu?.removeAttribute("open");
                showToast("Filters applied", "success");
            }
        );

    $("cancelMarketplaceFilters")
        ?.addEventListener(
            "click",
            () => {
                restoreMarketplaceFilterSnapshot();
                applyFilters();
                filterMenu?.removeAttribute("open");
            }
        );

    $("refreshProducts")
        ?.addEventListener(
            "click",
            loadProducts
        );


    $("bottomCategoriesButton")?.addEventListener("click", () => {
        const modal = $("categoryPickerModal");
        if (!modal) return;
        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        document.body.classList.add("studentkart-modal-navigation-hidden");
    });

    document.querySelectorAll(".category-picker-card").forEach(card => {
        card.addEventListener("click", () => {
            selectCategory(card.dataset.category);
            const modal = $("categoryPickerModal");
            modal?.classList.add("hidden");
            document.body.classList.remove("modal-open");
            document.body.classList.remove("studentkart-modal-navigation-hidden");
        });
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

    $("productImage")
        ?.addEventListener(
            "change",
            handleImagePreview
        );


    /* -----------------------------------------
       PRODUCT DETAILS
       ----------------------------------------- */

    $("contactSellerButton")
        ?.addEventListener(
            "click",
            contactSeller
        );

    $("viewSellerProfileButton")
        ?.addEventListener(
            "click",
            () => {

                if (
                    currentProduct?.userId
                ) {

                    openSellerProfile(
                        currentProduct.userId
                    );
                }
            }
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
            async () => {

                if (!currentUser) {
                    openModal("loginModal");
                    showToast("Please login to chat", "warning");
                    return;
                }

                await loadReceivedInquiries();
                setupChatListControls();
                openModal("inquiriesModal");
            }
        );

    $("logoutButton")
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

function setupAuthListener() {

    supabaseClient.auth
        .onAuthStateChange(
            async (event, session) => {

                currentUser =
                    session?.user ||
                    null;
                
                if (currentUser) {
                    applyStudentKartSettings();
                } else {
                    document.body.classList.remove("studentkart-dark");
                }

                if (currentUser) {
                    await ensureProfileAfterPasswordSignup(currentUser);
                }

                updateNavbar();

                if (currentUser) {

                    startNotificationRefresh();
                    await getWishlist();
                    updateWishlistButtons();

                    // Start chat unread notifications for this logged-in user.
                    await updateChatUnreadCount();
                    await startChatUnreadRealtime();

                } else {

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
                }

                if (
                    event ===
                    "SIGNED_IN" ||
                    event ===
                    "SIGNED_OUT"
                ) {

                    setTimeout(
                        loadProducts,
                        0
                    );
                }
            }
        );
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
            applyStudentKartSettings();
        }

        updateNavbar();

        setupEventListeners();

        setupAuthListener();

        await loadProducts();

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

async function openChat(inquiry) {

    if (!currentUser) {
        openModal("loginModal");
        showToast("Please login first", "warning");
        return;
    }

    if (!inquiry || !inquiry.id) {
        showToast("Chat information unavailable", "error");
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

    /*
     * Chat is a child of the Chats list. Keep that relationship explicit
     * so Android/browser Back restores the chat list instead of Home.
     */
    const chatListIsOpen = Boolean(
        document.getElementById("inquiriesModal") &&
        !document.getElementById("inquiriesModal").classList.contains("hidden")
    );

    if (chatListIsOpen) {
        modalHistory = ["inquiriesModal"];
    }

    openModal("chatModal");

    if (chatListIsOpen && window.history.state?.studentKart) {
        window.history.replaceState(
            {
                ...window.history.state,
                studentKart: true,
                modalId: "chatModal",
                modalStack: ["inquiriesModal", "chatModal"]
            },
            "",
            window.location.pathname + window.location.search + "#chatModal"
        );
    }

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

    startChatRealtime();
}



// Open the other participant's profile by tapping the chat header.
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

$("chatBackButton")?.addEventListener("click", () => {
    const chatModal = $("chatModal");
    const inquiriesModal = $("inquiriesModal");

    if (!chatModal || !inquiriesModal) return;

    // One click = immediately return to the Chats list.
    // Replace the current Chat history entry instead of going back through
    // multiple history entries, so the same chat cannot reopen.
    chatModal.classList.remove("modal-closing");
    chatModal.classList.add("hidden");
    inquiriesModal.classList.remove("modal-closing");
    inquiriesModal.classList.remove("hidden");

    document.body.classList.add("modal-open");
    document.body.classList.add("studentkart-modal-navigation-hidden");
    document.body.classList.remove("studentkart-chat-open");

    modalHistory = [];

    if (window.history.state?.studentKart) {
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
});

window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "inquiriesModal" && $("chatModal") && !$("chatModal").classList.contains("hidden")) {
        $("chatModal").classList.add("hidden");
        $("chatModal").classList.remove("modal-closing");
        $("inquiriesModal")?.classList.remove("hidden");
        document.body.classList.add("modal-open");
        document.body.classList.add("studentkart-modal-navigation-hidden");
        document.body.classList.remove("studentkart-chat-open");
        modalHistory = [];
    }
});

let selectedChatMessageIds = new Set();
let chatLongPressTimer = null;
let chatLongPressTriggered = false;

function updateChatMessageSelectionUI() {
    document.querySelectorAll("#chatMessages .chat-message").forEach(messageEl => {
        messageEl.classList.toggle(
            "chat-message-selected",
            selectedChatMessageIds.has(String(messageEl.dataset.messageId))
        );
    });
    const bar = $("chatSelectionBar");
    const count = $("chatSelectionCount");
    if (count) count.textContent = String(selectedChatMessageIds.size);
    if (bar) bar.classList.toggle("hidden", selectedChatMessageIds.size === 0);
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
        toggleChatMessageSelection(messageEl.dataset.messageId);
    }, 550);
}

function endChatMessageLongPress() {
    clearTimeout(chatLongPressTimer);
}

$("chatMessages")?.addEventListener("pointerdown", beginChatMessageLongPress);
$("chatMessages")?.addEventListener("pointerup", endChatMessageLongPress);
$("chatMessages")?.addEventListener("pointercancel", endChatMessageLongPress);
$("chatMessages")?.addEventListener("pointerleave", endChatMessageLongPress);

$("chatMessages")?.addEventListener("click", event => {
    const messageEl = event.target.closest(".chat-message");
    if (!messageEl) return;

    if (chatLongPressTriggered) {
        chatLongPressTriggered = false;
        return;
    }

    if (selectedChatMessageIds.size > 0) {
        toggleChatMessageSelection(messageEl.dataset.messageId);
    }
});

$("clearChatSelectionButton")?.addEventListener("click", clearChatMessageSelection);
$("copySelectedChatButton")?.addEventListener("click", copySelectedChatMessages);
$("replySelectedChatButton")?.addEventListener("click", replyToSelectedChatMessage);
$("deleteSelectedChatButton")?.addEventListener("click", deleteSelectedOwnChatMessages);

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
    input.value = quoted ? "> " + quoted + "\n" : "";
    setChatReplyPreview(quoted, "Replying to message");
    input.focus();
    clearChatMessageSelection();
    showToast("Reply ready", "success");
}

async function deleteSelectedOwnChatMessages() {
    if (!currentUser || !selectedChatMessageIds.size) return;

    const ownIds = getSelectedChatMessageElements()
        .filter(el => String(el.dataset.senderId) === String(currentUser.id))
        .map(el => el.dataset.messageId)
        .filter(Boolean);

    if (!ownIds.length) {
        showToast("Select messages you sent to delete them", "warning");
        return;
    }

    if (!window.confirm(
        "Delete " + ownIds.length + " selected message" +
        (ownIds.length === 1 ? "" : "s") + "?"
    )) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("messages")
            .delete()
            .in("id", ownIds)
            .eq("sender_id", currentUser.id);

        if (error) throw error;

        selectedChatMessageIds.clear();
        await loadChatMessages();
        showToast(
            ownIds.length + " message" +
            (ownIds.length === 1 ? "" : "s") + " deleted",
            "success"
        );
    } catch (error) {
        console.error("Delete selected chat messages error:", error);
        showToast("Could not delete selected messages", "error");
    }
}

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

        const nextSignature = JSON.stringify((data || []).map(message => [
            message.id,
            message.updated_at || message.created_at,
            message.message,
            message.is_read
        ]));

        if (container.dataset.messageSignature === nextSignature) return;
        container.dataset.messageSignature = nextSignature;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="chat-empty">
                    <i class="fas fa-comment-dots"></i>
                    <p>No messages yet.</p>
                    <span>Start the conversation below.</span>
                </div>`;
            return;
        }

        container.innerHTML = data.map(message => {
            const isMine = message.sender_id === currentUser.id;
            const image = parseChatMediaMessage(message.message);

            let content = "";

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
                content = `<div class="chat-message-bubble">${escapeHtml(message.message)}</div>`;
            }

            return `
                <div class="chat-message ${isMine ? "chat-message-own sent" : "chat-message-other received"}"
                     data-message-id="${escapeHtml(String(message.id))}"
                     data-sender-id="${escapeHtml(String(message.sender_id || ""))}"
                     data-message-type="${image ? image.mediaType : "text"}">
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
        container.innerHTML = `
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

    const input = $("chatInput");
    const imageInput = $("chatImageInput");
    const selectedFile = imageInput?.files?.[0] || null;
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
        input?.focus();
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
    const preview = $("chatImagePreview");
    const image = $("chatImagePreviewImg");
    const name = $("chatImagePreviewName");

    if (input) input.value = "";
    if (image) image.src = "";
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

    if (!preview || !image) return;

    const url = URL.createObjectURL(file);
    image.onload = () => URL.revokeObjectURL(url);
    image.src = isVideoPreviewFile(file) ? "" : url;
    if (isVideoPreviewFile(file)) {
        image.style.display = "none";
        const video = document.createElement("video");
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:8px;display:block";
        video.id = "chatImagePreviewVideo";
        $("chatImagePreviewImg")?.replaceWith(video);
    } else {
        image.style.display = "block";
    }
    if (name) name.textContent = (isVideoPreviewFile(file) ? "🎬 " : "🖼️ ") + file.name;
    preview.classList.remove("hidden");
}

function clearChatReplyPreview() {
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

$("chatAttachButton")?.addEventListener("click", () => {
    $("chatImageInput")?.click();
});

$("chatImageInput")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    showChatImageSelection(file);
});

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
        badge.textContent = unread > 99 ? "99+" : String(unread);
        badge.classList.toggle("hidden", unread === 0);
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

    window.location.hash = "home";

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


/* Footer information links */
const bottomSettingsButton = $("bottomSettingsButton");
if (bottomSettingsButton) {
    bottomSettingsButton.addEventListener("click", () => {
        if (currentUser) {
            openModal("settingsModal");
        } else {
            openModal("loginModal");
        }
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
    const settings=getStudentKartSettings();
    openSettingsActionModal({
        title:"Blocked Users",
        description:"Manage accounts you have blocked.",
        fields:[{id:"users",label:"Blocked User IDs / Emails",type:"textarea",value:(settings.privacy.blockedUsers||[]).join(", "),placeholder:"Enter IDs or emails separated by commas"}],
        confirmText:"Save Block List",
        onConfirm:async values=>{
            settings.privacy.blockedUsers=values.users?values.users.split(",").map(v=>v.trim()).filter(Boolean):[];
            await saveStudentKartSettings(settings);
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
    if (!currentUser) {
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

    if (action === "safety-tips" || action === "safety-about" || action === "about" ||
        action === "terms" || action === "privacy-policy" || action === "contact") {
        const map = {
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
        body: "StudentKart is a student-focused marketplace created to make everyday buying, selling and discovering products simpler for students. From books and electronics to furniture, vehicles and useful services, the platform brings students and sellers together in one convenient place. Our goal is to make student-to-student transactions easier, more accessible and more organized."
    },
    how: {
        title: "How It Works",
        body: "Using StudentKart is simple. Browse the marketplace, search for the product you need, and use filters to find relevant listings by category, price and location. Open any listing to view its details and contact the seller. If you want to sell something, sign in, add your product information and photos, set a price and publish the listing so other students can discover it."
    },
    safety: {
        title: "Safety Tips",
        body: "Your safety matters when buying or selling online. Meet other users in a safe and public place, inspect products carefully before completing a transaction, and avoid sharing passwords, OTPs or sensitive personal information. Be cautious of unusually cheap offers or requests for advance payments. If a listing or user seems suspicious, use the available reporting features and avoid continuing the transaction."
    },
    contact: {
        title: "Contact Us",
        body: "Have a question, suggestion or feedback about StudentKart? You can reach us directly at rathodharish004@gmail.com. Whether you have found a problem, want to suggest a new feature or simply want to share your experience, your feedback can help improve StudentKart for students. StudentKart is based in Titwala, Kalyan, Maharashtra, India."
    },
    privacy: {
        title: "Privacy Policy",
        body: "StudentKart is designed to use personal information only where it is needed to provide account, marketplace and communication features. We aim to keep user information handled responsibly and to avoid exposing unnecessary contact details publicly. Never share your password, OTP or other account credentials with another person, even if someone claims to be from StudentKart."
    },
    terms: {
        title: "Terms & Conditions",
        body: "By using StudentKart, users are expected to provide genuine listing information, communicate respectfully and use the platform only for lawful purposes. Buyers and sellers are responsible for checking products, agreeing on transaction details and completing payments safely. StudentKart is a platform that connects users and does not replace the user's responsibility to verify a listing, seller or transaction before proceeding."
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
            if (body) body.textContent = info.body;

            openModal("footerInfoModal");
        });
    });
});
