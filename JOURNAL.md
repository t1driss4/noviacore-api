# NOV-0001 — Setup Core System

**Date:** 2026-05-11
**Branch:** `flow-NOV-0001-novia-api--setup-core-system`

## Summary

Bootstrapped the Novia API from the initial scaffold into a production-ready NestJS foundation with multi-tenant authentication, role-based access control, and full tenant/user management.

## What Was Built

### Stack
- **Framework:** NestJS 10 + TypeScript
- **ORM:** Prisma 5 + PostgreSQL
- **Auth:** JWT (passport-jwt) + bcrypt
- **Validation:** class-validator + class-transformer (global `ValidationPipe`)
- **API docs:** Swagger/OpenAPI (`/docs`)
- **Security hardening:** Helmet, CORS, `@nestjs/throttler` rate limiting

### Database Schema (`prisma/schema.prisma`)

Three models:
- `User` — email/password credentials, optional name, `isSuperAdmin` flag
- `Tenant` — name, unique slug, `isActive` flag
- `UserTenant` — join table with a `Role` enum (`SUPER_ADMIN | ADMIN | MEMBER | VIEWER`), unique on `(userId, tenantId)`

### Modules

#### `AuthModule` (`src/auth/`)
- `POST /api/v1/auth/register` — creates user + first tenant in a single Prisma transaction; returns JWT
- `POST /api/v1/auth/login` — validates credentials, resolves tenant context (accepts optional `tenantId`), returns JWT
- JWT payload: `{ sub, email, tenantId, role }`
- Rate limited: 5 req/min on register, 10 req/min on login

#### `TenantsModule` (`src/tenants/`)
- Full CRUD on tenants (create, list, get, update, delete)
- Member management: list, add, update role, remove
- Role enforcement: ADMIN/SUPER_ADMIN gates on mutations; cannot assign a role higher than your own

#### `UsersModule` (`src/users/`)
- `GET /api/v1/users/me` — fetch own profile
- `PATCH /api/v1/users/me` — update name or password (bcrypt re-hash on password change)

#### `PrismaModule` (`src/prisma/`)
- Singleton `PrismaService` extending `PrismaClient`

### Common (`src/common/`)
- `HttpExceptionFilter` — normalises all exception responses
- `RolesGuard` — decorator-driven role checking
- `@CurrentUser()` decorator — extracts `JwtUser` from request
- `@Roles()` decorator
- `JwtPayload` / `JwtUser` types
- `slugify` utility — generates URL-safe tenant slugs with collision avoidance

### Bootstrap (`src/main.ts`)
- Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
- Global `HttpExceptionFilter`
- Helmet security headers
- CORS driven by `CORS_ORIGIN` env var
- Global prefix `api/v1`
- Swagger at `/docs`

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Added all runtime + dev dependencies |
| `prisma/schema.prisma` | Defined `User`, `Tenant`, `UserTenant`, `Role` enum |
| `prisma/seed.ts` | Seed script for development data |
| `src/main.ts` | Full bootstrap with security, validation, Swagger |
| `src/app.module.ts` | Wired `ConfigModule`, `PrismaModule`, `AuthModule`, `TenantsModule`, `UsersModule` |
| `src/auth/` | Auth module (controller, service, JWT strategy, guard, DTOs) |
| `src/tenants/` | Tenants module (controller, service, DTOs) |
| `src/users/` | Users module (controller, service, DTO) |
| `src/common/` | Shared filters, guards, decorators, types, utilities |

## Environment Variables Required

```
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=7d      # optional, defaults to 7d
PORT=3000              # optional, defaults to 3000
CORS_ORIGIN=           # optional, defaults to http://localhost:3000
```
