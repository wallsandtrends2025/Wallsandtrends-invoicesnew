/**
 * Authentication Module - Main exports
 * Clean separation of authentication concerns
 */

export { authService } from './authService';
export { USER_ROLES, PERMISSIONS, useAuth, withPermission, PermissionGuard } from './authService';
export { permissionGuard, usePermission, withPermissionGuard, PermissionGuardComponent, PermissionError } from './permissionGuard';