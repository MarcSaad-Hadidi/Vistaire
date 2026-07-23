import type { DisplayPriceMode } from "@/lib/owner/price";
import type { CreateRestaurantDishPhotoStatus } from "@/lib/owner/types";

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
  tags: string[];
  options: string[];
  chefNote: string;
  available: boolean;
  photoStatus: CreateRestaurantDishPhotoStatus;
};
