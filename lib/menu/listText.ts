export function capitalizeListItem(value: string): string {
  const item = value.trim();
  if (!item) return "";

  const firstLetterIndex = item.search(/\p{L}/u);
  if (firstLetterIndex < 0) return item;

  return (
    item.slice(0, firstLetterIndex) +
    item[firstLetterIndex].toLocaleUpperCase("fr-CA") +
    item.slice(firstLetterIndex + 1)
  );
}

export function capitalizeListItems(items: string[]): string[] {
  return items.map(capitalizeListItem);
}
