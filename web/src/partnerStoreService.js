import { createSecureId } from "./secureId.js";
import { signMedia } from "./socialService.js";

const STORE_KINDS = new Set(["marca", "academia", "vendedor"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function requireStoreOwner(profile, userId) {
  if (!userId || profile?.id !== userId || !STORE_KINDS.has(profile?.kind)) {
    throw new Error("Somente a própria loja ou academia pode gerenciar este catálogo.");
  }
}

export async function loadStorefront(client, profileId) {
  if (!client || !profileId) throw new Error("Não foi possível abrir esta loja.");
  const [listingResult, productResult] = await Promise.all([
    client.from("partner_listings")
      .select("address,website_url,contact_phone,modalities,opening_hours")
      .eq("profile_id", profileId)
      .maybeSingle(),
    client.from("partner_store_products")
      .select("id,profile_id,name,category,description,price,image_path,is_launch,is_active,created_at,updated_at")
      .eq("profile_id", profileId)
      .order("is_launch", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (listingResult.error) throw listingResult.error;
  if (productResult.error) throw productResult.error;
  const products = await Promise.all((productResult.data || []).map(async product => ({
    ...product,
    image: await signMedia(client, product.image_path),
  })));
  return {
    listing: listingResult.data || null,
    products,
  };
}

// Public marketplace results are governed by the database RLS policies. Only
// active listings from approved partner accounts/content are returned.
export async function loadMarketplaceProducts(client) {
  if (!client) throw new Error("A vitrine está temporariamente indisponível.");
  const { data, error } = await client.from("partner_store_products")
    .select("id,profile_id,name,category,description,price,image_path,is_launch,created_at")
    .eq("is_active", true)
    .order("is_launch", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data || []).map(async product => ({
    ...product,
    sku: product.id,
    image: await signMedia(client, product.image_path),
    imageAlt: `Foto de ${product.name}`,
    detail: product.description || "Consulte a loja parceira para obter detalhes deste produto.",
    specs: [`Categoria: ${product.category}`, "Preço e disponibilidade informados pela loja parceira"],
  })));
}

export async function saveStoreProduct(client, profile, userId, fields, existing = null) {
  requireStoreOwner(profile, userId);
  if (!client) throw new Error("A conexão com a loja está indisponível.");
  const name = String(fields.name || "").trim();
  const category = String(fields.category || "").trim();
  const description = String(fields.description || "").trim();
  const price = Number(fields.price);
  if (name.length < 2 || name.length > 120) throw new Error("O produto precisa ter um nome de 2 a 120 caracteres.");
  if (category.length < 2 || category.length > 60) throw new Error("Informe a categoria do produto.");
  if (description.length > 1200) throw new Error("A descrição pode ter até 1.200 caracteres.");
  if (!Number.isFinite(price) || price <= 0) throw new Error("Informe um preço válido.");
  if (!existing && !fields.imageFile) throw new Error("Escolha uma foto para o produto.");
  if (fields.imageFile && (!IMAGE_TYPES.has(fields.imageFile.type) || fields.imageFile.size > MAX_IMAGE_SIZE)) {
    throw new Error("Use uma imagem JPG, PNG ou WebP de até 5 MB.");
  }
  if (existing && existing.profile_id !== userId) throw new Error("Este produto não pertence a esta loja.");

  let imagePath = existing?.image_path || "";
  if (fields.imageFile) {
    const extension = fields.imageFile.type === "image/png" ? "png" : fields.imageFile.type === "image/webp" ? "webp" : "jpg";
    imagePath = `${userId}/store-products/${createSecureId()}.${extension}`;
    const { error: uploadError } = await client.storage.from("social-media").upload(imagePath, fields.imageFile, {
      contentType: fields.imageFile.type,
      upsert: false,
    });
    if (uploadError) throw uploadError;
  }

  const payload = {
    profile_id: userId,
    name,
    category,
    description,
    price: Number(price.toFixed(2)),
    image_path: imagePath,
    is_launch: Boolean(fields.isLaunch),
    is_active: Boolean(fields.isActive),
    updated_at: new Date().toISOString(),
  };
  const query = existing
    ? client.from("partner_store_products").update(payload).eq("id", existing.id).eq("profile_id", userId)
    : client.from("partner_store_products").insert(payload);
  const { data, error } = await query.select("id,profile_id,name,category,description,price,image_path,is_launch,is_active,created_at,updated_at").single();
  if (error) {
    if (fields.imageFile) {
      const { error: cleanupError } = await client.storage.from("social-media").remove([imagePath]);
      if (cleanupError) console.error("Não foi possível limpar a imagem do produto após falha ao salvar.", cleanupError);
    }
    throw error;
  }
  if (fields.imageFile && existing?.image_path && existing.image_path !== imagePath) {
    const { error: cleanupError } = await client.storage.from("social-media").remove([existing.image_path]);
    if (cleanupError) console.error("Produto atualizado, mas não foi possível remover sua imagem anterior.", cleanupError);
  }
  return data;
}

export async function deleteStoreProduct(client, profile, userId, product) {
  requireStoreOwner(profile, userId);
  if (product?.profile_id !== userId || !product.id) throw new Error("Este produto não pertence a esta loja.");
  const { error } = await client.from("partner_store_products")
    .delete()
    .eq("id", product.id)
    .eq("profile_id", userId);
  if (error) throw error;
  if (product.image_path) {
    const { error: cleanupError } = await client.storage.from("social-media").remove([product.image_path]);
    if (cleanupError) {
      console.error("Produto removido, mas não foi possível apagar sua imagem.", cleanupError);
      throw new Error("Produto removido. A imagem anterior não pôde ser apagada do armazenamento.");
    }
  }
}
