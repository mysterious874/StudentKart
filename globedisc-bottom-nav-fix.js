/* GlobeDisc floating bottom navigation — reliable click bindings */
(function () {
  "use strict";

  function bindBottomNav() {
    const nav = document.querySelector(".mobile-bottom-nav");
    if (!nav || nav.dataset.bound === "1") return;
    nav.dataset.bound = "1";
    nav.style.pointerEvents = "auto";
    nav.style.zIndex = "120000";

    nav.addEventListener("click", function (event) {
      const item = event.target.closest(".bottom-nav-item");
      if (!item || !nav.contains(item)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const id = item.id;

      if (id === "bottomMarketplaceButton") {
        window.location.href = "/marketplace.html";
        return;
      }

      if (id === "bottomWishlistButton") {
        if (typeof window.openWishlist === "function") {
          window.openWishlist();
        } else if (typeof window.openModal === "function" && document.getElementById("wishlistModal")) {
          window.openModal("wishlistModal");
        } else {
          window.location.hash = "wishlist";
        }
        return;
      }

      if (id === "bottomCampusButton") {
        if (typeof window.renderCampusPicker === "function") {
          window.renderCampusPicker();
        }
        if (typeof window.openModal === "function" && document.getElementById("campusModal")) {
          window.openModal("campusModal");
        }
        return;
      }

      if (id === "bottomProfileButton") {
        if (typeof window.openProfile === "function") {
          window.openProfile();
        } else if (typeof window.openModal === "function" && document.getElementById("profileModal")) {
          window.openModal("profileModal");
        }
        return;
      }

      if (id === "bottomMoreButton") {
        if (typeof window.openGlobeDiscMore === "function") {
          window.openGlobeDiscMore();
        } else {
          const more = document.getElementById("globediscMoreMenu");
          if (more) {
            more.classList.remove("hidden");
            more.setAttribute("aria-hidden","false");
          }
        }
        return;
      }

      if (item.classList.contains("bottom-chat-nav-item")) {
        const chatButton = document.getElementById("chatButton");
        if (chatButton) {
          chatButton.click();
        } else if (typeof window.openModal === "function" && document.getElementById("inquiriesModal")) {
          window.openModal("inquiriesModal");
        } else {
          const modal = document.getElementById("inquiriesModal");
          if (modal) modal.classList.remove("hidden");
        }
        return;
      }

      if (item.matches('a[href="#home"]')) {
        if (typeof window.closeAllModals === "function") {
          window.closeAllModals({ instant: true });
        }
        document.querySelectorAll(".category-page-active,.search-results-page").forEach(function (page) {
          page.classList.remove("category-page-active");
        });
        document.body.classList.remove(
          "category-page-active",
          "marketplace-page-active",
          "studentkart-search-results-active"
        );
        const home = document.getElementById("home");
        if (home) {
          home.classList.remove("hidden");
          home.style.removeProperty("display");
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindBottomNav, { once: true });
  } else {
    bindBottomNav();
  }

  window.addEventListener("load", bindBottomNav, { once: true });
})();
