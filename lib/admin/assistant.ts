import "server-only";

import { generateMistralAdminAssistantAnswer } from "@/lib/ai/mistral";
import {
  buildRuleBasedAdminAssistantAnswer,
  buildRuleBasedAdminRecommendations,
  containsForbiddenAdminAssistantContent,
  containsForbiddenBusinessMetric,
  isAdminAssistantQuestionInScope,
  isMenuAuditQuestion
} from "@/lib/admin/recommendations";
import { getRestaurantInsights } from "@/lib/analytics/insights";
import type { AdminRecommendation } from "@/lib/demoAdminInsights";

export type AdminAssistantMode = "summary" | "question";

export type AdminAssistantResult = {
  answer: string;
  source: "mistral" | "rules" | "blocked";
  recommendations: AdminRecommendation[];
  dataSource: "real" | "partial" | "empty" | "preview";
};

const MAX_QUESTION_LENGTH = 220;

function normalizeQuestion(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_LENGTH);
}

function metricValue(
  insights: Awaited<ReturnType<typeof getRestaurantInsights>>["insights"],
  id: string,
  fallback = "Non suivi"
): string {
  return insights.summary.find((item) => item.id === id)?.value ?? fallback;
}

export function validateAdminAssistantRequest(input: unknown):
  | {
      ok: true;
      mode: AdminAssistantMode;
      question: string;
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Question invalide." };
  }

  const candidate = input as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (keys.some((key) => key !== "mode" && key !== "question")) {
    return { ok: false, error: "Question invalide." };
  }
  if (candidate.mode !== "summary" && candidate.mode !== "question") {
    return { ok: false, error: "Question invalide." };
  }
  const mode = candidate.mode === "summary" ? "summary" : "question";
  const question = normalizeQuestion(candidate.question);

  if (mode === "question" && !question) {
    return { ok: false, error: "Posez une question courte sur l'activité du menu." };
  }

  if (mode === "question" && !isAdminAssistantQuestionInScope(question)) {
    return {
      ok: true,
      mode,
      question
    };
  }

  return {
    ok: true,
    mode,
    question
  };
}

export async function getAdminAssistantAnswer(args: {
  restaurantId: string;
  mode: AdminAssistantMode;
  question?: string;
  allowMistral?: boolean;
}): Promise<AdminAssistantResult> {
  const result = await getRestaurantInsights(args.restaurantId);
  const insights = result.insights;
  const recommendations = buildRuleBasedAdminRecommendations(insights);
  const question = normalizeQuestion(args.question);

  if (result.source !== "real") {
    return {
      answer:
        "Pas encore assez d’activité réelle pour répondre de façon fiable. Les tendances apparaîtront après davantage de consultations du menu.",
      source: "rules",
      recommendations: [],
      dataSource: result.source
    };
  }
  const isBlocked =
    args.mode === "question" &&
    (!isAdminAssistantQuestionInScope(question) || isMenuAuditQuestion(question));

  if (isBlocked) {
    return {
      answer: buildRuleBasedAdminAssistantAnswer({
        insights,
        mode: "question",
        question
      }),
      source: "blocked",
      recommendations,
      dataSource: result.source
    };
  }

  const fallbackAnswer = buildRuleBasedAdminAssistantAnswer({
    insights,
    mode: args.mode,
    question
  });

  if (!args.allowMistral) {
    return {
      answer: fallbackAnswer,
      source: "rules",
      recommendations,
      dataSource: result.source
    };
  }

  const mistral = await generateMistralAdminAssistantAnswer({
    restaurantName: insights.generatedFor,
    mode: args.mode,
    question: args.mode === "question" ? question : undefined,
    menuOpens: metricValue(insights, "menu-opens"),
    anonymousSessions: metricValue(insights, "anonymous-sessions"),
    topDishes: insights.topDishes.slice(0, 6).map((item) => ({
      name: item.dish.name,
      views: item.views,
      immersiveInteractions: item.immersiveInteractions,
      interestScore: item.interestScore,
      interestLevel: item.interestLevel
    })),
    topSearches: insights.searchInsights.slice(0, 6).map((item) => ({
      term: item.term,
      count: item.count,
      interpretation: item.interpretation
    })),
    immersiveUsage: metricValue(insights, "immersive-views"),
    popularCategory: metricValue(insights, "top-category"),
    opportunities: recommendations
      .filter(
        (item) =>
          !containsForbiddenAdminAssistantContent(
            `${item.type} ${item.title} ${item.body}`
          )
      )
      .map((item) => ({
        type: item.type,
        title: item.title,
        body: item.body
      }))
  });

  if (
    mistral?.answer &&
    !containsForbiddenBusinessMetric(mistral.answer) &&
    !containsForbiddenAdminAssistantContent(mistral.answer)
  ) {
    return {
      answer: mistral.answer,
      source: "mistral",
      recommendations,
      dataSource: result.source
    };
  }

  return {
    answer: fallbackAnswer,
    source: "rules",
    recommendations,
    dataSource: result.source
  };
}
