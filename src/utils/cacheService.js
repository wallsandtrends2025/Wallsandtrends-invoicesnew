/**
 * Client-Side Caching Service
 * Provides efficient caching for API calls and data fetching
 * Reduces database calls and improves performance
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Set cache entry with optional TTL
   */
  set(key, value, ttlMs = this.defaultTTL) {
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, {
      value,
      expiry,
      timestamp: Date.now()
    });
  }

  /**
   * Get cache entry if not expired
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get or set cache entry with async factory function
   */
  async getOrSet(key, factory, ttlMs = this.defaultTTL) {
    let value = this.get(key);
    if (value !== null) {
      return value;
    }

    value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let total = 0;
    let expired = 0;

    for (const entry of this.cache.values()) {
      total++;
      if (now > entry.expiry) {
        expired++;
      }
    }

    return {
      total,
      expired,
      active: total - expired,
      hitRate: total > 0 ? ((total - expired) / total * 100).toFixed(1) : 0
    };
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Auto cleanup every 10 minutes
setInterval(() => {
  cacheService.cleanup();
}, 10 * 60 * 1000);