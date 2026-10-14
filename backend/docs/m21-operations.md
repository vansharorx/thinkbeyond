# M21 Operations

## Health endpoints

- `GET /api/v1/health/live` checks that the process can respond. It does not query PostgreSQL or require authentication.
- `GET /api/v1/health/ready` checks PostgreSQL with a bounded timeout. It returns `200` only when the database is reachable and `503` otherwise.
- `GET /api/v1/health` remains available as the legacy health endpoint.

The readiness timeout is controlled by `READINESS_TIMEOUT_MS` and must remain between 100 and 10000 milliseconds.

## Request tracing

Requests receive an `X-Request-Id` response header. A valid incoming value up to 128 characters is preserved; invalid or oversized values are replaced with a generated ID. Production logs are JSON records containing timestamp, severity, event, and request context. Query strings and authorization headers are not logged.

## Shutdown

The server handles `SIGINT` and `SIGTERM` by stopping new connections, allowing active requests to finish within the shutdown deadline, disconnecting Prisma, and then exiting. Repeated signals share the same cleanup operation.