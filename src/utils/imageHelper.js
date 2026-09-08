// ============================================================
// DISH IMAGE HELPER
// Images are vendor-driven: each menu item shows the photo the
// vendor uploaded (item.img, a Supabase Storage URL). When a
// vendor has not uploaded a photo, a neutral placeholder shows.
// No hard-coded per-dish or per-category images.
// ============================================================

// Neutral "no image" placeholder (inline SVG data URI — no network request).
export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23F1F5F9'/%3E%3Cg fill='none' stroke='%23CBD5E1' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M170 150v100M170 150c-16 0-16 40 0 40h0v-40zM230 150v100M230 150c14 0 22 14 22 30 0 12-8 20-22 20'/%3E%3C/g%3E%3Ctext x='200' y='310' font-family='Arial, sans-serif' font-size='24' fill='%2394A3B8' text-anchor='middle'%3ENo photo yet%3C/text%3E%3C/svg%3E";

/**
 * Returns the vendor-uploaded image for a menu item, or a neutral
 * placeholder when the vendor has not uploaded one.
 */
export function getFoodItemImage(item) {
  const img = item?.img;
  if (img && typeof img === 'string' && img.trim()) {
    return img;
  }
  return PLACEHOLDER_IMAGE;
}
