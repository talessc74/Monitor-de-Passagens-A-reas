# _local EDRs Index

Engineering workflow and implementation decisions for FlySpot.

## application

Code-level implementation patterns and application conventions.

- [001-route-stats-endpoint](application/001-route-stats-endpoint.md) — `GET /api/route-stats` reuses the existing Gemini scan simulator to answer pre-monitor price queries, instead of adding a second pricing engine
