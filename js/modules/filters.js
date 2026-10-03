/* StudentKart Filters Module
 * Marketplace filtering logic. Loaded before script.js; kept global for the current app architecture.
 */

async function applyFilters() {

    const search =
        String(
            $("marketplaceSearch")?.value ||
            $("navbarSearchInput")?.value || ""
        )
            .trim()
            .toLowerCase();

    const category =
        $("categoryFilter")?.value ||
        selectedMarketplaceCategory || "all";

    const min =
        Number(
            $("minPrice")?.value || 0
        );

    const maxRaw =
        $("maxPrice")?.value ?? "";

    const max =
        maxRaw === ""
            ? Infinity
            : Number(maxRaw);

    const condition =
        $("conditionFilter")?.value || "all";

    const locationRaw =
        String(
            $("locationFilter")?.value || ""
        ).trim();

    const locationTerms =
        locationRaw
            ? await getStudentKartLocationTerms(locationRaw)
            : [];

    const sort =
        $("sortFilter")?.value || "newest";

    let filtered = [...currentProducts];

    if (search) {
        filtered = filtered.filter(product => {
            const haystack =
                [
                    product.name,
                    product.category,
                    product.location,
                    product.condition,
                    product.description,
                    product.seller
                ]
                    .join(" ")
                    .toLowerCase();

            return haystack.includes(search);
        });
    }

    if (category && category !== "all") {
        filtered = filtered.filter(
            product =>
                String(product.category).toLowerCase() ===
                String(category).toLowerCase()
        );
    }

    filtered = filtered.filter(
        product =>
            Number(product.price) >= min &&
            Number(product.price) <= max
    );

    if (condition && condition !== "all") {
        filtered = filtered.filter(
            product =>
                String(product.condition).toLowerCase() ===
                String(condition).toLowerCase()
        );
    }

    if (locationTerms.length) {
        filtered = filtered.filter(product => {
            const productLocation = String(product.location || "").toLowerCase();
            const productText = [
                product.location,
                product.description,
                product.name
            ].join(" ").toLowerCase();

            return locationTerms.some(term =>
                productLocation.includes(term) ||
                productText.includes(term)
            );
        });
    }

    if (sort === "price-low") {
        filtered.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sort === "price-high") {
        filtered.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sort === "oldest") {
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    updateFilterStatus(filtered.length);
    renderProducts(filtered);
}
