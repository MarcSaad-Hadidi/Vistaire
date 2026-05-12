import {
  getAllDishes,
  getCategories,
  type Category,
  type Dish
} from "@/lib/demoMenuData";

export type InterestLevel = "Très fort" | "Bon" | "À observer" | "Plus discret";

export type SearchTrend = "En hausse" | "Stable" | "À observer";

export type RecommendationType =
  | "Fort intérêt"
  | "Signal client"
  | "Tendance du service"
  | "À observer"
  | "Moment fort"
  | "Attention client"
  | "Recherche fréquente"
  | "Vue immersive";

export type AdminSummaryMetric = {
  id: string;
  label: string;
  value: string;
  helper: string;
};

export type TopDishInsight = {
  rank: number;
  dish: Dish;
  category: Category;
  views: number;
  averageTime: string;
  immersiveInteractions: number;
  interestScore: number;
  interestLevel: InterestLevel;
};

export type SearchInsight = {
  term: string;
  count: number;
  trend: SearchTrend;
  interpretation?: string;
};

export type ImmersiveInsight = {
  label: string;
  value: string;
  helper: string;
};

export type ServiceActivity = {
  label: string;
  count: number;
  share: number;
  detail: string;
};

export type EngagementFunnelStep = {
  id: string;
  label: string;
  value: number;
  share: number;
  helper: string;
};

export type AdminRecommendation = {
  type: RecommendationType;
  title: string;
  body: string;
};

export type DemoAdminInsights = {
  generatedFor: string;
  serviceLabel: string;
  dailySummary: string;
  summary: AdminSummaryMetric[];
  topDishes: TopDishInsight[];
  searchInsights: SearchInsight[];
  immersiveInsights: ImmersiveInsight[];
  engagementFunnel: EngagementFunnelStep[];
  serviceActivity: ServiceActivity[];
  recommendations: AdminRecommendation[];
};

const DEMO_ADMIN_CONTEXT = {
  restaurantName: "Maison Élyse",
  serviceLabel: "Aujourd’hui · Service du soir"
} as const;

const TOP_DISHES: Array<
  Omit<TopDishInsight, "rank" | "dish" | "category"> & { slug: string }
> = [
  {
    slug: "homard-bisque",
    views: 148,
    averageTime: "48 s",
    immersiveInteractions: 41,
    interestScore: 100,
    interestLevel: "Très fort"
  },
  {
    slug: "souffle-chocolat",
    views: 121,
    averageTime: "44 s",
    immersiveInteractions: 29,
    interestScore: 92,
    interestLevel: "Très fort"
  },
  {
    slug: "ravioles-romarin",
    views: 94,
    averageTime: "36 s",
    immersiveInteractions: 17,
    interestScore: 67,
    interestLevel: "Bon"
  },
  {
    slug: "cocktail-maison-elyse",
    views: 76,
    averageTime: "29 s",
    immersiveInteractions: 12,
    interestScore: 56,
    interestLevel: "Bon"
  },
  {
    slug: "negroni-fut",
    views: 21,
    averageTime: "17 s",
    immersiveInteractions: 0,
    interestScore: 24,
    interestLevel: "À observer"
  }
];

const SEARCH_INSIGHTS: SearchInsight[] = [
  {
    term: "sans gluten",
    count: 18,
    trend: "En hausse",
    interpretation: "Préférences alimentaires présentes"
  },
  {
    term: "homard",
    count: 15,
    trend: "En hausse",
    interpretation: "Fort intérêt signature"
  },
  {
    term: "dessert",
    count: 13,
    trend: "En hausse",
    interpretation: "Intérêt en fin de repas"
  },
  {
    term: "végétarien",
    count: 9,
    trend: "À observer",
    interpretation: "Préférence alimentaire suivie"
  },
  {
    term: "cocktail",
    count: 8,
    trend: "Stable",
    interpretation: "Attention en fin de soirée"
  }
];

const SERVICE_ACTIVITY: ServiceActivity[] = [
  {
    label: "Midi",
    count: 82,
    share: 28,
    detail: "Ouvertures calmes, surtout entrées et options plus légères."
  },
  {
    label: "Après-midi",
    count: 34,
    share: 12,
    detail: "Consultations courtes avant le service du soir."
  },
  {
    label: "Souper",
    count: 132,
    share: 46,
    detail: "Pic d'intérêt sur les plats signatures et desserts."
  },
  {
    label: "Fin de soirée",
    count: 41,
    share: 14,
    detail: "Desserts et cocktails reviennent dans les consultations tardives."
  }
];

const RECOMMENDATIONS: AdminRecommendation[] = [
  {
    type: "Fort intérêt",
    title: "Le Homard bleu attire le plus d'attention aujourd'hui.",
    body: "Les clients ouvrent souvent sa fiche et utilisent la vue immersive pendant le souper."
  },
  {
    type: "Recherche fréquente",
    title: "Les recherches « sans gluten » reviennent souvent.",
    body: "C'est un signal d'intérêt client à suivre pendant le service."
  },
  {
    type: "Moment fort",
    title: "Le Soufflé chocolat génère beaucoup d'intérêt après les plats principaux.",
    body: "L'attention client augmente sur les desserts en fin de repas."
  }
];

function findDish(slug: string, dishes: Dish[]): Dish {
  const dish = dishes.find((candidate) => candidate.slug === slug);
  if (!dish) {
    throw new Error(`Demo admin insight references an unknown dish: ${slug}`);
  }
  return dish;
}

function findCategory(slug: string, categories: Category[]): Category {
  const category = categories.find((candidate) => candidate.slug === slug);
  if (!category) {
    throw new Error(`Demo admin insight references an unknown category: ${slug}`);
  }
  return category;
}

export function getDemoAdminInsights(): DemoAdminInsights {
  const dishes = getAllDishes();
  const categories = getCategories();
  const topCategory = findCategory("plats-signatures", categories);
  const topDish = findDish("homard-bisque", dishes);
  const mostExploredDish = findDish("homard-bisque", dishes);

  const topDishes = TOP_DISHES.map((item, index) => {
    const dish = findDish(item.slug, dishes);
    return {
      rank: index + 1,
      dish,
      category: findCategory(dish.categorySlug, categories),
      views: item.views,
      averageTime: item.averageTime,
      immersiveInteractions: item.immersiveInteractions,
      interestScore: item.interestScore,
      interestLevel: item.interestLevel
    };
  });

  return {
    generatedFor: DEMO_ADMIN_CONTEXT.restaurantName,
    serviceLabel: DEMO_ADMIN_CONTEXT.serviceLabel,
    dailySummary:
      "Les clients explorent surtout les plats signatures. Le Homard bleu et le Soufflé chocolat génèrent le plus d'intérêt, tandis que les recherches liées au sans gluten signalent une préférence alimentaire à suivre.",
    summary: [
      {
        id: "menu-opens",
        label: "Ouvertures du menu aujourd’hui",
        value: "248",
        helper: "Clients qui ont ouvert la carte Vistaire."
      },
      {
        id: "anonymous-sessions",
        label: "Sessions clients estimées",
        value: "173",
        helper: "Sessions anonymes observées sur le menu."
      },
      {
        id: "dish-views",
        label: "Plats consultés",
        value: "612",
        helper: "Fiches plats vues pendant le service."
      },
      {
        id: "searches",
        label: "Recherches effectuées",
        value: "43",
        helper: "Mots saisis dans la recherche du menu."
      },
      {
        id: "immersive-views",
        label: "Vues immersives",
        value: "87",
        helper: "Clients qui ont exploré un plat en détail."
      },
      {
        id: "ar-option-used",
        label: "« Afficher devant moi »",
        value: "31",
        helper: "Moments où un client a voulu projeter le plat à table."
      },
      {
        id: "top-dish",
        label: "Plat le plus consulté",
        value: topDish.name.replace(", bisque corsée & fenouil", ""),
        helper: "Le signal le plus fort du jour."
      },
      {
        id: "top-category",
        label: "Catégorie la plus populaire",
        value: topCategory.name,
        helper: "La section qui concentre le plus d’intérêt."
      }
    ],
    topDishes,
    searchInsights: SEARCH_INSIGHTS,
    immersiveInsights: [
      {
        label: "Clients qui ont ouvert une vue immersive",
        value: "87",
        helper: "Les plats que les clients prennent le temps d’explorer avant de choisir."
      },
      {
        label: "Clients qui ont utilisé « Afficher devant moi »",
        value: "31",
        helper: "Un signal fort d’envie et de projection à table."
      },
      {
        label: "Plat le plus exploré en vue immersive",
        value: mostExploredDish.name.replace(", bisque corsée & fenouil", ""),
        helper: "La signature marine domine les interactions du soir."
      },
      {
        label: "Taux d’utilisation immersive",
        value: "14 %",
        helper: "Part des consultations qui déclenchent une expérience avancée."
      }
    ],
    engagementFunnel: [
      {
        id: "menu-opened",
        label: "Menu ouvert",
        value: 248,
        share: 100,
        helper: "Ouvertures de la carte Vistaire."
      },
      {
        id: "category-viewed",
        label: "Sessions clients estimées",
        value: 173,
        share: 70,
        helper: "Sessions anonymes observées sur le menu."
      },
      {
        id: "dish-opened",
        label: "Vue immersive lancée",
        value: 87,
        share: 35,
        helper: "Clients qui explorent un plat en détail."
      },
      {
        id: "ar-option-used",
        label: "Afficher devant moi",
        value: 31,
        share: 13,
        helper: "Moments où un client projette le plat à table."
      }
    ],
    serviceActivity: SERVICE_ACTIVITY,
    recommendations: RECOMMENDATIONS
  };
}
