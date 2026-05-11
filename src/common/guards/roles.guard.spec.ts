import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

const mockReflector = { getAllAndOverride: jest.fn() };

function buildContext(userRole?: Role): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: userRole ? { role: userRole } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(mockReflector as unknown as Reflector);
    jest.clearAllMocks();
  });

  it('returns true when no roles metadata is set', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('returns true when required roles array is empty', () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(buildContext(Role.MEMBER))).toBe(true);
  });

  it('returns true when user has one of the required roles', () => {
    mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]);

    expect(guard.canActivate(buildContext(Role.ADMIN))).toBe(true);
  });

  it('returns false when user role is not in the required roles', () => {
    mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]);

    expect(guard.canActivate(buildContext(Role.MEMBER))).toBe(false);
  });

  it('reads metadata using ROLES_KEY from handler and class', () => {
    mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext(Role.ADMIN);

    guard.canActivate(ctx);

    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });
});
