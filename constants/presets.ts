export interface Country {
  code: string;
  name: string;
  currency: string;
  currencyName: string;
  symbol: string;
  phonePrefix: string;
  flag: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

export interface UnitOfMeasure {
  value: string;
  label: string;
  abbreviation: string;
}

export const COUNTRIES: Country[] = [
  { code: 'KE', name: 'Kenya',         currency: 'KES', currencyName: 'Kenyan Shilling',     symbol: 'KSh', phonePrefix: '+254', flag: '🇰🇪' },
  { code: 'UG', name: 'Uganda',        currency: 'UGX', currencyName: 'Ugandan Shilling',     symbol: 'USh', phonePrefix: '+256', flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania',      currency: 'TZS', currencyName: 'Tanzanian Shilling',   symbol: 'TSh', phonePrefix: '+255', flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda',        currency: 'RWF', currencyName: 'Rwandan Franc',        symbol: 'RF',  phonePrefix: '+250', flag: '🇷🇼' },
  { code: 'ET', name: 'Ethiopia',      currency: 'ETB', currencyName: 'Ethiopian Birr',       symbol: 'Br',  phonePrefix: '+251', flag: '🇪🇹' },
  { code: 'BI', name: 'Burundi',       currency: 'BIF', currencyName: 'Burundian Franc',      symbol: 'Fr',  phonePrefix: '+257', flag: '🇧🇮' },
  { code: 'SS', name: 'South Sudan',   currency: 'SSP', currencyName: 'S. Sudanese Pound',    symbol: '£',   phonePrefix: '+211', flag: '🇸🇸' },
  { code: 'US', name: 'United States', currency: 'USD', currencyName: 'US Dollar',            symbol: '$',   phonePrefix: '+1',   flag: '🇺🇸' },
];

export const CURRENCIES: Currency[] = COUNTRIES.map(({ currency, currencyName, symbol, flag }) => ({
  code: currency,
  name: currencyName,
  symbol,
  flag,
}));

export const UNITS_OF_MEASURE: UnitOfMeasure[] = [
  { value: 'unit',  label: 'Unit / Piece',  abbreviation: 'unit' },
  { value: 'kg',    label: 'Kilogram',       abbreviation: 'kg'   },
  { value: 'g',     label: 'Gram',           abbreviation: 'g'    },
  { value: 'l',     label: 'Litre',          abbreviation: 'L'    },
  { value: 'ml',    label: 'Millilitre',     abbreviation: 'mL'   },
  { value: 'dozen', label: 'Dozen',          abbreviation: 'doz'  },
  { value: 'pack',  label: 'Pack',           abbreviation: 'pk'   },
  { value: 'box',   label: 'Box',            abbreviation: 'box'  },
  { value: 'bag',   label: 'Bag',            abbreviation: 'bag'  },
  { value: 'lb',    label: 'Pound',          abbreviation: 'lb'   },
  { value: 'oz',    label: 'Ounce',          abbreviation: 'oz'   },
  { value: 'm',     label: 'Metre',          abbreviation: 'm'    },
  { value: 'cm',    label: 'Centimetre',     abbreviation: 'cm'   },
  { value: 'ton',   label: 'Tonne',          abbreviation: 't'    },
];

/** Returns the Country record for a given country code, or undefined. */
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** Returns the Currency symbol for a given currency code (e.g. 'KES' → 'KSh'). */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCIES.find((c) => c.code === currencyCode)?.symbol ?? currencyCode;
}

/** Returns the UnitOfMeasure entry for a given value string. */
export function getUnit(value: string): UnitOfMeasure | undefined {
  return UNITS_OF_MEASURE.find((u) => u.value === value);
}
