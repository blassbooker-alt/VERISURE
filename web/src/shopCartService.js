export function getShopCartLineKey(line) {
  const options = Object.entries(line.options || {}).sort(([first], [second]) => first.localeCompare(second));
  return JSON.stringify([line.id, options]);
}

export function getShopCartProduct(line) {
  return line?.product?.id === line.id ? line.product : null;
}

export function getShopCartOptionsLabel(line) {
  return Object.values(line.options || {}).filter(Boolean).join(" · ");
}

export function addShopCartItem(cart, product, options, quantity = 1) {
  if (!product?.id || !Number.isFinite(Number(product.price)) || Number(product.price) <= 0) throw new Error("Este item não está disponível para a sacola.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Informe uma quantidade válida.");

  const snapshot = { id: product.id, name: product.name, category: product.category, price: Number(product.price), image: product.image, imageAlt: product.imageAlt || product.name, detail: product.detail || "", specs: product.specs || [], isDemo: Boolean(product.isDemo), demoStore: product.demoStore || "" };
  const line = { id: product.id, options, quantity, product: snapshot };
  const lineKey = getShopCartLineKey(line);
  const existingLine = cart.find(item => getShopCartLineKey(item) === lineKey);
  if (existingLine) {
    return cart.map(item => getShopCartLineKey(item) === lineKey
      ? { ...item, product: snapshot, quantity: item.quantity + quantity }
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
