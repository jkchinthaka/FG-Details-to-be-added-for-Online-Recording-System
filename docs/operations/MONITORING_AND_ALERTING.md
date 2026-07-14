# Monitoring and Alerting — Nelna FG Digital Recording System

Define alerts with Nelna IT’s platform of choice. Thresholds below are starting points.

## 1. Signals

| Signal | Source | Notes |
|--------|--------|-------|
| API liveness | `GET /health/live` | Process dead |
| API readiness | `GET /health/ready` | DB/storage |
| Aggregated health | `GET /health` | Degraded status |
| DB connectivity | readiness / DB metrics | |
| HTTP 5xx rate | Reverse proxy / APM | |
| Latency p95 | APM | |
| Disk / object storage | Host / cloud metrics | Evidence files |
| Auth failures | App logs (count `login failed`) | Brute force |
| Backup job | Scheduler exit code | |

Do **not** scrape health payloads for secrets — none should be present.

## 2. Alert catalogue

| Alert | Condition (starter) | Severity | Response |
|-------|---------------------|----------|----------|
| API unavailable | Liveness fail ≥ 2 min | Critical | Page on-call; consider rollback |
| Database unavailable | Readiness 503 / DB down ≥ 2 min | Critical | DBA + app owner |
| Repeated login failures | ≥ 20 failures / 5 min same IP or ≥ 10 / user | High | Review lockouts; block IP if abuse |
| High error rate | 5xx > 5% of requests / 5 min | High | Check deploy; rollback if new |
| Failed background sync | Future SW queue errors | Medium | When PWA sync ships |
| Failed file upload | Upload 5xx spike | Medium | Storage path / quota |
| Failed scheduled backup | Job non-zero exit | Critical | Re-run; escalate before next migrate |
| Low storage | < 15% free on file volume | High | Expand / purge temp |
| Abnormally slow response | p95 > 3s sustained 10 min | Medium | Investigate DB / N+1 |
| Repeated notification failure | Future notifier errors | Medium | When notifications ship |

## 3. Dashboards (minimum)

1. API uptime + readiness  
2. Request rate / error rate / latency  
3. DB CPU/connections  
4. Backup success timeline  

## 4. On-call

Document primary/secondary contacts in Nelna IT runbooks (not in git if personal phone numbers). Link from `docs/security/INCIDENT_RESPONSE.md`.
