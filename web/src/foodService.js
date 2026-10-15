import { signMedia } from "./socialService.js";

export async function loadAvailableFoodMenu(client) {
  if (!client) throw new Error("O serviço de cardápios está indisponível.");

  const { data: menuItems, error: menuError } = await client
    .from("food_menu_items")
    .select("id,restaurant_id,name,description,price,currency,image_paths,portion_label,allergens,available,stock,created_at")
    .eq("available", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (menuError) throw menuError;

  const items = menuItems || [];
  const restaurantIds = [...new Set(items.map(item => item.restaurant_id).filter(Boolean))];
  if (!restaurantIds.length) return [];

  const { data: restaurants, error: restaurantError } = await client
    .from("profiles")
    .select("id,display_name,city,kind,partner_approved_at")
    .eq("kind", "restaurante")
    .in("id", restaurantIds);
  if (restaurantError) throw restaurantError;

  const approvedRestaurants = new Map((restaurants || [])
    .filter(restaurant => restaurant.kind === "restaurante" && restaurant.partner_approved_at)
    .map(restaurant => [restaurant.id, restaurant]));

  const mappedItems = await Promise.all(items
    .filter(item => item.available && (item.stock == null || Number(item.stock) > 0)
      && approvedRestaurants.has(item.restaurant_id))
    .map(async item => {
      const restaurant = approvedRestaurants.get(item.restaurant_id);
      const price = Number(item.price);
      if (!Number.isFinite(price) || price <= 0) return null;
      const imagePath = Array.isArray(item.image_paths) ? item.image_paths[0] : "";
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price,
        currency: item.currency,
        image: imagePath ? await signMedia(client, imagePath) : "",
        portionLabel: item.portion_label || "",
        allergens: Array.isArray(item.allergens) ? item.allergens : [],
        restaurant: {
          id: restaurant.id,
          name: restaurant.display_name,
          city: restaurant.city || "",
        },
      };
    }));
  return mappedItems.filter(Boolean);
}
