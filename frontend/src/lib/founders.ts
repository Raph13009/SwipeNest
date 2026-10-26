export type Founder = {
  id: string;
  name: string;
  role: { en: string; fr: string };
  detail: { en: string; fr: string };
  location: string;
  initials: string;
  accent: string;
};

export const FOUNDERS: Founder[] = [
  {
    id: "raphael",
    name: "Raphaël Levy",
    role: {
      en: "Product & Business",
      fr: "Product & Business",
    },
    detail: {
      en: "ESSEC–CentraleSupélec · OPOPA",
      fr: "ESSEC–CentraleSupélec · OPOPA",
    },
    location: "Paris",
    initials: "RL",
    accent: "#1B4D3E",
  },
  {
    id: "carla",
    name: "Carla Boubal",
    role: {
      en: "Legal · IP/IT",
      fr: "Juridique · IP/IT",
    },
    detail: {
      en: "IP/IT Legal Apprentice at Thales",
      fr: "Apprentie juriste IP/IT chez Thales",
    },
    location: "Versailles",
    initials: "CB",
    accent: "#5F736B",
  },
  {
    id: "camille",
    name: "Camille Flé",
    role: {
      en: "Urban & Product Strategy",
      fr: "Stratégie urbaine & produit",
    },
    detail: {
      en: "ESSEC MUI · Sorbonne Université",
      fr: "ESSEC MUI · Sorbonne Université",
    },
    location: "Paris",
    initials: "CF",
    accent: "#A7C4B8",
  },
  {
    id: "laetitia",
    name: "Laetitia Richaume",
    role: {
      en: "New Business & Growth",
      fr: "New Business & Growth",
    },
    detail: {
      en: "Publicis Media · ESSEC & EDHEC",
      fr: "Publicis Media · ESSEC & EDHEC",
    },
    location: "France",
    initials: "LR",
    accent: "#2F6B57",
  },
  {
    id: "solenn",
    name: "Solenn Fondeur",
    role: {
      en: "Strategy & Operations",
      fr: "Stratégie & Opérations",
    },
    detail: {
      en: "ESSEC Business School",
      fr: "ESSEC Business School",
    },
    location: "Paris",
    initials: "SF",
    accent: "#C89A9E",
  },
];
