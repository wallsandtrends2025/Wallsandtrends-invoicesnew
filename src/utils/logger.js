// src/utils/logger.js
// Production-safe logging utility

class Logger {
  constructor() {
    this.isDevelopment = import.meta.env?.DEV || process.env.NODE_ENV === 'development';
    this.isProduction = !this.isDevelopment;
  }

  // Only log in development mode
  debug(message, ...args) {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  // Log info in development, silent in production
  info(message, ...args) {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  // Always log warnings (but sanitized)
  warn(message, ...args) {
    console.warn(`[WARN] ${this.sanitizeMessage(message)}`, ...args);
  }

  // Always log errors (but sanitized)
  error(message, error = null, ...args) {
    const sanitizedMessage = this.sanitizeMessage(message);
    console.error(`[ERROR] ${sanitizedMessage}`, error, ...args);

    // In production, you might want to send to error reporting service
    if (this.isProduction && error) {
      this.reportError(sanitizedMessage, error);
    }
  }

  // Sanitize sensitive data from log messages
  sanitizeMessage(message) {
    if (typeof message !== 'string') return message;

    // Remove or mask sensitive patterns
    return message
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_NUMBER]') // Credit cards
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Emails
      .replace(/\b\d{10,15}\b/g, '[PHONE]') // Phone numbers
      .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{3}\b/g, '[GST_NUMBER]') // GST numbers
      .replace(/\b[A-Z]{5}\d{4}[A-Z]{1}\b/g, '[PAN_NUMBER]'); // PAN numbers
  }

  // Report errors to external service in production
  reportError(message, error) {
    // TODO: Integrate with error reporting service like Sentry, LogRocket, etc.
    // For now, just prepare the structure
    const errorReport = {
      message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator?.userAgent,
      url: window?.location?.href
    };

    // Placeholder for error reporting service
    // Example: Sentry.captureException(error, { extra: errorReport });
    // Example: LogRocket.captureException(error, errorReport);
  }

  // Performance logging
  time(label) {
    if (this.isDevelopment) {
      console.time(`[TIMER] ${label}`);
    }
  }

  timeEnd(label) {
    if (this.isDevelopment) {
      console.timeEnd(`[TIMER] ${label}`);
    }
  }

  // Group logging for complex operations
  group(label) {
    if (this.isDevelopment) {
      console.group(`[GROUP] ${label}`);
    }
  }

  groupEnd() {
    if (this.isDevelopment) {
      console.groupEnd();
    }
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;