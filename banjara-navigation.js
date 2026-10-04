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

  window.BanjaraConnectBack = goPrevious;
  window.BanjaraConnectPushCurrentPage = pushCurrentPage;

  function ensureSettingsModal() {
    var modal = document.getElementById("settingsModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "settingsModal";
    modal.className = "modal hidden";
    modal.innerHTML = '<div class="modal-overlay" data-settings-close></div><div class="modal-content settings-modal-content"><div class="settings-clean-title"><h2>Settings</h2><button type="button" class="modal-close" data-settings-close aria-label="Close">&times;</button></div><div class="settings-sections">' +
      '<button type="button" class="settings-section-button" data-settings-section="profile"><span><i class="fas fa-user"></i><b>Profile</b><small>Personal information and profile</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="notifications"><span><i class="fas fa-bell"></i><b>Notifications</b><small>Choose what you receive</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="appearance"><span><i class="fas fa-palette"></i><b>Appearance</b><small>Theme and visual preferences</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="language"><span><i class="fas fa-language"></i><b>Language</b><small>Choose your app language</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="privacy"><span><i class="fas fa-shield-halved"></i><b>Privacy</b><small>Access and privacy controls</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="security"><span><i class="fas fa-lock"></i><b>Security</b><small>Keep your account secure</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="help"><span><i class="fas fa-circle-info"></i><b>Help &amp; About</b><small>Help, feedback and app info</small></span><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="settings-section-button" data-settings-section="account"><span><i class="fas fa-user-gear"></i><b>Account</b><small>Account actions</small></span><i class="fas fa-chevron-right"></i></button>' +
      '</div></div>';
    document.body.appendChild(modal);
    ensureSettingsDetailModal();
    modal.querySelectorAll("[data-settings-close]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        if (typeof window.closeModal === "function") window.closeModal("settingsModal");
        else modal.classList.add("hidden");
      });
    });
    return modal;
  }


  function ensureSettingsDetailModal() {
    var detail = document.getElementById("settingsDetailModal");
    if (detail) return detail;
    detail = document.createElement("div");
    detail.id = "settingsDetailModal";
    detail.className = "modal hidden";
    detail.innerHTML = '<div class="modal-overlay" data-settings-detail-close></div><div class="modal-content settings-detail-modal-content"><div class="settings-detail-header"><button type="button" class="settings-detail-back" data-settings-detail-back aria-label="Back to Settings"><i class="fas fa-arrow-left"></i></button><div class="settings-detail-icon-wrap"><i id="settingsDetailIcon" class="fas fa-circle-info"></i></div><div class="settings-detail-heading"><h2 id="settingsDetailTitle">Settings</h2><p id="settingsDetailSubtitle">Manage your preferences.</p></div><button type="button" class="modal-close" data-settings-detail-close aria-label="Close">&times;</button></div><div id="settingsDetailContent" class="settings-detail-content"></div></div>';
    document.body.appendChild(detail);

    function backToSettings() {
      if (typeof window.closeModal === "function") {
        try { window.closeModal("settingsDetailModal"); } catch (_) { detail.classList.add("hidden"); }
      } else {
        detail.classList.add("hidden");
      }
      var settings = document.getElementById("settingsModal");
      if (settings) {
        settings.classList.remove("hidden");
        document.body.classList.add("modal-open");
        if (typeof window.applyStudentKartSettings === "function") {
          try { window.applyStudentKartSettings(); } catch (_) {}
        }
      }
    }

    detail.querySelectorAll("[data-settings-detail-close]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        if (typeof window.closeModal === "function") window.closeModal("settingsDetailModal");
        else detail.classList.add("hidden");
      });
    });
    var back = detail.querySelector("[data-settings-detail-back]");
    if (back) back.addEventListener("click", backToSettings);
    return detail;
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
      var target = e.target && e.target.closest ? e.target.closest(".banjara-more-item") : null;
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

  try { document.documentElement.classList.add("banjara-nav-ready"); } catch (_) {}
})();