import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: Role;
}

export interface JwtUser {
  id: string;
  email: string;
  tenantId: string;
  role: Role;
}
