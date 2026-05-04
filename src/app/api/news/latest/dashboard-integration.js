// ─── DASHBOARD INTEGRATION GUIDE ─────────────────────────────────────────────
//
// 1. Copy FilterSidebar.jsx into:
//    src/components/FilterSidebar.jsx
//
// 2. In src/app/dashboard/page.jsx, make these changes:
// ─────────────────────────────────────────────────────────────────────────────

// STEP A — Add import at the top of dashboard/page.jsx:
import FilterSidebar from "@/components/FilterSidebar";


// STEP B — Add filter state (alongside your existing useState hooks):
const [filters, setFilters] = useState({ keyword: "", dateFrom: "", dateTo: "" });


// STEP C — Replace your existing fetchArticles/news fetch with this version
//          that passes filter params to /api/news:

async function fetchArticles(page = 1, activeFilters = filters) {
  const params = new URLSearchParams();
  params.set("limit", "20");
  params.set("page", page);

  if (activeFilters.keyword)  params.set("keyword", activeFilters.keyword);
  if (activeFilters.dateFrom) params.set("dateFrom", activeFilters.dateFrom);
  if (activeFilters.dateTo)   params.set("dateTo",   activeFilters.dateTo);

  const res = await fetch(`/api/news?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  setArticles(data.articles || []);
  setTotalPages(data.pages || 1);
}

// Call it on filter change:
function handleFilter(newFilters) {
  setFilters(newFilters);
  setCurrentPage(1);
  fetchArticles(1, newFilters);
}

function handleReset() {
  const empty = { keyword: "", dateFrom: "", dateTo: "" };
  setFilters(empty);
  setCurrentPage(1);
  fetchArticles(1, empty);
}


// STEP D — Wrap your dashboard content in a flex row and add the sidebar.
//          Find your main dashboard container and change it to:

<div style={{ display: "flex", minHeight: "100vh" }}>
  <FilterSidebar onFilter={handleFilter} onReset={handleReset} />

  {/* your existing dashboard content goes here, unchanged */}
  <main style={{ flex: 1, overflowX: "hidden" }}>
    {/* ... articles list, charts, etc. */}
  </main>
</div>


// ─── BACKEND: add date range support to GET /news/latest ─────────────────────
//
// Your current routes.js /news/latest only supports keyword, crawler, analyzed.
// Add dateFrom / dateTo support. In routes.js find the filter block and add:

const { keyword, crawler, analyzed, limit = 20, page = 1, dateFrom, dateTo } = req.query;

// then in the filter object add:
if (dateFrom || dateTo) {
  filter.fetchedAt = {};
  if (dateFrom) filter.fetchedAt.$gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999); // include the full end day
    filter.fetchedAt.$lte = end;
  }
}