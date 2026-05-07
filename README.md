# novia-api

REST API built with NestJS, Prisma ORM, and PostgreSQL.

## Stack

- **Framework**: NestJS 10
- **ORM**: Prisma 5
- **Database**: PostgreSQL
- **Language**: TypeScript 5
- **Validation**: class-validator + class-transformer
- **Docs**: Swagger / OpenAPI

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- npm / yarn / pnpm

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials and secrets
```

### 3. Run database migrations

```bash
npm run db:migrate:dev
```

### 4. Generate Prisma client

```bash
npm run db:generate
```

### 5. (Optional) Seed the database

```bash
npm run db:seed
```

### 6. Start the development server

```bash
npm run start:dev
```

API is available at `http://localhost:3000/api/v1`  
Swagger docs at `http://localhost:3000/docs`

## Scripts

| Script | Description |
|---|---|
| `start:dev` | Start in watch mode |
| `start:prod` | Start production build |
| `build` | Compile TypeScript |
| `test` | Run unit tests |
| `test:cov` | Run tests with coverage |
| `test:e2e` | Run end-to-end tests |
| `lint` | Run ESLint |
| `format` | Run Prettier |
| `db:migrate:dev` | Create and apply a dev migration |
| `db:migrate:deploy` | Apply pending migrations (production) |
| `db:generate` | Regenerate Prisma client |
| `db:studio` | Open Prisma Studio |
| `db:seed` | Run database seed |

## Project Structure

```
src/
├── prisma/             # PrismaService + PrismaModule (global)
├── app.module.ts       # Root module
├── app.controller.ts   # Health check endpoint
├── app.service.ts
└── main.ts             # Bootstrap & Swagger setup
prisma/
├── schema.prisma       # Database schema
└── seed.ts             # Seed script
test/
└── app.e2e-spec.ts     # E2E tests
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | HTTP port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `JWT_EXPIRES_IN` | JWT expiry duration | `7d` |

## Contributing

1. Create a feature branch from `main`
2. Follow the [conventional commits](https://www.conventionalcommits.org/) format
3. Ensure tests pass and coverage stays above 80%
4. Open a pull request
