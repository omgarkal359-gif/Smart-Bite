// ============================================================
// FOOD COURT OF SGU — Complete Database
// ============================================================

export const FOOD_COURT = {
  name: "Food Court of SGU",
  stalls: [

    // ── 1. Southern Delight(Mangale Snacks) ──────────────────────────────────
    {
      id: "mangales-snacks",
      name: "Southern Delight(Mangale Snacks)",
      tagline: "The Perfect BITE, Every Time...",
      logo: "🥘",
      online: true,
      rating: 4.6,
      contact: ["8805682020", "9372221444"],
      img: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80",
      categories: [
        {
          name: "Thalipeeth",
          items: [
            { name: "Dahi Thalipeeth", price: 50, isVeg: true },
            { name: "Schezwan Thalipeeth", price: 60, isVeg: true },
            { name: "Paneer Thalipeeth", price: 70, isVeg: true },
            { name: "Cheese Thalipeeth", price: 80, isVeg: true },
            { name: "Cheese Paneer Thalipeeth", price: 90, isVeg: true },
            { name: "Mozzarella Cheese Thalipeeth", price: 120, isVeg: true },
          ],
        },
        {
          name: "Misal",
          items: [
            { name: "Misal", price: 50, isVeg: true },
            { name: "Dahi Misal", price: 60, isVeg: true },
            { name: "Cheese Misal", price: 70, isVeg: true },
            { name: "Extra Bread", price: 10, isVeg: true },
            { name: "Jumbo Misal", price: 100, isVeg: true },
          ],
        },
        {
          name: "Rice",
          items: [
            { name: "Masala Rice", price: 40, isVeg: true },
            { name: "Butter Veg Pulav", price: 60, isVeg: true },
            { name: "Soya Butter Pulav", price: 70, isVeg: true },
            { name: "Soya Paneer Pulav", price: 80, isVeg: true },
            { name: "Paneer Butter Pulav", price: 80, isVeg: true },
            { name: "Cheese Butter Pulav", price: 90, isVeg: true },
            { name: "Cheese Paneer Pulav", price: 90, isVeg: true },
            { name: "Ghee Daal Khichadi", price: 70, isVeg: true },
            { name: "Masala Dal Khichdi", price: 100, isVeg: true },
          ],
        },
        {
          name: "Veg Wraps",
          items: [
            { name: "Veg Wraps", price: 40, isVeg: true },
            { name: "Mayo Veg Wraps", price: 50, isVeg: true },
            { name: "Lays Veg Wraps", price: 60, isVeg: true },
            { name: "Cheese Veg Wraps", price: 60, isVeg: true },
            { name: "Cheese Veg Wraps (Special)", price: 70, isVeg: true },
            { name: "Paneer Tikka Veg Wraps", price: 80, isVeg: true },
            { name: "Cheesy Paneer Veg Wraps", price: 80, isVeg: true },
            { name: "Mozzarella Cheese Wrap", price: 90, isVeg: true },
          ],
        },
        {
          name: "Spring Potato",
          items: [
            { name: "Peri Peri", price: 50, isVeg: true },
            { name: "Cheese Peri Peri", price: 80, isVeg: true },
          ],
        },
        {
          name: "Cheese Special",
          items: [
            { name: "Garlic Cheesy Bread", price: 60, isVeg: true },
            { name: "Mozzarella Cheese Ball", price: 70, isVeg: true },
            { name: "Mexican Tacos", price: 100, isVeg: true },
          ],
        },
        {
          name: "Puri Special",
          items: [
            { name: "Methi Puri with Curd", price: 60, isVeg: true },
            { name: "Khasta Puri with Curd", price: 70, isVeg: true },
            { name: "Chatpatti Puri", price: 70, isVeg: true },
            { name: "Cheese Puri", price: 80, isVeg: true },
          ],
        },
        {
          name: "Papads",
          items: [
            { name: "Masala Papad", price: 40, isVeg: true },
            { name: "Periperi Masala Papad", price: 50, isVeg: true },
            { name: "Cheese Masala Papad", price: 60, isVeg: true },
          ],
        },
        {
          name: "Cutlets & Pattice",
          items: [
            { name: "Veg Cutlet", price: 50, isVeg: true },
            { name: "Paneer Cutlet", price: 60, isVeg: true },
            { name: "Cheese Cutlet", price: 70, isVeg: true },
            { name: "Cheese Paneer Cutlet", price: 80, isVeg: true },
            { name: "Bread Pattice", price: 50, isVeg: true },
          ],
        },
        {
          name: "Momos (4 Pcs)",
          items: [
            { name: "Fried Momos", price: 50, isVeg: true },
            { name: "Tandoor Momos", price: 60, isVeg: true },
            { name: "Steamy Momos", price: 70, isVeg: true },
            { name: "Steamed Tandoor Momos", price: 70, isVeg: true },
            { name: "Cheese Momos (Fried)", price: 80, isVeg: true },
            { name: "Cheese Momos (Steamed)", price: 90, isVeg: true },
          ],
        },
        {
          name: "Masala Pav (2 Pcs)",
          items: [
            { name: "Masala Pav", price: 40, isVeg: true },
            { name: "Mayo Masala Pav", price: 50, isVeg: true },
            { name: "Cheese Masala Pav", price: 60, isVeg: true },
            { name: "Mozzarella Cheese Masala Pav", price: 90, isVeg: true },
          ],
        },
        {
          name: "Salad",
          items: [
            { name: "Diet Salad", price: 60, isVeg: true },
            { name: "Paneer Salad", price: 80, isVeg: true },
            { name: "Sprouts Salad", price: 100, isVeg: true },
          ],
        },
        {
          name: "Platter",
          items: [
            { name: "Tasty Platter", price: 120, isVeg: true },
          ],
        },
      ],
    },

    // ── 2. Tea & Coffee Stall ────────────────────────────────
    {
      id: "tea-coffee",
      name: "Tea & Coffee",
      tagline: "Fresh brews, every cup",
      logo: "☕",
      online: true,
      rating: 4.3,
      contact: [],
      img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80",
      categories: [
        {
          name: "Tea's",
          items: [
            { name: "Gulacha Basundi Tea", price: 10, isVeg: true },
            { name: "Black Tea", price: 15, isVeg: true },
            { name: "Jumbo Tea", price: 20, isVeg: true },
            { name: "Irani Tea", price: 20, isVeg: true },
            { name: "Chocolate Tea", price: 20, isVeg: true },
            { name: "Lemon Tea", price: 20, isVeg: true },
            { name: "Green Tea", price: 20, isVeg: true },
            { name: "Masala Dudh", price: 20, isVeg: true },
          ],
        },
        {
          name: "Coffee",
          items: [
            { name: "Coffee", price: 20, isVeg: true },
            { name: "Black Coffee", price: 15, isVeg: true },
            { name: "Hazelnut Coffee", price: 20, isVeg: true },
            { name: "Butterscotch Coffee", price: 20, isVeg: true },
            { name: "Vanilla Coffee", price: 20, isVeg: true },
          ],
        },
        {
          name: "Cold Beverages",
          items: [
            { name: "Cold Coffee", price: 30, isVeg: true },
            { name: "Iced Tea", price: 30, isVeg: true },
            { name: "Peach Iced Tea", price: 30, isVeg: true },
          ],
        },
        {
          name: "Special",
          items: [
            { name: "Hot Chocolate", price: 50, isVeg: true },
          ],
        },
      ],
    },

    // ── 3. Rohit Vadewale ─────────────────────
    {
      id: "rohit-vadewale",
      name: "Rohit Vadewale",
      tagline: "Garam Garam Aloo Paratha & Today's Special",
      logo: "🥟",
      online: true,
      rating: 4.1,
      contact: [],
      img: "https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=400&q=80",
      categories: [
        {
          name: "Today's Special",
          items: [
            { name: "Modak", price: 40, isVeg: true },
            { name: "Mutter Karanji", price: 50, isVeg: true },
          ],
        },
        {
          name: "Fasting Special",
          items: [
            { name: "Sabudana Vada", price: 45, isVeg: true },
            { name: "Fries", price: 60, isVeg: true },
          ],
        },
      ],
    },

    // ── 4. Oodles of Noodles ─────────────────────────────────
    {
      id: "oodles-of-noodles",
      name: "Oodles of Noodles",
      tagline: "Self Service – Chinese & Indo-Chinese",
      logo: "🍜",
      online: true,
      rating: 4.4,
      contact: ["9823916186"],
      img: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80",
      categories: [
        {
          name: "Starter",
          items: [
            { name: "Veg Manchurian", price: 50, isVeg: true },
            { name: "Veg Schezwan Dry", price: 60, isVeg: true },
            { name: "Chinese Bhel", price: 60, isVeg: true },
            { name: "Veg Crispy", price: 70, isVeg: true },
            { name: "Paneer Chilli", price: 110, isVeg: true },
          ],
        },
        {
          name: "Roll",
          items: [
            { name: "Noodles Roll", price: 60, isVeg: true },
            { name: "Noodles Cheese Roll", price: 70, isVeg: true },
            { name: "Paneer Roll", price: 70, isVeg: true },
            { name: "Paneer Cheese Roll", price: 80, isVeg: true },
            { name: "Soya 69", price: 80, isVeg: true },
          ],
        },
        {
          name: "Noodles",
          items: [
            { name: "Hakka Noodles", price: 50, isVeg: true },
            { name: "Garlic Noodles", price: 60, isVeg: true },
            { name: "Singapuri Noodles", price: 60, isVeg: true },
            { name: "Hong Kong Noodles", price: 60, isVeg: true },
            { name: "Schezwan Noodles", price: 60, isVeg: true },
            { name: "Manchurian Noodles", price: 70, isVeg: true },
            { name: "Paneer Noodles", price: 80, isVeg: true },
            { name: "Triple Noodles", price: 80, isVeg: true },
          ],
        },
        {
          name: "Rice",
          items: [
            { name: "Fried Rice", price: 50, isVeg: true },
            { name: "Garlic Rice", price: 60, isVeg: true },
            { name: "Singapuri Rice", price: 60, isVeg: true },
            { name: "Hong Kong Rice", price: 60, isVeg: true },
            { name: "Schezwan Rice", price: 60, isVeg: true },
            { name: "Manchurian Rice", price: 70, isVeg: true },
            { name: "Paneer Rice", price: 80, isVeg: true },
            { name: "Triple Rice", price: 80, isVeg: true },
            { name: "Combination Rice", price: 70, isVeg: true },
          ],
        },
        {
          name: "Maggi",
          items: [
            { name: "Regular Maggi", price: 40, isVeg: true },
            { name: "Cheese Maggi", price: 60, isVeg: true },
            { name: "Vegetable Maggi", price: 60, isVeg: true },
            { name: "Corn Maggi", price: 60, isVeg: true },
            { name: "Peri Peri Maggi", price: 60, isVeg: true },
            { name: "Peri Peri Cheese Maggi", price: 70, isVeg: true },
          ],
        },
        {
          name: "Soup",
          items: [
            { name: "Veg Manchow Soup", price: 50, isVeg: true },
            { name: "Veg Noodles Soup", price: 60, isVeg: true },
            { name: "Spinach Soup", price: 60, isVeg: true },
          ],
        },
      ],
    },

    // ── 5. Narayana (South Indian Special) ────────────────────
    {
      id: "narayana",
      name: "Narayana",
      tagline: "South Indian Special",
      logo: "🥞",
      online: true,
      rating: 4.5,
      contact: [],
      img: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=400&q=80",
      categories: [
        {
          name: "Idli's",
          items: [
            { name: "Single Idli", price: 20, isVeg: true },
            { name: "Idli Plate (2 Pcs)", price: 35, isVeg: true },
            { name: "Cheese Idli", price: 50, isVeg: true },
            { name: "Idli Fry", price: 40, isVeg: true },
            { name: "Ghee Podli Idli", price: 60, isVeg: true },
          ],
        },
        {
          name: "Dosa's",
          items: [
            { name: "Plain Dosa", price: 40, isVeg: true },
            { name: "Masala Dosa", price: 50, isVeg: true },
            { name: "Sponge Dosa", price: 60, isVeg: true },
            { name: "Cheese Dosa", price: 60, isVeg: true },
            { name: "Paneer Cheese Dosa", price: 80, isVeg: true },
            { name: "Spong Loni Dosa", price: 80, isVeg: true },
            { name: "Davangiri Loni Dosa", price: 90, isVeg: true },
            { name: "Mysore Masala Dosa", price: 90, isVeg: true },
            { name: "Ghee Podi Dosa", price: 100, isVeg: true },
          ],
        },
        {
          name: "Uthappa",
          items: [
            { name: "Tomato Uthappa", price: 70, isVeg: true },
            { name: "Onion Uthappa", price: 70, isVeg: true },
          ],
        },
        {
          name: "Medu Vada",
          items: [
            { name: "Medu Vada", price: 50, isVeg: true },
            { name: "Dahi Vada", price: 50, isVeg: true },
          ],
        },
        {
          name: "Appe (7 Pcs)",
          items: [
            { name: "Appe", price: 50, isVeg: true },
            { name: "Masala Appe", price: 60, isVeg: true },
          ],
        },
        {
          name: "Rice Bowl",
          items: [
            { name: "Rice with Sambar", price: 50, isVeg: true },
            { name: "Puliyogare Rice", price: 60, isVeg: true },
            { name: "Lemon Rice", price: 60, isVeg: true },
            { name: "Soya Rice", price: 60, isVeg: true },
            { name: "Curd Rice", price: 80, isVeg: true },
            { name: "Paneer Tikka", price: 80, isVeg: true },
            { name: "Veg Hyderabadi", price: 80, isVeg: true },
            { name: "Paneer Hyderabadi", price: 90, isVeg: true },
          ],
        },
        {
          name: "Paratha's",
          items: [
            { name: "Aloo Paratha", price: 60, isVeg: true },
            { name: "Paneer Paratha", price: 80, isVeg: true },
            { name: "Cheese Paratha", price: 80, isVeg: true },
            { name: "Cheese Aloo Paratha", price: 80, isVeg: true },
            { name: "Magic Paratha (Paneer)", price: 100, isVeg: true },
          ],
        },
        {
          name: "Pasta's",
          items: [
            { name: "Red Sauce Pasta", price: 70, isVeg: true },
            { name: "White Sauce Pasta", price: 80, isVeg: true },
            { name: "Peri Peri Pasta", price: 80, isVeg: true },
            { name: "Creamy Corn Pasta", price: 90, isVeg: true },
          ],
        },
        {
          name: "Maggie",
          items: [
            { name: "Plain Maggie", price: 50, isVeg: true },
            { name: "Corn Maggie", price: 60, isVeg: true },
            { name: "Vegetable Maggie", price: 60, isVeg: true },
            { name: "Cheese Maggie", price: 70, isVeg: true },
            { name: "Peri Peri Maggie", price: 70, isVeg: true },
          ],
        },
        {
          name: "Roll's",
          items: [
            { name: "Aloo Corn Roll", price: 50, isVeg: true },
            { name: "Vegetable Roll", price: 60, isVeg: true },
            { name: "Soya Tikka Roll", price: 70, isVeg: true },
            { name: "Paneer Masala Roll", price: 80, isVeg: true },
            { name: "Paneer Tikka Roll", price: 90, isVeg: true },
            { name: "Spring Roll", price: 90, isVeg: true },
          ],
        },
      ],
      extras: [
        { name: "Extra Cheese", price: 10, isVeg: true },
        { name: "Parcel Charge", price: 5, isVeg: true },
      ],
    },
  ],
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
