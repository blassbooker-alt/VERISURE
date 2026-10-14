import { fortalfyAsset } from "./assetPath.js";

const catalog = [
  ["performance-tee", "camiseta-performance-preta", "Camiseta Performance Preta", "Roupas", 89.9],
  ["performance-tee-white", "camiseta-performance-branca", "Camiseta Performance Branca", "Roupas", 89.9],
  ["performance-tee-green", "camiseta-performance-verde", "Camiseta Performance Verde", "Roupas", 89.9],
  ["cropped-lime", "camiseta-cropped-lima", "Camiseta Cropped Lima", "Roupas", 79.9],
  ["training-tank", "regata-treino-grafite", "Regata de Treino Grafite", "Roupas", 79.9],
  ["thermal-bottle", "garrafa-termica-750ml-verde", "Garrafa Térmica 750 ml", "Acessórios", 69.9],
  ["thermal-bottle-500", "garrafa-termica-500ml-lima", "Garrafa Térmica 500 ml", "Acessórios", 59.9],
  ["thermal-cup-black", "copo-termico-preto", "Copo Térmico Preto", "Acessórios", 69.9],
  ["protein-shaker", "shaker-proteina-verde", "Shaker Verde", "Acessórios", 39.9],
  ["reusable-cup", "copo-reutilizavel-branco", "Copo Reutilizável Branco", "Acessórios", 39.9],
  ["training-mat", "tapete-yoga-verde", "Tapete de Yoga Verde", "Treino em casa", 89.9],
  ["resistance-band", "faixa-resistencia-lima", "Faixa de Resistência Lima", "Treino em casa", 29.9],
  ["mini-bands", "mini-bands-kit", "Kit Mini Bands", "Treino em casa", 49.9],
  ["jump-rope", "corda-pular-preta", "Corda de Pular Preta", "Treino em casa", 29.9],
  ["training-gloves", "luvas-treino-grafite", "Luvas de Treino Grafite", "Acessórios", 49.9],
  ["foam-roller", "rolo-miofascial-verde", "Rolo Miofascial Verde", "Recovery", 89.9],
  ["massage-ball", "bola-massagem-lima", "Bola de Massagem Lima", "Recovery", 29.9],
  ["yoga-block", "bloco-yoga-areia", "Bloco de Yoga Areia", "Recovery", 29.9],
  ["performance-towel", "toalha-performance-branca", "Toalha Performance Branca", "Acessórios", 29.9],
  ["wellness-pouch", "necessaire-wellness-verde", "Necessaire Wellness Verde", "Wellness", 59.9],
  ["starter-kit", "kit-comeco-forte", "Kit Começo Forte", "Kits Fortalfy", 149.9],
  ["home-training-kit", "kit-treino-casa", "Kit Treino em Casa", "Kits Fortalfy", 179.9],
  ["recovery-kit", "kit-recovery-total", "Kit Recovery Total", "Kits Fortalfy", 249.9],
  ["hydration-kit", "kit-hidratacao", "Kit Hidratação", "Kits Fortalfy", 129.9],
  ["wellness-gift-kit", "kit-presente-wellness", "Kit Presente Wellness", "Kits Fortalfy", 199.9],
];

export const shopProducts = catalog.map(([id, file, name, category, price]) => ({
  id,
  name,
  image: fortalfyAsset("produtos", `${file}.jpg`),
  imageAlt: `${name} · imagem de demonstração`,
  category,
  price,
  description: "Item e dados comerciais ilustrativos; disponibilidade não confirmada.",
  detail: "Imagem fornecida para demonstração. Materiais, especificações, variações, vendedor e condições de compra ainda precisam ser confirmados.",
  specs: ["Dados de produto não confirmados", "Estoque, entrega e troca indisponíveis"],
  shades: [],
  sizes: [],
  official: false,
  localDelivery: false,
  tag: "DEMONSTRAÇÃO",
}));

export const shopOffers = [
  { id: "tee", title: "Coleção de camisetas", image: fortalfyAsset("ofertas", "oferta-camiseta.jpg"), productId: "performance-tee" },
  { id: "bottle", title: "Ideias para hidratação", image: fortalfyAsset("ofertas", "oferta-garrafa.jpg"), productId: "thermal-bottle" },
  { id: "kit", title: "Kits para movimento", image: fortalfyAsset("ofertas", "oferta-kit.jpg"), productId: "starter-kit" },
  { id: "recovery", title: "Cuidados de recovery", image: fortalfyAsset("ofertas", "oferta-recovery.jpg"), productId: "recovery-kit" },
];
