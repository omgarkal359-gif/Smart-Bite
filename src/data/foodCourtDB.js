// ============================================================
// FOOD COURT OF SGU — Complete Database
// ============================================================

export const FOOD_COURT = {
  name: "Food Court of SGU",
  stalls: [],
};

// ── Helper: flat list of all items with stall info ──────────
let _idCounter = 1;
export const ALL_FOOD_ITEMS = FOOD_COURT.stalls.flatMap((stall) =>
  stall.categories.flatMap((cat) =>
    cat.items.map((item) => ({
      id: _idCounter++,
      ...item,
      category: cat.name,
      stallId: stall.id,
      stallName: stall.name,
      stock: 20,
    }))
  )
);

// ── Helper: get stall shops in format matching MOCK_SHOPS ───
export const SHOPS = FOOD_COURT.stalls.map((stall) => ({
  id: stall.id,
  name: stall.name,
  category: stall.tagline,
  online: stall.online,
  busyMode: false,
  waitTime: 0,
  rating: stall.rating,
  img: stall.img,
  logo: stall.logo,
}));

// ── Helper: get items for a specific stall ──────────────────
export function getItemsByStall(stallId) {
  return ALL_FOOD_ITEMS.filter((item) => item.stallId === stallId);
}

// ── Helper: get categories for a specific stall ─────────────
export function getCategoriesByStall(stallId) {
  const stall = FOOD_COURT.stalls.find((s) => s.id === stallId);
  return stall ? stall.categories.map((c) => c.name) : [];
}

// ── Helper: search across all stalls ────────────────────────
export function searchFoodItems(query) {
  const q = query.toLowerCase();
  return ALL_FOOD_ITEMS.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.stallName.toLowerCase().includes(q)
  );
}
