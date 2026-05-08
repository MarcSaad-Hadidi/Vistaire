import { DemoMenuClient } from "@/components/menu/DemoMenuClient";
import { MenuHero } from "@/components/menu/MenuHero";
import {
  getAllDishes,
  getCategories,
  getRestaurant
} from "@/lib/demoMenuData";

export default function DemoPage() {
  const restaurant = getRestaurant();
  const categories = getCategories();
  const dishes = getAllDishes();

  return (
    <>
      <MenuHero restaurant={restaurant} />
      <DemoMenuClient
        categories={categories}
        dishes={dishes}
        currency={restaurant.currency}
      />
    </>
  );
}
