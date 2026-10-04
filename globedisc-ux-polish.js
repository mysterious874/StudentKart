/* GlobeDisc Chat + Marketplace UX polish
   Safe additive layer: does not replace the existing chat/product logic.
*/
(function () {
  "use strict";

  function polishChatSuggestions() {
    const box = document.getElementById("newChatSearchResults");
    if (!box) return;
    const list = box.querySelector(".chat-search-result-list") || box;
    const cards = Array.from(list.querySelectorAll(".chat-search-result"));
    cards.forEach(card => { card.hidden = false; });

    const title = box.querySelector(".chat-search-title");
    const small = title?.querySelector("small");
    if (small) {
      small.textContent = cards.length > 10
        ? cards.length + " users • scroll for more"
        : cards.length + (cards.length === 1 ? " user" : " users");
    }
  }

  function setupChatSuggestions() {
    const box = document.getElementById("chatUserSearchResults");
    const input = document.getElementById("newChatSearchInput");
    if (!box || !input || box.dataset.uxReady === "1") return;

    box.dataset.uxReady = "1";

    const observer = new MutationObserver(() => {
      polishChatSuggestions();
    });
    observer.observe(box, { childList: true, subtree: true });

    input.addEventListener("input", () => {
      window.setTimeout(polishChatSuggestions, 180);
      window.setTimeout(polishChatSuggestions, 360);
    });

    window.setTimeout(polishChatSuggestions, 250);
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
      polishChatSuggestions();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    polishChatSuggestions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();