import { SetMetadata } from '@nestjs/common';

// Keys used to check authorization values via Reflector
export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'public';

// Read the argument values from Reflector using the key
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata(PUBLIC_KEY, true);
