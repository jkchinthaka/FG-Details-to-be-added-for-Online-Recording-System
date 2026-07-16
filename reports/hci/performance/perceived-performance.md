# Perceived performance

## Implemented

- Skeleton / LoadingState on template preview and session checks  
- Request sequence guards to avoid stale template/version responses  
- Offline status banner with sync retry  

## Measured (local/dev — not production claim)

| Metric | Method | Result |
| --- | --- | --- |
| LCP / INP / CLS | Lighthouse (optional) | Not claimed without run artifact |
| Route transition | Qualitative | Shell persists; content skeletons preferred |
| TTFB | Network | Environment-dependent |

## Next

Capture Lighthouse JSON under this folder when CI job is available. Do not treat Lighthouse alone as UX proof.
