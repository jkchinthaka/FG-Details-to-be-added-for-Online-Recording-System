# PostgreSQL migration archive (historical only)

These Prisma SQL migrations were produced when the Nelna FG API used **PostgreSQL**.

They are **not** applied against MongoDB Atlas. Prisma Migrate does not drive schema changes for the MongoDB provider in this project; use `prisma db push` / `prisma generate` instead (see `apps/api/package.json` scripts `prisma:push` and `prisma:validate`).

Keep this folder for:

- Audit trail of the former relational schema evolution
- Reference when reconciling data transforms (cuid → ObjectId, `@db.Date` → UTC midnight `DateTime`, composite join-table PKs → ObjectId + `@@unique`)
- Debugging historical production / staging Postgres snapshots

Do **not** run `prisma migrate deploy` or `prisma migrate dev` against a MongoDB `DATABASE_URL`. The package scripts `prisma:migrate:legacy` / `prisma:migrate:deploy:legacy` exist only as renamed reminders of the old Postgres workflow.
