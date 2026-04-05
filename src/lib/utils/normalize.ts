const MAKE_ALIASES: Record<string, string> = {
  chevy: "Chevrolet",
  chev: "Chevrolet",
  vw: "Volkswagen",
  merc: "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  "mb": "Mercedes-Benz",
  beemer: "BMW",
  bimmer: "BMW",
  porsh: "Porsche",
  porshe: "Porsche",
  "land rover": "Land Rover",
  landrover: "Land Rover",
  "alfa romeo": "Alfa Romeo",
  alfa: "Alfa Romeo",
  "aston martin": "Aston Martin",
  aston: "Aston Martin",
  "rolls royce": "Rolls-Royce",
  rolls: "Rolls-Royce",
};

export function normalizeMake(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (MAKE_ALIASES[lower]) return MAKE_ALIASES[lower];
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
}

export function normalizeModel(raw: string): string {
  return raw.trim();
}

export function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 100 || num > 10_000_000) return null;
  return Math.round(num);
}

export function parseMileage(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num < 0 || num > 1_000_000) return null;
  return num;
}

export function parseYear(raw: string): number | null {
  const match = raw.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  const year = parseInt(match[0], 10);
  if (year < 1900 || year > new Date().getFullYear() + 2) return null;
  return year;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
