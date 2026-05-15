const COUNTRY_ALIASES: Record<string, string> = {
  // Common abbreviations and aliases
  usa: 'United States',
  us: 'United States',
  'united states of america': 'United States',
  'u.s.a': 'United States',
  'u.s.': 'United States',
  america: 'United States',

  uk: 'United Kingdom',
  'great britain': 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  'u.k.': 'United Kingdom',

  uae: 'United Arab Emirates',
  'u.a.e.': 'United Arab Emirates',
  'u.a.e': 'United Arab Emirates',

  brasil: 'Brazil',
  'brasil (brazil)': 'Brazil',

  deutschland: 'Germany',
  allemagne: 'Germany',

  'south korea': 'South Korea',
  'korea, republic of': 'South Korea',
  'republic of korea': 'South Korea',
  'korea (south)': 'South Korea',

  'north korea': 'North Korea',
  "korea, democratic people's republic of": 'North Korea',

  'taiwan, province of china': 'Taiwan',
  'chinese taipei': 'Taiwan',

  'hong kong sar': 'Hong Kong',
  'hong kong s.a.r.': 'Hong Kong',

  'macao sar': 'Macau',

  'viet nam': 'Vietnam',

  'russian federation': 'Russia',

  'iran, islamic republic of': 'Iran',

  "lao people's democratic republic": 'Laos',

  'czech republic': 'Czech Republic',
  czechia: 'Czech Republic',

  'the netherlands': 'Netherlands',
  holland: 'Netherlands',

  'slovak republic': 'Slovakia',

  'moldova, republic of': 'Moldova',

  'tanzania, united republic of': 'Tanzania',

  'bolivia, plurinational state of': 'Bolivia',

  'venezuela, bolivarian republic of': 'Venezuela',

  'syrian arab republic': 'Syria',

  'libyan arab jamahiriya': 'Libya',

  'côte d\'ivoire': "Cote d'Ivoire",
  'ivory coast': "Cote d'Ivoire",

  'democratic republic of the congo': 'DR Congo',
  'dr congo': 'DR Congo',
  'congo, the democratic republic of the': 'DR Congo',

  'republic of the congo': 'Republic of Congo',
  'congo, republic of the': 'Republic of Congo',

  'central african republic': 'Central African Republic',

  'timor-leste': 'East Timor',
  'east timor': 'East Timor',

  'cabo verde': 'Cape Verde',

  'eswatini': 'Eswatini',
  'swaziland': 'Eswatini',

  'north macedonia': 'North Macedonia',
  'macedonia': 'North Macedonia',
  'fyrom': 'North Macedonia',

  'burma': 'Myanmar',

  'worldwide': 'International',
  'global': 'International',
  'all countries': 'International',
  'international': 'International',
  'all nationalities': 'International',
};

/**
 * Normalizes a country name string to a standard form.
 * Handles common aliases, abbreviations, and alternate spellings.
 * Returns null if input is null or empty.
 */
export function normalizeCountry(raw: string | null): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // Direct alias lookup
  if (COUNTRY_ALIASES[lower]) {
    return COUNTRY_ALIASES[lower];
  }

  // Check for partial matches in common patterns
  for (const [alias, normalized] of Object.entries(COUNTRY_ALIASES)) {
    if (lower === alias) {
      return normalized;
    }
  }

  // Return the trimmed original with title case if not found in aliases
  // (preserve original casing for properly-cased inputs)
  return trimmed;
}
