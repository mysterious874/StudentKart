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

  function ensureSettingsModal() {
    var modal = document.getElementById("settingsModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "settingsModal";
    modal.className = "modal hidden";
    modal.innerHTML = '<div class="modal-overlay" data-settings-close></div><div class="modal-content settings-modal-content"><div class="settings-modal-header"><div><span class="section-label">GLOBEDISC</span><h2>Settings</h2><p>Manage your account, privacy and app preferences.</p></div><button type="button" class="modal-close" data-settings-close aria-label="Close">&times;</button></div><div class="settings-sections">' +
      '<button type="button" class="settings-section-button" data-settings-section="account"><span><i class="fas fa-user"></i><b>Account</b><small>Profile and account details</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="notifications"><span><i class="fas fa-bell"></i><b>Notifications</b><small>Control notification preferences</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="privacy"><span><i class="fas fa-shield-halved"></i><b>Privacy &amp; Safety</b><small>Control privacy and blocked users</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="location"><span><i class="fas fa-location-dot"></i><b>Location</b><small>Manage location preferences</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="preferences"><span><i class="fas fa-sliders"></i><b>App Preferences</b><small>Appearance, language and vibration</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="security"><span><i class="fas fa-lock"></i><b>Security</b><small>Sessions and account security</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="about"><span><i class="fas fa-circle-info"></i><b>About &amp; Support</b><small>Help, policies and developer</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="account-actions"><span><i class="fas fa-door-open"></i><b>Account Actions</b><small>Logout or delete account</small></span><i class="fas fa-chevron-right"></i></button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-settings-close]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        if (typeof window.closeModal === "function") window.closeModal("settingsModal");
        else modal.classList.add("hidden");
      });
    });
    return modal;
  }

  function openSettingsFromNav() {
    var modal = ensureSettingsModal();
    if (typeof window.closeAllModals === "function") {
      try { window.closeAllModals({fromPopState:true}); } catch (_) {}
    }
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    if (typeof window.applyStudentKartSettings === "function") {
      try { window.applyStudentKartSettings(); } catch (_) {}
    }
  }

  function installBottomSettings() {
    document.querySelectorAll('[data-bottom-action="settings"]').forEach(function(btn) {
      if (btn.dataset.settingsNavReady === "1") return;
      btn.dataset.settingsNavReady = "1";
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        openSettingsFromNav();
      });
    });
  }

  function installBackGuards() {
    installBottomSettings();
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
    });

    // Catch dynamically-rendered floating-bar buttons as well.
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-bottom-action="settings"]') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openSettingsFromNav();
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installBackGuards, { once: true });
  } else {
    installBackGuards();
  }

  try { document.documentElement.classList.add("globedisc-nav-ready"); } catch (_) {}
})();