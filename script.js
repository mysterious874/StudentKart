/* =========================================================
   STUDENTKART - COMPLETE SCRIPT
   ========================================================= */


/* =========================================================
   SUPABASE CONFIG
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

const STORAGE_BUCKET =
    "product-images";


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let currentProducts = [];
let currentProduct = null;

let editingProductId = null;
let selectedInquiryProduct = null;

let toastTimer = null;


/* =========================================================
   SHORT SELECTOR
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   PRICE
   ========================================================= */

function formatPrice(price) {

    const number =
        Number(price) || 0;

    return "₹" +
        number.toLocaleString("en-IN");
}


/* =========================================================
   DATE
   ========================================================= */

function formatDate(dateValue) {

    if (!dateValue) {
        return "Recently";
    }

    const date =
        new Date(dateValue);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Recently";
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   RELATIVE DATE
   ========================================================= */

function getRelativeDate(dateValue) {

    if (!dateValue) {
        return "Recently";
    }

    const date =
        new Date(dateValue);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Recently";
    }

    const now =
        new Date();

    const difference =
        now.getTime() -
        date.getTime();

    const minutes =
        Math.floor(
            difference / 60000
        );

    const hours =
        Math.floor(
            difference / 3600000
        );

    const days =
        Math.floor(
            difference / 86400000
        );

    if (minutes < 1) {
        return "Just now";
    }

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    if (hours < 24) {
        return `${hours}h ago`;
    }

    if (days < 7) {
        return `${days}d ago`;
    }

    return formatDate(dateValue);
}


/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(name) {

    if (!name) {
        return "S";
    }

    const words =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (words.length === 1) {

        return words[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();
}


/* =========================================================
   PLACEHOLDER IMAGE
   ========================================================= */

function getPlaceholderImage(
    name = "StudentKart"
) {

    const text =
        encodeURIComponent(
            String(name).slice(0, 24)
        );

    return (
        `https://placehold.co/800x600/1f2937/e5e7eb?text=${text}`
    );
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
    message,
    type = "success"
) {

    const toast =
        $("toast");

    const toastMessage =
        $("toastMessage");

    const toastIcon =
        $("toastIcon");

    if (
        !toast ||
        !toastMessage
    ) {
        return;
    }

    toastMessage.textContent =
        message;

    if (toastIcon) {

        if (type === "error") {

            toastIcon.innerHTML =
                '<i class="fa-solid fa-circle-exclamation"></i>';

        } else if (
            type === "warning"
        ) {

            toastIcon.innerHTML =
                '<i class="fa-solid fa-triangle-exclamation"></i>';

        } else {

            toastIcon.innerHTML =
                '<i class="fa-solid fa-check"></i>';
        }
    }

    toast.classList.remove(
        "hidden"
    );

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            toast.classList.add(
                "hidden"
            );

        }, 3500);
}


/* =========================================================
   MODALS
   ========================================================= */

function openModal(id) {

    const modal =
        $(id);

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "hidden"
    );

    modal.classList.add(
        "active"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function closeModal(id) {

    const modal =
        $(id);

    if (!modal) {
        return;
    }

    modal.classList.add(
        "hidden"
    );

    modal.classList.remove(
        "active"
    );

    const openModals =
        document.querySelectorAll(
            ".modal:not(.hidden)"
        );

    if (!openModals.length) {

        document.body.classList.remove(
            "modal-open"
        );
    }
}


function closeAllModals() {

    document
        .querySelectorAll(".modal")
        .forEach(modal => {

            modal.classList.add(
                "hidden"
            );

            modal.classList.remove(
                "active"
            );
        });

    document.body.classList.remove(
        "modal-open"
    );
}


/* =========================================================
   LOCAL PROFILE STORAGE
   ========================================================= */

function getProfileStorageKey() {

    if (!currentUser) {
        return null;
    }

    return (
        `studentkart_profile_${currentUser.id}`
    );
}


function getSavedProfile() {

    const key =
        getProfileStorageKey();

    if (!key) {
        return {};
    }

    try {

        return JSON.parse(
            localStorage.getItem(key) ||
            "{}"
        );

    } catch (error) {

        return {};
    }
}


function saveProfile(profile) {

    const key =
        getProfileStorageKey();

    if (!key) {
        return;
    }

    localStorage.setItem(
        key,
        JSON.stringify(profile)
    );
}


/* =========================================================
   USER PROFILE
   ========================================================= */

function getUserProfile() {

    if (!currentUser) {

        return {
            name: "Student",
            college: "College",
            email: "",
            avatar: ""
        };
    }

    const metadata =
        currentUser.user_metadata || {};

    const saved =
        getSavedProfile();

    return {

        name:
            saved.name ||
            metadata.full_name ||
            metadata.name ||
            "Student",

        college:
            saved.college ||
            metadata.college ||
            "College",

        email:
            currentUser.email ||
            "",

        avatar:
            saved.avatar ||
            ""
    };
}


/* =========================================================
   AVATAR
   ========================================================= */

function getProfileAvatar() {

    const profile =
        getUserProfile();

    return profile.avatar || "";
}


function getPlaceholderAvatar(name) {

    const initials =
        encodeURIComponent(
            getInitials(name)
        );

    return (
        `https://placehold.co/160x160/167c6a/ffffff?text=${initials}`
    );
}


/* =========================================================
   WISHLIST
   ========================================================= */

function getWishlistStorageKey() {

    if (currentUser) {

        return (
            `studentkart_wishlist_${currentUser.id}`
        );
    }

    return "studentkart_wishlist_guest";
}


function getWishlist() {

    const key =
        getWishlistStorageKey();

    try {

        const data =
            JSON.parse(
                localStorage.getItem(key) ||
                "[]"
            );

        if (!Array.isArray(data)) {
            return [];
        }

        return data.map(String);

    } catch (error) {

        console.error(
            "Wishlist read error:",
            error
        );

        return [];
    }
}


function saveWishlist(list) {

    const key =
        getWishlistStorageKey();

    localStorage.setItem(
        key,
        JSON.stringify(
            list.map(String)
        )
    );
}


function isWishlisted(productId) {

    return getWishlist()
        .includes(
            String(productId)
        );
}


/* =========================================================
   WISHLIST NAVBAR COUNT
   ========================================================= */

function updateWishlistNavbar() {

    const countElement =
        $("wishlistCount");

    if (!countElement) {
        return;
    }

    const count =
        getWishlist().length;

    countElement.textContent =
        count;

    countElement.style.display =
        count > 0
            ? "inline-flex"
            : "none";
}


/* =========================================================
   UPDATE WISHLIST BUTTONS
   ========================================================= */

function updateWishlistButtons(
    productId
) {

    const active =
        isWishlisted(productId);

    document
        .querySelectorAll(
            `[data-wishlist-id="${CSS.escape(String(productId))}"]`
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                active
            );

            button.setAttribute(
                "aria-pressed",
                active
                    ? "true"
                    : "false"
            );

            const icon =
                button.querySelector(
                    ".wishlist-icon"
                );

            if (icon) {

                icon.textContent =
                    active
                        ? "♥"
                        : "♡";
            }
        });
}


/* =========================================================
   TOGGLE WISHLIST
   ========================================================= */

function toggleWishlist(
    productId,
    button = null
) {

    if (
        productId === null ||
        productId === undefined
    ) {
        return;
    }

    const id =
        String(productId);

    const wishlist =
        getWishlist();

    const index =
        wishlist.indexOf(id);

    let added = false;

    if (index >= 0) {

        wishlist.splice(
            index,
            1
        );

        added = false;

    } else {

        wishlist.push(id);

        added = true;
    }

    saveWishlist(
        wishlist
    );

    updateWishlistButtons(
        id
    );

    updateWishlistNavbar();

    showToast(
        added
            ? "Added to wishlist ❤️"
            : "Removed from wishlist",
        "success"
    );

    if (button) {

        button.setAttribute(
            "aria-pressed",
            added
                ? "true"
                : "false"
        );
    }
}


/* =========================================================
   RENDER WISHLIST
   ========================================================= */

function renderWishlist() {

    const container =
        $("wishlistContainer");

    if (!container) {
        return;
    }

    const wishlistIds =
        getWishlist();


    /* EMPTY */

    if (!wishlistIds.length) {

        container.innerHTML = `
            <div class="wishlist-empty">

                <i class="fa-regular fa-heart"></i>

                <h3>
                    Your wishlist is empty
                </h3>

                <p>
                    Save products you like and find them here later.
                </p>

            </div>
        `;

        updateWishlistNavbar();

        return;
    }


    /* GET PRODUCTS */

    const wishlistProducts =
        currentProducts.filter(
            product =>
                wishlistIds.includes(
                    String(product.id)
                )
        );


    /* CLEAN DELETED PRODUCTS */

    const availableIds =
        wishlistProducts.map(
            product =>
                String(product.id)
        );

    const cleanedIds =
        wishlistIds.filter(
            id =>
                availableIds.includes(
                    String(id)
                )
        );


    if (
        cleanedIds.length !==
        wishlistIds.length
    ) {

        saveWishlist(
            cleanedIds
        );
    }


    /* NOTHING AVAILABLE */

    if (!wishlistProducts.length) {

        container.innerHTML = `
            <div class="wishlist-empty">

                <i class="fa-regular fa-heart"></i>

                <h3>
                    Your wishlist is empty
                </h3>

                <p>
                    The products you saved are no longer available.
                </p>

            </div>
        `;

        updateWishlistNavbar();

        return;
    }


    /* RENDER */

    container.innerHTML =
        wishlistProducts
            .map(product => {

                const image =
                    product.image ||
                    getPlaceholderImage(
                        product.name
                    );

                return `

                    <div
                        class="wishlist-card"
                        data-wishlist-card="${escapeHTML(product.id)}"
                    >

                        <div class="wishlist-card-image">

                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(product.name)}"
                                onerror="this.src='${getPlaceholderImage(product.name)}'"
                            >

                        </div>


                        <div class="wishlist-card-info">

                            <h3>
                                ${escapeHTML(product.name)}
                            </h3>


                            <div class="wishlist-card-price">
                                ${formatPrice(product.price)}
                            </div>


                            <div class="wishlist-card-location">

                                <i class="fa-solid fa-location-dot"></i>

                                ${escapeHTML(
                                    product.location ||
                                    "Location unavailable"
                                )}

                            </div>


                            <div class="wishlist-card-actions">

                                <button
                                    type="button"
                                    class="wishlist-view-button"
                                    data-wishlist-view="${escapeHTML(product.id)}"
                                >
                                    <i class="fa-solid fa-eye"></i>
                                    View
                                </button>


                                <button
                                    type="button"
                                    class="wishlist-remove-button"
                                    data-wishlist-remove="${escapeHTML(product.id)}"
                                >
                                    <i class="fa-regular fa-trash-can"></i>
                                    Remove
                                </button>

                            </div>

                        </div>

                    </div>

                `;
            })
            .join("");

    updateWishlistNavbar();
}


/* =========================================================
   OPEN WISHLIST
   ========================================================= */

function openWishlist() {

    renderWishlist();

    openModal(
        "wishlistModal"
    );
}


/* =========================================================
   REMOVE FROM WISHLIST
   ========================================================= */

function removeFromWishlist(
    productId
) {

    const id =
        String(productId);

    const wishlist =
        getWishlist();

    const updatedWishlist =
        wishlist.filter(
            wishlistId =>
                String(wishlistId) !== id
        );

    saveWishlist(
        updatedWishlist
    );

    updateWishlistButtons(
        id
    );

    updateWishlistNavbar();

    renderWishlist();

    showToast(
        "Removed from wishlist",
        "success"
    );
}


/* =========================================================
   NORMALIZE PRODUCT
   ========================================================= */

function normalizeProduct(product) {

    return {

        id:
            product.id,

        userId:
            product.user_id,

        name:
            product.name ||
            "Untitled Product",

        category:
            product.category ||
            "Other",

        price:
            Number(product.price) || 0,

        location:
            product.location ||
            "Not specified",

        condition:
            product.condition ||
            "Used",

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

        createdAt:
            product.created_at ||
            null
    };
}


/* =========================================================
   CONDITION
   ========================================================= */

function getConditionClass(
    condition
) {

    const value =
        String(condition || "")
            .toLowerCase();

    if (value === "new") {
        return "condition-new";
    }

    if (
        value === "like new" ||
        value === "good"
    ) {
        return "condition-good";
    }

    if (value === "fair") {
        return "condition-fair";
    }

    return "condition-used";
}


function getConditionIcon(
    condition
) {

    const value =
        String(condition || "")
            .toLowerCase();

    if (value === "new") {
        return "✨";
    }

    if (value === "like new") {
        return "⭐";
    }

    if (value === "good") {
        return "👍";
    }

    if (value === "fair") {
        return "👌";
    }

    return "📦";
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
            await supabaseClient.auth.getUser();

        if (error) {

            console.error(
                "Get user error:",
                error
            );

            currentUser = null;

            return null;
        }

        currentUser =
            data?.user || null;

        return currentUser;

    } catch (error) {

        console.error(
            "Get current user error:",
            error
        );

        currentUser = null;

        return null;
    }
}


/* =========================================================
   NAVBAR
   ========================================================= */

function updateNavbar() {

    const loginButton =
        $("loginButton");

    const signupButton =
        $("signupButton");

    const profileButton =
        $("profileButton");

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
    }

    updateWishlistNavbar();
}


/* =========================================================
   LOAD PRODUCTS
   ========================================================= */

async function loadProducts() {

    const container =
        $("productContainer");

    if (container) {

        container.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading listings...
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

        console.error(
            "Products error:",
            error
        );

        if (container) {

            container.innerHTML = `
                <div class="error-state">
                    Unable to load listings.
                </div>
            `;
        }

        showToast(
            "Unable to load marketplace",
            "error"
        );

        return;
    }

    currentProducts =
        (data || [])
            .map(normalizeProduct);

    updateStats();

    applyFilters();

    updateWishlistNavbar();
}


/* =========================================================
   STATS
   ========================================================= */

function updateStats() {

    const total =
        $("totalListings");

    if (total) {

        total.textContent =
            currentProducts.length;
    }
}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters() {

    let products =
        [...currentProducts];

    const search =
        (
            $("marketplaceSearch")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const category =
        $("categoryFilter")
            ?.value ||
        "all";

    const minPrice =
        Number(
            $("minPrice")
                ?.value || 0
        );

    const maxPriceRaw =
        $("maxPrice")
            ?.value || "";

    const maxPrice =
        maxPriceRaw === ""
            ? Infinity
            : Number(maxPriceRaw);

    const condition =
        $("conditionFilter")
            ?.value ||
        "all";

    const sort =
        $("sortFilter")
            ?.value ||
        "newest";


    /* SEARCH */

    if (search) {

        products =
            products.filter(
                product => {

                    const searchable =
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

                    return searchable.includes(
                        search
                    );
                }
            );
    }


    /* CATEGORY */

    if (category !== "all") {

        products =
            products.filter(
                product =>
                    product.category ===
                    category
            );
    }


    /* PRICE */

    products =
        products.filter(
            product =>
                product.price >=
                    minPrice &&
                product.price <=
                    maxPrice
        );


    /* CONDITION */

    if (condition !== "all") {

        products =
            products.filter(
                product =>
                    product.condition ===
                    condition
            );
    }


    /* SORT */

    if (sort === "price-low") {

        products.sort(
            (a, b) =>
                a.price - b.price
        );

    } else if (
        sort === "price-high"
    ) {

        products.sort(
            (a, b) =>
                b.price - a.price
        );

    } else if (
        sort === "oldest"
    ) {

        products.sort(
            (a, b) =>
                new Date(
                    a.createdAt || 0
                ) -
                new Date(
                    b.createdAt || 0
                )
        );

    } else {

        products.sort(
            (a, b) =>
                new Date(
                    b.createdAt || 0
                ) -
                new Date(
                    a.createdAt || 0
                )
        );
    }


    renderProducts(
        products
    );

    updateFilterStatus(
        products.length
    );
}


/* =========================================================
   FILTER STATUS
   ========================================================= */

function updateFilterStatus(count) {

    const status =
        $("filterStatus");

    if (!status) {
        return;
    }

    status.textContent =
        `${count} listing${count === 1 ? "" : "s"} found`;
}


/* =========================================================
   RENDER PRODUCTS
   ========================================================= */

function renderProducts(
    products
) {

    const container =
        $("productContainer");

    const emptyState =
        $("emptyState");

    if (!container) {
        return;
    }


    if (!products.length) {

        container.innerHTML = "";

        emptyState?.classList.remove(
            "hidden"
        );

        return;
    }


    emptyState?.classList.add(
        "hidden"
    );


    container.innerHTML =
        products
            .map(product => {

                const mine =
                    isMyProduct(
                        product
                    );

                const wishlisted =
                    isWishlisted(
                        product.id
                    );

                const conditionClass =
                    getConditionClass(
                        product.condition
                    );

                const conditionIcon =
                    getConditionIcon(
                        product.condition
                    );

                const sellerInitials =
                    getInitials(
                        product.seller
                    );


                return `

                    <article
                        class="product-card"
                        data-product-id="${escapeHTML(product.id)}"
                    >

                        <div class="product-image-wrapper">

                            <img
                                class="product-image"
                                src="${escapeHTML(product.image)}"
                                alt="${escapeHTML(product.name)}"
                                loading="lazy"
                                onerror="this.src='${getPlaceholderImage(product.name)}'"
                            >


                            <div class="product-image-overlay">

                                <span
                                    class="product-condition-pill ${conditionClass}"
                                >
                                    ${conditionIcon}
                                    ${escapeHTML(product.condition)}
                                </span>

                            </div>


                            <button
                                type="button"
                                class="wishlist-button ${wishlisted ? "active" : ""}"
                                data-action="wishlist"
                                data-wishlist-id="${escapeHTML(product.id)}"
                                aria-label="Add to wishlist"
                                aria-pressed="${wishlisted}"
                            >

                                <span class="wishlist-icon">
                                    ${wishlisted ? "♥" : "♡"}
                                </span>

                            </button>

                        </div>


                        <div class="product-card-content">

                            <div class="product-card-top">

                                <span class="product-badge product-category">
                                    ${escapeHTML(product.category)}
                                </span>

                                <span class="product-date">
                                    ${escapeHTML(
                                        getRelativeDate(
                                            product.createdAt
                                        )
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


                            <div class="product-meta location">

                                <i class="fa-solid fa-location-dot"></i>

                                ${escapeHTML(
                                    product.location
                                )}

                            </div>


                            <div class="product-seller">

                                <span class="seller-avatar">
                                    ${escapeHTML(
                                        sellerInitials
                                    )}
                                </span>

                                <span class="seller-name">
                                    ${escapeHTML(
                                        product.seller
                                    )}
                                </span>

                                ${
                                    mine
                                        ? `
                                            <span class="seller-you-badge">
                                                Your listing
                                            </span>
                                        `
                                        : ""
                                }

                            </div>


                            <button
                                type="button"
                                class="view-product-button view-product-btn"
                                data-action="view"
                                data-id="${escapeHTML(product.id)}"
                            >
                                View Details
                            </button>


                            ${
                                mine
                                    ? `
                                        <div class="product-owner-actions">

                                            <button
                                                type="button"
                                                class="btn btn-outline"
                                                data-action="edit"
                                                data-id="${escapeHTML(product.id)}"
                                            >
                                                <i class="fa-solid fa-pen"></i>
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                class="btn btn-danger"
                                                data-action="delete"
                                                data-id="${escapeHTML(product.id)}"
                                            >
                                                <i class="fa-solid fa-trash"></i>
                                                Delete
                                            </button>

                                        </div>
                                    `
                                    : ""
                            }

                        </div>

                    </article>

                `;
            })
            .join("");
}


/* =========================================================
   CHECK PRODUCT OWNERSHIP
   ========================================================= */

function isMyProduct(
    product
) {

    if (
        !currentUser ||
        !product
    ) {
        return false;
    }

    return (
        String(product.userId) ===
        String(currentUser.id)
    );
}


/* =========================================================
   PRODUCT DETAILS
   ========================================================= */

function openProductDetails(
    productId
) {

    const product =
        currentProducts.find(
            item =>
                String(item.id) ===
                String(productId)
        );

    if (!product) {

        showToast(
            "Product not found",
            "error"
        );

        return;
    }


    currentProduct =
        product;


    const detailsImage =
        $("detailsImage");

    if (detailsImage) {

        detailsImage.src =
            product.image ||
            getPlaceholderImage(
                product.name
            );

        detailsImage.alt =
            product.name;
    }


    if ($("detailsCategory")) {
        $("detailsCategory").textContent =
            product.category;
    }

    if ($("detailsName")) {
        $("detailsName").textContent =
            product.name;
    }

    if ($("detailsPrice")) {
        $("detailsPrice").textContent =
            formatPrice(
                product.price
            );
    }

    if ($("detailsLocation")) {
        $("detailsLocation").textContent =
            product.location;
    }

    if ($("detailsCondition")) {
        $("detailsCondition").textContent =
            product.condition;
    }

    if ($("detailsDescription")) {
        $("detailsDescription").textContent =
            product.description ||
            "No description provided.";
    }

    if ($("detailsSeller")) {
        $("detailsSeller").textContent =
            product.seller;
    }


    const avatar =
        $("detailsSellerAvatar");

    if (avatar) {

        avatar.textContent =
            getInitials(
                product.seller
            );
    }


    const contactButton =
        $("contactSellerButton");


    if (contactButton) {

        if (
            isMyProduct(
                product
            )
        ) {

            contactButton.disabled =
                true;

            contactButton.innerHTML =
                `
                    <i class="fa-solid fa-circle-check"></i>
                    This is Your Listing
                `;

        } else if (
            !product.userId
        ) {

            contactButton.disabled =
                true;

            contactButton.innerHTML =
                `
                    <i class="fa-solid fa-circle-exclamation"></i>
                    Seller Unavailable
                `;

        } else {

            contactButton.disabled =
                false;

            contactButton.innerHTML =
                `
                    <i class="fa-solid fa-message"></i>
                    Contact Seller
                `;
        }
    }


    openModal(
        "productModal"
    );
}


/* =========================================================
   CONTACT SELLER
   ========================================================= */

function contactSeller() {

    if (!currentUser) {

        closeModal(
            "productModal"
        );

        showToast(
            "Please login to contact sellers",
            "warning"
        );

        openModal(
            "loginModal"
        );

        return;
    }


    if (!currentProduct) {
        return;
    }


    if (
        isMyProduct(
            currentProduct
        )
    ) {

        showToast(
            "You cannot contact yourself",
            "warning"
        );

        return;
    }


    if (!currentProduct.userId) {

        showToast(
            "This seller is unavailable for contact",
            "error"
        );

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
            .value =
            `Hi, I'm interested in "${currentProduct.name}". Is it still available?`;
    }


    closeModal(
        "productModal"
    );

    openModal(
        "inquiryModal"
    );
}


/* =========================================================
   SUBMIT INQUIRY
   ========================================================= */

async function submitInquiry(
    event
) {

    event.preventDefault();


    if (!currentUser) {

        showToast(
            "Please login first",
            "warning"
        );

        return;
    }


    if (!selectedInquiryProduct) {

        showToast(
            "Product not selected",
            "error"
        );

        return;
    }


    const message =
        $("inquiryMessage")
            ?.value
            .trim() || "";


    if (!message) {

        showToast(
            "Please enter a message",
            "warning"
        );

        return;
    }


    if (
        String(
            selectedInquiryProduct.userId
        ) ===
        String(currentUser.id)
    ) {

        showToast(
            "You cannot contact yourself",
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
        submitButton.disabled =
            true;
    }


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

                message:
                    message,

                status:
                    "new"
            });


    if (submitButton) {
        submitButton.disabled =
            false;
    }


    if (error) {

        console.error(
            "Inquiry error:",
            error
        );

        showToast(
            "Could not send inquiry",
            "error"
        );

        return;
    }


    if ($("inquiryForm")) {
        $("inquiryForm").reset();
    }


    closeModal(
        "inquiryModal"
    );

    selectedInquiryProduct =
        null;

    showToast(
        "Inquiry sent successfully! 🎉",
        "success"
    );
}


/* =========================================================
   RECEIVED INQUIRIES
   ========================================================= */

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
            <i class="fa-solid fa-spinner fa-spin"></i>
            Loading inquiries...
        </div>
    `;


    const {
        data: inquiries,
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

        console.error(
            "Inquiries error:",
            error
        );

        container.innerHTML = `
            <div class="error-state">
                Unable to load inquiries.
            </div>
        `;

        return;
    }


    if (!inquiries?.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    <i class="fa-solid fa-message"></i>
                </div>

                <h3>
                    No inquiries yet
                </h3>

                <p>
                    Buyer messages will appear here.
                </p>

            </div>
        `;

        return;
    }


    const productIds =
        [
            ...new Set(
                inquiries.map(
                    inquiry =>
                        inquiry.product_id
                )
            )
        ];


    const {
        data: products
    } =
        await supabaseClient
            .from("products")
            .select("*")
            .in(
                "id",
                productIds
            );


    const productMap =
        new Map(
            (products || [])
                .map(product => [

                    String(product.id),

                    normalizeProduct(
                        product
                    )
                ])
        );


    container.innerHTML =
        inquiries
            .map(inquiry => {

                const product =
                    productMap.get(
                        String(
                            inquiry.product_id
                        )
                    );

                const status =
                    inquiry.status ||
                    "new";


                return `

                    <div class="inquiry-card">

                        <div class="inquiry-card-header">

                            <div>

                                <span class="section-label">
                                    INQUIRY
                                </span>

                                <h3>
                                    ${
                                        escapeHTML(
                                            product?.name ||
                                            "Product"
                                        )
                                    }
                                </h3>

                            </div>

                            <span
                                class="inquiry-status status-${escapeHTML(status)}"
                            >
                                ${escapeHTML(status)}
                            </span>

                        </div>


                        <div class="inquiry-product-price">

                            ${
                                product
                                    ? formatPrice(
                                        product.price
                                    )
                                    : ""
                            }

                        </div>


                        <p class="inquiry-message">
                            ${escapeHTML(
                                inquiry.message
                            )}
                        </p>


                        <div class="inquiry-footer">

                            <span>
                                ${escapeHTML(
                                    getRelativeDate(
                                        inquiry.created_at
                                    )
                                )}
                            </span>


                            <div class="inquiry-actions">

                                ${
                                    status !== "read"
                                        ? `
                                            <button
                                                type="button"
                                                class="btn btn-outline"
                                                data-inquiry-action="status"
                                                data-inquiry-id="${escapeHTML(inquiry.id)}"
                                                data-status="read"
                                            >
                                                Mark Read
                                            </button>
                                        `
                                        : ""
                                }


                                ${
                                    status !== "replied"
                                        ? `
                                            <button
                                                type="button"
                                                class="btn btn-primary"
                                                data-inquiry-action="status"
                                                data-inquiry-id="${escapeHTML(inquiry.id)}"
                                                data-status="replied"
                                            >
                                                Mark Replied
                                            </button>
                                        `
                                        : ""
                                }

                            </div>

                        </div>

                    </div>

                `;
            })
            .join("");
}


/* =========================================================
   UPDATE INQUIRY STATUS
   ========================================================= */

async function updateInquiryStatus(
    inquiryId,
    status
) {

    if (!currentUser) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from("inquiries")
            .update({
                status: status
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

        console.error(
            "Status update error:",
            error
        );

        showToast(
            "Could not update inquiry",
            "error"
        );

        return;
    }


    showToast(
        "Inquiry status updated",
        "success"
    );


    await loadReceivedInquiries();
}


/* =========================================================
   IMAGE UPLOAD
   ========================================================= */

async function uploadProductImage(
    file
) {

    if (!currentUser) {

        throw new Error(
            "You must be logged in."
        );
    }


    if (!file) {
        return null;
    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        throw new Error(
            "Please select an image file."
        );
    }


    if (
        file.size >
        5 * 1024 * 1024
    ) {

        throw new Error(
            "Image must be smaller than 5MB."
        );
    }


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const fileName =
        `${Date.now()}-${crypto.randomUUID()}.${extension}`;


    const filePath =
        `${currentUser.id}/${fileName}`;


    const {
        error
    } =
        await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",
                    upsert: false
                }
            );


    if (error) {

        console.error(
            "Image upload error:",
            error
        );

        throw error;
    }


    const {
        data
    } =
        supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(
                filePath
            );


    return data.publicUrl;
}


/* =========================================================
   STORAGE PATH
   ========================================================= */

function getStoragePathFromPublicUrl(
    url
) {

    if (!url) {
        return null;
    }


    try {

        const marker =
            `/storage/v1/object/public/${STORAGE_BUCKET}/`;


        const index =
            url.indexOf(marker);


        if (index === -1) {
            return null;
        }


        return decodeURIComponent(
            url.slice(
                index +
                marker.length
            )
        );

    } catch (error) {

        return null;
    }
}


/* =========================================================
   DELETE STORAGE IMAGE
   ========================================================= */

async function deleteStorageImage(
    url
) {

    const path =
        getStoragePathFromPublicUrl(
            url
        );


    if (!path) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .remove([
                path
            ]);


    if (error) {

        console.warn(
            "Could not delete image:",
            error
        );
    }
}


/* =========================================================
   IMAGE PREVIEW
   ========================================================= */

function handleImagePreview(
    event
) {

    const file =
        event.target.files?.[0];


    const preview =
        $("imagePreview");


    if (!preview) {
        return;
    }


    if (!file) {

        preview.innerHTML =
            "";

        return;
    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        showToast(
            "Please select an image",
            "error"
        );

        event.target.value =
            "";

        return;
    }


    if (
        file.size >
        5 * 1024 * 1024
    ) {

        showToast(
            "Image must be smaller than 5MB",
            "error"
        );

        event.target.value =
            "";

        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        function () {

            preview.innerHTML = `
                <img
                    src="${reader.result}"
                    alt="Preview"
                >
            `;
        };


    reader.readAsDataURL(file);
}


/* =========================================================
   OPEN SELL MODAL
   ========================================================= */

function openSellModal() {

    if (!currentUser) {

        showToast(
            "Please login to sell an item",
            "warning"
        );

        openModal(
            "loginModal"
        );

        return;
    }


    editingProductId =
        null;


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


    if ($("sellForm")) {

        $("sellForm").reset();
    }


    if ($("imagePreview")) {

        $("imagePreview")
            .innerHTML =
            "";
    }


    openModal(
        "sellModal"
    );
}


/* =========================================================
   OPEN EDIT PRODUCT
   ========================================================= */

function openEditProduct(
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

        showToast(
            "Product not found",
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
            "Save Changes";
    }


    $("productName").value =
        product.name;

    $("productCategory").value =
        product.category;

    $("productPrice").value =
        product.price;

    $("productLocation").value =
        product.location;

    $("productCondition").value =
        product.condition;

    $("productDescription").value =
        product.description;


    $("productImage").value =
        "";


    if (product.image) {

        $("imagePreview").innerHTML = `
            <img
                src="${escapeHTML(product.image)}"
                alt="Current image"
            >
        `;

    } else {

        $("imagePreview").innerHTML =
            "";
    }


    openModal(
        "sellModal"
    );
}


/* =========================================================
   SUBMIT PRODUCT
   ========================================================= */

async function submitProduct(
    event
) {

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
            .value
            .trim();


    const category =
        $("productCategory")
            .value;


    const price =
        Number(
            $("productPrice")
                .value
        );


    const location =
        $("productLocation")
            .value
            .trim();


    const condition =
        $("productCondition")
            .value;


    const description =
        $("productDescription")
            .value
            .trim();


    const imageFile =
        $("productImage")
            .files?.[0] ||
        null;


    if (
        !name ||
        !category ||
        !location ||
        !condition ||
        !description
    ) {

        showToast(
            "Please fill all required fields",
            "warning"
        );

        return;
    }


    if (
        Number.isNaN(price) ||
        price < 0
    ) {

        showToast(
            "Enter a valid price",
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
        submitButton.disabled =
            true;
    }


    try {

        let imageUrl =
            null;


        if (imageFile) {

            imageUrl =
                await uploadProductImage(
                    imageFile
                );
        }


        /* ================= EDIT ================= */

        if (editingProductId) {

            const existing =
                currentProducts.find(
                    product =>
                        String(
                            product.id
                        ) ===
                        String(
                            editingProductId
                        )
                );


            if (
                !existing ||
                !isMyProduct(existing)
            ) {

                throw new Error(
                    "You are not allowed to edit this listing."
                );
            }


            const updateData = {

                name,
                category,
                price,
                location,
                condition,
                description
            };


            if (imageUrl) {

                updateData.image =
                    imageUrl;
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

                if (imageUrl) {

                    await deleteStorageImage(
                        imageUrl
                    );
                }

                throw error;
            }


            if (
                imageUrl &&
                existing.image
            ) {

                await deleteStorageImage(
                    existing.image
                );
            }


            showToast(
                "Listing updated successfully!",
                "success"
            );


        } else {

            /* ================= CREATE ================= */

            const profile =
                getUserProfile();


            const {
                error
            } =
                await supabaseClient
                    .from("products")
                    .insert({

                        user_id:
                            currentUser.id,

                        name,

                        category,

                        price,

                        location,

                        condition,

                        description,

                        image:
                            imageUrl ||
                            getPlaceholderImage(
                                name
                            ),

                        seller:
                            profile.name ||
                            currentUser.email ||
                            "Student",

                        seller_email:
                            currentUser.email ||
                            ""
                    });


            if (error) {

                if (imageUrl) {

                    await deleteStorageImage(
                        imageUrl
                    );
                }

                throw error;
            }


            showToast(
                "Listing published successfully! 🎉",
                "success"
            );
        }


        closeModal(
            "sellModal"
        );


        editingProductId =
            null;


        if ($("sellForm")) {
            $("sellForm").reset();
        }


        if ($("imagePreview")) {

            $("imagePreview")
                .innerHTML =
                "";
        }


        await loadProducts();


    } catch (error) {

        console.error(
            "Submit product error:",
            error
        );

        showToast(
            error.message ||
            "Could not save listing",
            "error"
        );

    } finally {

        if (submitButton) {
            submitButton.disabled =
                false;
        }
    }
}


/* =========================================================
   DELETE PRODUCT
   ========================================================= */

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

        showToast(
            "Product not found",
            "error"
        );

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
            `Delete "${product.name}"?`
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from("products")
            .delete()
            .eq(
                "id",
                product.id
            )
            .eq(
                "user_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Delete error:",
            error
        );

        showToast(
            "Could not delete listing",
            "error"
        );

        return;
    }


    const wishlist =
        getWishlist().filter(
            id =>
                String(id) !==
                String(product.id)
        );


    saveWishlist(
        wishlist
    );

    updateWishlistNavbar();


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


    const myListingsModal =
        $("myListingsModal");


    if (
        myListingsModal &&
        !myListingsModal
            .classList
            .contains("hidden")
    ) {

        await loadMyListings();
    }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser(
    event
) {

    event.preventDefault();


    const email =
        $("loginEmail")
            .value
            .trim();


    const password =
        $("loginPassword")
            .value;


    if (
        !email ||
        !password
    ) {

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
        button.disabled =
            true;
    }


    const {
        data,
        error
    } =
        await supabaseClient.auth
            .signInWithPassword({

                email,
                password
            });


    if (button) {
        button.disabled =
            false;
    }


    if (error) {

        console.error(
            "Login error:",
            error
        );

        showToast(
            error.message ||
            "Login failed",
            "error"
        );

        return;
    }


    currentUser =
        data.user;


    updateNavbar();

    updateWishlistNavbar();


    closeModal(
        "loginModal"
    );


    if ($("loginForm")) {
        $("loginForm").reset();
    }


    showToast(
        "Welcome back! 👋",
        "success"
    );


    await loadProducts();
}


/* =========================================================
   SIGNUP
   ========================================================= */

async function signupUser(
    event
) {

    event.preventDefault();


    const name =
        $("signupName")
            .value
            .trim();


    const college =
        $("signupCollege")
            .value
            .trim();


    const email =
        $("signupEmail")
            .value
            .trim();


    const password =
        $("signupPassword")
            .value;


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


    if (
        password.length < 6
    ) {

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
        button.disabled =
            true;
    }


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

                        full_name:
                            name,

                        college:
                            college
                    }
                }
            });


    if (button) {
        button.disabled =
            false;
    }


    if (error) {

        console.error(
            "Signup error:",
            error
        );

        showToast(
            error.message ||
            "Signup failed",
            "error"
        );

        return;
    }


    if (data.user) {

        const oldUser =
            currentUser;


        currentUser =
            data.session
                ? data.user
                : null;


        if (currentUser) {

            saveProfile({

                name,

                college,

                avatar:
                    ""
            });


            updateNavbar();

            updateWishlistNavbar();


            closeModal(
                "signupModal"
            );


            if ($("signupForm")) {
                $("signupForm").reset();
            }


            showToast(
                "Account created successfully! 🎉",
                "success"
            );


            await loadProducts();

        } else {

            showToast(
                "Account created. Please verify your email before login.",
                "success"
            );


            closeModal(
                "signupModal"
            );


            if ($("signupForm")) {
                $("signupForm").reset();
            }


            currentUser =
                oldUser ||
                null;

            updateNavbar();
        }
    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {

    const {
        error
    } =
        await supabaseClient.auth
            .signOut();


    if (error) {

        console.error(
            "Logout error:",
            error
        );

        showToast(
            "Logout failed",
            "error"
        );

        return;
    }


    currentUser =
        null;


    closeAllModals();

    updateNavbar();

    updateWishlistNavbar();


    showToast(
        "Logged out successfully",
        "success"
    );


    await loadProducts();
}


/* =========================================================
   PROFILE
   ========================================================= */

function openProfile() {

    if (!currentUser) {

        openModal(
            "loginModal"
        );

        return;
    }


    updateProfileUI();

    openModal(
        "profileModal"
    );
}


/* =========================================================
   UPDATE PROFILE UI
   ========================================================= */

function updateProfileUI() {

    if (!currentUser) {
        return;
    }


    const profile =
        getUserProfile();


    const profileName =
        $("profileName");

    const profileCollege =
        $("profileCollege");

    const profileCollegeInfo =
        $("profileCollegeInfo");

    const profileEmailInfo =
        $("profileEmailInfo");

    const avatar =
        $("profileAvatar");


    if (profileName) {

        profileName.textContent =
            profile.name;
    }


    if (profileCollege) {

        profileCollege.textContent =
            profile.college;
    }


    if (profileCollegeInfo) {

        profileCollegeInfo.textContent =
            profile.college ||
            "—";
    }


    if (profileEmailInfo) {

        profileEmailInfo.textContent =
            profile.email ||
            "—";
    }


    if (avatar) {

        if (profile.avatar) {

            avatar.innerHTML = `
                <img
                    src="${escapeHTML(profile.avatar)}"
                    alt="Profile"
                >
            `;

        } else {

            avatar.textContent =
                getInitials(
                    profile.name
                );
        }
    }
}


/* =========================================================
   EDIT PROFILE
   ========================================================= */

function openEditProfile() {

    if (!currentUser) {
        return;
    }


    const profile =
        getUserProfile();


    $("editProfileName").value =
        profile.name;


    $("editProfileCollege").value =
        profile.college;


    $("editProfileEmail").value =
        profile.email;


    const preview =
        $("editAvatarPreview");


    if (profile.avatar) {

        preview.innerHTML = `
            <img
                src="${escapeHTML(profile.avatar)}"
                alt="Profile"
            >
        `;

    } else {

        preview.textContent =
            getInitials(
                profile.name
            );
    }


    if ($("editProfileImage")) {

        $("editProfileImage")
            .value =
            "";
    }


    openModal(
        "editProfileModal"
    );
}


/* =========================================================
   PROFILE IMAGE PREVIEW
   ========================================================= */

function handleProfileImagePreview(
    event
) {

    const file =
        event.target.files?.[0];


    if (!file) {
        return;
    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        showToast(
            "Please select an image",
            "error"
        );

        event.target.value =
            "";

        return;
    }


    if (
        file.size >
        2 * 1024 * 1024
    ) {

        showToast(
            "Profile image must be smaller than 2MB",
            "error"
        );

        event.target.value =
            "";

        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        function () {

            const preview =
                $("editAvatarPreview");

            if (preview) {

                preview.innerHTML =
                    `
                        <img
                            src="${reader.result}"
                            alt="Profile preview"
                        >
                    `;
            }
        };


    reader.readAsDataURL(
        file
    );
}


/* =========================================================
   SAVE PROFILE
   ========================================================= */

async function saveEditedProfile(
    event
) {

    event.preventDefault();


    if (!currentUser) {
        return;
    }


    const name =
        $("editProfileName")
            .value
            .trim();


    const college =
        $("editProfileCollege")
            .value
            .trim();


    const imageFile =
        $("editProfileImage")
            .files?.[0] ||
        null;


    if (!name || !college) {

        showToast(
            "Name and college are required",
            "warning"
        );

        return;
    }


    const oldProfile =
        getUserProfile();


    let avatar =
        oldProfile.avatar ||
        "";


    if (imageFile) {

        if (
            !imageFile.type.startsWith(
                "image/"
            )
        ) {

            showToast(
                "Please select a valid image",
                "error"
            );

            return;
        }


        if (
            imageFile.size >
            2 * 1024 * 1024
        ) {

            showToast(
                "Profile image must be smaller than 2MB",
                "error"
            );

            return;
        }


        avatar =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    const reader =
                        new FileReader();


                    reader.onload =
                        () =>
                            resolve(
                                reader.result
                            );


                    reader.onerror =
                        reject;


                    reader.readAsDataURL(
                        imageFile
                    );
                }
            );
    }


    saveProfile({

        name,

        college,

        avatar
    });


    updateProfileUI();


    closeModal(
        "editProfileModal"
    );


    showToast(
        "Profile updated successfully",
        "success"
    );
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
            <i class="fa-solid fa-spinner fa-spin"></i>
            Loading your listings...
        </div>
    `;


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

        console.error(
            "My listings error:",
            error
        );

        container.innerHTML = `
            <div class="error-state">
                Unable to load your listings.
            </div>
        `;

        return;
    }


    const products =
        (data || [])
            .map(normalizeProduct);


    if (!products.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    <i class="fa-solid fa-box-open"></i>
                </div>

                <h3>
                    No listings yet
                </h3>

                <p>
                    Start selling something on StudentKart.
                </p>

                <button
                    type="button"
                    class="btn btn-primary"
                    data-my-action="sell"
                >
                    Sell an Item
                </button>

            </div>
        `;

        return;
    }


    container.innerHTML =
        products
            .map(product => {

                const conditionClass =
                    getConditionClass(
                        product.condition
                    );

                const wishlisted =
                    isWishlisted(
                        product.id
                    );


                return `

                    <article
                        class="product-card"
                        data-product-id="${escapeHTML(product.id)}"
                    >

                        <div class="product-image-wrapper">

                            <img
                                class="product-image"
                                src="${escapeHTML(product.image)}"
                                alt="${escapeHTML(product.name)}"
                                loading="lazy"
                                onerror="this.src='${getPlaceholderImage(product.name)}'"
                            >


                            <div class="product-image-overlay">

                                <span
                                    class="product-condition-pill ${conditionClass}"
                                >
                                    ${getConditionIcon(
                                        product.condition
                                    )}
                                    ${escapeHTML(
                                        product.condition
                                    )}
                                </span>

                            </div>


                            <button
                                type="button"
                                class="wishlist-button ${wishlisted ? "active" : ""}"
                                data-action="wishlist"
                                data-wishlist-id="${escapeHTML(product.id)}"
                                aria-label="Add to wishlist"
                                aria-pressed="${wishlisted}"
                            >

                                <span class="wishlist-icon">
                                    ${wishlisted ? "♥" : "♡"}
                                </span>

                            </button>

                        </div>


                        <div class="product-card-content">

                            <div class="product-card-top">

                                <span class="product-badge product-category">
                                    ${escapeHTML(
                                        product.category
                                    )}
                                </span>

                                <span class="product-date">
                                    ${escapeHTML(
                                        getRelativeDate(
                                            product.createdAt
                                        )
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


                            <div class="product-meta location">

                                <i class="fa-solid fa-location-dot"></i>

                                ${escapeHTML(
                                    product.location
                                )}

                            </div>


                            <div class="product-seller">

                                <span class="seller-avatar">
                                    ${escapeHTML(
                                        getInitials(
                                            product.seller
                                        )
                                    )}
                                </span>

                                <span class="seller-name">
                                    ${escapeHTML(
                                        product.seller
                                    )}
                                </span>

                                <span class="seller-you-badge">
                                    Your listing
                                </span>

                            </div>


                            <button
                                type="button"
                                class="view-product-button view-product-btn"
                                data-my-action="view"
                                data-id="${escapeHTML(product.id)}"
                            >
                                View Details
                            </button>


                            <div class="product-owner-actions">

                                <button
                                    type="button"
                                    class="btn btn-outline"
                                    data-my-action="edit"
                                    data-id="${escapeHTML(product.id)}"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                    Edit
                                </button>


                                <button
                                    type="button"
                                    class="btn btn-danger"
                                    data-my-action="delete"
                                    data-id="${escapeHTML(product.id)}"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                    Delete
                                </button>

                            </div>

                        </div>

                    </article>

                `;
            })
            .join("");
}


/* =========================================================
   SEARCH
   ========================================================= */

function performSearch() {

    const heroSearch =
        $("heroSearch");

    const marketplaceSearch =
        $("marketplaceSearch");

    const value =
        heroSearch
            ?.value
            .trim() ||
        "";


    if (marketplaceSearch) {

        marketplaceSearch.value =
            value;
    }


    $("marketplace")
        ?.scrollIntoView({
            behavior: "smooth"
        });


    applyFilters();
}


/* =========================================================
   SELECT CATEGORY
   ========================================================= */

function selectCategory(
    category
) {

    const filter =
        $("categoryFilter");


    if (filter) {

        filter.value =
            category;
    }


    $("marketplace")
        ?.scrollIntoView({
            behavior: "smooth"
        });


    applyFilters();
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {


    /* =====================================================
       MODAL CLOSE
       ===================================================== */

    document.addEventListener(
        "click",
        event => {

            const closeElement =
                event.target.closest(
                    "[data-close-modal]"
                );


            if (!closeElement) {
                return;
            }


            const modal =
                closeElement.closest(
                    ".modal"
                );


            if (modal) {

                closeModal(
                    modal.id
                );
            }
        }
    );


    /* =====================================================
       ESCAPE KEY
       ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeAllModals();
            }
        }
    );


    /* =====================================================
       NAVBAR
       ===================================================== */

    $("loginButton")
        ?.addEventListener(
            "click",
            () => {

                openModal(
                    "loginModal"
                );
            }
        );


    $("signupButton")
        ?.addEventListener(
            "click",
            () => {

                openModal(
                    "signupModal"
                );
            }
        );


    $("wishlistButton")
        ?.addEventListener(
            "click",
            openWishlist
        );


    $("profileButton")
        ?.addEventListener(
            "click",
            openProfile
        );


    $("sellButton")
        ?.addEventListener(
            "click",
            openSellModal
        );


    /* =====================================================
       HERO
       ===================================================== */

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
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    performSearch();
                }
            }
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


    /* =====================================================
       MARKETPLACE FILTERS
       ===================================================== */

    $("marketplaceSearch")
        ?.addEventListener(
            "input",
            applyFilters
        );


    $("categoryFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("minPrice")
        ?.addEventListener(
            "input",
            applyFilters
        );


    $("maxPrice")
        ?.addEventListener(
            "input",
            applyFilters
        );


    $("conditionFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("sortFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("refreshProducts")
        ?.addEventListener(
            "click",
            async () => {

                await loadProducts();

                showToast(
                    "Marketplace refreshed",
                    "success"
                );
            }
        );


    /* =====================================================
       CATEGORIES
       ===================================================== */

    document
        .querySelectorAll(
            ".category-card"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    selectCategory(
                        card.dataset.category
                    );
                }
            );
        });


    /* =====================================================
       AUTH
       ===================================================== */

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
            () => {

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
            () => {

                closeModal(
                    "signupModal"
                );

                openModal(
                    "loginModal"
                );
            }
        );


    /* =====================================================
       SELL
       ===================================================== */

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


    /* =====================================================
       PRODUCT DETAILS
       ===================================================== */

    $("contactSellerButton")
        ?.addEventListener(
            "click",
            contactSeller
        );


    /* =====================================================
       INQUIRY
       ===================================================== */

    $("inquiryForm")
        ?.addEventListener(
            "submit",
            submitInquiry
        );


    /* =====================================================
       PROFILE
       ===================================================== */

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


    $("logoutButton")
        ?.addEventListener(
            "click",
            logoutUser
        );


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


    /* =====================================================
       FOOTER
       ===================================================== */

    $("footerLoginButton")
        ?.addEventListener(
            "click",
            () => {

                openModal(
                    "loginModal"
                );
            }
        );


    $("footerSignupButton")
        ?.addEventListener(
            "click",
            () => {

                openModal(
                    "signupModal"
                );
            }
        );


    /* =====================================================
       WISHLIST MODAL ACTIONS
       ===================================================== */

    $("wishlistContainer")
        ?.addEventListener(
            "click",
            event => {

                const viewButton =
                    event.target.closest(
                        "[data-wishlist-view]"
                    );


                const removeButton =
                    event.target.closest(
                        "[data-wishlist-remove]"
                    );


                /* VIEW */

                if (viewButton) {

                    const id =
                        viewButton.dataset
                            .wishlistView;


                    closeModal(
                        "wishlistModal"
                    );


                    openProductDetails(
                        id
                    );

                    return;
                }


                /* REMOVE */

                if (removeButton) {

                    const id =
                        removeButton.dataset
                            .wishlistRemove;


                    removeFromWishlist(
                        id
                    );

                    return;
                }
            }
        );


    /* =====================================================
       PRODUCT CARD ACTIONS
       ===================================================== */

    $("productContainer")
        ?.addEventListener(
            "click",
            event => {

                const actionButton =
                    event.target.closest(
                        "[data-action]"
                    );


                if (!actionButton) {
                    return;
                }


                const action =
                    actionButton.dataset.action;


                const id =
                    actionButton.dataset.id ||
                    actionButton.dataset.wishlistId;


                if (!id) {
                    return;
                }


                if (
                    action ===
                    "wishlist"
                ) {

                    event.preventDefault();

                    event.stopPropagation();

                    toggleWishlist(
                        id,
                        actionButton
                    );

                    return;
                }


                if (
                    action ===
                    "view"
                ) {

                    event.preventDefault();

                    openProductDetails(
                        id
                    );

                    return;
                }


                if (
                    action ===
                    "edit"
                ) {

                    event.preventDefault();

                    openEditProduct(
                        id
                    );

                    return;
                }


                if (
                    action ===
                    "delete"
                ) {

                    event.preventDefault();

                    deleteProduct(
                        id
                    );

                    return;
                }
            }
        );


    /* =====================================================
       MY LISTINGS ACTIONS
       ===================================================== */

    $("myListingsContainer")
        ?.addEventListener(
            "click",
            async event => {

                /* WISHLIST */

                const wishlistButton =
                    event.target.closest(
                        '[data-action="wishlist"]'
                    );


                if (wishlistButton) {

                    event.preventDefault();

                    event.stopPropagation();

                    const wishlistId =
                        wishlistButton
                            .dataset
                            .wishlistId;


                    if (wishlistId) {

                        toggleWishlist(
                            wishlistId,
                            wishlistButton
                        );
                    }

                    return;
                }


                /* OTHER ACTIONS */

                const button =
                    event.target.closest(
                        "[data-my-action]"
                    );


                if (!button) {
                    return;
                }


                const action =
                    button.dataset.myAction;


                const id =
                    button.dataset.id;


                if (
                    action ===
                    "view"
                ) {

                    closeModal(
                        "myListingsModal"
                    );

                    openProductDetails(
                        id
                    );

                    return;
                }


                if (
                    action ===
                    "edit"
                ) {

                    closeModal(
                        "myListingsModal"
                    );

                    openEditProduct(
                        id
                    );

                    return;
                }


                if (
                    action ===
                    "delete"
                ) {

                    await deleteProduct(
                        id
                    );

                    return;
                }


                if (
                    action ===
                    "sell"
                ) {

                    closeModal(
                        "myListingsModal"
                    );

                    openSellModal();
                }
            }
        );


    /* =====================================================
       INQUIRY ACTIONS
       ===================================================== */

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


                if (
                    button.dataset
                        .inquiryAction ===
                    "status"
                ) {

                    await updateInquiryStatus(

                        button.dataset
                            .inquiryId,

                        button.dataset
                            .status
                    );
                }
            }
        );
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function setupAuthListener() {

    supabaseClient.auth
        .onAuthStateChange(
            (
                event,
                session
            ) => {

                currentUser =
                    session?.user ||
                    null;


                updateNavbar();

                updateWishlistNavbar();


                if (
                    event ===
                    "SIGNED_IN"
                ) {

                    setTimeout(
                        () => {
                            loadProducts();
                        },
                        0
                    );
                }


                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    setTimeout(
                        () => {
                            loadProducts();
                        },
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

        await getCurrentUser();

        updateNavbar();

        updateWishlistNavbar();

        setupEventListeners();

        setupAuthListener();

        await loadProducts();

    } catch (error) {

        console.error(
            "StudentKart initialization error:",
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

window.openSellModal =
    openSellModal;

window.openProfile =
    openProfile;

window.selectCategory =
    selectCategory;

window.performSearch =
    performSearch;


/* =========================================================
   START APP
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