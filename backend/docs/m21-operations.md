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

## Repository analysis lifecycle

Repository imports accept only canonical HTTPS GitHub URLs. An import creates an owner-scoped lifecycle row before cloning and returns `202` with the repository lifecycle state. Status values are `pending`, `cloning`, `analyzing`, `ready`, and `failed`; phases describe the actual stage without percentage estimates.

Use `GET /api/v1/repositories/:id/status` to inspect an owned import and `POST /api/v1/repositories/:id/retry` to retry an owned failed import. Existing intelligence endpoints return a conflict until the repository is `ready`.

Equivalent owner/source requests converge through the database uniqueness constraint. Active work is bounded to two in-process analyses, with a conditional database claim preventing multiple processes from analyzing the same row. Startup marks interrupted active jobs as failed with `PROCESS_INTERRUPTED`. Legacy repository rows default to `ready` and nullable source fields; legacy filesystem snapshots without an ownership row remain inaccessible.