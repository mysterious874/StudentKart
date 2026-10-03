/* StudentKart Navigation Module
 * Home/search page navigation helper.
 * Kept global for compatibility with the current script architecture.
 */

function showHomePageFromSearch(options = {}) {
    $("searchResultsPage")?.classList.add("hidden");
    document.body.classList.remove("search-results-mobile-view");
    setHomeSearchStripVisibility(true);
    $("categoryPage")?.classList.add("hidden");
    $("home")?.classList.remove("hidden");
    $("marketplace")?.classList.remove("hidden");
    $("how-it-works")?.classList.remove("hidden");
    document.body.classList.remove("category-page-active");
    document.querySelector("main")?.classList.remove("category-page-active");
    $("navbarSearchInput")&&( $("navbarSearchInput").value="" );
    $("heroSearchInput")&&( $("heroSearchInput").value="" );
    $("navbarSearchSuggestions")?.classList.add("hidden");
    $("heroSearchSuggestions")?.classList.add("hidden");
    window.scrollTo({top:0,behavior:"auto"});
}
