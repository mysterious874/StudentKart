/* GlobeDisc Chat + Marketplace UX polish
   Safe additive layer: does not replace the existing chat/product logic.
*/
(function () {
  "use strict";

  function trimChatSuggestions() {
    const box = document.getElementById("chatUserSearchResults");
    if (!box) return;

    const list = box.querySelector(".chat-user-search-list");
    if (!list) return;

    const cards = Array.from(list.querySelectorAll(".chat-user-search-card"));
    cards.forEach((card, index) => {
      card.hidden = index >= 10;
    });

    const title = box.querySelector(".chat-user-search-title");
    if (title) {
      const small = title.querySelector("small");
      if (small) {
        const total = cards.length;
        const shown = Math.min(total, 10);
        small.textContent = total > 10
          ? shown + " shown • scroll for more"
          : shown + (shown === 1 ? " number" : " numbers");
      }
    }
  }

  function setupChatSuggestions() {
    const box = document.getElementById("chatUserSearchResults");
    const input = document.getElementById("chatListSearchInput");
    if (!box || !input || box.dataset.uxReady === "1") return;

    box.dataset.uxReady = "1";

    const observer = new MutationObserver(() => {
      trimChatSuggestions();
    });
    observer.observe(box, { childList: true, subtree: true });

    input.addEventListener("input", () => {
      window.setTimeout(trimChatSuggestions, 260);
      window.setTimeout(trimChatSuggestions, 520);
    });

    window.setTimeout(trimChatSuggestions, 300);
  }

  function setupProductCardPolish() {
    const containers = [
      document.getElementById("productContainer"),
      document.getElementById("categoryProductContainer"),
      document.getElementById("searchResultsProductContainer"),
      document.getElementById("myListingsContainer"),
      document.getElementById("wishlistContainer")
    ].filter(Boolean);

    containers.forEach(container => {
      if (container.dataset.uxReady === "1") return;
      container.dataset.uxReady = "1";

      const observer = new MutationObserver(() => {
        container.querySelectorAll(".product-card").forEach(card => {
          card.classList.add("globedisc-product-card-polished");
        });
      });
      observer.observe(container, { childList: true, subtree: true });
    });
  }

  function init() {
    setupChatSuggestions();
    setupProductCardPolish();

    const bodyObserver = new MutationObserver(() => {
      setupChatSuggestions();
      setupProductCardPolish();
      trimChatSuggestions();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    trimChatSuggestions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();