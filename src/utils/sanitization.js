/**
 * Input sanitization utilities to prevent XSS and injection attacks
 * Following security best practices for web applications
 */

export class InputSanitizer {
  /**
   * Sanitize text input for display - prevents XSS attacks
   * @param {string} input - Raw input string
   * @returns {string} Sanitized string safe for display
   */
  static sanitizeText(input) {
    if (typeof input !== 'string') return '';

    return input
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }

  /**
   * Sanitize HTML content (allow only safe tags)
   * Note: In production, use DOMPurify for comprehensive HTML sanitization
   * @param {string} input - Raw HTML input
   * @returns {string} Sanitized HTML
   */
  static sanitizeHTML(input) {
    if (typeof input !== 'string') return '';

    // Remove script tags and their content
    let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');

    return sanitized;
  }

  /**
   * Validate email format using RFC 5322 compliant regex
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  static isValidEmail(email) {
    if (typeof email !== 'string') return false;

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Sanitize and validate numeric input
   * @param {string|number} input - Raw numeric input
   * @param {object} options - Validation options
   * @returns {number} Sanitized number or 0 if invalid
   */
  static sanitizeNumber(input, options = {}) {
    const { min, max, decimals = 2, allowNegative = false } = options;

    if (input === null || input === undefined || input === '') return 0;

    // Convert to string and extract numeric pattern
    const stringInput = String(input);
    const numericMatch = stringInput.match(/-?\d*\.?\d+/);

    if (!numericMatch) return 0;

    let num = parseFloat(numericMatch[0]);

    if (isNaN(num)) return 0;

    // Apply constraints
    if (!allowNegative) num = Math.max(0, num);
    if (min !== undefined) num = Math.max(num, min);
    if (max !== undefined) num = Math.min(num, max);

    return Number(num.toFixed(decimals));
  }

  /**
   * Validate Indian GST number format
   * @param {string} gst - GST number to validate
   * @returns {boolean} True if valid GST format
   */
  static isValidGST(gst) {
    if (typeof gst !== 'string') return false;

    // GST format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanum + Z + 1 alphanum
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst.trim().toUpperCase());
  }

  /**
   * Validate PAN number format
   * @param {string} pan - PAN number to validate
   * @returns {boolean} True if valid PAN format
   */
  static isValidPAN(pan) {
    if (typeof pan !== 'string') return false;

    // PAN format: 5 letters + 4 digits + 1 letter
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.trim().toUpperCase());
  }

  /**
   * Sanitize phone number - keep only digits and basic formatting
   * @param {string} phone - Raw phone number
   * @returns {string} Sanitized phone number
   */
  static sanitizePhone(phone) {
    if (typeof phone !== 'string') return '';

    // Keep only digits, spaces, hyphens, plus signs
    return phone.replace(/[^\d\s\-\+\(\)]/g, '').trim();
  }

  /**
   * Validate phone number format (basic validation)
   * @param {string} phone - Phone number to validate
   * @returns {boolean} True if basic phone format
   */
  static isValidPhone(phone) {
    if (typeof phone !== 'string') return false;

    const cleanPhone = this.sanitizePhone(phone);
    // Basic check: 10-15 digits
    const digitCount = cleanPhone.replace(/\D/g, '').length;
    return digitCount >= 10 && digitCount <= 15;
  }

  /**
   * Sanitize address input - allow basic punctuation
   * @param {string} address - Raw address input
   * @returns {string} Sanitized address
   */
  static sanitizeAddress(address) {
    if (typeof address !== 'string') return '';

    // Allow letters, numbers, spaces, and basic punctuation
    return address.replace(/[^a-zA-Z0-9\s\.,#\-\/]/g, '').trim();
  }

  /**
   * Sanitize name input - allow only letters and spaces
   * @param {string} name - Raw name input
   * @returns {string} Sanitized name
   */
  static sanitizeName(name) {
    if (typeof name !== 'string') return '';

    // Allow only letters, spaces, and basic punctuation
    return name.replace(/[^a-zA-Z\s\.\-']/g, '').trim();
  }

  /**
   * General input sanitization for form fields
   * @param {string} input - Raw input
   * @param {string} type - Input type (text, email, number, etc.)
   * @returns {string} Sanitized input
   */
  static sanitize(input, type = 'text') {
    switch (type) {
      case 'email':
        return input.trim().toLowerCase();
      case 'number':
        return String(this.sanitizeNumber(input));
      case 'phone':
        return this.sanitizePhone(input);
      case 'name':
        return this.sanitizeName(input);
      case 'address':
        return this.sanitizeAddress(input);
      case 'gst':
      case 'pan':
        return input.trim().toUpperCase();
      default:
        return this.sanitizeText(input);
    }
  }
}