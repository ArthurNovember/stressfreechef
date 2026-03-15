export function formatScaledQuantity(value) {
  if (value == null || Number.isNaN(value)) return "";

  const rounded = Math.round(value * 100) / 100;

  if (Number.isInteger(rounded)) return String(rounded);

  return String(rounded).replace(".", ",");
}

export function getScaledIngredients(recipe, targetServings) {
  const baseServings =
    Number(recipe?.servings) > 0 ? Number(recipe.servings) : 1;
  const ratio = targetServings / baseServings;

  const structured = Array.isArray(recipe?.structuredIngredients)
    ? recipe.structuredIngredients
    : [];

  if (structured.length > 0) {
    return structured.map((item) => {
      if (!item?.scalable || item.quantity == null) {
        return item?.original || item?.name || "";
      }

      const scaledQty = item.quantity * ratio;
      const qtyText = formatScaledQuantity(scaledQty);
      const unitText = item.unit ? ` ${item.unit}` : "";
      const nameText = item.name ? ` ${item.name}` : "";

      return `${qtyText}${unitText}${nameText}`.trim();
    });
  }

  return Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
}
