/**
 * Permission Guard - Authorization and access control
 * Handles permission checking, resource access, and business rules
 */

import { authService } from './authService';
import { logger } from '../logger';

class PermissionCache {
  constructor(ttlMs = 300000) {
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

export class PermissionGuard {
  constructor() {
    this.cache = new PermissionCache();
    this.auditLog = [];
    this.maxAuditLogSize = 10000;
  }

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

  async checkAllPermissions(permissions, context = {}) {
    for (const permission of permissions) {
      if (!(await this.checkPermission(permission, context))) {
        return false;
      }
    }
    return true;
  }

  async checkAnyPermission(permissions, context = {}) {
    for (const permission of permissions) {
      if (await this.checkPermission(permission, context)) {
        return true;
      }
    }
    return false;
  }

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

  async canEditInvoice(invoiceData) {
    if (!invoiceData) return false;

    const hasBasicPermission = await this.checkPermission('UPDATE_INVOICE', {
      invoiceId: invoiceData.id,
      invoiceData
    });

    if (!hasBasicPermission) return false;

    if (invoiceData.status === 'finalized') {
      return await this.checkPermission('ADMIN_OVERRIDE', {
        reason: 'edit_finalized_invoice',
        invoiceId: invoiceData.id
      });
    }

    if (this.isInvoiceTooOld(invoiceData)) {
      return await this.checkPermission('ADMIN_OVERRIDE', {
        reason: 'edit_old_invoice',
        invoiceId: invoiceData.id
      });
    }

    return true;
  }

  async canDeleteClient(clientData) {
    if (!clientData) return false;

    const hasBasicPermission = await this.checkPermission('DELETE_CLIENT', {
      clientId: clientData.id,
      clientData
    });

    if (!hasBasicPermission) return false;

    if (await this.clientHasActiveInvoices(clientData.id)) {
      return await this.checkPermission('ADMIN_OVERRIDE', {
        reason: 'delete_client_with_invoices',
        clientId: clientData.id
      });
    }

    return true;
  }

  async isManagement() {
    const user = authService.getCurrentUser();
    if (!user) return false;

    try {
      return await authService.checkServerSideManagementStatus();
    } catch (error) {
      console.error('Failed to check management status:', error);
      return false;
    }
  }

  async hashUid(uid) {
    const encoder = new TextEncoder();
    const data = encoder.encode(uid + 'wallsandtrends_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  hasMinimumRole(minRole) {
    return this.isManagement();
  }

  requireMinimumRole(minRole) {
    if (!this.isManagement()) {
      throw new PermissionError(
        `Management team access required`,
        'MANAGEMENT_CHECK',
        { requiredRole: minRole }
      );
    }
  }

  isAdmin() {
    return this.isManagement();
  }

  isSuperAdmin() {
    return this.isManagement();
  }

  async evaluatePermission(permission, context) {
    const user = authService.getCurrentUser();
    if (!user) return false;
    return await this.isManagement();
  }

  generateCacheKey(permission, context) {
    const userId = authService.getCurrentUser()?.uid || 'anonymous';
    const contextStr = JSON.stringify(context);
    return `${userId}:${permission}:${contextStr}`;
  }

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

  isInvoiceTooOld(invoiceData) {
    if (!invoiceData.createdAt) return false;

    const createdDate = new Date(invoiceData.createdAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return createdDate < thirtyDaysAgo;
  }

  async clientHasActiveInvoices(clientId) {
    return false; // Implementation needed based on data structure
  }

  logAudit(eventType, permission, context, result) {
    const auditEntry = {
      timestamp: new Date(),
      userId: authService.getCurrentUser()?.uid,
      eventType,
      permission,
      context,
      result,
      userAgent: navigator.userAgent,
      ipAddress: 'client-side'
    };

    this.auditLog.push(auditEntry);

    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.shift();
    }

    if (process.env.NODE_ENV === 'production') {
      logger.info('Permission audit', auditEntry);
    }
  }

  clearCache() {
    this.cache.clear();
  }

  invalidateCache(pattern) {
    this.cache.invalidate(pattern);
  }

  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }
}

export class PermissionError extends Error {
  constructor(message, permission, context = {}) {
    super(message);
    this.name = 'PermissionError';
    this.permission = permission;
    this.context = context;
    this.timestamp = new Date();
  }
}

export const permissionGuard = new PermissionGuard();

// React hooks
import React from 'react';

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
    hasPermission: (permission, context = {}) => {
      try {
        const user = authService.getCurrentUser();
        if (!user) return false;

        const userRoleLevel = authService.USER_ROLES[user.role] || 0;
        const permissionConfig = authService.PERMISSIONS[permission];

        if (!permissionConfig) return false;

        return permissionConfig.includes(userRoleLevel);
      } catch (error) {
        console.warn('Permission check failed:', error);
        return false;
      }
    },

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