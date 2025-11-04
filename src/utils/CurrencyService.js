// Currency Service - Handles all currency conversions and calculations
// GST calculations remain unchanged for INR only

import {
  CURRENCIES,
  STATIC_EXCHANGE_RATES,
  STATIC_EXCHANGE_RATES_REVERSE,
  isGSTApplicable,
  formatAmountInCurrency,
  getAvailableCurrenciesForCountry,
  getSuggestedCurrencyForCountry
} from '../constants/currencies.js';
import { logger } from './logger.js';

// Live exchange rate service
class LiveExchangeRateService {
  static CACHE_DURATION = Number(import.meta.env?.VITE_EXCHANGE_RATE_CACHE_DURATION) || 30 * 60 * 1000; // 30 minutes default
  static cache = new Map();
  static lastFetch = null;
  static lastApiCall = null;
  static API_CALL_INTERVAL = 60 * 1000; // Minimum 1 minute between API calls to respect rate limits
  static USE_STATIC_FALLBACK = import.meta.env?.VITE_USE_STATIC_RATES === 'true' || false;

  static async getLiveRates() {
    const now = Date.now();

    // Check if we should use static rates (for development/testing)
    if (this.USE_STATIC_FALLBACK) {
      logger.debug('Using static rates (development mode enabled via VITE_USE_STATIC_RATES)');
      return this.getStaticRates();
    }

    // Check rate limiting - don't call API too frequently
    if (this.lastApiCall && (now - this.lastApiCall) < this.API_CALL_INTERVAL) {
      const waitTime = Math.ceil((this.API_CALL_INTERVAL - (now - this.lastApiCall)) / 1000);
      logger.debug(`Rate limiting active, waiting ${waitTime}s before API call`);

      // Use cached rates if available and fresh, otherwise static rates
      if (this.cache.has('rates') && this.lastFetch && (now - this.lastFetch) < this.CACHE_DURATION) {
        const cachedRates = this.cache.get('rates');
        logger.debug('Using cached rates during rate limiting:', cachedRates);
        return cachedRates;
      }

      logger.debug('Falling back to static rates during rate limiting');
      return this.getStaticRates();
    }

    try {
      logger.debug('Fetching live exchange rates from API...');
      logger.debug('API URL:', import.meta.env?.VITE_EXCHANGE_RATE_API_URL || 'https://api.exchangerate-api.com/v4/latest/INR');

      const rates = await this.fetchFromAPI();

      // Validate API response
      if (rates && typeof rates === 'object' && rates.INR === 1) {
        // Cache the successful API rates
        this.cache.set('rates', rates);
        this.lastFetch = now;
        this.lastApiCall = now;

        logger.debug('Successfully fetched live rates from API:', rates);
        logger.debug('Live API rates are now active and cached');
        return rates;
      } else {
        logger.warn('Invalid API response, falling back to static rates');
        logger.warn('API Response:', rates);
        return this.getStaticRates();
      }
    } catch (error) {
      logger.error('API call failed, using static rates as fallback:', error.message, error);

      // Try cached rates first before falling back to static
      if (this.cache.has('rates') && this.lastFetch && (now - this.lastFetch) < this.CACHE_DURATION) {
        const cachedRates = this.cache.get('rates');
        logger.debug('Using cached rates as fallback after API failure:', cachedRates);
        return cachedRates;
      }

      logger.debug('No cached rates available, using static rates as final fallback');
      return this.getStaticRates();
    }
  }

  static async fetchFromAPI() {
    const primaryApiUrl = import.meta.env?.VITE_EXCHANGE_RATE_API_URL;
    const fallbackApiUrl = import.meta.env?.VITE_FALLBACK_API_URL || 'https://api.exchangerate-api.com/v4/latest/INR';

    // Try primary API first
    if (primaryApiUrl) {
      logger.debug(`Trying primary exchange rate API: ${primaryApiUrl}`);
      try {
        const response = await fetch(primaryApiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          logger.debug('Primary API response:', data);

          // Transform primary API response (currencyapi.com format)
          if (data.data && typeof data.data === 'object') {
            const transformedRates = {
              INR: 1.0
            };

            for (const [currency, rateData] of Object.entries(data.data)) {
              if (CURRENCIES[currency] && rateData && typeof rateData.value === 'number' && rateData.value > 0) {
                transformedRates[currency] = 1 / rateData.value;
                logger.debug(`Transformed ${currency}: 1 ${currency} = ${transformedRates[currency]} INR`);
              }
            }

            logger.debug('Successfully fetched from primary API:', transformedRates);
            return transformedRates;
          }
        } else {
          logger.warn(`Primary API failed with status ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        logger.warn('Primary API error:', error.message);
      }
    }

    // Try fallback API
    logger.debug(`Trying fallback exchange rate API: ${fallbackApiUrl}`);
    try {
      const response = await fetch(fallbackApiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        logger.debug('Fallback API response:', data);

        // Transform fallback API response (exchangerate-api.com format)
        if (data.rates && typeof data.rates === 'object') {
          const transformedRates = {
            INR: 1.0
          };

          for (const [currency, rate] of Object.entries(data.rates)) {
            if (CURRENCIES[currency] && typeof rate === 'number' && rate > 0) {
              // Convert to INR-based format: 1 foreign currency = 1 / rate INR (since rate is 1 INR = rate foreign)
              transformedRates[currency] = 1 / rate;
              logger.debug(`Transformed ${currency}: 1 ${currency} = ${transformedRates[currency]} INR`);
            }
          }

          logger.debug('Successfully fetched from fallback API:', transformedRates);
          return transformedRates;
        }
      }

      throw new Error(`Fallback API failed with status ${response.status}: ${response.statusText}`);
    } catch (error) {
      logger.warn('Fallback API failed, using static rates:', error.message);
      logger.debug('Using updated static rates as reliable fallback');

      // Return static rates as final fallback
      return this.getStaticRates();
    }
  }

  static getStaticRates() {
    const now = Date.now();

    // Use cached static rates if available and fresh
    if (this.cache.has('static_rates') && this.lastFetch && (now - this.lastFetch) < this.CACHE_DURATION) {
      logger.debug('Using cached static rates');
      return this.cache.get('static_rates');
    }

    // Generate current static rates as fallback - Updated with more recent rates
    const staticRates = {
      INR: 1.0,
      USD: 84.5,     // Current rate (1 USD ≈ 84.5 INR) - Updated Oct 2024
      EUR: 92.0,     // Current rate (1 EUR ≈ 92 INR) - Updated Oct 2024
      GBP: 108.0,    // Current rate (1 GBP ≈ 108 INR) - Updated Oct 2024
      AED: 23.0,     // Current rate (1 AED ≈ 23 INR) - Updated Oct 2024
      SGD: 63.5,     // Current rate (1 SGD ≈ 63.5 INR) - Updated Oct 2024
      AUD: 56.0,     // Current rate (1 AUD ≈ 56 INR) - Updated Oct 2024
      CAD: 61.5,     // Current rate (1 CAD ≈ 61.5 INR) - Updated Oct 2024
      JPY: 0.57,     // Current rate (1 JPY ≈ 0.57 INR) - Updated Oct 2024
      CHF: 98.0,     // Current rate (1 CHF ≈ 98 INR) - Updated Oct 2024
      CNY: 11.8,     // Current rate (1 CNY ≈ 11.8 INR) - Updated Oct 2024
      KRW: 0.063,    // Current rate (1 KRW ≈ 0.063 INR) - Updated Oct 2024
      THB: 2.35,     // Current rate (1 THB ≈ 2.35 INR) - Updated Oct 2024
      MYR: 19.2,     // Current rate (1 MYR ≈ 19.2 INR) - Updated Oct 2024
      IDR: 0.0054,   // Current rate (1 IDR ≈ 0.0054 INR) - Updated Oct 2024
      VND: 0.0034,   // Current rate (1 VND ≈ 0.0034 INR) - Updated Oct 2024
      PHP: 1.48,     // Current rate (1 PHP ≈ 1.48 INR) - Updated Oct 2024
      NZD: 51.0,     // Current rate (1 NZD ≈ 51 INR) - Updated Oct 2024
      ZAR: 4.7,      // Current rate (1 ZAR ≈ 4.7 INR) - Updated Oct 2024
      RUB: 0.88,     // Current rate (1 RUB ≈ 0.88 INR) - Updated Oct 2024
      TRY: 2.45,     // Current rate (1 TRY ≈ 2.45 INR) - Updated Oct 2024
      SAR: 22.5,     // Current rate (1 SAR ≈ 22.5 INR) - Updated Oct 2024
      QAR: 23.2,     // Current rate (1 QAR ≈ 23.2 INR) - Updated Oct 2024
      KWD: 275.0,    // Current rate (1 KWD ≈ 275 INR) - Updated Oct 2024
      BHD: 224.0,    // Current rate (1 BHD ≈ 224 INR) - Updated Oct 2024
      OMR: 219.0,    // Current rate (1 OMR ≈ 219 INR) - Updated Oct 2024
      EGP: 1.72,     // Current rate (1 EGP ≈ 1.72 INR) - Updated Oct 2024
      NGN: 0.055,    // Current rate (1 NGN ≈ 0.055 INR) - Updated Oct 2024
      BRL: 15.8,     // Current rate (1 BRL ≈ 15.8 INR) - Updated Oct 2024
      MXN: 4.2,      // Current rate (1 MXN ≈ 4.2 INR) - Updated Oct 2024
      ARS: 0.089,    // Current rate (1 ARS ≈ 0.089 INR) - Updated Oct 2024
      CLP: 0.088,    // Current rate (1 CLP ≈ 0.088 INR) - Updated Oct 2024
      COP: 0.020,    // Current rate (1 COP ≈ 0.020 INR) - Updated Oct 2024
      PEN: 22.8,     // Current rate (1 PEN ≈ 22.8 INR) - Updated Oct 2024
      ILS: 22.9,     // Current rate (1 ILS ≈ 22.9 INR) - Updated Oct 2024
      JOD: 119.0,    // Current rate (1 JOD ≈ 119 INR) - Updated Oct 2024
      LBP: 0.056,    // Current rate (1 LBP ≈ 0.056 INR) - Updated Oct 2024
      IRR: 0.0020,   // Current rate (1 IRR ≈ 0.0020 INR) - Updated Oct 2024
      IQD: 0.065     // Current rate (1 IQD ≈ 0.065 INR) - Updated Oct 2024
    };

    // Cache static rates separately
    this.cache.set('static_rates', staticRates);
    this.lastFetch = now;

    logger.debug('Using static rates as fallback:', staticRates);
    return staticRates;
  }

  // Helper method to validate exchange rates
  static validateRate(apiRate, currency, fallbackRate) {
    const rate = Number(apiRate);
    if (isNaN(rate) || rate <= 0) {
      logger.warn(`Invalid API rate for ${currency}, using fallback: ${fallbackRate}`);
      return fallbackRate;
    }
    return rate;
  }

  static async getLiveRate(currencyCode) {
    const rates = await this.getLiveRates();
    return rates[currencyCode] || STATIC_EXCHANGE_RATES[currencyCode] || 1;
  }

  static isUsingLiveRates() {
    return this.cache.has('rates') && this.lastFetch &&
           (Date.now() - this.lastFetch) < this.CACHE_DURATION;
  }

  /**
   * Clear cached exchange rates (useful for testing or forcing refresh)
   */
  static clearCache() {
    this.cache.clear();
    this.lastFetch = null;
    logger.debug('Exchange rate cache cleared');
  }

  /**
   * Force refresh exchange rates and clear cache
   */
  static async forceRefresh() {
    logger.debug('Force refreshing exchange rates...');
    this.clearCache();
    return await this.getLiveRates();
  }

  /**
   * Force refresh rates and return current rates (for testing)
   */
  static async forceRefreshRates() {
    logger.debug('Force refreshing exchange rates...');
    this.clearCache();
    return await this.getLiveRates();
  }

  /**
   * Force refresh exchange rates (bypass cache)
   * @returns {Promise<Object>} Fresh exchange rates
   */
  static async forceRefreshRates() {
    logger.debug('Force refreshing exchange rates...');
    this.clearCache();
    return await this.getLiveRates();
  }

  /**
   * Get cache statistics for debugging
   */
  static getCacheStats() {
    const hasRates = this.cache.has('rates');
    const hasStaticRates = this.cache.has('static_rates');
    const lastFetch = this.lastFetch;
    const lastApiCall = this.lastApiCall;
    const age = lastFetch ? Date.now() - lastFetch : null;
    const apiCallAge = lastApiCall ? Date.now() - lastApiCall : null;
    const isFresh = age !== null && age < this.CACHE_DURATION;
    const canMakeApiCall = !lastApiCall || apiCallAge >= this.API_CALL_INTERVAL;

    return {
      hasRates,
      hasStaticRates,
      lastFetch,
      lastApiCall,
      age,
      apiCallAge,
      isFresh,
      canMakeApiCall,
      cacheSize: this.cache.size,
      cacheDuration: this.CACHE_DURATION,
      apiCallInterval: this.API_CALL_INTERVAL,
      useStaticFallback: this.USE_STATIC_FALLBACK,
      apiUrl: import.meta.env?.VITE_EXCHANGE_RATE_API_URL,
      hasApiKey: !!import.meta.env?.VITE_EXCHANGE_RATE_API_KEY
    };
  }

  /**
   * Get current exchange rates with source information
   */
  static async getRatesWithSource() {
    const rates = await this.getLiveRates();
    const stats = this.getCacheStats();

    return {
      rates,
      source: stats.hasRates && stats.isFresh ? 'live_api' : 'static_fallback',
      lastUpdated: stats.lastFetch,
      age: stats.age,
      isFresh: stats.isFresh,
      apiUrl: stats.apiUrl,
      hasApiKey: stats.hasApiKey
    };
  }

  /**
   * Test API connectivity (for debugging)
   */
  static async testApiConnection() {
    try {
      logger.debug('Testing API connection...');
      const testRates = await this.fetchFromAPI();
      logger.debug('API test successful, sample rates:', testRates);
      return {
        success: true,
        rates: testRates,
        message: 'API connection successful'
      };
    } catch (error) {
      logger.error('API test failed:', error.message, error);
      return {
        success: false,
        error: error.message,
        message: 'API connection failed'
      };
    }
  }

  /**
   * Force refresh rates and test API (for debugging)
   */
  static async forceRefreshAndTest() {
    logger.debug('Force refreshing and testing API...');
    this.clearCache();
    const testResult = await this.testApiConnection();
    const rates = await this.getLiveRates();

    return {
      testResult,
      currentRates: rates,
      cacheStats: this.getCacheStats()
    };
  }

  /**
    * Cleanup old cache entries (call periodically to prevent memory leaks)
    */
   static cleanup() {
     try {
       // For now, we only cache rates, but this can be extended for other cached data
       const stats = this.getCacheStats();
       if (stats.hasRates && !stats.isFresh) {
         logger.debug('Cleaning up expired cache');
         this.clearCache();
       }
     } catch (error) {
       logger.error('Error during cache cleanup:', error.message, error);
     }
   }
}

export class CurrencyService {
  /**
   * Initialize the currency service with live rates
   * Call this on application startup to ensure fresh rates are available
   */
  static async initialize() {
    logger.debug('Initializing CurrencyService with live rates...');
    try {
      await this.getExchangeRateWithRefresh('USD'); // This will trigger a fresh API call
      logger.debug('CurrencyService initialized successfully with live rates');
    } catch (error) {
      logger.warn('Failed to initialize live rates, using static rates:', error.message);
    }
  }

  /**
   * Get current rate source information
   */
  static getRateSourceInfo() {
    const cacheStats = LiveExchangeRateService.getCacheStats();
    const cachedRates = LiveExchangeRateService.cache.get('rates');

    return {
      usingLiveRates: cacheStats.hasRates && cacheStats.isFresh,
      usingStaticRates: !cacheStats.hasRates || !cacheStats.isFresh,
      lastUpdated: cacheStats.lastFetch ? new Date(cacheStats.lastFetch).toLocaleString() : 'Never',
      cacheAge: cacheStats.age ? `${Math.round(cacheStats.age / 1000)}s` : 'Unknown',
      apiUrl: cacheStats.apiUrl || 'Not configured',
      hasApiKey: cacheStats.hasApiKey
    };
  }

  /**
   * Test API connectivity (delegate to LiveExchangeRateService)
   */
  static async testApiConnection() {
    return await LiveExchangeRateService.testApiConnection();
  }

  /**
   * Get cache statistics (delegate to LiveExchangeRateService)
   */
  static getCacheStats() {
    return LiveExchangeRateService.getCacheStats();
  }

  /**
   * Clear cache (delegate to LiveExchangeRateService)
   */
  static clearCache() {
    return LiveExchangeRateService.clearCache();
  }

  /**
   * Force refresh rates (delegate to LiveExchangeRateService)
   */
  static async forceRefresh() {
    return await LiveExchangeRateService.forceRefresh();
  }
  /**
     * Convert amount from one currency to another (now async with live rates)
     * @param {number} amount - Amount to convert
     * @param {string} fromCurrency - Source currency code
     * @param {string} toCurrency - Target currency code
     * @returns {Promise<number>} Converted amount
     */
    static async convertCurrency(amount, fromCurrency, toCurrency) {
      logger.debug(`CurrencyService.convertCurrency(${amount} ${fromCurrency} to ${toCurrency})`);

      // Clean the input amount first
      const cleanedInput = String(amount).match(/[-+]?[0-9]*\.?[0-9]+/g)?.[0] || '0';
      const cleanAmount = Number(cleanedInput) || 0;

      if (fromCurrency === toCurrency) {
        logger.debug(`Same currency, returning cleaned amount: ${cleanAmount}`);
        return cleanAmount;
      }

      try {
        // First convert to INR as base currency
        const amountInINR = await this.convertCurrencyToINR(cleanAmount, fromCurrency);
        logger.debug(`Converted to INR: ${amountInINR}`);

        // Then convert from INR to target currency
        const finalAmount = await this.convertINRToCurrency(amountInINR, toCurrency);
        logger.debug(`Final converted amount: ${finalAmount}`);
        return finalAmount;
      } catch (error) {
        logger.error(`Error in convertCurrency:`, error.message, error);

        // Clean fallback
        return cleanAmount;
      }
    }

  /**
       * Format amount for display in specific currency (synchronous wrapper)
       * @param {number} amountINR - Amount in INR
       * @param {string} displayCurrency - Currency to display in
       * @returns {string} Formatted currency string
       */
      static formatCurrencyDisplay(amountINR, displayCurrency) {
        logger.debug(`CurrencyService.formatCurrencyDisplay(${amountINR} INR to ${displayCurrency})`);

        // Clean the input first using proper sanitization
        const numAmount = this.sanitizeAmount(amountINR);

        try {
          if (!isFinite(numAmount)) {
            logger.warn(`Invalid amount for formatting: ${amountINR} (sanitized: ${numAmount})`);
            return "₹0.00";
          }

          const formatted = formatAmountInCurrency(numAmount, displayCurrency);
          logger.debug(`Formatted amount: ${formatted}`);
          return formatted;
        } catch (error) {
          logger.error('Error formatting currency display:', error.message, error);

          // Clean fallback formatting
          const cleanAmount = numAmount.toFixed(2);
          return `₹${cleanAmount}`;
        }
      }

  /**
   * Format amount for PDF display (direct formatting to avoid issues)
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted amount string
   */
  static formatAmountForPDF(amount, currency) {
    try {
      // Sanitize the amount first
      const sanitizedAmount = this.sanitizeAmount(amount);

      if (!isFinite(sanitizedAmount) || sanitizedAmount < 0) {
        console.warn(`⚠️ DEBUG: Invalid amount for PDF formatting: ${amount} (sanitized: ${sanitizedAmount})`);
        return "0.00";
      }

      const symbol = this.getCurrencySymbol(currency);
      // Format with commas and two decimals
      const formattedAmount = sanitizedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${symbol}${formattedAmount}`;
    } catch (error) {
      console.error('❌ DEBUG: Error formatting amount for PDF:', error);

      // Ultimate fallback - ensure clean number
      const sanitizedAmount = this.sanitizeAmount(amount);
      const formattedAmount = Math.max(0, sanitizedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `INR ${formattedAmount}`;
    }
  }

  /**
   * Sanitize amount input for calculations and display
   * @param {string|number} input - Raw input value
   * @returns {number} Sanitized number or 0 if invalid
   */
  static sanitizeAmount(input) {
    logger.debug(`sanitizeAmount input: "${input}" (type: ${typeof input})`);

    if (input === "" || input === null || input === undefined) {
      logger.debug(`sanitizeAmount returning 0 for empty/null/undefined`);
      return 0;
    }

    // Convert to string and extract only valid numeric patterns
    const stringInput = String(input);
    logger.debug(`Converted to string: "${stringInput}"`);

    // First, try to find a valid number pattern (including decimal)
    const numberMatch = stringInput.match(/[-+]?\d*\.?\d+/);
    if (numberMatch) {
      const extractedNumber = numberMatch[0];
      const num = Number(extractedNumber);
      logger.debug(`Regex match found: "${extractedNumber}" → ${num}`);
      if (!isNaN(num) && isFinite(num)) {
        return Math.max(0, num); // Ensure non-negative
      }
    }

    logger.warn(`No valid regex match found, trying aggressive cleaning`);

    // Aggressive fallback: remove all non-numeric characters except decimal point
    const cleaned = stringInput.replace(/[^0-9.]/g, '');
    logger.debug(`After aggressive cleaning: "${cleaned}"`);

    // Handle multiple decimal points (keep only the first one)
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts[1];
      const finalNum = Number(`${integerPart}.${decimalPart}`);
      logger.debug(`Multiple decimals handled: "${integerPart}.${decimalPart}" → ${finalNum}`);
      return isNaN(finalNum) ? 0 : Math.max(0, finalNum);
    }

    const num = Number(cleaned);
    const result = isNaN(num) ? 0 : Math.max(0, num);
    logger.debug(`Final result: ${result}`);

    return result;
  }

  /**
   * Get currency symbol for a currency code
   * @param {string} currencyCode - Currency code
   * @returns {string} Currency symbol
   */
  static getCurrencySymbol(currencyCode) {
    if (!currencyCode || typeof currencyCode !== 'string') {
      logger.warn(`Invalid currency code for symbol: ${currencyCode}`);
      return '₹';
    }
    return CURRENCIES[currencyCode]?.symbol || '₹';
  }

  /**
    * Get currency name for a currency code
    * @param {string} currencyCode - Currency code
    * @returns {string} Currency name
    */
   static getCurrencyName(currencyCode) {
     if (!currencyCode || typeof currencyCode !== 'string') {
       logger.warn(`Invalid currency code for name: ${currencyCode}`);
       return 'Indian Rupee';
     }
     return CURRENCIES[currencyCode]?.name || 'Indian Rupee';
   }

  /**
    * Get currency info for a currency code
    * @param {string} currencyCode - Currency code
    * @returns {Object} Currency information
    */
   static getCurrencyInfo(currencyCode) {
     if (!currencyCode || typeof currencyCode !== 'string') {
       logger.warn(`Invalid currency code for info: ${currencyCode}`);
       return CURRENCIES.INR;
     }
     return CURRENCIES[currencyCode] || CURRENCIES.INR;
   }

  /**
   * Get exchange rate for a currency (synchronous wrapper)
   * @param {string} currencyCode - Currency code
   * @returns {number} Exchange rate to INR
   */
  static getExchangeRate(currencyCode) {
    try {
      // Validate currency code
      if (!currencyCode || typeof currencyCode !== 'string') {
        logger.warn(`Invalid currency code: ${currencyCode}`);
        return 1;
      }

      // Use the cached rates if available and fresh
      const cachedRates = LiveExchangeRateService.cache.get('rates');
      const cacheStats = LiveExchangeRateService.getCacheStats();

      if (cachedRates && cachedRates[currencyCode] && cacheStats.isFresh) {
        logger.debug(`CurrencyService.getExchangeRate(${currencyCode}) = ${cachedRates[currencyCode]} (CACHED LIVE RATE)`);
        return cachedRates[currencyCode];
      }

      // Try to get fresh rates if cache is stale or empty (async operation)
      if (!cacheStats.isFresh || !cachedRates) {
        logger.debug(`Cache stale or empty for ${currencyCode}, triggering background refresh...`);
        // Trigger background refresh but don't wait for it
        LiveExchangeRateService.getLiveRates().catch(error => {
          logger.warn(`Background rate refresh failed for ${currencyCode}:`, error.message);
        });
      }

      const rate = STATIC_EXCHANGE_RATES[currencyCode] || 1;
      logger.debug(`CurrencyService.getExchangeRate(${currencyCode}) = ${rate} (STATIC RATE - using fallback)`);
      return rate;
    } catch (error) {
      logger.warn(`Failed to get rate for ${currencyCode}, using static:`, error.message);
      return STATIC_EXCHANGE_RATES[currencyCode] || 1;
    }
  }

  /**
   * Force refresh exchange rates and get updated rate
   * @param {string} currencyCode - Currency code
   * @returns {Promise<number>} Exchange rate to INR
   */
  static async getExchangeRateWithRefresh(currencyCode) {
    try {
      // Validate currency code
      if (!currencyCode || typeof currencyCode !== 'string') {
        logger.warn(`Invalid currency code: ${currencyCode}`);
        return 1;
      }

      logger.debug(`Force refreshing rates for ${currencyCode}...`);
      await LiveExchangeRateService.forceRefresh();

      // Get the updated rate
      const freshRates = LiveExchangeRateService.cache.get('rates');
      if (freshRates && freshRates[currencyCode]) {
        logger.debug(`CurrencyService.getExchangeRateWithRefresh(${currencyCode}) = ${freshRates[currencyCode]} (FRESH LIVE RATE)`);
        return freshRates[currencyCode];
      }

      const rate = STATIC_EXCHANGE_RATES[currencyCode] || 1;
      logger.debug(`CurrencyService.getExchangeRateWithRefresh(${currencyCode}) = ${rate} (STATIC RATE - fallback)`);
      return rate;
    } catch (error) {
      logger.warn(`Failed to get rate for ${currencyCode}, using static:`, error.message);
      return STATIC_EXCHANGE_RATES[currencyCode] || 1;
    }
  }

  /**
    * Check if GST applies to a currency (legacy function - kept for backward compatibility)
    * @param {string} currencyCode - Currency code
    * @returns {boolean} Whether GST is applicable
    */
   static isGSTApplicable(currencyCode) {
     if (!currencyCode || typeof currencyCode !== 'string') {
       logger.warn(`Invalid currency code for GST check: ${currencyCode}`);
       return false;
     }
     return isGSTApplicable(currencyCode);
   }

  /**
    * Check if GST should be applied based on client country and invoice currency
    * @param {string} currencyCode - Invoice currency code
    * @param {Object} client - Client data with country information
    * @returns {boolean} Whether GST should be applied
    */
   static shouldApplyGSTForClient(currencyCode, client) {
     // Validate inputs
     if (!currencyCode || typeof currencyCode !== 'string') {
       logger.warn(`Invalid currency code for GST check: ${currencyCode}`);
       return false;
     }
 
     // If no client data, default to GST applicable (assume Indian client)
     if (!client?.country) {
       return currencyCode === 'INR'; // Only apply GST if INR invoice
     }
 
     // Check if client is from India
     const clientCountry = (client.country || '').toLowerCase();
     const isIndianClient = clientCountry.includes('india') || clientCountry === 'republic of india';
 
     if (isIndianClient) {
       // For Indian clients, apply GST only for INR invoices
       return currencyCode === 'INR';
     } else {
       // For international clients, apply 18% GST only for INR invoices
       return currencyCode === 'INR';
     }
   }

  /**
    * Check if 18% tax should be applied for international clients
    * @param {string} currencyCode - Invoice currency code
    * @param {Object} client - Client data with country information
    * @returns {boolean} Whether 18% tax should be applied
    */
   static shouldApplyInternationalTax(currencyCode, client) {
     // Validate currency code
     if (!currencyCode || typeof currencyCode !== 'string') {
       logger.warn(`Invalid currency code for international tax check: ${currencyCode}`);
       return false;
     }
 
     // Apply 18% tax when:
     // 1. Invoice is in INR AND
     // 2. Client is from another country (not India)
     if (currencyCode !== 'INR') {
       return false;
     }
 
     if (!client?.country) {
       return false; // No client data, don't apply international tax
     }
 
     const clientCountry = (client.country || '').toLowerCase();
     const isIndianClient = clientCountry.includes('india') || clientCountry === 'republic of india';
 
     return !isIndianClient; // Apply 18% tax for non-Indian clients when INR invoice
   }

  /**
    * Check if client is from India
    * @param {Object} client - Client data
    * @returns {boolean} Whether client is Indian
    */
   static isIndianClient(client) {
     if (!client?.country) return true; // Default to Indian if no country data

     const clientCountry = String(client.country || '').toLowerCase();
     return clientCountry.includes('india') || clientCountry === 'republic of india';
   }

  /**
    * Calculate GST for INR amount (updated logic based on client country)
    * @param {number} amountINR - Amount in INR
    * @param {string} clientState - Client state for GST determination
    * @param {Object} client - Client data for country determination
    * @returns {Object} GST breakdown
    */
   static calculateGST(amountINR, clientState, client = null) {
     logger.debug(`calculateGST called with amount: ${amountINR}, client: ${client?.country}, state: ${clientState}`);
 
     // Clean the input amount first
     const cleanedInput = String(amountINR).match(/[-+]?[0-9]*\.?[0-9]+/g)?.[0] || '0';
     const cleanAmountINR = Number(cleanedInput) || 0;
 
     logger.debug(`calculateGST cleaned amount: ${amountINR} → ${cleanAmountINR}`);
 
     const isIndianClient = this.isIndianClient(client);
     logger.debug(`Is Indian client: ${isIndianClient}`);
 
     if (!isIndianClient) {
       // For international clients, apply 18% flat tax when invoicing in INR
       logger.debug('Applying international tax (18%) for non-Indian client');
       const taxRate = 18;
       const taxAmount = (cleanAmountINR * taxRate) / 100;
 
       const result = {
         cgstRate: 0,
         sgstRate: 0,
         igstRate: taxRate,  // Ensure igstRate is set for international clients
         cgstAmount: 0,
         sgstAmount: 0,
         igstAmount: taxAmount,
         totalTax: taxAmount,
         totalAmount: cleanAmountINR + taxAmount,
         isInternationalTax: true,
         taxType: 'international',
         international_tax_rate: taxRate  // Additional field for clarity
       };
 
       logger.debug(`International tax calculation result:`, result);
       return result;
     }

     // Existing GST calculation for Indian clients
     const isTelangana = (clientState || '').toLowerCase() === 'telangana';

     let cgstRate = 0, sgstRate = 0, igstRate = 0;

     if (isTelangana) {
       cgstRate = 9;
       sgstRate = 9;
     } else {
       igstRate = 18;
     }

     const cgstAmount = (cleanAmountINR * cgstRate) / 100;
     const sgstAmount = (cleanAmountINR * sgstRate) / 100;
     const igstAmount = (cleanAmountINR * igstRate) / 100;

     return {
       cgstRate,
       sgstRate,
       igstRate,
       cgstAmount,
       sgstAmount,
       igstAmount,
       totalTax: cgstAmount + sgstAmount + igstAmount,
       totalAmount: cleanAmountINR + cgstAmount + sgstAmount + igstAmount,
       isInternationalTax: false,
       taxType: 'gst'
     };
   }

  /**
      * Calculate total amount with tax for any currency (now async with live rates)
      * @param {number} amountINR - Base amount in INR
      * @param {string} currency - Display currency
      * @param {string} clientState - Client state for GST
      * @param {Object} client - Client data for country determination
      * @returns {Promise<Object>} Amount breakdown
      */
     static async calculateTotalWithTax(amountINR, currency, clientState, client = null) {
       logger.debug(`CurrencyService.calculateTotalWithTax(${amountINR} INR, ${currency}, ${clientState}, ${client?.country})`);

       // Clean the input amount first
       const cleanedInput = String(amountINR).match(/[-+]?[0-9]*\.?[0-9]+/g)?.[0] || '0';
       const cleanAmountINR = Number(cleanedInput) || 0;

       logger.debug(`calculateTotalWithTax cleaned amount: ${amountINR} → ${cleanAmountINR}`);

       const isIndianClient = this.isIndianClient(client);
       const isLocalCurrency = client && this.getDefaultCurrencyForClient(client) === currency;

       logger.debug(`Is Indian client: ${isIndianClient}, Is local currency: ${isLocalCurrency}`);

       // For international clients using their local currency: no tax, just exchange rate
       if (!isIndianClient && isLocalCurrency && currency !== 'INR') {
         const exchangeRate = await this.getExchangeRateWithRefresh(currency);
         const subtotalDisplay = await this.convertINRToCurrency(cleanAmountINR, currency);
         const totalDisplay = await this.convertINRToCurrency(cleanAmountINR, currency);
         logger.debug(`International client local currency: subtotal=${subtotalDisplay}, total=${totalDisplay}, rate=${exchangeRate}`);
         return {
           subtotalINR: cleanAmountINR,
           taxINR: 0,
           totalINR: cleanAmountINR,
           currency: currency,
           subtotalDisplay,
           taxDisplay: 0,
           totalDisplay,
           exchangeRate: exchangeRate,
           taxType: 'none'
         };
       }

       // Check if tax should be applied
       const gstApplicable = this.shouldApplyGSTForClient(currency, client);
       const internationalTaxApplicable = this.shouldApplyInternationalTax(currency, client);

       logger.debug(`GST applicable: ${gstApplicable}, International tax applicable: ${internationalTaxApplicable}`);

       if (!gstApplicable && !internationalTaxApplicable) {
         // No tax applies - use exchange rate for other currencies
         const exchangeRate = await this.getExchangeRateWithRefresh(currency);
         const subtotalDisplay = await this.convertINRToCurrency(cleanAmountINR, currency);
         const totalDisplay = await this.convertINRToCurrency(cleanAmountINR, currency);
         logger.debug(`No tax calculation: subtotal=${subtotalDisplay}, total=${totalDisplay}, rate=${exchangeRate}`);
         return {
           subtotalINR: cleanAmountINR,
           taxINR: 0,
           totalINR: cleanAmountINR,
           currency: currency,
           subtotalDisplay,
           taxDisplay: 0,
           totalDisplay,
           exchangeRate: exchangeRate,
           taxType: 'none'
         };
       }

       // Tax calculation (either GST for Indian clients or 18% for international clients)
       const gstResult = this.calculateGST(cleanAmountINR, clientState, client);
       logger.debug(`Tax calculation result:`, gstResult);

       const subtotalDisplay = await this.convertINRToCurrency(cleanAmountINR, currency);
       const taxDisplay = await this.convertINRToCurrency(gstResult.totalTax, currency);
       const totalDisplay = await this.convertINRToCurrency(gstResult.totalAmount, currency);
       const exchangeRate = await this.getExchangeRateWithRefresh(currency);

       logger.debug(`Tax calculation: subtotal=${subtotalDisplay}, tax=${taxDisplay}, total=${totalDisplay}, rate=${exchangeRate}`);

       // Ensure gstBreakdown has correct rate information for international clients
       const gstBreakdown = {
         ...gstResult,
         international_tax_rate: gstResult.isInternationalTax ? (gstResult.igstRate || 18) : gstResult.igstRate
       };

       return {
         subtotalINR: cleanAmountINR,
         taxINR: gstResult.totalTax,
         totalINR: gstResult.totalAmount,
         currency: currency,
         subtotalDisplay,
         taxDisplay,
         totalDisplay,
         exchangeRate,
         gstBreakdown,
         taxType: gstResult.taxType,
         isInternationalTax: gstResult.isInternationalTax
       };
     }

  /**
   * Validate currency selection based on client country
   * @param {string} currency - Selected currency
   * @param {Object} client - Client data
   * @returns {boolean} Whether currency is valid for client
   */
  static validateCurrencyForClient(currency, client) {
    if (!currency || typeof currency !== 'string') {
      logger.warn(`Invalid currency for validation: ${currency}`);
      return false;
    }

    if (!client?.country) return true; // Allow if no client data

    const availableCurrencies = this.getAvailableCurrenciesForClient(client);
    return availableCurrencies.includes(currency);
  }

  /**
   * Get available currencies for a client
   * @param {Object} client - Client data
   * @returns {Array} Array of available currency codes
   */
  static getAvailableCurrenciesForClient(client) {
    if (!client?.country) return ['INR'];

    const country = String(client.country || '');
    return getAvailableCurrenciesForCountry(country);
  }

  /**
   * Get default currency for a client
   * @param {Object} client - Client data
   * @returns {string} Default currency code
   */
  static getDefaultCurrencyForClient(client) {
    if (!client?.country) {
      logger.debug('CurrencyService.getDefaultCurrencyForClient - No client country, returning INR');
      return 'INR';
    }

    const country = String(client.country || '');
    const suggestedCurrency = getSuggestedCurrencyForCountry(country);

    logger.debug('CurrencyService.getDefaultCurrencyForClient:', {
      clientCountry: country,
      suggestedCurrency: suggestedCurrency,
      isJapan: country.toLowerCase().includes('japan'),
      isJapaneseYen: suggestedCurrency === 'JPY'
    });

    return suggestedCurrency;
  }

  /**
      * Prepare invoice data for storage with currency information (now async with live rates)
      * @param {Object} formData - Form data
      * @param {string} selectedCurrency - Selected currency
      * @param {Object} client - Client data
      * @returns {Promise<Object>} Prepared invoice data
      */
     static async prepareInvoiceDataForStorage(formData, selectedCurrency, client) {
       logger.debug(`CurrencyService.prepareInvoiceDataForStorage - currency: ${selectedCurrency}, subtotal: ${formData.subtotal}, client: ${client?.country}`);

       // Clean the subtotal input first
       const cleanedSubtotal = String(formData.subtotal || 0).match(/[-+]?[0-9]*\.?[0-9]+/g)?.[0] || '0';
       const subtotalInSelectedCurrency = Number(cleanedSubtotal) || 0;

       logger.debug(`Subtotal in selected currency: ${formData.subtotal} → ${subtotalInSelectedCurrency}`);

       const subtotalINR = await this.convertCurrencyToINR(subtotalInSelectedCurrency, selectedCurrency);
       logger.debug(`Subtotal in INR: ${subtotalINR}`);

       // Use new tax calculation logic based on client country
       const gstCalculation = this.calculateGST(subtotalINR, client?.state, client);
       logger.debug(`Tax calculation:`, gstCalculation);

       // Get current exchange rate for storage
       const currentExchangeRate = await this.getExchangeRateWithRefresh(selectedCurrency);
       const isLive = LiveExchangeRateService.isUsingLiveRates();
       logger.debug(`Exchange rate: ${currentExchangeRate}, isLive: ${isLive}`);

       const taxAmountDisplay = await this.convertINRToCurrency(gstCalculation.totalTax, selectedCurrency);
       const totalAmountDisplay = await this.convertINRToCurrency(gstCalculation.totalAmount, selectedCurrency);

       logger.debug(`Display amounts - tax: ${taxAmountDisplay}, total: ${totalAmountDisplay}`);

       // Determine if GST or international tax applies
       const isIndianClient = this.isIndianClient(client);
       const gstApplicable = this.shouldApplyGSTForClient(selectedCurrency, client);
       const internationalTaxApplicable = this.shouldApplyInternationalTax(selectedCurrency, client);

       return {
         ...formData,
         // Currency information
         currency: selectedCurrency,
         exchange_rate: currentExchangeRate,

         // Amounts in INR (for calculations)
         subtotal_inr: subtotalINR,
         tax_amount_inr: gstCalculation.totalTax,
         total_amount_inr: gstCalculation.totalAmount,

         // Display amounts (in selected currency)
         subtotal_display: subtotalInSelectedCurrency,
         tax_amount_display: taxAmountDisplay,
         total_amount_display: totalAmountDisplay,

         // GST breakdown (for Indian clients) or international tax (for international clients)
         ...(gstApplicable && {
           cgst: gstCalculation.cgstAmount,
           sgst: gstCalculation.sgstAmount,
           igst: gstCalculation.igstAmount,
           gst_rate_cgst: gstCalculation.cgstRate,
           gst_rate_sgst: gstCalculation.sgstRate,
           gst_rate_igst: gstCalculation.igstRate
         }),

         // International tax information
         ...(internationalTaxApplicable && {
           international_tax_rate: gstCalculation.igstRate || 18,
           international_tax_amount: gstCalculation.igstAmount,
           tax_type: gstCalculation.taxType
         }),

         // Metadata
         currency_calculated_at: new Date(),
         gst_applicable: gstApplicable,
         international_tax_applicable: internationalTaxApplicable,
         client_country: client?.country,
         // Updated debug info
         live_rates_used: isLive,
         static_rates_used: !isLive,
         exchange_rates_snapshot: isLive ?
           await LiveExchangeRateService.getLiveRates() :
           STATIC_EXCHANGE_RATES,
         rate_source: isLive ? 'live_api' : 'static_fallback'
       };
     }

  /**
    * Convert INR amount to target currency (now async with live rates)
    * @param {number} amountINR - Amount in INR
    * @param {string} targetCurrency - Target currency code
    * @returns {Promise<number>} Converted amount
    */
   static async convertINRToCurrency(amountINR, targetCurrency) {
     try {
       // Clean input first to remove any malformed characters
       const cleanedInput = String(amountINR).match(/[-+]?[0-9]*\.?[0-9]+/g)?.[0] || '0';
       const numAmount = Number(cleanedInput) || 0;

       if (!isFinite(numAmount)) {
         logger.warn(`Invalid amount for conversion: ${amountINR} (cleaned: ${cleanedInput})`);
         return 0;
       }

       if (!targetCurrency || !CURRENCIES[targetCurrency]) {
         logger.warn(`Invalid target currency: ${targetCurrency}`);
         return numAmount; // Return cleaned amount if currency invalid
       }

       const rate = await this.getExchangeRateWithRefresh(targetCurrency);
       const convertedAmount = numAmount / rate;

       if (!isFinite(convertedAmount)) {
         logger.warn(`Invalid conversion result: ${convertedAmount}`);
         return 0;
       }

       logger.debug(`convertINRToCurrency(${numAmount} INR to ${targetCurrency}) = ${convertedAmount} (rate: ${rate})`);
       return convertedAmount;
     } catch (error) {
       logger.error(`Error converting INR to ${targetCurrency}:`, error.message, error);

       // Clean fallback
       const cleanedInput = String(amountINR).replace(/[^\d.-]/g, '');
       return Number(cleanedInput) || 0;
     }
   }

  /**
    * Convert foreign currency amount to INR (now async with live rates)
    * @param {number} amount - Amount in foreign currency
    * @param {string} sourceCurrency - Source currency code
    * @returns {Promise<number>} Amount in INR
    */
   static async convertCurrencyToINR(amount, sourceCurrency) {
     try {
       // Clean input first to remove any malformed characters
       const cleanedInput = String(amount).match(/[-+]?[0-9]*\.?[0-9]+/g)?.[0] || '0';
       const numAmount = Number(cleanedInput) || 0;

       if (!isFinite(numAmount)) {
         logger.warn(`Invalid amount for conversion: ${amount} (cleaned: ${cleanedInput})`);
         return 0;
       }

       if (!sourceCurrency || !CURRENCIES[sourceCurrency]) {
         logger.warn(`Invalid source currency: ${sourceCurrency}`);
         return numAmount; // Return cleaned amount if currency invalid
       }

       const rate = await this.getExchangeRateWithRefresh(sourceCurrency);
       const amountInINR = numAmount * rate;

       if (!isFinite(amountInINR)) {
         logger.warn(`Invalid conversion result: ${amountInINR}`);
         return 0;
       }

       logger.debug(`convertCurrencyToINR(${numAmount} ${sourceCurrency} to INR) = ${amountInINR} (rate: ${rate})`);
       return amountInINR;
     } catch (error) {
       logger.error(`Error converting ${sourceCurrency} to INR:`, error.message, error);

       // Clean fallback
       const cleanedInput = String(amount).replace(/[^\d.-]/g, '');
       return Number(cleanedInput) || 0;
     }
   }

  /**
   * Format amount for PDF display (direct formatting without conversion)
   * @param {number} amount - Amount in the specified currency
   * @param {string} currency - Display currency
   * @returns {string} Formatted amount string for PDF
   */
  static formatAmountForPDF(amount, currency) {
    try {
      // Sanitize the amount first
      const sanitizedAmount = this.sanitizeAmount(amount);

      if (!isFinite(sanitizedAmount) || sanitizedAmount < 0) {
        logger.warn(`Invalid amount for PDF formatting: ${amount} (sanitized: ${sanitizedAmount})`);
        return "INR 0.00";
      }

      // Ensure we have a clean number without any special characters
      const cleanAmount = Number(sanitizedAmount.toFixed(2));

      // For INR currency, just the formatted amount
      if (currency === 'INR') {
        const formattedAmount = cleanAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return formattedAmount;
      }

      const symbol = this.getCurrencySymbol(currency);
      return `${symbol}${cleanAmount}`;
    } catch (error) {
      logger.error('Error formatting amount for PDF:', error.message, error);

      // Clean the amount before formatting fallback
      const cleanedInput = String(amount).replace(/[^\d.-]/g, '');
      const numAmount = Number(cleanedInput) || 0;

      // Fallback to basic formatting
      if (currency === 'INR') {
        return numAmount.toFixed(2);
      }

      const currencyInfo = CURRENCIES[currency];
      if (!currencyInfo) {
        return `INR ${numAmount.toFixed(2)}`;
      }

      return `${currencyInfo.symbol}${numAmount.toFixed(2)}`;
    }
  }
}

export default CurrencyService;
export { LiveExchangeRateService };