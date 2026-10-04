(function () {
  "use strict";

  var STACK_KEY = "banjaraAppNavStack";

  function readStack() {
    try {
      var raw = sessionStorage.getItem(STACK_KEY);
      var stack = raw ? JSON.parse(raw) : [];
      return Array.isArray(stack) ? stack : [];
    } catch (_) {
      return [];
    }
  }

  function writeStack(stack) {
    try { sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-30))); } catch (_) {}
  }

  function pushCurrentPage() {
    try {
      var current = location.pathname + location.search + location.hash;
      var stack = readStack();
      if (stack[stack.length - 1] !== current) {
        stack.push(current);
        writeStack(stack);
      }
    } catch (_) {}
  }

  function goPrevious() {
    try {
      var stack = readStack();
      var previous = stack.pop();

      if (previous && previous !== (location.pathname + location.search + location.hash)) {
        writeStack(stack);
        // Replace instead of history.back(): this can never close the PWA/tab.
        location.replace(previous);
        return;
      }

      writeStack([]);
      location.replace("/");
    } catch (_) {
      try { location.replace("/"); } catch (__) {}
    }
  }

  window.GlobeDiscBack = goPrevious;
  window.GlobeDiscPushCurrentPage = pushCurrentPage;

  function installBackGuards() {
    document.querySelectorAll('button[onclick*="history.back"], a[onclick*="history.back"]').forEach(function (el) {
      el.removeAttribute("onclick");
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        goPrevious();
      }, true);
    });

    document.addEventListener("click", function (e) {
      var target = e.target && e.target.closest ? e.target.closest(".globedisc-more-item") : null;
      if (target) {
        var path = target.getAttribute("data-more-target") || "";
        if (path && path.charAt(0) !== "#") {
          // More-menu navigation is our controlled app navigation stack.
          pushCurrentPage();
        }
        return;
      }

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