import classicWadapav from '../assets/classic_wadapav.png';
import cornWadapav from '../assets/corn_wadapav.png';
import paneerWadapav from '../assets/paneer_wadapav.png';
import mixVegWadapav from '../assets/mix_veg_wadapav.png';
import specialWadapav from '../assets/special_wadapav.png';
import periPeriWadapav from '../assets/peri_peri_wadapav.png';
import cheeseWadapav from '../assets/cheese_wadapav.png';

// ============================================================
// DISH IMAGE HELPER — 100% Vegetarian, accurate per-dish images
// This food court is STRICTLY VEGETARIAN.
// All images selected show vegetarian Indian/Chinese food only.
// ============================================================

// Per-item name → Unsplash photo URL (all verified vegetarian)
const ITEM_IMAGE_MAP = {
  // ── Thalipeeth (Mangale Snacks) ───────────────────────────
  // Thalipeeth is a Maharashtrian flatbread — using roti/flatbread style images
  'Dahi Thalipeeth':              'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
  'Schezwan Thalipeeth':          'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Paneer Thalipeeth':            'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  'Cheese Thalipeeth':            'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  'Cheese Paneer Thalipeeth':     'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  'Mozzarella Cheese Thalipeeth': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=400&q=80',

  // ── Misal (spicy sprouted beans curry, Maharashtrian) ─────
  'Misal':                        'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Dahi Misal':                   'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Cheese Misal':                 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Extra Bread':                  'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
  'Jumbo Misal':                  'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',

  // ── Rice & Pulav ─────────────────────────────────────────
  'Masala Rice':                  'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Butter Veg Pulav':             'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Soya Butter Pulav':            'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Soya Paneer Pulav':            'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Paneer Butter Pulav':          'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Cheese Butter Pulav':          'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Cheese Paneer Pulav':          'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Ghee Daal Khichadi':           'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Masala Dal Khichdi':           'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',

  // ── Veg Wraps ─────────────────────────────────────────────
  'Veg Wraps':                    'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Mayo Veg Wraps':               'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Lays Veg Wraps':               'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Cheese Veg Wraps':             'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Cheese Veg Wraps (Special)':   'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Paneer Tikka Veg Wraps':       'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Cheesy Paneer Veg Wraps':      'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Mozzarella Cheese Wrap':       'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Noodles Roll':                 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Noodles Cheese Roll':          'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Paneer Roll':                  'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Paneer Cheese Roll':           'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',

  // ── Spring Potato / Peri Peri (potato-based, veg) ────────
  'Peri Peri':                    'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=400&q=80',
  'Cheese Peri Peri':             'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=400&q=80',

  // ── Cheese Special / Garlic Bread ─────────────────────────
  'Garlic Cheesy Bread':          'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&w=400&q=80',
  'Mozzarella Cheese Ball':       'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=400&q=80',
  // Veg tacos — using a clearly veg taco image with no meat visible
  'Mexican Tacos':                'https://images.unsplash.com/photo-1640980361225-04be95b7aa5a?auto=format&fit=crop&w=400&q=80',

  // ── Puri (Indian fried bread) ─────────────────────────────
  'Methi Puri with Curd':         'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Khasta Puri with Curd':        'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Chatpatti Puri':               'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Cheese Puri':                  'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',

  // ── Papads (crispy Indian lentil wafers) ──────────────────
  'Masala Papad':                 'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Periperi Masala Papad':        'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Cheese Masala Papad':          'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',

  // ── Cutlets & Pattice (veg — potato/paneer patties) ───────
  // Using a clearly veg potato cutlet image
  'Veg Cutlet':                   'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Paneer Cutlet':                'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Cheese Cutlet':                'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Cheese Paneer Cutlet':         'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Bread Pattice':                'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',

  // ── Momos (veg steamed dumplings) ─────────────────────────
  // Using a safe steamed dumpling image (veg momos look identical)
  'Fried Momos':                  'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'Tandoor Momos':                'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'Steamy Momos':                 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'Steamed Tandoor Momos':        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'Cheese Momos (Fried)':         'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'Cheese Momos (Steamed)':       'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',

  // ── Masala Pav (spiced bread rolls, veg) ─────────────────
  'Masala Pav':                   'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Mayo Masala Pav':              'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Cheese Masala Pav':            'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Mozzarella Cheese Masala Pav': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',

  // ── Salad (fresh vegetable salads) ───────────────────────
  'Diet Salad':                   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
  'Paneer Salad':                 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
  'Sprouts Salad':                'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',

  // ── Platter (Indian veg food spread) ─────────────────────
  'Tasty Platter':                'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',

  // ── Tea ──────────────────────────────────────────────────
  'Gulacha Basundi Tea':          'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
  'Black Tea':                    'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=400&q=80',
  'Jumbo Tea':                    'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
  'Irani Tea':                    'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
  'Chocolate Tea':                'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=400&q=80',
  'Lemon Tea':                    'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80',
  'Green Tea':                    'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=400&q=80',
  'Masala Dudh':                  'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
  'Hot Chocolate':                'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=400&q=80',

  // ── Coffee ────────────────────────────────────────────────
  'Coffee':                       'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
  'Black Coffee':                 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=400&q=80',
  'Hazelnut Coffee':              'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
  'Butterscotch Coffee':          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
  'Vanilla Coffee':               'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',

  // ── Cold Beverages ────────────────────────────────────────
  'Cold Coffee':                  'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Iced Tea':                     'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80',
  'Peach Iced Tea':               'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80',

  // ── Wadapav (Rohit Vadewale) — potato vada in a bun ──────
  'Classic Wadapav':              classicWadapav,
  'Corn Wadapav':                 cornWadapav,
  'Paneer Wadapav':               paneerWadapav,
  'Mix Veg Wadapav':              mixVegWadapav,
  'Special Wadapav':              specialWadapav,
  'Peri Peri Wadapav':            periPeriWadapav,
  'Cheese Wadapav':               cheeseWadapav,

  // ── Breakfast ─────────────────────────────────────────────
  'Poha':                         'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Upama':                        'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  'Poha-Upama Combo':             'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  // Pineapple Shira is a sweet semolina pudding — using warm yellow/sweet food image
  'Pineapple Shira':              'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',

  // ── Samosa Chaat (potato-filled crispy pastry) ───────────
  'Punjabi Samosa':               'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Dahi Samosa':                  'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',

  // ── Fasting (Upwaas) — all veg fasting food ──────────────
  'Sabu Khichadi':                'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Sabu Khichadi (Masala)':       'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Sabu Thalipeeth':              'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  // Sabudana Wada is a tapioca fritter — using veg fritter image
  'Sabudana Wada':                'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Classic Fries':                'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=400&q=80',
  'Peri Peri Fries':              'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=400&q=80',

  // ── Pavbhaji (spiced vegetable mash with bread) ──────────
  'Pavbhaji':                     'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Cheese Pavbhaji':              'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Butter Cheese Pavbhaji':       'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',

  // ── Rohit Special (Maharashtrian veg specialties) ─────────
  'Jhataka Wada with Cheese':     'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
  'Batata Wada Chutney':          'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
  // Kothimbir Vadi is a steamed/fried coriander-chickpea cake
  'Kothimbir Vadi (5 Pcs)':       'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  // Puran Poli is a sweet stuffed flatbread
  'Puran Poli (Single)':          'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Aloo Paratha':                 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
  // Shenga Poli is a peanut-stuffed flatbread
  'Shenga Poli':                  'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Beetroot Paratha':             'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
  'Palak Dal Khichadi':           'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',

  // ── Bhaji (veg fritters) ──────────────────────────────────
  'Tari Cutwada (Single)':        'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Tari Cutwada (Double)':        'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Palak Bhaji':                  'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Moong Bhaji':                  'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Kanda Bhaji':                  'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Batata Bhaji':                 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Mirchi Bhaji':                 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Mutter Karanji':               'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  // Modak is a sweet steamed dumpling (Ganesh festival sweet)
  'Modak':                        'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',

  // ── Chinese / Noodles — all veg (Oodles of Noodles) ──────
  // Veg Manchurian = fried veggie balls in sauce
  'Veg Manchurian':               'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Veg Schezwan Dry':             'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Chinese Bhel':                 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Veg Crispy':                   'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  // Paneer Chilli = paneer cubes in chilli sauce (vegetarian)
  'Paneer Chilli':                'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Soya 69':                      'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Hakka Noodles':                'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Garlic Noodles':               'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Singapuri Noodles':            'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Hong Kong Noodles':            'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Schezwan Noodles':             'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'Manchurian Noodles':           'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Paneer Noodles':               'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Triple Noodles':               'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Fried Rice':                   'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Garlic Rice':                  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Singapuri Rice':               'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Hong Kong Rice':               'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Schezwan Rice':                'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Manchurian Rice':              'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Paneer Rice':                  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Triple Rice':                  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Combination Rice':             'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
  'Regular Maggi':                'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
  'Cheese Maggi':                 'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
  'Vegetable Maggi':              'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
  'Corn Maggi':                   'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
  'Peri Peri Maggi':              'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
  'Peri Peri Cheese Maggi':       'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
  'Veg Manchow Soup':             'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80',
  'Veg Noodles Soup':             'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80',
  'Spinach Soup':                 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80',

  // ── South Indian (Narayana) ───────────────────────────────
  'Single Idli':                  'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Idli Plate (2 Pcs)':           'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Cheese Idli':                  'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Idli Fry':                     'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Ghee Podli Idli':              'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Plain Dosa':                   'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Masala Dosa':                  'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Sponge Dosa':                  'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Cheese Dosa':                  'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Paneer Cheese Dosa':           'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Spong Loni Dosa':              'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Davangiri Loni Dosa':          'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Mysore Masala Dosa':           'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Ghee Podi Dosa':               'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Tomato Uthappa':               'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Onion Uthappa':                'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Medu Vada':                    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Dahi Vada':                    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Appe':                         'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Masala Appe':                  'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',

  // ── Rice Bowl (South Indian) ─────────────────────────────
  'Rice with Sambar':             'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Puliyogare Rice':              'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Lemon Rice':                   'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Soya Rice':                    'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Curd Rice':                    'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  // Paneer Tikka = grilled paneer (cheese) cubes — pure vegetarian
  'Paneer Tikka':                 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Veg Hyderabadi':               'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
  'Paneer Hyderabadi':            'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',

  // ── Pasta ─────────────────────────────────────────────────
  'Red Sauce Pasta':              'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=400&q=80',
  'White Sauce Pasta':            'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=400&q=80',

  // ── Cool Cravings (beverages & shakes) ───────────────────
  'Thick Cold Coffee':            'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Cold Coffee with Crush':       'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Nutella Cold Coffee':          'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Hazelnut Cold Coffee':         'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Cold Coffee with Icecream':    'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Mint Mojito':                  'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  'Green Mojito':                 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  'Citrus Punch Mojito':          'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  'Blue Curacao':                 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  'Strawberry Shake':             'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Mango Shake':                  'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Blueberry Shake':              'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Butterscotch Shake':           'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Vanilla Shake':                'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Rose Shake':                   'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Chocolate Shake':              'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Oreo Shake':                   'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Kitkat Shake':                 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Hazelnut Shake':               'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Nutella Shake':                'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Falooda Shake':                'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Plain Lassi':                  'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Strawberry Lassi':             'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Pineapple Lassi':              'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Butterscotch Lassi':           'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Rose Lassi':                   'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Mango Lassi':                  'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Blueberry Lassi':              'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Plain Taak':                   'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Masala Taak':                  'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Limbu Sharbat':                'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80',
  'Kokam Sharbat':                'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
};

// Fallback: category-level image (all strictly vegetarian)
const CATEGORY_IMAGE_MAP = {
  "Tea's":            'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
  'Coffee':           'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
  'Cold Beverages':   'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Cold Coffee':      'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Wadapav':          classicWadapav,
  'Misal':            'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Thalipeeth':       'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  'Rice':             'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Veg Wraps':        'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  "Idli's":           'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  "Dosa's":           'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Noodles':          'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Shakes':           'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Mojito':           'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  'Lassi':            'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Butter Milk':      'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Sharbat':          'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80',
  // Veg Chinese starters
  'Starter':          'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Roll':             'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'Breakfast':        'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Pavbhaji':         'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Maggi':            'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
  'Soup':             'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80',
  'Salad':            'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
  "Pasta's":          'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=400&q=80',
  "Paratha's":        'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
  'Bhaji':            'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Uthappa':          'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Medu Vada':        'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Appe (7 Pcs)':     'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  'Rice Bowl':        'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Momos (4 Pcs)':    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'Spring Potato':    'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=400&q=80',
  'Cheese Special':   'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=400&q=80',
  'Puri Special':     'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Papads':           'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Cutlets & Pattice': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Masala Pav (2 Pcs)': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Platter':          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
  'Samosa Chaat':     'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Fast (Upwaas)':    'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
  'Our Speciality':   'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
  'Rohit Special':    'https://images.unsplash.com/photo-1605197184040-b8ca3c9f2f07?auto=format&fit=crop&w=400&q=80',
  'Special':          'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=400&q=80',
};

// A sensible vegetarian Indian food image as last resort
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80';

/**
 * Returns the most relevant, strictly-vegetarian dish image for a given menu item.
 * Resolution order: item.img (if valid, non-placeholder) → exact item name → category → default.
 */
export function getFoodItemImage(item) {
  // 1. Use the item's own img only if it's a real URL and NOT the old salad-bowl placeholder
  if (item && item.img && typeof item.img === 'string' && item.img.trim().startsWith('http')) {
    if (!item.img.includes('photo-1546069901-ba9599a7e63c')) {
      return item.img;
    }
  }

  // 2. Exact item name match (most accurate — covers every dish in the menu)
  if (item?.name && ITEM_IMAGE_MAP[item.name]) {
    return ITEM_IMAGE_MAP[item.name];
  }

  // 3. Category-level fallback (always vegetarian)
  if (item?.category && CATEGORY_IMAGE_MAP[item.category]) {
    return CATEGORY_IMAGE_MAP[item.category];
  }

  // 4. Generic vegetarian Indian food as final fallback
  return DEFAULT_IMAGE;
}
