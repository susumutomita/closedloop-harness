-- name: ListHarnesses :many
SELECT * FROM harnesses ORDER BY updated_at DESC;

-- name: GetHarness :one
SELECT * FROM harnesses WHERE id = ?;

-- name: CreateHarness :one
INSERT INTO harnesses (name, description, base_url, created_at, updated_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateHarness :one
UPDATE harnesses SET name = ?, description = ?, base_url = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: DeleteHarness :exec
DELETE FROM harnesses WHERE id = ?;
