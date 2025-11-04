// Currency Constants and Configuration
// Defines supported currencies, exchange rates, and utility functions

export const CURRENCIES = {
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    flag: '🇮🇳',
    countries: ['India', 'Republic of India'],
    isGSTApplicable: true
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    flag: '🇺🇸',
    countries: ['United States', 'USA', 'US', 'America'],
    isGSTApplicable: false
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
    countries: ['Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Portugal', 'Finland', 'Ireland', 'Greece', 'Luxembourg', 'Slovenia', 'Cyprus', 'Malta', 'Estonia', 'Latvia', 'Lithuania', 'Slovakia', 'Andorra', 'Monaco', 'San Marino', 'Vatican City', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Serbia', 'Ukraine', 'Belarus', 'Moldova', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia', 'Albania', 'Kosovo', 'Iceland', 'Liechtenstein'],
    isGSTApplicable: false
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    flag: '🇬🇧',
    countries: ['United Kingdom', 'UK', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
    isGSTApplicable: false
  },
  AED: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'د.إ',
    flag: '🇦🇪',
    countries: ['United Arab Emirates', 'UAE', 'Dubai', 'Abu Dhabi'],
    isGSTApplicable: false
  },
  SGD: {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'S$',
    flag: '🇸🇬',
    countries: ['Singapore'],
    isGSTApplicable: false
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    flag: '🇦🇺',
    countries: ['Australia'],
    isGSTApplicable: false
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'C$',
    flag: '🇨🇦',
    countries: ['Canada'],
    isGSTApplicable: false
  },
  CHF: {
    code: 'CHF',
    name: 'Swiss Franc',
    symbol: 'CHF',
    flag: '🇨🇭',
    countries: ['Switzerland'],
    isGSTApplicable: false
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    flag: '🇯🇵',
    countries: ['Japan'],
    isGSTApplicable: false
  },
  KRW: {
    code: 'KRW',
    name: 'South Korean Won',
    symbol: '₩',
    flag: '🇰🇷',
    countries: ['South Korea', 'Korea'],
    isGSTApplicable: false
  },
  CNY: {
    code: 'CNY',
    name: 'Chinese Yuan',
    symbol: '¥',
    flag: '🇨🇳',
    countries: ['China', 'People\'s Republic of China'],
    isGSTApplicable: false
  },
  THB: {
    code: 'THB',
    name: 'Thai Baht',
    symbol: '฿',
    flag: '🇹🇭',
    countries: ['Thailand'],
    isGSTApplicable: false
  },
  MYR: {
    code: 'MYR',
    name: 'Malaysian Ringgit',
    symbol: 'RM',
    flag: '🇲🇾',
    countries: ['Malaysia'],
    isGSTApplicable: false
  },
  IDR: {
    code: 'IDR',
    name: 'Indonesian Rupiah',
    symbol: 'Rp',
    flag: '🇮🇩',
    countries: ['Indonesia'],
    isGSTApplicable: false
  },
  VND: {
    code: 'VND',
    name: 'Vietnamese Dong',
    symbol: '₫',
    flag: '🇻🇳',
    countries: ['Vietnam'],
    isGSTApplicable: false
  },
  PHP: {
    code: 'PHP',
    name: 'Philippine Peso',
    symbol: '₱',
    flag: '🇵🇭',
    countries: ['Philippines'],
    isGSTApplicable: false
  },
  NZD: {
    code: 'NZD',
    name: 'New Zealand Dollar',
    symbol: 'NZ$',
    flag: '🇳🇿',
    countries: ['New Zealand'],
    isGSTApplicable: false
  },
  ZAR: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R',
    flag: '🇿🇦',
    countries: ['South Africa'],
    isGSTApplicable: false
  },
  EGP: {
    code: 'EGP',
    name: 'Egyptian Pound',
    symbol: '£',
    flag: '🇪🇬',
    countries: ['Egypt'],
    isGSTApplicable: false
  },
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    flag: '🇳🇬',
    countries: ['Nigeria'],
    isGSTApplicable: false
  },
  BRL: {
    code: 'BRL',
    name: 'Brazilian Real',
    symbol: 'R$',
    flag: '🇧🇷',
    countries: ['Brazil'],
    isGSTApplicable: false
  },
  ARS: {
    code: 'ARS',
    name: 'Argentine Peso',
    symbol: '$',
    flag: '🇦🇷',
    countries: ['Argentina'],
    isGSTApplicable: false
  },
  CLP: {
    code: 'CLP',
    name: 'Chilean Peso',
    symbol: '$',
    flag: '🇨🇱',
    countries: ['Chile'],
    isGSTApplicable: false
  },
  COP: {
    code: 'COP',
    name: 'Colombian Peso',
    symbol: '$',
    flag: '🇨🇴',
    countries: ['Colombia'],
    isGSTApplicable: false
  },
  PEN: {
    code: 'PEN',
    name: 'Peruvian Sol',
    symbol: 'S/',
    flag: '🇵🇪',
    countries: ['Peru'],
    isGSTApplicable: false
  },
  RUB: {
    code: 'RUB',
    name: 'Russian Ruble',
    symbol: '₽',
    flag: '🇷🇺',
    countries: ['Russia', 'Russian Federation'],
    isGSTApplicable: false
  },
  TRY: {
    code: 'TRY',
    name: 'Turkish Lira',
    symbol: '₺',
    flag: '🇹🇷',
    countries: ['Turkey'],
    isGSTApplicable: false
  },
  SAR: {
    code: 'SAR',
    name: 'Saudi Riyal',
    symbol: '﷼',
    flag: '🇸🇦',
    countries: ['Saudi Arabia'],
    isGSTApplicable: false
  },
  QAR: {
    code: 'QAR',
    name: 'Qatari Riyal',
    symbol: '﷼',
    flag: '🇶🇦',
    countries: ['Qatar'],
    isGSTApplicable: false
  },
  KWD: {
    code: 'KWD',
    name: 'Kuwaiti Dinar',
    symbol: 'د.ك',
    flag: '🇰🇼',
    countries: ['Kuwait'],
    isGSTApplicable: false
  },
  BHD: {
    code: 'BHD',
    name: 'Bahraini Dinar',
    symbol: 'د.ب',
    flag: '🇧🇭',
    countries: ['Bahrain'],
    isGSTApplicable: false
  },
  OMR: {
    code: 'OMR',
    name: 'Omani Rial',
    symbol: '﷼',
    flag: '🇴🇲',
    countries: ['Oman'],
    isGSTApplicable: false
  },
  JOD: {
    code: 'JOD',
    name: 'Jordanian Dinar',
    symbol: 'د.أ',
    flag: '🇯🇴',
    countries: ['Jordan'],
    isGSTApplicable: false
  },
  LBP: {
    code: 'LBP',
    name: 'Lebanese Pound',
    symbol: 'ل.ل',
    flag: '🇱🇧',
    countries: ['Lebanon'],
    isGSTApplicable: false
  },
  ILS: {
    code: 'ILS',
    name: 'Israeli Shekel',
    symbol: '₪',
    flag: '🇮🇱',
    countries: ['Israel'],
    isGSTApplicable: false
  },
  IRR: {
    code: 'IRR',
    name: 'Iranian Rial',
    symbol: '﷼',
    flag: '🇮🇷',
    countries: ['Iran'],
    isGSTApplicable: false
  },
  IQD: {
    code: 'IQD',
    name: 'Iraqi Dinar',
    symbol: 'ع.د',
    flag: '🇮🇶',
    countries: ['Iraq'],
    isGSTApplicable: false
  }
};

// Static exchange rates (fallback rates in INR) - Updated with current rates (Oct 2024)
export const STATIC_EXCHANGE_RATES = {
  INR: 1.0,
  USD: 84.5,     // 1 USD ≈ 84.5 INR - Current rate
  EUR: 92.0,     // 1 EUR ≈ 92 INR - Current rate
  GBP: 108.0,    // 1 GBP ≈ 108 INR - Current rate
  AED: 23.0,     // 1 AED ≈ 23 INR - Current rate
  SGD: 63.5,     // 1 SGD ≈ 63.5 INR - Current rate
  AUD: 56.0,     // 1 AUD ≈ 56 INR - Current rate
  CAD: 61.5,     // 1 CAD ≈ 61.5 INR - Current rate
  CHF: 98.0,     // 1 CHF ≈ 98 INR - Current rate
  JPY: 0.57,     // 1 JPY ≈ 0.57 INR - Current rate (Japanese Yen is very low value)
  KRW: 0.063,    // 1 KRW ≈ 0.063 INR - Current rate
  CNY: 11.8,     // 1 CNY ≈ 11.8 INR - Current rate
  THB: 2.35,     // 1 THB ≈ 2.35 INR - Current rate
  MYR: 19.2,     // 1 MYR ≈ 19.2 INR - Current rate
  IDR: 0.0054,   // 1 IDR ≈ 0.0054 INR - Current rate
  VND: 0.0034,   // 1 VND ≈ 0.0034 INR - Current rate
  PHP: 1.48,     // 1 PHP ≈ 1.48 INR - Current rate
  NZD: 51.0,     // 1 NZD ≈ 51 INR - Current rate
  ZAR: 4.7,      // 1 ZAR ≈ 4.7 INR - Current rate
  EGP: 1.72,     // 1 EGP ≈ 1.72 INR - Current rate
  NGN: 0.055,    // 1 NGN ≈ 0.055 INR - Current rate
  BRL: 15.8,     // 1 BRL ≈ 15.8 INR - Current rate
  ARS: 0.089,    // 1 ARS ≈ 0.089 INR - Current rate
  CLP: 0.088,    // 1 CLP ≈ 0.088 INR - Current rate
  COP: 0.020,    // 1 COP ≈ 0.020 INR - Current rate
  PEN: 22.8,     // 1 PEN ≈ 22.8 INR - Current rate
  RUB: 0.88,     // 1 RUB ≈ 0.88 INR - Current rate
  TRY: 2.45,     // 1 TRY ≈ 2.45 INR - Current rate
  SAR: 22.5,     // 1 SAR ≈ 22.5 INR - Current rate
  QAR: 23.2,     // 1 QAR ≈ 23.2 INR - Current rate
  KWD: 275.0,    // 1 KWD ≈ 275 INR - Current rate
  BHD: 224.0,    // 1 BHD ≈ 224 INR - Current rate
  OMR: 219.0,    // 1 OMR ≈ 219 INR - Current rate
  JOD: 119.0,    // 1 JOD ≈ 119 INR - Current rate
  LBP: 0.056,    // 1 LBP ≈ 0.056 INR - Current rate
  ILS: 22.9,     // 1 ILS ≈ 22.9 INR - Current rate
  IRR: 0.0020,   // 1 IRR ≈ 0.0020 INR - Current rate
  IQD: 0.065,    // 1 IQD ≈ 0.065 INR - Current rate
  MXN: 4.2,      // 1 MXN ≈ 4.2 INR - Current rate
  UAH: 2.05,     // 1 UAH ≈ 2.05 INR - Current rate
  SEK: 8.0,      // 1 SEK ≈ 8.0 INR - Current rate
  NOK: 7.8,      // 1 NOK ≈ 7.8 INR - Current rate
  DKK: 12.3,     // 1 DKK ≈ 12.3 INR - Current rate
  PLN: 21.0,     // 1 PLN ≈ 21.0 INR - Current rate
  CZK: 3.6,      // 1 CZK ≈ 3.6 INR - Current rate
  HUF: 0.23,     // 1 HUF ≈ 0.23 INR - Current rate
  RON: 18.5,     // 1 RON ≈ 18.5 INR - Current rate
  BGN: 47.0,     // 1 BGN ≈ 47.0 INR - Current rate
  HRK: 12.2,     // 1 HRK ≈ 12.2 INR - Current rate
  RSD: 0.78,     // 1 RSD ≈ 0.78 INR - Current rate
  BAM: 47.0,     // 1 BAM ≈ 47.0 INR - Current rate
  MKD: 1.5,      // 1 MKD ≈ 1.5 INR - Current rate
  ALL: 0.92,     // 1 ALL ≈ 0.92 INR - Current rate
  XOF: 0.14,     // 1 XOF ≈ 0.14 INR - Current rate
  XAF: 0.14,     // 1 XAF ≈ 0.14 INR - Current rate
  GHS: 5.5,      // 1 GHS ≈ 5.5 INR - Current rate
  KES: 0.65,     // 1 KES ≈ 0.65 INR - Current rate
  TZS: 0.032,    // 1 TZS ≈ 0.032 INR - Current rate
  UGX: 0.023,    // 1 UGX ≈ 0.023 INR - Current rate
  MAD: 8.4,      // 1 MAD ≈ 8.4 INR - Current rate
  TND: 27.0,     // 1 TND ≈ 27.0 INR - Current rate
  DZD: 0.63,     // 1 DZD ≈ 0.63 INR - Current rate
  LYD: 17.5,     // 1 LYD ≈ 17.5 INR - Current rate
  MZN: 1.32,     // 1 MZN ≈ 1.32 INR - Current rate
  AOA: 0.095,    // 1 AOA ≈ 0.095 INR - Current rate
  ZMW: 3.2,      // 1 ZMW ≈ 3.2 INR - Current rate
  BWP: 6.2,      // 1 BWP ≈ 6.2 INR - Current rate
  MUR: 1.82,     // 1 MUR ≈ 1.82 INR - Current rate
  SCR: 6.1,      // 1 SCR ≈ 6.1 INR - Current rate
  MVR: 5.5,      // 1 MVR ≈ 5.5 INR - Current rate
  LKR: 0.28,     // 1 LKR ≈ 0.28 INR - Current rate
  BDT: 0.71,     // 1 BDT ≈ 0.71 INR - Current rate
  NPR: 0.63,     // 1 NPR ≈ 0.63 INR - Current rate
  PKR: 0.30,     // 1 PKR ≈ 0.30 INR - Current rate
  LKR: 0.28,     // 1 LKR ≈ 0.28 INR - Current rate
  MMK: 0.040,    // 1 MMK ≈ 0.040 INR - Current rate
  KHR: 0.021,    // 1 KHR ≈ 0.021 INR - Current rate
  LAK: 0.0038,   // 1 LAK ≈ 0.0038 INR - Current rate
  MNT: 0.025,    // 1 MNT ≈ 0.025 INR - Current rate
  TJS: 7.7,      // 1 TJS ≈ 7.7 INR - Current rate
  KZT: 0.17,     // 1 KZT ≈ 0.17 INR - Current rate
  UZB: 7.4,      // 1 UZB ≈ 7.4 INR - Current rate
  TMT: 24.1,     // 1 TMT ≈ 24.1 INR - Current rate
  AFN: 1.2,      // 1 AFN ≈ 1.2 INR - Current rate
  YER: 0.34,     // 1 YER ≈ 0.34 INR - Current rate
  SYP: 0.033,    // 1 SYP ≈ 0.033 INR - Current rate
  JEP: 108.0,    // 1 JEP ≈ 108 INR - Current rate
  GGP: 108.0,    // 1 GGP ≈ 108 INR - Current rate
  IMP: 108.0,    // 1 IMP ≈ 108 INR - Current rate
  GIP: 108.0,    // 1 GIP ≈ 108 INR - Current rate
  FKP: 108.0,    // 1 FKP ≈ 108 INR - Current rate
  SHP: 108.0,    // 1 SHP ≈ 108 INR - Current rate
  TVD: 56.0,     // 1 TVD ≈ 56 INR - Current rate
  KID: 56.0,     // 1 KID ≈ 56 INR - Current rate
  WST: 31.0,     // 1 WST ≈ 31 INR - Current rate
  TOP: 35.8,     // 1 TOP ≈ 35.8 INR - Current rate
  VUV: 0.71,     // 1 VUV ≈ 0.71 INR - Current rate
  XPF: 0.77,     // 1 XPF ≈ 0.77 INR - Current rate
  FJD: 37.5,     // 1 FJD ≈ 37.5 INR - Current rate
  PGK: 21.4,     // 1 PGK ≈ 21.4 INR - Current rate
  SBD: 10.1,     // 1 SBD ≈ 10.1 INR - Current rate
  VUV: 0.71,     // 1 VUV ≈ 0.71 INR - Current rate
  XPF: 0.77      // 1 XPF ≈ 0.77 INR - Current rate
};

// Reverse rates (INR to foreign currency)
export const STATIC_EXCHANGE_RATES_REVERSE = {};
Object.keys(STATIC_EXCHANGE_RATES).forEach(currency => {
  STATIC_EXCHANGE_RATES_REVERSE[currency] = 1 / STATIC_EXCHANGE_RATES[currency];
});

/**
 * Check if GST is applicable for a currency
 * @param {string} currencyCode - Currency code
 * @returns {boolean} Whether GST applies
 */
export function isGSTApplicable(currencyCode) {
  if (!currencyCode || typeof currencyCode !== 'string') {
    return false;
  }
  return CURRENCIES[currencyCode]?.isGSTApplicable || false;
}

/**
 * Format amount in specific currency
 * @param {number} amountINR - Amount in INR
 * @param {string} currencyCode - Target currency code
 * @returns {string} Formatted currency string
 */
export function formatAmountInCurrency(amountINR, currencyCode) {
  if (!currencyCode || !CURRENCIES[currencyCode]) {
    return `₹${Number(amountINR || 0).toFixed(2)}`;
  }

  const currency = CURRENCIES[currencyCode];
  const rate = STATIC_EXCHANGE_RATES[currencyCode] || 1;
  const convertedAmount = amountINR / rate;

  return `${currency.symbol}${Number(convertedAmount || 0).toFixed(2)}`;
}

/**
 * Get available currencies for a country
 * @param {string} countryName - Country name
 * @returns {Array} Array of currency codes - MAXIMUM 2 options only
 */
export function getAvailableCurrenciesForCountry(countryName) {
  if (!countryName || typeof countryName !== 'string') {
    return ['INR'];
  }

  const country = countryName.toLowerCase().trim();
  let localCurrency = null;

  // Find the PRIMARY local currency for the country (only one)
  for (const [currencyCode, currency] of Object.entries(CURRENCIES)) {
    if (currencyCode === 'INR') continue; // Skip INR, we'll add it separately

    const currencyMatch = currency.countries.some(c => {
      const currencyCountry = c.toLowerCase().trim();

      // Direct exact match
      if (currencyCountry === country) return true;

      // Special cases for common variations
      if (country === 'united states' && (currencyCountry.includes('america') || currencyCountry.includes('usa') || currencyCountry.includes('us'))) return true;
      if (country === 'america' && currencyCountry.includes('united states')) return true;
      if (country === 'usa' && currencyCountry.includes('united states')) return true;
      if (country === 'us' && (currencyCountry.includes('united states') || currencyCountry.includes('usa'))) return true;

      if (country === 'united kingdom' && (currencyCountry.includes('uk') || currencyCountry.includes('great britain'))) return true;
      if (country === 'uk' && currencyCountry.includes('united kingdom')) return true;

      // Additional country variations
      if (country === 'russia' && currencyCountry.includes('russian federation')) return true;
      if (country === 'russian federation' && currencyCountry.includes('russia')) return true;

      if (country === 'south korea' && currencyCountry.includes('korea')) return true;
      if (country === 'korea' && currencyCountry.includes('south korea')) return true;

      if (country === 'china' && currencyCountry.includes('people\'s republic of china')) return true;
      if (country === 'people\'s republic of china' && currencyCountry.includes('china')) return true;

      if (country === 'united arab emirates' && (currencyCountry.includes('uae') || currencyCountry.includes('dubai'))) return true;
      if (country === 'uae' && currencyCountry.includes('united arab emirates')) return true;

      if (country === 'saudi arabia' && currencyCountry.includes('saudi')) return true;
      if (country === 'vietnam' && currencyCountry.includes('viet nam')) return true;
      if (country === 'viet nam' && currencyCountry.includes('vietnam')) return true;

      return false;
    });

    if (currencyMatch) {
      localCurrency = currencyCode;
      break; // Stop at first match - only one local currency
    }
  }

  // For countries without defined currencies, use USD as default for Western countries
  if (!localCurrency) {
    // Common Western countries that might not have specific currencies defined
    const westernCountries = [
      'france', 'spain', 'italy', 'netherlands', 'belgium', 'switzerland', 'austria',
      'sweden', 'norway', 'denmark', 'finland', 'ireland', 'portugal', 'greece',
      'poland', 'czech republic', 'hungary', 'romania', 'bulgaria', 'croatia',
      'slovenia', 'slovakia', 'estonia', 'latvia', 'lithuania', 'luxembourg',
      'malta', 'cyprus', 'andorra', 'monaco', 'san marino', 'vatican city',
      'liechtenstein', 'iceland'
    ];

    if (westernCountries.includes(country)) {
      localCurrency = 'EUR'; // Most Western European countries use EUR
    } else {
      localCurrency = 'USD'; // Default for other countries without specific currency
    }
  }

  // Return exactly 2 options: local currency + INR
  if (localCurrency && localCurrency !== 'INR') {
    return [localCurrency, 'INR'];
  }

  // Fallback: just INR
  return ['INR'];
}

/**
 * Get suggested currency for a country
 * @param {string} countryName - Country name
 * @returns {string} Suggested currency code
 */
export function getSuggestedCurrencyForCountry(countryName) {
  if (!countryName || typeof countryName !== 'string') {
    return 'INR';
  }

  const country = countryName.toLowerCase();

  // Check for exact matches first
  for (const [currencyCode, currency] of Object.entries(CURRENCIES)) {
    for (const countryName of currency.countries) {
      if (countryName.toLowerCase() === country) {
        return currencyCode;
      }
    }
  }

  // Check for partial matches
  for (const [currencyCode, currency] of Object.entries(CURRENCIES)) {
    for (const countryName of currency.countries) {
      if (country.includes(countryName.toLowerCase()) || countryName.toLowerCase().includes(country)) {
        return currencyCode;
      }
    }
  }

  return 'INR'; // Default fallback
}

/**
 * Get all supported currency codes
 * @returns {Array} Array of currency codes
 */
export function getAllSupportedCurrencies() {
  return Object.keys(CURRENCIES);
}

/**
 * Get currency display options for UI
 * @returns {Array} Array of currency options with labels
 */
export function getCurrencyOptions() {
  return Object.keys(CURRENCIES).map(code => ({
    value: code,
    label: `${CURRENCIES[code].symbol} ${CURRENCIES[code].name} (${code})`
  }));
}

/**
 * Get currency options formatted for React Select component
 * @param {Array} currencyCodes - Array of currency codes to include
 * @returns {Array} Array of currency options with value/label structure
 */
export function getCurrencyOptionsForSelect(currencyCodes = null) {
  const codes = currencyCodes || Object.keys(CURRENCIES);
  return codes.map(code => {
    const currency = CURRENCIES[code];
    if (!currency) return null;
    return {
      value: code,
      label: `${currency.flag} ${currency.name} (${currency.symbol}) - ${code}`
    };
  }).filter(Boolean);
}

/**
 * Validate currency code
 * @param {string} currencyCode - Currency code to validate
 * @returns {boolean} Whether currency code is valid
 */
export function isValidCurrencyCode(currencyCode) {
  return currencyCode && typeof currencyCode === 'string' && CURRENCIES[currencyCode] !== undefined;
}

/**
 * Get currency precision (decimal places)
 * @param {string} currencyCode - Currency code
 * @returns {number} Number of decimal places
 */
export function getCurrencyPrecision(currencyCode) {
  // Most currencies use 2 decimal places, INR also uses 2
  return 2;
}