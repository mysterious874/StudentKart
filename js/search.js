/* StudentKart Search Module
 * Search-result matching, live suggestions, result rendering/navigation and filters.
 * Loaded before script.js; functions intentionally remain global for the current app architecture.
 */

function getSearchResultMatches(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const categoryQuery = ["books","electronics","vehicles","furniture","services","fashion","gaming","other"].includes(q);
    return [...currentProducts].filter(product => {
        const haystack = [product.name,product.category,product.location,product.condition,product.description,product.seller].join(" ").toLowerCase();
        return categoryQuery
            ? String(product.category || "").toLowerCase() === q
            : terms.every(term => haystack.includes(term));
    }).sort((a,b) => {
        const an=String(a.name||"").toLowerCase(), bn=String(b.name||"").toLowerCase();
        return (Number(bn.startsWith(q))-Number(an.startsWith(q))) || (new Date(b.createdAt)-new Date(a.createdAt));
    });
}

function getResultPageSuggestions(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    const results = [];
    const add = (title, meta, icon, value) => {
        const key = String(title || "").trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        results.push({ title, meta, icon, value });
    };
    const popular = [
        ["Laptop","Electronics","fa-laptop"],["Laptop Stand","Electronics","fa-laptop"],
        ["Mobile Phone","Electronics","fa-mobile-screen"],["Headphones","Electronics","fa-headphones"],
        ["Programming Books","Books","fa-book"],["Textbooks","Books","fa-book-open"],
        ["Bicycle","Vehicles","fa-bicycle"],["Calculator","Electronics","fa-calculator"],
        ["Study Table","Furniture","fa-table"],["Chair","Furniture","fa-chair"],
        ["Room for Rent","Services","fa-house"],["Notes","Books","fa-note-sticky"]
    ];
    popular.filter(x => x[0].toLowerCase().includes(q))
        .sort((a,b)=>Number(!a[0].toLowerCase().startsWith(q))-Number(!b[0].toLowerCase().startsWith(q)))
        .forEach(x=>add(x[0],x[1],x[2],x[0]));
    ["Books","Electronics","Vehicles","Furniture","Services","Fashion"].filter(x=>x.toLowerCase().includes(q))
        .forEach(x=>add(x,"Category","fa-layer-group",x));
    currentProducts.filter(p=>[p.name,p.category,p.location,p.description,p.condition].join(" ").toLowerCase().includes(q))
        .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")))
        .forEach(p=>add(p.name,p.category||"Listing","fa-tag",p.name));
    return results.slice(0,7);
}

function setupSearchResultsSearch() {
    const input = $("searchResultsSearchInput");
    const page = $("searchResultsPage");
    if (!input || !page || input.dataset.resultSearchBound === "true") return;
    input.dataset.resultSearchBound = "true";

    let panel = $("searchResultsSuggestions");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "searchResultsSuggestions";
        panel.className = "search-results-suggestions hidden";
        page.querySelector(".search-results-search-field")?.appendChild(panel);
    }

    const hide = () => {
        panel.classList.add("hidden");
        panel.innerHTML = "";
    };

    const render = () => {
        const items = getResultPageSuggestions(input.value);
        if (!items.length) { hide(); return; }
        panel.innerHTML = items.map(item =>
            '<button type="button" class="search-results-suggestion" data-suggestion-value="' +
            escapeHTML(item.value) + '">' +
            '<span class="search-results-suggestion-icon"><i class="fas ' + escapeHTML(item.icon) + '"></i></span>' +
            '<span class="search-results-suggestion-copy"><strong>' + escapeHTML(item.title) +
            '</strong><small>' + escapeHTML(item.meta) + '</small></span>' +
            '<i class="fas fa-chevron-right search-results-suggestion-arrow"></i></button>'
        ).join("");
        panel.classList.remove("hidden");
        panel.querySelectorAll(".search-results-suggestion").forEach(button => {
            button.addEventListener("click", () => {
                const value = button.dataset.suggestionValue || "";
                hide();
                if (value) showSearchResultsPage(value);
            });
        });
    };

    input.addEventListener("input", render);
    input.addEventListener("focus", () => { if (input.value.trim()) render(); });
    document.addEventListener("click", event => {
        if (!page.contains(event.target)) hide();
    });
}

function setupSearchResultsFilter() {
    const button = $("searchResultsFilterButton");
    const page = $("searchResultsPage");
    if (!button || !page || button.dataset.filterBound === "true") return;
    button.dataset.filterBound = "true";

    const closePanel = panel => panel?.classList.add("hidden");

    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        let panel = $("searchResultsFilterPanel");
        if (!panel) {
            panel = document.createElement("div");
            panel.id = "searchResultsFilterPanel";
            panel.className = "search-results-filter-panel hidden";
            panel.innerHTML =
                '<div class="search-results-filter-card">' +
                    '<div class="filter-panel-header">' +
                        '<div><strong>Filter Listings</strong><small>Refine marketplace results</small></div>' +
                        '<button type="button" class="filter-panel-close" id="searchResultsFilterClose" aria-label="Close">&times;</button>' +
                    '</div>' +
                    '<div class="filter-panel-grid">' +
                        '<label><span>Category</span><select id="resultFilterCategory">' +
                            '<option value="all">All Categories</option><option value="Books">Books</option><option value="Electronics">Electronics</option><option value="Vehicles">Vehicles</option><option value="Furniture">Furniture</option><option value="Services">Services</option><option value="Fashion">Fashion</option>' +
                        '</select></label>' +
                        '<label><span>Min Price</span><input id="resultFilterMin" type="number" min="0" placeholder="₹0"></label>' +
                        '<label><span>Max Price</span><input id="resultFilterMax" type="number" min="0" placeholder="No limit"></label>' +
                        '<label class="marketplace-location-filter"><span>Location</span><div class="marketplace-location-search-wrap">' +
                            '<input id="resultFilterLocation" type="text" autocomplete="off" placeholder="University / city / village / area">' +
                            '<div id="resultFilterLocationSuggestions" class="studentkart-location-suggestions hidden" role="listbox" aria-label="Location suggestions"></div>' +
                        '</div></label>' +
                        '<label><span>Condition</span><select id="resultFilterCondition">' +
                            '<option value="all">Any Condition</option><option value="New">New</option><option value="Like New">Like New</option><option value="Good">Good</option><option value="Fair">Fair</option><option value="Used">Used</option>' +
                        '</select></label>' +
                        '<label><span>Sort By</span><select id="resultFilterSort">' +
                            '<option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option>' +
                        '</select></label>' +
                    '</div>' +
                    '<div class="filter-panel-actions">' +
                        '<button type="button" class="btn btn-outline" id="resultFilterClear">Clear</button>' +
                        '<button type="button" class="btn btn-primary" id="resultFilterApply"><i class="fas fa-check"></i> Apply Filters</button>' +
                    '</div>' +
                '</div>';
            page.appendChild(panel);

            $("searchResultsFilterClose")?.addEventListener("click", () => closePanel(panel));

            const applyButton = $("resultFilterApply");
            const clearButton = $("resultFilterClear");

            applyButton?.addEventListener("click", () => {
                applySearchResultFilter();
                showToast("Filters applied", "success");
            });

            clearButton?.addEventListener("click", () => {
                ["resultFilterMin","resultFilterMax","resultFilterLocation"].forEach(id => {
                    const el = $(id);
                    if (el) el.value = "";
                });
                const category = $("resultFilterCategory");
                const condition = $("resultFilterCondition");
                const sort = $("resultFilterSort");
                if (category) category.value = "all";
                if (condition) condition.value = "all";
                if (sort) sort.value = "newest";
                $("resultFilterLocationSuggestions")?.classList.add("hidden");
                applySearchResultFilter();
                closePanel(panel);
            });

            // Keep the filter panel open while the user is entering values.
            // Results are applied when "Apply Filters" is pressed, matching the
            // marketplace filter behaviour.
            ["resultFilterCategory","resultFilterCondition","resultFilterSort"].forEach(id => {
                $(id)?.addEventListener("change", () => {});
            });

            const locationInput = $("resultFilterLocation");
            if (locationInput) {
                locationInput.addEventListener("input", async () => {
                    const value = locationInput.value.trim();
                    if (value.length < 2) {
                        $("resultFilterLocationSuggestions")?.classList.add("hidden");
                        return;
                    }
                    const originalInput = $("locationFilter");
                    const originalBox = $("studentkartLocationSuggestions");
                    if (!originalInput || !originalBox || typeof searchStudentKartIndiaLocations !== "function") return;
                    const originalValue = originalInput.value;
                    originalInput.value = value;
                    await searchStudentKartIndiaLocations(value);
                    const sourceButtons = originalBox.querySelectorAll(".studentkart-location-option");
                    const targetBox = $("resultFilterLocationSuggestions");
                    if (!targetBox) return;
                    targetBox.innerHTML = Array.from(sourceButtons).slice(0, 10).map(option =>
                        '<button type="button" class="studentkart-location-option" data-location-value="' +
                        escapeHTML(option.dataset.locationValue || "") + '">' + option.innerHTML + '</button>'
                    ).join("");
                    targetBox.classList.toggle("hidden", !targetBox.children.length);
                    targetBox.querySelectorAll(".studentkart-location-option").forEach(option => {
                        option.addEventListener("click", () => {
                            locationInput.value = option.dataset.locationValue || "";
                            targetBox.classList.add("hidden");
                        });
                    });
                    originalInput.value = originalValue;
                    originalBox.classList.add("hidden");
                });
            }
        }

        panel.classList.toggle("hidden");
    });

    function applySearchResultFilter() {
        const query = $("searchResultsSearchInput")?.value || window.history.state?.searchQuery || "";
        let matches = getSearchResultMatches(query);
        const category = $("resultFilterCategory")?.value || "all";
        const condition = $("resultFilterCondition")?.value || "all";
        const location = String($("resultFilterLocation")?.value || "").trim().toLowerCase();
        const min = Number($("resultFilterMin")?.value || 0);
        const maxValue = $("resultFilterMax")?.value;
        const max = maxValue === "" || maxValue == null ? Infinity : Number(maxValue);
        const sort = $("resultFilterSort")?.value || "newest";

        matches = matches.filter(p => {
            const productLocation = String(p.location || "").toLowerCase();
            return (category === "all" || String(p.category || "").toLowerCase() === category.toLowerCase()) &&
                (condition === "all" || String(p.condition || "").toLowerCase() === condition.toLowerCase()) &&
                (!location || productLocation.includes(location)) &&
                Number(p.price || 0) >= min &&
                Number(p.price || 0) <= max;
        });

        matches.sort((a,b) =>
            sort === "oldest" ? new Date(a.createdAt) - new Date(b.createdAt) :
            sort === "price-low" ? Number(a.price || 0) - Number(b.price || 0) :
            sort === "price-high" ? Number(b.price || 0) - Number(a.price || 0) :
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        renderProducts(matches, "searchResultsProductContainer", "searchResultsEmptyState");
        const count = $("searchResultsCount");
        if (count) count.textContent = matches.length + (matches.length === 1 ? " listing" : " listings");
        $("searchResultsFilterPanel")?.classList.add("hidden");
    }
}

function showSearchResultsPage(query, options = {}

function forceCloseSearchResultsPage() {
    const page = $("searchResultsPage");
    if (!page) return;
    page.classList.add("hidden");
    document.body.classList.remove("search-results-mobile-view");
    page.style.removeProperty("display");
    page.style.removeProperty("position");
    page.style.removeProperty("inset");
    page.style.removeProperty("height");
    page.style.removeProperty("overflow");
    page.style.removeProperty("transform");
    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");
}
