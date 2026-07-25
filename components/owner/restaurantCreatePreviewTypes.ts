import type { DisplayPriceMode } from "@/lib/owner/price";
import type { CreateRestaurantDishPhotoStatus } from "@/lib/owner/types";
import type { DishAllergenDeclaration } from "@/lib/menu/allergens";

export type DraftSection = {
  id: string;
  name: string;
  description: string;
};

export type DraftDish = {
  id: string;
  name: string;
  section: string;
  price: string;
  displayPriceMode: DisplayPriceMode;
  description: string;
  imageUrl: string;
  ingredients: string[];
  allergens: string[];
  customAllergens: string[];
  allergenDeclarations: DishAllergenDeclaration[];
  tags: string[];
  options: string[];
  chefNote: string;
  available: boolean;
  photoStatus: CreateRestaurantDishPhotoStatus;
};
