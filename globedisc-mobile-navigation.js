(function () {
  "use strict";
  window.GlobeDiscBack = function () {
    try {
      var ref = document.referrer ? new URL(document.referrer, location.href) : null;
      if (history.length > 1 && ref && ref.origin === location.origin) {
        history.back();
      } else {
        location.replace("/");
      }
    } catch (_) {
      location.replace("/");
    }
  };

  // Keep page changes visually immediate; do not add artificial navigation delays.
  try {
    document.documentElement.classList.add("globedisc-nav-ready");
  } catch (_) {}
})();