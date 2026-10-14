export const profile = {
  name: "Leblonjr",
  handle: "@Leblonjr",
  city: "Aldeota, Fortaleza — CE",
  gym: "Viva Fitness",
};

export const gyms = [
  {
    name: "Viva Fitness",
    image: "./assets/pass-hero-gym.jpg",
    tags: ["Musculação", "Funcional", "Mobilidade"],
  },
  {
    name: "Studio Viva",
    image: "./assets/pass-demo-gym-nextfit.jpg",
    tags: ["Treino funcional", "Pilates", "Aulas coletivas"],
  },
];

export const restaurants = [
  { name: "Green Fit Bowls", dish: "Bowl Proteico", kcal: 520, protein: 35, image: "./assets/food-bowl.jpg", tag: "Alto em proteína" },
  { name: "Fit Prime", dish: "Frango grelhado", kcal: 480, protein: 42, image: "./assets/food-grilled-chicken.jpg", tag: "Perfil nutricional a confirmar" },
  { name: "Viva Saladas", dish: "Salada Power", kcal: 350, protein: 28, image: "./assets/food-salad.jpg", tag: "Leve e nutritiva" },
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

export const courseList = [
  { title: "Alimentação Inteligente", subtitle: "Monte uma rotina que funciona", category: "Nutrição", image: "./assets/food-salad.jpg" },
  { title: "Rotina que Funciona", subtitle: "Hábitos simples, evolução constante", category: "Rotina", image: "./assets/fortalfy-movimento.svg" },
];
