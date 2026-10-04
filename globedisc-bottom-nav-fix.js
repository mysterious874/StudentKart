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
      if (id === "bottomSettingsButton") {
        const settings = document.getElementById("settingsModal"); if (settings) { settings.classList.remove("hidden"); settings.setAttribute("aria-hidden","false"); document.body.classList.add("modal-open"); }
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
