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
let currentProduct = null;
let editingProductId = null;
let selectedInquiryProduct = null;
let currentSellerProfile = null;

let currentNotifications = [];
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

function openModal(id) {

    const modal = $(id);

    if (!modal) {
        return;
    }

    modal.classList.remove("hidden");

    document.body.classList.add("modal-open");
}

function closeModal(id) {

    const modal = $(id);

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");

    const anyOpen =
        document.querySelector(
            ".modal:not(.hidden)"
        );

    if (!anyOpen) {
        document.body.classList.remove("modal-open");
    }
}

function closeAllModals() {

    document
        .querySelectorAll(".modal")
        .forEach(modal => {
            modal.classList.add("hidden");
        });

    document.body.classList.remove("modal-open");
}


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
                    "id,name,college,email,avatar_url,created_at,updated_at"
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

        profileButton?.classList.add(
            "hidden"
        );

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

function applyFilters() {

    const search =
        String(
            $("marketplaceSearch")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const category =
        $("categoryFilter")
            ?.value || "all";

    const min =
        Number(
            $("minPrice")?.value || 0
        );

    const maxRaw =
        $("maxPrice")?.value;

    const max =
        maxRaw === ""
            ? Infinity
            : Number(maxRaw);

    const condition =
        $("conditionFilter")
            ?.value || "all";

    const sort =
        $("sortFilter")
            ?.value || "newest";

    let filtered =
        [...currentProducts];

    if (search) {

        filtered =
            filtered.filter(product => {

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

                return haystack.includes(
                    search
                );
            });
    }

    if (
        category &&
        category !== "all"
    ) {

        filtered =
            filtered.filter(
                product =>
                    String(
                        product.category
                    ).toLowerCase() ===
                    String(
                        category
                    ).toLowerCase()
            );
    }

    filtered =
        filtered.filter(
            product =>
                product.price >= min &&
                product.price <= max
        );

    if (
        condition &&
        condition !== "all"
    ) {

        filtered =
            filtered.filter(
                product =>
                    String(
                        product.condition
                    ).toLowerCase() ===
                    String(
                        condition
                    ).toLowerCase()
            );
    }

    if (sort === "price-low") {

        filtered.sort(
            (a, b) =>
                a.price - b.price
        );

    } else if (sort === "price-high") {

        filtered.sort(
            (a, b) =>
                b.price - a.price
        );

    } else if (sort === "oldest") {

        filtered.sort(
            (a, b) =>
                new Date(a.createdAt) -
                new Date(b.createdAt)
        );

    } else {

        filtered.sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );
    }

    updateFilterStatus(
        filtered.length
    );

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
                class="modal-close"
                data-close-modal
                aria-label="Close">
                <i class="fas fa-xmark"></i>
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
                    "id,name,college,avatar_url,created_at"
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

    closeModal("productModal");
    closeModal("myListingsModal");

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

    closeModal("productModal");

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

        const {
            error
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
                });

        if (error) {
            throw error;
        }

        closeModal(
            "inquiryModal"
        );

        showToast(
            "Inquiry sent successfully",
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

async function loadReceivedInquiries() {

    if (!currentUser) {
        return;
    }

    const container =
        $("inquiriesContainer");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading inquiries...</p>
        </div>
    `;

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("inquiries")
                .select("*")
                .eq(
                    "seller_id",
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
                    <p>Buyer messages about your listings will appear here.</p>
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

        const buyerIds = [
            ...new Set(
                visibleInquiries
                    .map(inquiry => inquiry.buyer_id)
                    .filter(Boolean)
            )
        ];

        let profilesMap = {};

        if (buyerIds.length) {
            const { data: profiles } =
                await supabaseClient
                    .from("profiles")
                    .select("id,name,college,avatar_url")
                    .in("id", buyerIds);

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

                if (
                    message.receiver_id === currentUser.id ||
                    (message.sender_id !== currentUser.id && message.is_read === false)
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

                    const profile =
                        profilesMap[
                            String(
                                inquiry.buyer_id
                            )
                        ];

                    const buyerName =
                        profile?.name ||
                        inquiry.buyer_name ||
                        "Student";

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
                        buyerName
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
                        >
                            <label class="inquiry-select-box" onclick="event.stopPropagation()">
                                <input
                                    type="checkbox"
                                    class="inquiry-select-checkbox"
                                    data-inquiry-select="${escapeHTML(inquiry.id)}"
                                >
                            </label>
                            <div class="whatsapp-inquiry-avatar">
                                ${profile?.avatar_url
                                    ? `<img src="${escapeHTML(profile.avatar_url)}" alt="">`
                                    : escapeHTML(initials)}
                            </div>

                            <div class="whatsapp-inquiry-main">
                                <div class="whatsapp-inquiry-top">
                                    <strong>${escapeHTML(buyerName)}</strong>
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
                                            aria-label="Open chat with ${escapeHTML(buyerName)}"
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
    } catch (error) {

        console.error(
            "Inquiry loading error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Could not load inquiries</h3>
                <p>Please try again.</p>
            </div>
        `;
    }
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
            "You can only edit your own listings",
            "error"
        );

        return;
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

async function loginUser(event) {

    event.preventDefault();

    const email =
        $("loginEmail")
            ?.value
            ?.trim();

    const password =
        $("loginPassword")
            ?.value;

    if (!email || !password) {

        showToast(
            "Enter email and password",
            "warning"
        );

        return;
    }

    const button =
        $("loginForm")
            ?.querySelector(
                'button[type="submit"]'
            );

    if (button) {
        button.disabled = true;
    }

    try {

        const {
            error
        } =
            await supabaseClient.auth
                .signInWithPassword({
                    email,
                    password
                });

        if (error) {
            throw error;
        }

        closeModal("loginModal");

        showToast(
            "Login successful",
            "success"
        );

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        showToast(
            error?.message ||
            "Login failed",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
        }
    }
}

async function signupUser(event) {

    event.preventDefault();

    const name =
        $("signupName")
            ?.value
            ?.trim();

    const college =
        $("signupCollege")
            ?.value
            ?.trim();

    const email =
        $("signupEmail")
            ?.value
            ?.trim();

    const password =
        $("signupPassword")
            ?.value;

    if (
        !name ||
        !college ||
        !email ||
        !password
    ) {

        showToast(
            "Please fill all fields",
            "warning"
        );

        return;
    }

    if (password.length < 6) {

        showToast(
            "Password must be at least 6 characters",
            "warning"
        );

        return;
    }

    const button =
        $("signupForm")
            ?.querySelector(
                'button[type="submit"]'
            );

    if (button) {
        button.disabled = true;
    }

    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signUp({
                    email,
                    password,
                    options: {
                        data: {
                            name,
                            college
                        }
                    }
                });

        if (error) {
            throw error;
        }

        if (data?.user) {

            await supabaseClient
                .from("profiles")
                .upsert({
                    id:
                        data.user.id,
                    name,
                    college,
                    email
                });
        }

        closeModal(
            "signupModal"
        );

        showToast(
            "Account created successfully",
            "success"
        );

    } catch (error) {

        console.error(
            "Signup error:",
            error
        );

        showToast(
            error?.message ||
            "Signup failed",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
        }
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

    if ($("editProfileCollege")) {

        $("editProfileCollege").value =
            profile?.college ||
            currentUser
                .user_metadata
                ?.college ||
            "";
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

    const name =
        $("editProfileName")
            ?.value
            ?.trim();

    const college =
        $("editProfileCollege")
            ?.value
            ?.trim();

    if (!name) {

        showToast(
            "Name is required",
            "warning"
        );

        return;
    }

    const file =
        $("editProfileImage")
            ?.files?.[0];

    try {

        const oldProfile =
            await getUserProfile();

        let avatarUrl =
            oldProfile?.avatar_url ||
            "";

        if (file) {

            const extension =
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase();

            const path =
                `${currentUser.id}/avatar-${Date.now()}.${extension}`;

            const {
                error:
                uploadError
            } =
                await supabaseClient
                    .storage
                    .from(STORAGE_BUCKET)
                    .upload(
                        path,
                        file,
                        {
                            upsert: true,
                            contentType:
                                file.type
                        }
                    );

            if (uploadError) {
                throw uploadError;
            }

            const {
                data
            } =
                supabaseClient.storage
                    .from(STORAGE_BUCKET)
                    .getPublicUrl(
                        path
                    );

            avatarUrl =
                data?.publicUrl ||
                avatarUrl;
        }

        const profile = {
            id:
                currentUser.id,
            name,
            college,
            email:
                currentUser.email ||
                "",
            avatar_url:
                avatarUrl,
            updated_at:
                new Date().toISOString()
        };

        const {
            error
        } =
            await supabaseClient
                .from("profiles")
                .upsert(
                    profile
                );

        if (error) {
            throw error;
        }

        saveProfile(profile);

        await supabaseClient.auth
            .updateUser({
                data: {
                    name,
                    college
                }
            });

        closeModal(
            "editProfileModal"
        );

        await updateProfileUI();

        showToast(
            "Profile updated successfully",
            "success"
        );

        await loadProducts();

    } catch (error) {

        console.error(
            "Profile update error:",
            error
        );

        showToast(
            "Could not update profile",
            "error"
        );
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

    const filter =
        $("categoryFilter");

    if (filter) {

        filter.value =
            category;
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

    if ($("notificationsModal")) {
        return;
    }

    const button =
        document.createElement("button");

    button.type =
        "button";

    button.id =
        "notificationButton";

    button.className =
        "btn btn-outline nav-notification-button";

    button.setAttribute(
        "aria-label",
        "Open Notifications"
    );

    button.innerHTML = `
        <i class="fa-regular fa-bell"></i>
        <span
            class="notification-count hidden"
            id="notificationCount">
            0
        </span>
    `;

    const wishlistButton =
        $("wishlistButton");

    if (
        wishlistButton?.parentElement
    ) {

        wishlistButton.parentElement
            .insertBefore(
                button,
                wishlistButton
            );

    } else {

        document
            .querySelector(
                ".nav-actions"
            )
            ?.appendChild(
                button
            );
    }

    const modal =
        document.createElement("div");

    modal.id =
        "notificationsModal";

    modal.className =
        "modal hidden";

    modal.innerHTML = `
        <div
            class="modal-overlay"
            data-close-modal>
        </div>

        <div
            class="modal-content wide-modal notifications-modal-content">

            <button
                type="button"
                class="modal-close"
                data-close-modal
                aria-label="Close">
                <i class="fas fa-xmark"></i>
            </button>

            <div class="notifications-header">

                <div>
                    <span class="section-label">
                        ACTIVITY
                    </span>

                    <h2>
                        Notifications
                    </h2>

                    <p>
                        Stay updated on your marketplace activity.
                    </p>
                </div>

                <button
                    type="button"
                    class="btn btn-outline"
                    id="markAllNotificationsButton">
                    <i class="fas fa-check-double"></i>
                    Mark all as read
                </button>

            </div>

            <div
                id="notificationsContainer"
                class="notifications-container">
            </div>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    injectNotificationStyles();
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
            transition:
                background .2s,
                border-color .2s;
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

    closeModal(
        "notificationsModal"
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

                    if (
                        payload.new
                    ) {

                        showNotificationPopup(
                            payload.new.title,
                            payload.new.message
                        );

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

    $("notificationsContainer")
        ?.addEventListener(
            "click",
            event => {

                const item =
                    event.target.closest(
                        "[data-notification-id]"
                    );

                if (!item) {
                    return;
                }

                openNotification(
                    item.dataset
                        .notificationId
                );
            }
        );


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

    [
        "marketplaceSearch",
        "categoryFilter",
        "minPrice",
        "maxPrice",
        "conditionFilter",
        "sortFilter"
    ]
        .forEach(id => {

            $(id)?.addEventListener(
                "input",
                applyFilters
            );

            $(id)?.addEventListener(
                "change",
                applyFilters
            );
        });

    $("refreshProducts")
        ?.addEventListener(
            "click",
            loadProducts
        );


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

                closeModal(
                    "profileModal"
                );

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

                closeModal(
                    "profileModal"
                );

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

    $("editProfileForm")
        ?.addEventListener(
            "submit",
            saveEditedProfile
        );

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

                    closeModal(
                        "wishlistModal"
                    );

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

                    closeModal(
                        "myListingsModal"
                    );

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

                    closeModal(
                        "myListingsModal"
                    );

                    openEditProduct(
                        edit.dataset
                            .myEdit
                    );

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

                closeModal(
                    "sellerProfileModal"
                );

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

                if (!button) {
                    return;
                }

                const action =
                    button.dataset.inquiryAction;

                const inquiryId =
                    button.dataset.inquiryId;

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
    return Array.from(
        document.querySelectorAll(".inquiry-select-checkbox:checked")
    ).map(input => input.dataset.inquirySelect).filter(Boolean);
}

function updateBulkInquiryToolbar() {
    const ids = getSelectedInquiryIds();
    const count = ids.length;

    const countEl = $("selectedInquiryCount");
    const markButton = $("bulkMarkRepliedButton");
    const deleteButton = $("bulkDeleteForMeButton");
    const selectAll = $("selectAllInquiries");

    if (countEl) {
        countEl.textContent = count + (count === 1 ? " selected" : " selected");
        countEl.classList.toggle("hidden", count === 0);
    }

    if (markButton) markButton.classList.toggle("hidden", count === 0);
    if (deleteButton) deleteButton.classList.toggle("hidden", count === 0);

    if (selectAll) {
        const boxes = Array.from(document.querySelectorAll(".inquiry-select-checkbox"));
        selectAll.checked = boxes.length > 0 && boxes.every(box => box.checked);
        selectAll.indeterminate = count > 0 && count < boxes.length;
    }

    document.querySelectorAll(".whatsapp-inquiry-card").forEach(card => {
        const box = card.querySelector(".inquiry-select-checkbox");
        card.classList.toggle("is-selected", !!box?.checked);
    });
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

    const rows = ids.map(inquiryId => ({
        user_id: currentUser.id,
        inquiry_id: inquiryId
    }));

    const { error } = await supabaseClient
        .from("hidden_chats")
        .upsert(rows, { onConflict: "user_id,inquiry_id" });

    if (error) {
        console.error("Bulk delete for me error:", error);
        showToast("Could not delete selected chats", "error");
        return;
    }

    showToast(ids.length + " chat" + (ids.length === 1 ? "" : "s") + " deleted for you", "success");
    await loadReceivedInquiries();
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

    await removeHiddenChat(inquiry.id);

    if ($("chatProductName")) {
        $("chatProductName").textContent =
            inquiry.product_name || "Product Chat";
    }

    if ($("chatUserName")) {
        const otherUser =
            inquiry.seller_id === currentUser.id
                ? "Buyer"
                : "Seller";

        $("chatUserName").textContent = otherUser;
    }

    openModal("chatModal");

    await markChatMessagesRead(inquiry.id);
    await loadChatMessages();

    startChatRealtime();
}


async function loadChatMessages() {

    if (!currentChatInquiry || !currentUser) {
        return;
    }

    const container = $("chatMessages");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="chat-empty">
            Loading messages...
        </div>
    `;

    try {

        const { data, error } =
            await supabaseClient
                .from("messages")
                .select("*")
                .eq("inquiry_id", currentChatInquiry.id)
                .order("created_at", {
                    ascending: true
                });

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {

            container.innerHTML = `
                <div class="chat-empty">
                    No messages yet. Start the conversation.
                </div>
            `;

            return;
        }

        container.innerHTML = data
            .map(message => {

                const isMine =
                    message.sender_id === currentUser.id;

                return `
                    <div class="chat-message ${isMine
                        ? "chat-message-own"
                        : "chat-message-other"
                    }">

                        <div class="chat-message-bubble">
                            ${escapeHtml(message.message)}
                        </div>

                        <small>
                            ${formatChatTime(message.created_at)}
                        </small>

                    </div>
                `;

            })
            .join("");

        scrollChatToBottom();

    } catch (error) {

        console.error(
            "Load chat messages error:",
            error
        );

        container.innerHTML = `
            <div class="chat-empty">
                Could not load messages.
            </div>
        `;
    }
}


async function sendChatMessage(event) {

    event.preventDefault();

    if (!currentUser || !currentChatInquiry) {
        return;
    }

    const input = $("chatInput");

    if (!input) {
        return;
    }

    const message = input.value.trim();

    if (!message) {
        return;
    }

    const isSeller =
        currentChatInquiry.seller_id === currentUser.id;

    const receiverId =
        isSeller
            ? currentChatInquiry.buyer_id
            : currentChatInquiry.seller_id;

    if (!receiverId) {
        showToast(
            "Receiver information unavailable",
            "error"
        );
        return;
    }

    const sendButton =
        $("chatForm")?.querySelector(
            'button[type="submit"]'
        );

    if (sendButton) {
        sendButton.disabled = true;
    }

    try {

        await removeHiddenChat(currentChatInquiry.id);

        const { error } =
            await supabaseClient
                .from("messages")
                .insert({
                    inquiry_id: currentChatInquiry.id,
                    sender_id: currentUser.id,
                    receiver_id: receiverId,
                    message
                });

        if (error) {
            throw error;
        }

        input.value = "";

        await loadChatMessages();

    } catch (error) {

        console.error(
            "Send chat message error:",
            error
        );

        showToast(
            "Could not send message",
            "error"
        );

    } finally {

        if (sendButton) {
            sendButton.disabled = false;
        }

        input.focus();
    }
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

/* RECEIVED INQUIRIES ACTION HANDLER */
document.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-inquiry-action]");

    if (!actionButton) {
        return;
    }

    const action = actionButton.dataset.inquiryAction;
    const inquiryId = actionButton.dataset.inquiryId;

    if (!inquiryId) {
        return;
    }

    if (action === "chat") {
        event.preventDefault();
        event.stopPropagation();
        await openInquiryChat(inquiryId);
        return;
    }

    if (action === "status") {
        event.preventDefault();
        event.stopPropagation();

        const status = actionButton.dataset.status;

        if (status) {
            await updateInquiryStatus(inquiryId, status);
        }
    }
});


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
        await updateChatUnreadCount();
    } catch (error) {
        console.error("Mark chat messages read error:", error);
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

