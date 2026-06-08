import "server-only";

import type { OwnerRecommendation } from "@/lib/owner/types";
import { containsForbiddenAdminAssistantContent } from "@/lib/admin/recommendations";
import type { MenuStyleAdvisorInput } from "@/lib/menu/menuStyleAdvisor";

type MistralRecommendationPayload = {
  restaurants: Array<{
    name: string;
    status: string;
    openingsToday: number;
    interactionsToday: number;
    dishCount: number;
    lastActivity: string;
  }>;
  stats: {
    totalRestaurants: number;
    menuOpensToday: number;
    dishViewsToday: number;
    immersiveInteractionsToday: number;
  };
};

export type AdminAssistantMistralPayload = {
  restaurantName: string;
  mode: "summary" | "question";
  question?: string;
  menuOpens: string;
  anonymousSessions: string;
  topDishes: Array<{
    name: string;
    views: number;
    immersiveInteractions: number;
    interestScore?: number;
    interestLevel: string;
  }>;
  topSearches: Array<{
    term: string;
    count: number;
    interpretation?: string;
  }>;
  immersiveUsage: string;
  popularCategory: string;
  opportunities: Array<{
    type: string;
    title: string;
    body: string;
  }>;
};

export type AdminAssistantMistralResult = {
  answer: string;
  recommendations?: Array<{
    type: string;
    title: string;
    body: string;
  }>;
};

export type MistralMenuStyleAdvisorResult = Record<string, unknown>;

function parseRecommendations(content: string): OwnerRecommendation[] | null {
  const trimmed = content.trim();
  const jsonStart = trimmed.indexOf("[");
  const jsonEnd = trimmed.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd < jsonStart) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed)) return null;

    return parsed.slice(0, 5).flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
      const body = typeof candidate.body === "string" ? candidate.body.trim() : "";
      const type = typeof candidate.type === "string" ? candidate.type : "opportunity";

      if (!title || !body) return [];
      if (!["opportunity", "watch", "setup", "upsell"].includes(type)) return [];

      return [
        {
          id: `mistral-${index}`,
          title: title.slice(0, 140),
          body: body.slice(0, 260),
          type: type as OwnerRecommendation["type"],
          restaurantName:
            typeof candidate.restaurantName === "string"
              ? candidate.restaurantName.slice(0, 120)
              : undefined,
          source: "mistral" as const
        }
      ];
    });
  } catch {
    return null;
  }
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < jsonStart) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function cleanAssistantText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function includesForbiddenMetric(value: string): boolean {
  return /vente|ventes|vendu|vendus|revenu|revenus|profit|profits|commande|commandes|commandé|commandee|commandée|demandé|demandee|demandée|panier moyen|ticket moyen|chiffre d'affaires|ca\b|marge|rentabilite|rentabilité|conversion|roi|recette|couverts|satisfaction|avis|note|rating|réservation|reservation|sales|orders|revenue|profit/i.test(
    value
  );
}

function parseAdminAssistantResult(
  content: string
): AdminAssistantMistralResult | null {
  const parsed = parseJsonObject(content);
  if (!parsed) return null;

  const answer = cleanAssistantText(parsed.answer, 700);
  if (
    !answer ||
    includesForbiddenMetric(answer) ||
    containsForbiddenAdminAssistantContent(answer)
  ) {
    return null;
  }

  const rawRecommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
    : [];
  const recommendations = rawRecommendations.slice(0, 5).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const type = cleanAssistantText(candidate.type, 42);
    const title = cleanAssistantText(candidate.title, 140);
    const body = cleanAssistantText(candidate.body, 260);
    if (!type || !title || !body) return [];
    if (
      includesForbiddenMetric(`${type} ${title} ${body}`) ||
      containsForbiddenAdminAssistantContent(`${type} ${title} ${body}`)
    ) {
      return [];
    }
    return [{ type, title, body }];
  });

  return {
    answer,
    ...(recommendations.length ? { recommendations } : {})
  };
}

export async function generateMistralOwnerRecommendations(
  payload: MistralRecommendationPayload
): Promise<OwnerRecommendation[] | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  const model = process.env.MISTRAL_MODEL || "mistral-large-latest";

  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "Tu aides le propriétaire de Vistaire à prioriser ses restaurants. Réponds seulement avec un tableau JSON. N'utilise aucune donnée personnelle. Types permis: opportunity, watch, setup, upsell."
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction:
                "Génère 3 à 5 recommandations actionnables en français. Format: [{\"type\":\"opportunity|watch|setup|upsell\",\"title\":\"...\",\"body\":\"...\",\"restaurantName\":\"...\"}].",
              signals: payload
            })
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("[Vistaire owner] Mistral unavailable", response.status);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    return content ? parseRecommendations(content) : null;
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    console.error("[Vistaire owner] Mistral fallback", reason);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateMistralAdminAssistantAnswer(
  payload: AdminAssistantMistralPayload
): Promise<AdminAssistantMistralResult | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  const model = process.env.MISTRAL_MODEL || "mistral-large-latest";

  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 520,
        messages: [
          {
            role: "system",
            content:
              "Tu es Assistant Vistaire, un analyste premium du comportement client pour restaurant. Réponds seulement avec un objet JSON strict. Tu ne critiques jamais la construction du menu, son design, ses photos, ses images, sa clarté, ses catégories, ses libellés, sa mise en page ou sa configuration. Tu analyses uniquement ce que les clients font: consultations, recherches, clics, interactions immersives, moments d'activité et tendances d'attention. Tu ne dis jamais qu'un élément du menu est mal fait. Tu ne recommandes jamais de corriger ou d'améliorer le menu en termes de qualité. Tu ne déduis jamais la cause d'une attention faible: dis seulement qu'un élément reçoit moins d'attention dans les données disponibles. Tu ne parles jamais de ventes, revenus, profits, chiffre d'affaires, CA, marge, rentabilité, panier moyen, ticket moyen, conversion, ROI, satisfaction, avis, réservations, commandes ou intentions de commande sauf si ces données existent explicitement dans les signaux fournis. Ici, les signaux fournis ne contiennent pas de commandes. Tu ne dois jamais inventer de métrique. Si la question demande d'évaluer ou d'améliorer le menu, recadre vers la lecture du comportement client. Réponds en français, ton premium, clair, court et actionnable."
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction:
                "Retourne {\"answer\":\"réponse courte en français\", \"recommendations\":[{\"type\":\"Fort intérêt|Signal client|Tendance du service|À observer|Moment fort|Vue immersive|Recherche fréquente|Attention client\",\"title\":\"...\",\"body\":\"...\"}]}. Utilise uniquement les agrégats anonymes fournis. Ne donne aucune critique, aucun diagnostic et aucune cause probable sur le menu, les photos, les catégories, la présentation, la clarté, la configuration ou les libellés. Si une donnée est absente, dis-le sobrement. Si la question demande comment améliorer le menu, réponds: \"Je peux surtout vous aider à lire le comportement des clients\", puis donne une observation issue des signaux.",
              signals: payload
            })
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("[Vistaire admin] Mistral unavailable", response.status);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    return content ? parseAdminAssistantResult(content) : null;
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    console.error("[Vistaire admin] Mistral fallback", reason);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateMistralMenuStyleAdvice(
  payload: MenuStyleAdvisorInput
): Promise<MistralMenuStyleAdvisorResult | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  const model = process.env.MISTRAL_MODEL || "mistral-large-latest";

  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 1100,
        messages: [
          {
            role: "system",
            content:
              "Tu es Vistaire Menu Design Advisor. Tu ne generes jamais de plats, prix, ingredients, allergenes, photos, modeles 3D, disponibilites, descriptions de plats ou donnees metier nouvelles. Tu recommandes seulement theme, blueprint, layout, couleurs, typographie, densite, navigation, cards, detail, photos strategy, immersive strategy et UX parmi les whitelists fournies. Reponds uniquement en JSON strict."
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction:
                "Retourne {\"primary\":{\"theme\":\"...\",\"blueprint\":\"...\",\"configPatch\":{\"theme\":\"...\",\"experience\":{},\"navigation\":{},\"cards\":{},\"detail\":{},\"photos\":{},\"immersive\":{}},\"reason\":\"...\",\"confidence\":0.0,\"warnings\":[\"...\"]},\"alternatives\":[{\"theme\":\"...\",\"blueprint\":\"...\",\"configPatch\":{\"theme\":\"...\",\"experience\":{},\"navigation\":{},\"cards\":{},\"detail\":{},\"photos\":{},\"immersive\":{}},\"reason\":\"...\",\"confidence\":0.0,\"bestFor\":\"...\"}],\"analysis\":{\"restaurantType\":\"...\",\"dataSignals\":[\"...\"],\"photoReadiness\":\"none|low|partial|good\",\"immersiveReadiness\":\"none|partial|ready\",\"menuSize\":0,\"recommendedDirection\":\"...\"}}. N'inclus jamais dish, dishes, item, items, menuItem, menuItems, generatedMenu, generatedDishes, price, prices, ingredient, ingredients, allergen, allergens, availability, photoUrl, modelUrl ou description de plat.",
              allowedOutput:
                "theme, experience, navigation, cards, detail, photos strategy, immersive strategy only",
              signals: payload
            })
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("[Vistaire owner] Mistral menu style advisor unavailable", response.status);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    return content ? parseJsonObject(content) : null;
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    console.error("[Vistaire owner] Mistral menu style advisor fallback", reason);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
