import { signMedia } from "./socialService.js";

export async function loadAvailableFoodMenu(client) {
  if (!client) throw new Error("O serviço de cardápios está indisponível.");

  const { data: menuItems, error: menuError } = await client
    .from("food_menu_items")
    .select("id,restaurant_id,name,description,price,currency,image_paths,ingredients,portion_label,portion_weight_g,allergens,available,stock,created_at")
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

  const availableItems = items
    .filter(item => item.available && (item.stock == null || Number(item.stock) > 0)
      && approvedRestaurants.has(item.restaurant_id));
  if (!availableItems.length) return [];

  const { data: nutritionRows, error: nutritionError } = await client
    .from("food_nutrition_facts")
    .select("menu_item_id,energy_kcal,energy_kj,carbohydrates_g,sugars_total_g,sugars_added_g,protein_g,fat_total_g,fat_saturated_g,fat_trans_g,fiber_g,sodium_mg,salt_g,source_name,source_date,status,verified_at")
    .in("menu_item_id", availableItems.map(item => item.id));
  if (nutritionError) throw nutritionError;
  const nutritionByItem = new Map((nutritionRows || []).map(row => [row.menu_item_id, row]));
  const numericNutritionFields = [
    "energy_kcal", "energy_kj", "carbohydrates_g", "sugars_total_g", "sugars_added_g",
    "protein_g", "fat_total_g", "fat_saturated_g", "fat_trans_g", "fiber_g", "sodium_mg", "salt_g",
  ];

  const mappedItems = await Promise.all(availableItems
    .map(async item => {
      const restaurant = approvedRestaurants.get(item.restaurant_id);
      const price = Number(item.price);
      if (!Number.isFinite(price) || price <= 0) return null;
      const imagePath = Array.isArray(item.image_paths) ? item.image_paths[0] : "";
      const nutritionRow = nutritionByItem.get(item.id);
      const nutrition = nutritionRow
        ? Object.fromEntries([
          ...numericNutritionFields.map(field => [field, nutritionRow[field] == null ? null : Number(nutritionRow[field])]),
          ["sourceName", nutritionRow.source_name || ""],
          ["sourceDate", nutritionRow.source_date || ""],
          ["status", nutritionRow.status],
          ["verifiedAt", nutritionRow.verified_at || ""],
        ])
        : null;
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price,
        currency: item.currency,
        image: imagePath ? await signMedia(client, imagePath) : "",
        ingredients: Array.isArray(item.ingredients) ? item.ingredients.filter(ingredient => typeof ingredient === "string" && ingredient.trim()) : [],
        portionLabel: item.portion_label || "",
        portionWeightG: item.portion_weight_g == null ? null : Number(item.portion_weight_g),
        allergens: Array.isArray(item.allergens) ? item.allergens : [],
        nutrition,
        restaurant: {
          id: restaurant.id,
          name: restaurant.display_name,
          city: restaurant.city || "",
        },
      };
    }));
  return mappedItems.filter(Boolean);
}
