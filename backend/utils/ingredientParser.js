function parseFraction(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim().replace(",", ".");

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [a, b] = trimmed.split("/").map(Number);
    if (!b) return null;
    return a / b;
  }

  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(/\s+/);
    const [a, b] = fraction.split("/").map(Number);
    if (!b) return null;
    return Number(whole) + a / b;
  }

  return null;
}

const KNOWN_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "ks",
  "lžíce",
  "lžička",
  "hrnek",
  "balení",
  "stroužek",
  "špetka",
  "plátek",
];

function parseIngredientLine(line) {
  const original = String(line || "").trim();
  if (!original) {
    return {
      original: "",
      quantity: null,
      unit: null,
      name: "",
      scalable: false,
    };
  }

  const normalized = original.replace(/\s+/g, " ");

  if (/^\d+-\S+/.test(normalized) || /^\d+[A-Za-z]/.test(normalized)) {
    return {
      original,
      quantity: null,
      unit: null,
      name: original,
      scalable: false,
    };
  }

  const match = normalized.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s+(.*)$/,
  );

  if (!match) {
    return {
      original,
      quantity: null,
      unit: null,
      name: original,
      scalable: false,
    };
  }

  const quantityRaw = match[1];
  const rest = match[2].trim();
  const quantity = parseFraction(quantityRaw);

  if (quantity == null) {
    return {
      original,
      quantity: null,
      unit: null,
      name: original,
      scalable: false,
    };
  }

  const parts = rest.split(" ");
  const first = parts[0].toLowerCase();

  if (KNOWN_UNITS.includes(first)) {
    const name = parts.slice(1).join(" ");

    return {
      original,
      quantity,
      unit: first,
      name: name || rest,
      scalable: true,
    };
  }

  return {
    original,
    quantity,
    unit: null,
    name: rest,
    scalable: true,
  };
}

function parseIngredientList(lines = []) {
  if (!Array.isArray(lines)) return [];

  return lines
    .map((line) => parseIngredientLine(line))
    .filter((item) => item.original);
}

module.exports = {
  parseIngredientList,
};
