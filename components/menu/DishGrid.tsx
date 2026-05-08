"use client";

import type { CurrencyCode, Dish } from "@/lib/demoMenuData";
import { DishCard } from "@/components/menu/DishCard";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";

type DishGridProps = {
  dishes: Dish[];
  currency: CurrencyCode;
  categorySlug: string;
};

export function DishGrid({ dishes, currency, categorySlug }: DishGridProps) {
  const { isPhoneSimulation } = useDemoSimulation();

  return (
    <div
      id={`panel-${categorySlug}`}
      role="tabpanel"
      aria-labelledby={`tab-${categorySlug}`}
      className={
        isPhoneSimulation
          ? "grid grid-cols-1 gap-4 px-0 pb-6 pt-6"
          : "grid gap-4 px-4 py-5 sm:grid-cols-2 sm:gap-5 sm:px-5 sm:py-6 lg:grid-cols-3"
      }
    >
      {dishes.map((dish, index) => (
        <DishCard
          key={dish.id}
          dish={dish}
          currency={currency}
          priorityImage={index === 0}
        />
      ))}
    </div>
  );
}
