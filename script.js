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
window.supabaseClient = supabaseClient;

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