(function () {
  "use strict";

  function goPrevious() {
    try {
      var ref = document.referrer ? new URL(document.referrer, location.href) : null;
      var sameOriginPrevious = ref && ref.origin === location.origin;

      // Never call history.back() when the previous entry is outside the app.
      // That can close the tab/PWA instead of returning to the app.
      if (sameOriginPrevious && history.length > 1) {
        history.back();
      } else {
        location.replace("/");
      }
    } catch (_) {
      location.replace("/");
    }
  }

  window.GlobeDiscBack = goPrevious;

  function installBackGuards() {
    document.querySelectorAll('button[onclick*="history.back"], a[onclick*="history.back"]').forEach(function (el) {
      el.removeAttribute("onclick");
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        goPrevious();
      }, true);
    });

    // Marketplace and similar pages may attach their own back handler.
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest(
        "#marketplaceMobileBack,.marketplace-mobile-back,[data-mobile-back]"
      ) : null;
      if (!el) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      goPrevious();
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installBackGuards, { once: true });
  } else {
    installBackGuards();
  }

  try { document.documentElement.classList.add("globedisc-nav-ready"); } catch (_) {}
})();