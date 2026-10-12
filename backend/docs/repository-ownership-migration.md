# Repository Ownership Migration

The ownership migration creates the `Repository` table and requires every row to reference an existing `User`.

Existing filesystem snapshots under `backend/temp/repositories/<repositoryId>` do not contain an owner, and the previous schema had no repository table. The migration intentionally does not assign those snapshots to any user. Until an operator maps a snapshot to a verified user, repository endpoints return `404 Repository not found` for it.

For each retained snapshot, perform a controlled backfill only after verifying the repository ID and owner identity:

```sql
INSERT INTO "Repository" ("id", "ownerId", "createdAt", "updatedAt")
VALUES ('<repository-id>', '<verified-user-id>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

Do not infer ownership from request parameters, filenames, or the first user in the database. Unmapped snapshots may be archived or deleted separately according to the operator's retention policy; the application will not expose or reassign them automatically.