import type {
  AdminMetricState,
  ProductionAdminMetricScope
} from "../../lib/admin/data/contracts";

const productionScope: ProductionAdminMetricScope = {
  restaurantId: "restaurant",
  menuId: "menu",
  source: "production",
  timezone: "America/Toronto" as ProductionAdminMetricScope["timezone"]
};
void productionScope;

declare const state: AdminMetricState<number>;
if (state.kind === "available") {
  state.value satisfies number;
} else {
  // @ts-expect-error negative metric states never carry values
  void state.value;
}

// @ts-expect-error production repositories never accept demo scope
const demoScope: ProductionAdminMetricScope = { ...productionScope, source: "demo" };
void demoScope;
