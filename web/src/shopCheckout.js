export function buildSandboxCartItems(cart, products) {
  if (!Array.isArray(cart) || !Array.isArray(products) || cart.length === 0) {
    throw new Error("Adicione itens ao carrinho antes de continuar.");
  }
  const productIds = new Set(products.map(product => product.id));
  const quantities = new Map();
  for (const line of cart) {
    if (!line || !productIds.has(line.id) || !Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error("Há um item inválido ou desatualizado no carrinho.");
    }
    const quantity = (quantities.get(line.id) || 0) + line.quantity;
    if (quantity > 20) throw new Error("O checkout sandbox aceita até 20 unidades por produto.");
    quantities.set(line.id, quantity);
  }
  if (quantities.size > 20) throw new Error("O checkout sandbox aceita até 20 produtos diferentes por pedido.");
  return [...quantities.entries()].map(([id, quantity]) => ({ id, quantity }));
}
