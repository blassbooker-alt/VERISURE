import { shopProducts } from "./shopData.js";

const purchasableProducts = new Map(shopProducts.filter(product => product.sku).map(product => [product.sku, product]));

export function getShopCartLineKey(line) {
  const options = Object.entries(line.options || {}).sort(([first], [second]) => first.localeCompare(second));
  return JSON.stringify([line.id, options]);
}

export function getShopCartProduct(line) {
  return purchasableProducts.get(line.id) || null;
}

export function getShopCartOptionsLabel(line) {
  return Object.values(line.options || {}).filter(Boolean).join(" · ");
}

export function addShopCartItem(cart, product, options, quantity = 1) {
  if (!product?.sku) throw new Error("Este item não está disponível para a sacola.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Informe uma quantidade válida.");

  const line = { id: product.sku, options, quantity };
  const lineKey = getShopCartLineKey(line);
  const existingLine = cart.find(item => getShopCartLineKey(item) === lineKey);
  if (existingLine) {
    return cart.map(item => getShopCartLineKey(item) === lineKey
      ? { ...item, quantity: item.quantity + quantity }
      : item);
  }
  return [...cart, line];
}

export function updateShopCartQuantity(cart, lineKey, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Informe uma quantidade válida.");
  if (quantity === 0) return cart.filter(line => getShopCartLineKey(line) !== lineKey);
  return cart.map(line => getShopCartLineKey(line) === lineKey ? { ...line, quantity } : line);
}

export function removeShopCartItem(cart, lineKey) {
  return cart.filter(line => getShopCartLineKey(line) !== lineKey);
}

export function getShopCartSummary(cart) {
  return cart.reduce((summary, line) => {
    const product = getShopCartProduct(line);
    if (!product) return summary;
    summary.itemCount += line.quantity;
    summary.subtotal += product.price * line.quantity;
    return summary;
  }, { itemCount: 0, subtotal: 0 });
}
