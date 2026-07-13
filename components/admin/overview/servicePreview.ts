type ServiceWindow = {
  id: string;
  count: number;
};

export function buildServicePreview(windows: readonly ServiceWindow[]) {
  const total = (...ids: string[]) => windows
    .filter((item) => ids.includes(item.id))
    .reduce((sum, item) => sum + item.count, 0);

  return [
    { label: "Déjeuner", value: total("breakfast", "lunch") },
    { label: "Après-midi", value: total("afternoon") },
    { label: "Dîner", value: total("dinner", "overnight") },
  ];
}
