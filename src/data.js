export const shopsData = [
  {
    id: 's1',
    name: 'Snack Corner',
    category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1594212202875-86ac12c6eb52?auto=format&fit=crop&w=800&h=400&q=80',
    description: 'Fast Food',
    rating: 4.2,
    time: '10m',
    costForTwo: '₹100 for two',
    isOpen: true
  },
  {
    id: 's2',
    name: 'Juice Center',
    category: 'Drinks',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&h=400&q=80',
    description: 'Fresh Juices',
    rating: 4.5,
    time: '5m',
    costForTwo: '₹80 for two',
    isOpen: true
  },
  {
    id: 's3',
    name: 'Burger Palace',
    category: 'Meals',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&h=400&q=80',
    description: 'Gourmet Burgers',
    rating: 4.8,
    time: '15m',
    costForTwo: '₹250 for two',
    isOpen: true
  },
  {
    id: 's4',
    name: 'Pizza Paradise',
    category: 'Meals',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&h=400&q=80',
    description: 'Wood-fired Pizza',
    rating: 4.1,
    time: '20m',
    costForTwo: '₹400 for two',
    isOpen: false
  },
  {
    id: 's5',
    name: 'Sweet Tooth Cafe',
    category: 'Desserts',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&h=400&q=80',
    description: 'Pastries & Sweets',
    rating: 4.9,
    time: '5m',
    costForTwo: '₹150 for two',
    isOpen: true
  },
  {
    id: 's6',
    name: 'Oodles of Noodles',
    category: 'Meals',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&h=400&q=80',
    description: 'Chinese & Indo-Chinese',
    rating: 4.6,
    time: '15m',
    costForTwo: '₹300 for two',
    isOpen: true
  }
];

export const foodItemsData = [
  // Snack Corner (s1)
  { id: 'f1', name: 'Burger', description: 'Crispy veg burger', price: 80, image: '🍔', shopId: 's1' },
  { id: 'f2', name: 'French Fries', description: 'Salted crinkle fries', price: 50, image: '🍟', shopId: 's1' },
  { id: 'f3', name: 'Coke', description: 'Chilled soft drink', price: 30, image: '🥤', shopId: 's1' },
  { id: 'f14', name: 'Poha', description: 'Freshly prepared poha with signature herbs', price: 30, image: '🍲', shopId: 's1' },
  
  // Juice Center (s2)
  { id: 'f4', name: 'Mango Juice', description: 'Freshly squeezed', price: 40, image: '🥭', shopId: 's2' },
  { id: 'f5', name: 'Watermelon Juice', description: 'No added sugar', price: 40, image: '🍉', shopId: 's2' },

  // Burger Palace (s3)
  { id: 'f6', name: 'Veg Cheeseburger', description: 'Double veg patty', price: 120, image: '🍔', shopId: 's3' },
  { id: 'f7', name: 'Onion Rings', description: 'Crispy battered rings', price: 90, image: '🧅', shopId: 's3' },

  // Pizza Paradise (s4)
  { id: 'f8', name: 'Margherita Pizza', description: 'Cheese loaded', price: 200, image: '🍕', shopId: 's4' },
  
  // Sweet Tooth Cafe (s5)
  { id: 'f9', name: 'Chocolate Cake', description: 'Rich truffle slice', price: 90, image: '🍰', shopId: 's5' },
  { id: 'f10', name: 'Ice Cream', description: 'Vanilla scoop', price: 60, image: '🍦', shopId: 's5' },
  
  // Oodles of Noodles (s6)
  { id: 'f11', name: 'Veg Hakka Noodles', description: 'Classic stir-fried noodles', price: 150, image: '🍜', shopId: 's6' },
  { id: 'f12', name: 'Chilli Paneer', description: 'Spicy Indo-Chinese paneer', price: 220, image: '🥘', shopId: 's6' },
  { id: 'f13', name: 'Veg Manchurian', description: 'Dumplings in soy garlic sauce', price: 160, image: '🥟', shopId: 's6' }
];
