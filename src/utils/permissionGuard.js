/**
 * Permission Guard System - Enterprise Grade
 * Implements fine-grained access control with caching and performance optimization
 * Designed for high-scale applications with millions of users
 */

import { authService, USER_ROLES, PERMISSIONS } from './authService.jsx';
import { logger } from './logger';

// ============================================================================
// PERFORMANCE OPTIMIZATION
// ============================================================================

/**
 * Permission Cache with TTL
 * Reduces database calls and improves response times
 */
class PermissionCache {
  constructor(ttlMs = 300000) { // 5 minutes default TTL
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear() {
    this.cache.clear();
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================================
// PERMISSION GUARD IMPLEMENTATION
// ============================================================================

/**
 * Core Permission Guard Class
 * Handles all permission checking with enterprise-grade features
 */
export class PermissionGuard {
  constructor() {
    this.cache = new PermissionCache();
    this.auditLog = [];
    this.maxAuditLogSize = 10000;
  }

  // ============================================================================
  // BASIC PERMISSION CHECKING
  // ============================================================================

  /**
   * Check if current user has specific permission
   * @param {string} permission - Permission to check
   * @param {Object} context - Additional context for fine-grained control
   * @returns {boolean} True if permission granted
   */
  async checkPermission(permission, context = {}) {
    const cacheKey = this.generateCacheKey(permission, context);
    const cached = this.cache.get(cacheKey);

    if (cached !== null) {
      this.logAudit('cache_hit', permission, context, cached);
      return cached;
    }

    const result = await this.evaluatePermission(permission, context);
    this.cache.set(cacheKey, result);

    this.logAudit('permission_check', permission, context, result);
    return result;
  }

  /**
   * Require permission or throw error
   * @param {string} permission - Required permission
   * @param {Object} context - Additional context
   * @throws {PermissionError} If permission denied
   */
  async requirePermission(permission, context = {}) {
    const hasPermission = await this.checkPermission(permission, context);

    if (!hasPermission) {
      const error = new PermissionError(
        `Access denied: ${permission}`,
        permission,
        context
      );

      logger.warn('Permission denied', {
        permission,
        context,
        userId: authService.getCurrentUser()?.uid,
        userRole: authService.getCurrentUser()?.role
      });

      throw error;
    }
  }

  /**
   * Check multiple permissions (AND logic)
   * @param {string[]} permissions - Array of permissions to check
   * @param {Object} context - Context for all checks
   * @returns {boolean} True if all permissions granted
   */
  async checkAllPermissions(permissions, context = {}) {
    for (const permission of permissions) {
      if (!(await this.checkPermission(permission, context))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check multiple permissions (OR logic)
   * @param {string[]} permissions - Array of permissions to check
   * @param {Object} context - Context for all checks
   * @returns {boolean} True if any permission granted
   */
  async checkAnyPermission(permissions, context = {}) {
    for (const permission of permissions) {
      if (await this.checkPermission(permission, context)) {
        return true;
      }
    }
    return false;
  }

  // ============================================================================
  // RESOURCE-SPECIFIC PERMISSION CHECKING
  // ============================================================================

  /**
   * Check permission for specific resource
   * @param {string} resourceType - Type of resource (invoice, client, project)
   * @param {string} resourceId - Resource identifier
   * @param {string} action - Action to perform (read, write, delete)
   * @param {Object} resourceData - Resource data for ownership checks
   * @returns {boolean} True if access granted
   */
  async checkResourceAccess(resourceType, resourceId, action, resourceData = {}) {
    const permission = this.mapResourceToPermission(resourceType, action);
    if (!permission) return false;

    const context = {
      resourceType,
      resourceId,
      resourceData,
      action
    };

    return await this.checkPermission(permission, context);
  }

  /**
   * Require resource access or throw error
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource identifier
   * @param {string} action - Action to perform
   * @param {Object} resourceData - Resource data
   */
  async requireResourceAccess(resourceType, resourceId, action, resourceData = {}) {
    const hasAccess = await this.checkResourceAccess(resourceType, resourceId, action, resourceData);

    if (!hasAccess) {
      throw new PermissionError(
        `Access denied to ${resourceType} ${resourceId} for ${action}`,
        this.mapResourceToPermission(resourceType, action),
        { resourceType, resourceId, action, resourceData }
      );
    }
  }

  // ============================================================================
  // BUSINESS LOGIC PERMISSION CHECKING
  // ============================================================================

  /**
   * Check if user can edit invoice (business rules)
   * @param {Object} invoiceData - Invoice data
   * @returns {boolean} True if can edit
   */
  async canEditInvoice(invoiceData) {
    // Business rules for invoice editing
    if (!invoiceData) return false;

    // Check basic permission
    const hasBasicPermission = await this.checkPermission('UPDATE_INVOICE', {
      invoiceId: invoiceData.id,
      invoiceData
    });

    if (!hasBasicPermission) return false;

    // Business rule: Cannot edit finalized invoices
    if (invoiceData.status === 'finalized') {
      return await this.checkPermission('ADMIN_OVERRIDE', {
        reason: 'edit_finalized_invoice',
        invoiceId: invoiceData.id
      });
    }

    // Business rule: Cannot edit invoices older than 30 days
    if (this.isInvoiceTooOld(invoiceData)) {
      return await this.checkPermission('ADMIN_OVERRIDE', {
        reason: 'edit_old_invoice',
        invoiceId: invoiceData.id
      });
    }

    return true;
  }

  /**
   * Check if user can delete client (business rules)
   * @param {Object} clientData - Client data
   * @returns {boolean} True if can delete
   */
  async canDeleteClient(clientData) {
    if (!clientData) return false;

    // Check basic permission
    const hasBasicPermission = await this.checkPermission('DELETE_CLIENT', {
      clientId: clientData.id,
      clientData
    });

    if (!hasBasicPermission) return false;

    // Business rule: Cannot delete clients with active invoices
    if (await this.clientHasActiveInvoices(clientData.id)) {
      return await this.checkPermission('ADMIN_OVERRIDE', {
        reason: 'delete_client_with_invoices',
        clientId: clientData.id
      });
    }

    return true;
  }

  // ============================================================================
  // ROLE-BASED CHECKING
  // ============================================================================

  /**
   * Check if user has minimum role level
   * @param {string} minRole - Minimum required role
   * @returns {boolean} True if user meets role requirement
   */
  hasMinimumRole(minRole) {
    const user = authService.getCurrentUser();
    if (!user) return false;

    const userLevel = USER_ROLES[user.role];
    const requiredLevel = USER_ROLES[minRole];

    return userLevel >= requiredLevel;
  }

  /**
   * Require minimum role or throw error
   * @param {string} minRole - Minimum required role
   */
  requireMinimumRole(minRole) {
    if (!this.hasMinimumRole(minRole)) {
      throw new PermissionError(
        `Minimum role ${minRole} required`,
        'ROLE_CHECK',
        { requiredRole: minRole }
      );
    }
  }

  /**
   * Check if user is admin or super admin
   * @returns {boolean} True if admin level access
   */
  isAdmin() {
    return this.hasMinimumRole('ADMIN');
  }

  /**
   * Check if user is super admin
   * @returns {boolean} True if super admin
   */
  isSuperAdmin() {
    const user = authService.getCurrentUser();
    return user?.role === 'SUPER_ADMIN';
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Evaluate permission against user roles and context
   * @private
   */
  async evaluatePermission(permission, context) {
    const user = authService.getCurrentUser();

    // Not authenticated
    if (!user) return false;

    // Check if permission exists
    if (!PERMISSIONS[permission]) {
      logger.warn('Unknown permission requested', { permission });
      return false;
    }

    const allowedRoles = PERMISSIONS[permission];
    const userRoleLevel = USER_ROLES[user.role];

    // Basic role check
    if (!allowedRoles.includes(userRoleLevel)) {
      return false;
    }

    // Contextual checks
    return await this.evaluateContext(permission, context, user);
  }

  /**
   * Evaluate contextual permission rules
   * @private
   */
  async evaluateContext(permission, context, user) {
    // Ownership checks
    if (context.ownerId && context.ownerId !== user.uid) {
      // Allow if user is manager or admin
      if (USER_ROLES[user.role] < USER_ROLES.MANAGER) {
        return false;
      }
    }

    // Department checks
    if (context.department && user.metadata?.department) {
      if (context.department !== user.metadata.department) {
        // Allow if user is admin
        if (USER_ROLES[user.role] < USER_ROLES.ADMIN) {
          return false;
        }
      }
    }

    // Resource-specific checks
    if (context.resourceType) {
      return await this.evaluateResourceContext(permission, context, user);
    }

    return true;
  }

  /**
   * Evaluate resource-specific context
   * @private
   */
  async evaluateResourceContext(permission, context, user) {
    const { resourceType, resourceId, action, resourceData } = context;

    switch (resourceType) {
      case 'invoice':
        return await this.evaluateInvoicePermission(permission, resourceData, user);
      case 'client':
        return await this.evaluateClientPermission(permission, resourceData, user);
      case 'project':
        return await this.evaluateProjectPermission(permission, resourceData, user);
      default:
        return true;
    }
  }

  /**
   * Evaluate invoice-specific permissions
   * @private
   */
  async evaluateInvoicePermission(permission, invoiceData, user) {
    if (!invoiceData) return true;

    // Business rules for invoices
    switch (permission) {
      case 'UPDATE_INVOICE':
        // Cannot edit finalized invoices unless admin
        if (invoiceData.status === 'finalized') {
          return USER_ROLES[user.role] >= USER_ROLES.ADMIN;
        }
        break;

      case 'DELETE_INVOICE':
        // Cannot delete invoices with payments unless super admin
        if (invoiceData.paymentStatus === 'paid') {
          return user.role === 'SUPER_ADMIN';
        }
        break;
    }

    return true;
  }

  /**
   * Evaluate client-specific permissions
   * @private
   */
  async evaluateClientPermission(permission, clientData, user) {
    if (!clientData) return true;

    // Business rules for clients
    switch (permission) {
      case 'DELETE_CLIENT':
        // Cannot delete clients with active projects unless admin
        if (await this.clientHasActiveProjects(clientData.id)) {
          return USER_ROLES[user.role] >= USER_ROLES.ADMIN;
        }
        break;
    }

    return true;
  }

  /**
   * Evaluate project-specific permissions
   * @private
   */
  async evaluateProjectPermission(permission, projectData, user) {
    if (!projectData) return true;

    // Business rules for projects
    switch (permission) {
      case 'UPDATE_PROJECT':
        // Project managers can only edit their projects
        if (user.metadata?.department === 'project_management') {
          return projectData.managerId === user.uid ||
                 USER_ROLES[user.role] >= USER_ROLES.ADMIN;
        }
        break;
    }

    return true;
  }

  /**
   * Generate cache key for permission checks
   * @private
   */
  generateCacheKey(permission, context) {
    const userId = authService.getCurrentUser()?.uid || 'anonymous';
    const contextStr = JSON.stringify(context);
    return `${userId}:${permission}:${contextStr}`;
  }

  /**
   * Map resource type and action to permission
   * @private
   */
  mapResourceToPermission(resourceType, action) {
    const mapping = {
      invoice: {
        read: 'READ_INVOICE',
        write: 'UPDATE_INVOICE',
        delete: 'DELETE_INVOICE',
        create: 'CREATE_INVOICE'
      },
      client: {
        read: 'READ_CLIENT',
        write: 'UPDATE_CLIENT',
        delete: 'DELETE_CLIENT',
        create: 'CREATE_CLIENT'
      },
      project: {
        read: 'READ_PROJECT',
        write: 'UPDATE_PROJECT',
        delete: 'DELETE_PROJECT',
        create: 'CREATE_PROJECT'
      }
    };

    return mapping[resourceType]?.[action] || null;
  }

  /**
   * Check if invoice is too old to edit
   * @private
   */
  isInvoiceTooOld(invoiceData) {
    if (!invoiceData.createdAt) return false;

    const createdDate = new Date(invoiceData.createdAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return createdDate < thirtyDaysAgo;
  }

  /**
   * Check if client has active invoices
   * @private
   */
  async clientHasActiveInvoices(clientId) {
    // This would typically query the database
    // For now, return false (implement based on your data structure)
    return false;
  }

  /**
   * Check if client has active projects
   * @private
   */
  async clientHasActiveProjects(clientId) {
    // This would typically query the database
    // For now, return false (implement based on your data structure)
    return false;
  }

  /**
   * Log audit events
   * @private
   */
  logAudit(eventType, permission, context, result) {
    const auditEntry = {
      timestamp: new Date(),
      userId: authService.getCurrentUser()?.uid,
      eventType,
      permission,
      context,
      result,
      userAgent: navigator.userAgent,
      ipAddress: 'client-side' // Would be set by server
    };

    this.auditLog.push(auditEntry);

    // Maintain max log size
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.shift();
    }

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      logger.info('Permission audit', auditEntry);
    }
  }

  /**
   * Clear permission cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Invalidate cache for specific patterns
   */
  invalidateCache(pattern) {
    this.cache.invalidate(pattern);
  }

  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }
}

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

/**
 * Permission Error Class
 * Provides detailed information about permission failures
 */
export class PermissionError extends Error {
  constructor(message, permission, context = {}) {
    super(message);
    this.name = 'PermissionError';
    this.permission = permission;
    this.context = context;
    this.timestamp = new Date();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const permissionGuard = new PermissionGuard();

// ============================================================================
// REACT HOOKS AND COMPONENTS
// ============================================================================

/**
 * React hook for permission checking
 */
export function usePermission() {
  const {
    checkPermission,
    requirePermission,
    checkAllPermissions,
    checkAnyPermission,
    checkResourceAccess,
    canEditInvoice,
    canDeleteClient,
    hasMinimumRole,
    isAdmin,
    isSuperAdmin
  } = permissionGuard;

  return {
    // Sync permission check for immediate use
    hasPermission: (permission, context = {}) => {
      try {
        const user = authService.getCurrentUser();
        if (!user) return false;
        
        // Simple synchronous permission check for immediate use
        const userRoleLevel = USER_ROLES[user.role] || 0;
        const permissionConfig = PERMISSIONS[permission];
        
        if (!permissionConfig) return false;
        
        return permissionConfig.includes(userRoleLevel);
      } catch (error) {
        console.warn('Permission check failed:', error);
        return false;
      }
    },
    
    // Async permission check for complex scenarios
    checkPermission: (permission, context = {}) => checkPermission(permission, context),
    requirePermission: (permission, context = {}) => requirePermission(permission, context),
    checkAllPermissions: (permissions, context = {}) => checkAllPermissions(permissions, context),
    checkAnyPermission: (permissions, context = {}) => checkAnyPermission(permissions, context),
    checkResourceAccess: (resourceType, resourceId, action, resourceData) =>
      checkResourceAccess(resourceType, resourceId, action, resourceData),
    canEditInvoice: (invoiceData) => canEditInvoice(invoiceData),
    canDeleteClient: (clientData) => canDeleteClient(clientData),
    hasMinimumRole: (role) => hasMinimumRole(role),
    isAdmin: () => isAdmin(),
    isSuperAdmin: () => isSuperAdmin()
  };
}

/**
 * Higher-order component for permission guarding
 */
export function withPermissionGuard(WrappedComponent, permission, context = {}) {
  return function PermissionGuardedComponent(props) {
    const [hasPermission, setHasPermission] = React.useState(null);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      permissionGuard.checkPermission(permission, context)
        .then(setHasPermission)
        .catch(setError);
    }, [permission, JSON.stringify(context)]);

    if (error) {
      return React.createElement('div', {
        className: 'text-red-600 p-4 border border-red-300 rounded'
      }, 'Error checking permissions: ' + error.message);
    }

    if (hasPermission === null) {
      return React.createElement('div', {
        className: 'text-gray-600 p-4'
      }, 'Checking permissions...');
    }

    if (!hasPermission) {
      return React.createElement('div', {
        className: 'text-red-600 p-4 border border-red-300 rounded'
      }, 'Access denied. Insufficient permissions.');
    }

    return React.createElement(WrappedComponent, props);
  };
}

/**
 * Permission guard component
 */
export function PermissionGuardComponent({ permission, context, children, fallback }) {
  const [hasPermission, setHasPermission] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    permissionGuard.checkPermission(permission, context)
      .then(setHasPermission)
      .catch(setError);
  }, [permission, JSON.stringify(context)]);

  if (error) {
    return React.createElement('div', {
      className: 'text-red-600 p-4 border border-red-300 rounded'
    }, 'Error checking permissions: ' + error.message);
  }

  if (hasPermission === null) {
    return React.createElement('div', {
      className: 'text-gray-600 p-4'
    }, 'Checking permissions...');
  }

  if (!hasPermission) {
    return fallback || React.createElement('div', {
      className: 'text-red-600 p-4 border border-red-300 rounded'
    }, 'Access denied. Insufficient permissions.');
  }

  return children;
}

// Add React import
import React from 'react';