import { fortalfyAsset } from "./assetPath.js";

export const profile = {
  name: "Leblonjr",
  handle: "@Leblonjr",
  city: "Aldeota, Fortaleza — CE",
  gym: "Viva Fitness",
};

export const gyms = [
  {
    name: "Espaço de demonstração",
    image: fortalfyAsset("publicidade", "03-fortalpass-academia.jpg"),
    tags: ["Musculação", "Funcional", "Mobilidade"],
  },
  {
    name: "Studio demonstrativo",
    image: fortalfyAsset("publicidade", "banner-comunidade.jpg"),
    tags: ["Treino funcional", "Pilates", "Aulas coletivas"],
  },
];

export const restaurants = [
  { name: "Cardápio demonstrativo · 01", dish: "Bowl proteico de frango", category: "Proteínas", image: fortalfyAsset("food", "bowl-proteico-frango.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 02", dish: "Bowl de salmão", category: "Proteínas", image: fortalfyAsset("food", "bowl-salmao.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 03", dish: "Frango grelhado", category: "Marmitas fitness", image: fortalfyAsset("food", "frango-grelhado.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 04", dish: "Salada power", category: "Vegetarianos", image: fortalfyAsset("food", "salada-power.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 05", dish: "Marmita low carb", category: "Marmitas fitness", image: fortalfyAsset("food", "marmita-low-carb.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 06", dish: "Açaí proteico", category: "Sobremesas", image: fortalfyAsset("food", "acai-proteico.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 07", dish: "Panqueca proteica", category: "Lanches", image: fortalfyAsset("food", "pan-ca-proteica.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 08", dish: "Smoothie verde", category: "Bebidas", image: fortalfyAsset("food", "smoothie-verde.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 09", dish: "Wrap de frango", category: "Lanches", image: fortalfyAsset("food", "wrap-frango.jpg"), tag: "Prato ilustrativo" },
  { name: "Cardápio demonstrativo · 10", dish: "Frutas e castanhas", category: "Lanches", image: fortalfyAsset("food", "snack-frutas-castanhas.jpg"), tag: "Prato ilustrativo" },
];

export const clients = [
  { name: "Mariana Costa", goal: "Condicionamento", weight: "68 kg", adherence: 92, last: "Hoje, 06:30", status: "Em dia", initials: "MC" },
  { name: "Rafael Lima", goal: "Hipertrofia", weight: "81 kg", adherence: 74, last: "Ontem, 18:10", status: "Atenção", initials: "RL" },
  { name: "Camila Rocha", goal: "Mais disposição", weight: "59 kg", adherence: 87, last: "Hoje, 07:15", status: "Em dia", initials: "CR" },
];

export const workoutExercises = [
  { name: "Supino reto", details: "4 séries × 12 repetições", load: "60 kg" },
  { name: "Crucifixo inclinado", details: "3 séries × 15 repetições", load: "14 kg" },
  { name: "Flexão", details: "3 séries até a falha", load: "Peso corporal" },
];

export const workoutCategories = [
  { name: "Força", image: fortalfyAsset("treino", "07-treino-forca.jpg") },
  { name: "Cardio", image: fortalfyAsset("treino", "08-treino-cardio.jpg") },
  { name: "Yoga e mobilidade", image: fortalfyAsset("treino", "09-treino-yoga-mobilidade.jpg") },
  { name: "Recovery", image: fortalfyAsset("treino", "10-treino-recovery.jpg") },
];

export const courseList = [
  { title: "Alimentação Inteligente", subtitle: "Monte uma rotina que funciona", category: "Nutrição", image: "./assets/food-salad.jpg" },
  { title: "Rotina que Funciona", subtitle: "Hábitos simples, evolução constante", category: "Rotina", image: "./assets/fortalfy-movimento.svg" },
];
