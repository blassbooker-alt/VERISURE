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
  imageAlt: name,
  category,
  price,
  description: "Item do catálogo de referência Fortalfy. Não representa uma oferta ativa de vendedor.",
  detail: "Este catálogo não está associado a lojas nem confirma preço, disponibilidade ou prazo de entrega.",
  specs: [`Categoria: ${category}`, "Preço, vendedor e disponibilidade não confirmados"],
  shades: [],
  sizes: [],
  tag: "REFERÊNCIA",
}));

const suppliedCatalog = [
  ["FS-WHEY-C900", "Whey Protein Concentrado 900g", "Suplementos · Proteínas", 129.9, 105, "FS-WHEY-C900.jpg", "Sabor", ["Chocolate", "Baunilha", "Morango"]],
  ["FS-WHEY-I900", "Whey Protein Isolado 900g", "Suplementos · Proteínas", 219.9, 45, "FS-WHEY-I900.jpg", "Sabor", ["Chocolate", "Baunilha", "Cookies"]],
  ["FS-CREA-300", "Creatina Monohidratada 300g", "Suplementos · Creatina", 89.9, 64, "FS-CREA-300.jpg", "Sabor", ["Natural (sem sabor)"]],
  ["FS-PRE-300", "Pré-Treino 300g", "Suplementos · Pré-Treino", 119.9, 57, "FS-PRE-300.jpg", "Sabor", ["Frutas Vermelhas", "Limão", "Uva"]],
  ["FS-BCAA-120", "BCAA 2:1:1 120 Cápsulas", "Suplementos · Aminoácidos", 69.9, 51, "FS-BCAA-120.jpg", "Apresentação", ["120 cápsulas"]],
  ["FS-PASTA-1KG", "Pasta de Amendoim Integral 1kg", "Suplementos · Alimentos Funcionais", 34.9, 87, "FS-PASTA-1KG.jpg", "Tipo", ["Integral"]],
  ["FS-MULTI-60", "Multivitamínico A-Z 60 Cápsulas", "Suplementos · Vitaminas", 54.9, 46, "FS-MULTI-60.jpg", "Apresentação", ["60 cápsulas"]],
  ["FS-COQ-600", "Coqueteleira 600ml com Misturador", "Acessórios · Hidratação", 24.9, 153, "FS-COQ-600.jpg", "Cor", ["Verde", "Preta", "Azul"]],
  ["FS-GARR-1L", "Garrafa Térmica Inox 1 Litro", "Acessórios · Hidratação", 79.9, 62, "FS-GARR-1L.jpg", "Cor", ["Verde Musgo", "Preta"]],
  ["FS-LUVA-TR", "Luva de Treino com Munhequeira", "Acessórios · Proteção", 49.9, 80, "FS-LUVA-TR.jpg", "Tamanho", ["P", "M", "G"]],
  ["FS-CINTO-MB", "Cinto Lombar de Musculação", "Acessórios · Proteção", 89.9, 44, "FS-CINTO-MB.jpg", "Tamanho", ["M", "G", "GG"]],
  ["FS-CORDA-PU", "Corda de Pular Ajustável com Rolamento", "Acessórios · Cardio", 29.9, 72, "FS-CORDA-PU.jpg", "Modelo", ["Único"]],
  ["FS-FAIXA-KIT5", "Kit 5 Faixas Elásticas (Mini Band) com Bolsa", "Acessórios · Elásticos", 59.9, 44, "FS-FAIXA-KIT5.jpg", "Kit", ["5 níveis de resistência"]],
  ["FS-HALT-5KG", "Par de Halteres Sextavados Emborrachados 5kg", "Equipamentos · Halteres", 149.9, 17, "FS-HALT-5KG.jpg", "Peso (par)", ["2 x 5 kg"]],
  ["FS-TAPETE-10", "Tapete de Ginástica EVA 10mm", "Equipamentos · Colchonetes", 59.9, 56, "FS-TAPETE-10.jpg", "Cor", ["Verde", "Preto"]],
  ["FS-FONE-TWS", "Fone de Ouvido Bluetooth TWS Esportivo", "Eletrônicos · Áudio", 149.9, 66, "FS-FONE-TWS.jpg", "Cor", ["Preto", "Verde Limão"]],
  ["FS-FONE-OVR", "Headphone Bluetooth Over-Ear Esportivo", "Eletrônicos · Áudio", 229.9, 32, "FS-FONE-OVR.jpg", "Cor", ["Preto/Verde", "Preto"]],
  ["FS-WATCH-PRO", "Smartwatch Fitness com GPS e Monitor Cardíaco", "Eletrônicos · Wearables", 599.9, 37, "FS-WATCH-PRO.jpg", "Pulseira", ["Preta", "Verde Limão"]],
  ["FS-BAND-5", "Smartband Monitor de Atividades e Sono", "Eletrônicos · Wearables", 199.9, 62, "FS-BAND-5.jpg", "Pulseira", ["Preta", "Verde Limão"]],
  ["FS-CINTA-FC", "Cinta Monitor de Frequência Cardíaca Bluetooth", "Eletrônicos · Wearables", 179.9, 42, "FS-CINTA-FC.jpg", "Tamanho", ["P/M", "G/GG"]],
  ["FS-BAL-BIO", "Balança de Bioimpedância Bluetooth", "Eletrônicos · Saúde e Medição", 189.9, 51, "FS-BAL-BIO.jpg", "Cor", ["Preta", "Branca"]],
  ["FS-SOM-BT", "Caixa de Som Bluetooth Portátil à Prova d'Água", "Eletrônicos · Áudio", 199.9, 28, "FS-SOM-BT.jpg", "Cor", ["Verde Musgo", "Preta"]],
  ["FS-MASS-GUN", "Massageador Muscular de Percussão com 4 Ponteiras", "Eletrônicos · Recuperação", 299.9, 24, "FS-MASS-GUN.jpg", "Cor", ["Preto"]],
  ["FS-POWER-10K", "Power Bank 10.000mAh Slim com Cabo USB-C", "Eletrônicos · Energia", 119.9, 48, "FS-POWER-10K.jpg", "Capacidade", ["10.000 mAh"]],
  ["FS-CORDA-DIG", "Corda de Pular Digital com Contador", "Eletrônicos · Cardio", 59.9, 39, "FS-CORDA-DIG.jpg", "Modelo", ["Único"]],
];

const suppliedProducts = suppliedCatalog.map(([sku, name, category, price, , image, variationName, variationValues]) => ({
  id: sku,
  sku,
  name,
  image: fortalfyAsset("produtos", image),
  imageAlt: name,
  category,
  price,
  description: "Item do catálogo de referência Fortalfy. Não representa uma oferta ativa de vendedor.",
  detail: "Produto do catálogo Fortalfy. Preço, disponibilidade e entrega ainda precisam ser confirmados pela loja antes de qualquer pedido.",
  specs: [`Código do produto: ${sku}`, `${variationName}: ${variationValues.join(", ")}`],
  variation: { name: variationName, values: variationValues },
  shades: [],
  sizes: [],
  tag: "REFERÊNCIA",
}));

shopProducts.push(...suppliedProducts);

const demoStoreDefinitions = [
  { name: "Vitrine demonstrativa · Nutrição", products: ["FS-WHEY-C900", "FS-CREA-300"] },
  { name: "Vitrine demonstrativa · Acessórios", products: ["FS-COQ-600", "FS-LUVA-TR"] },
  { name: "Vitrine demonstrativa · Tecnologia", products: ["FS-WATCH-PRO", "FS-MASS-GUN"] },
];

export const demoShopStores = demoStoreDefinitions.map(store => ({
  ...store,
  products: store.products.map(id => shopProducts.find(product => product.id === id)).filter(Boolean).map(product => ({
    ...product,
    id: `demo-${product.id}`,
    isDemo: true,
    demoStore: store.name,
    description: "Item ilustrativo para demonstração da vitrine FortalShop.",
    detail: "Esta vitrine é demonstrativa. O produto, o preço e a disponibilidade não representam uma oferta de venda ativa.",
    specs: [...product.specs, "Demonstração: sem vendedor ou disponibilidade confirmados"],
    tag: "DEMONSTRAÇÃO",
  })),
}));

const demoCatalog = [
  ["01_garrafa_agua.jpg", "Garrafa de Água Esportiva", "Acessórios", 39.9],
  ["02_coqueteleira.jpg", "Coqueteleira com Misturador", "Acessórios", 34.9],
  ["03_toalha_treino.jpg", "Toalha de Treino", "Acessórios", 29.9],
  ["04_luvas_treino.jpg", "Luvas para Musculação", "Acessórios", 49.9],
  ["05_straps_musculacao.jpg", "Straps para Musculação", "Acessórios", 39.9],
  ["06_faixas_elasticas.jpg", "Kit de Faixas Elásticas", "Acessórios", 59.9],
  ["07_corda_pular.jpg", "Corda de Pular com Rolamento", "Acessórios", 44.9],
  ["08_mochila_fitness.jpg", "Mochila Fitness", "Acessórios", 139.9],
  ["09_tapete_exercicios.jpg", "Tapete para Exercícios", "Acessórios", 89.9],
  ["10_munhequeiras.jpg", "Munhequeiras Esportivas", "Acessórios", 29.9],
  ["11_whey_baunilha.jpg", "Whey Protein Sabor Baunilha", "Nutrição", 129.9],
  ["12_barra_proteica_chocolate.jpg", "Barra Proteica de Chocolate", "Nutrição", 12.9],
  ["13_barra_cereais_aveia_mel.jpg", "Barra de Cereais Aveia e Mel", "Nutrição", 8.9],
  ["14_mix_castanhas.jpg", "Mix de Castanhas", "Nutrição", 19.9],
  ["15_pasta_amendoim.jpg", "Pasta de Amendoim Integral", "Nutrição", 29.9],
  ["16_eletrolitos.jpg", "Eletrólitos para Treino", "Nutrição", 9.9],
  ["17_bebida_isotonica.jpg", "Bebida Isotônica", "Nutrição", 7.9],
  ["18_granola_fitness.jpg", "Granola Fitness", "Nutrição", 24.9],
  ["19_cookies_proteicos.jpg", "Cookies Proteicos", "Nutrição", 14.9],
  ["20_marmita_fitness.jpg", "Marmita Fitness com Divisórias", "Acessórios", 69.9],
].map(([image, name, category, price], index) => ({
  id: `demo-gear-${index + 1}`,
  name,
  image: fortalfyAsset("shop-demo", image),
  imageAlt: name,
  category,
  price,
  isDemo: true,
  demoStore: "FortalShop · Acessórios e nutrição",
  description: "Produto demonstrativo inspirado no catálogo de acessórios e nutrição FortalShop.",
  detail: "Este item faz parte de uma apresentação demonstrativa. Nome, preço, vendedor e disponibilidade são referências visuais e não representam uma oferta ativa.",
  specs: [`Categoria: ${category}`, "Preço apenas para demonstração", "Venda e disponibilidade não confirmadas"],
  variation: null,
  tag: "DEMONSTRAÇÃO",
}));

const apparelProducts = [
  ["01", "Camiseta Performance Verde", "Roupas", 89.9],
  ["02", "Regata Performance Preta", "Roupas", 79.9],
  ["03", "Camiseta Oversized Off-white", "Roupas", 99.9],
  ["04", "Camiseta Técnica Verde", "Roupas", 89.9],
  ["05", "Short Esportivo Preto", "Roupas", 89.9],
  ["06", "Short Biker Verde", "Roupas", 79.9],
  ["07", "Calça Jogger Preta", "Roupas", 139.9],
  ["08", "Jaqueta Corta-vento", "Roupas", 169.9],
  ["09", "Top Esportivo de Sustentação", "Roupas", 89.9],
  ["10", "Legging Performance Verde", "Roupas", 119.9],
].map(([code, name, category, price]) => {
  const photo = number => fortalfyAsset("shop-demo", `produto_${code}_foto_${number}.jpg`);
  return {
    id: `demo-apparel-${code}`,
    name,
    image: photo(1),
    imageAlt: name,
    gallery: [photo(1), photo(2), photo(3)],
    category,
    price,
    isDemo: true,
    demoStore: "FortalShop · Vestuário",
    description: "Peça demonstrativa da coleção de vestuário FortalShop.",
    detail: "Este item faz parte de uma apresentação demonstrativa. Nome, preço, vendedor e disponibilidade são referências visuais e não representam uma oferta ativa.",
    specs: ["Coleção demonstrativa FortalShop", "Preço apenas para demonstração", "Venda e disponibilidade não confirmadas"],
    variation: { name: "Tamanho", values: ["P", "M", "G", "GG"] },
    tag: "DEMONSTRAÇÃO",
  };
});

export const demoShopProducts = [...demoCatalog, ...apparelProducts];

export function getShopDepartment(product) {
  return product.category.split(/[·>]/, 1)[0].trim();
}

function normalizeShopSearchText(value) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function filterShopProducts(products, { search = "", category = "Todas", sort = "recommended" } = {}) {
  const searchTerms = normalizeShopSearchText(search).trim().split(/\s+/).filter(Boolean);
  const filtered = products.filter(product => {
    const matchesCategory = category === "Todas" || getShopDepartment(product) === category;
    const searchableText = normalizeShopSearchText(`${product.name} ${product.category} ${product.sku || ""}`);
    return matchesCategory && searchTerms.every(term => searchableText.includes(term));
  });

  if (sort === "price-asc") return filtered.sort((first, second) => first.price - second.price);
  if (sort === "price-desc") return filtered.sort((first, second) => second.price - first.price);
  if (sort === "name") return filtered.sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
  return filtered;
}

export const shopOffers = [
  { id: "supplements", title: "Suplementos", image: fortalfyAsset("produtos", "FS-WHEY-C900.jpg"), productId: "FS-WHEY-C900" },
  { id: "training", title: "Acessórios de treino", image: fortalfyAsset("produtos", "FS-FAIXA-KIT5.jpg"), productId: "FS-FAIXA-KIT5" },
  { id: "technology", title: "Tecnologia fitness", image: fortalfyAsset("produtos", "FS-WATCH-PRO.jpg"), productId: "FS-WATCH-PRO" },
  { id: "recovery", title: "Recovery", image: fortalfyAsset("produtos", "FS-MASS-GUN.jpg"), productId: "FS-MASS-GUN" },
];
