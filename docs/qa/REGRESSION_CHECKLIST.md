# Regression Checklist

Before every main push / deploy:

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `prisma validate` + `prisma generate`
- [ ] Login as non-demo role (when real users exist)
- [ ] Today’s Tasks empty or real data (no fake counts)
- [ ] CL/24 draft → submit path
- [ ] CL/30 critical block cannot be overridden
- [ ] CA list loads; transitions enforce SoD
- [ ] Re-inspection candidate picker loads
- [ ] Reports/PDF endpoints authorize
- [ ] `/health/ready` with Mongo up
- [ ] No secrets staged
