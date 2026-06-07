import { CanActivateFn } from '@angular/router';

/**
 * Placeholder route guard — privilege/role checks are not enforced on the frontend.
 * Routes stay protected by `authGuard` only.
 */
export const privilegeGuard: CanActivateFn = () => true;
