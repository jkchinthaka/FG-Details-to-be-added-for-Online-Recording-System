# Architecture

## Overview

Nelna FG Digital Recording System is a pnpm monorepo with a Next.js Progressive Web App and a NestJS REST API backed by PostgreSQL via Prisma.

```
+------------+     REST/JSON      +------------+      Prisma      +------------+
¦  apps/web  ¦ ?----------------? ¦  apps/api  ¦ ?--------------? ¦ PostgreSQL ¦
+------------+                    +------------+                  +------------+
       ¦                                 ¦
       ?                                 ?
 packages/ui                      packages/shared
 packages/shared
```

## Applications

### `apps/web`

- Next.js App Router, TypeScript, Tailwind CSS
- Mobile-first layouts and PWA manifest
- Consumes `@nelna/ui` and `@nelna/shared`
- Talks to the API using `NEXT_PUBLIC_API_URL`

### `apps/api`

- NestJS modules, OpenAPI/Swagger at `/api/docs`
- Health endpoint at `/health`
- Prisma ORM and PostgreSQL
- Role-based access control in later phases

## Shared packages

| Package | Responsibility |
| --- | --- |
| `@nelna/shared` | Domain vocabulary, Zod schemas, brand metadata |
| `@nelna/ui` | Design tokens and reusable operational components |
| `@nelna/config` | Shared TypeScript configuration bases |

## Cross-cutting concerns

- Validation with Zod on the shared boundary
- OpenAPI documentation for API consumers
- Environment-based configuration (no committed secrets)
- Audit logging for key operational changes (database phase onward)
- Template versioning so published checklists remain historically stable

## Local ports

| Service | Default |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:3001` |
| Postgres | `localhost:5432` |

## Evolution path

1. Foundation and health checks
2. Design system and app shell
3. Domain database model
4. Authentication and authorization
5. Dynamic checklist engine
6. Operator tasks and operational record workflows
