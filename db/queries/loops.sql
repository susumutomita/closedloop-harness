-- name: ListLoops :many
SELECT * FROM loops WHERE harness_id = ? ORDER BY sort_order ASC, id ASC;

-- name: GetLoop :one
SELECT * FROM loops WHERE id = ?;

-- name: CreateLoop :one
INSERT INTO loops (harness_id, name, sort_order, method, path, headers_json, body, expected_status, expected_body_contains, extract_json_path, extract_variable, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateLoop :one
UPDATE loops SET name = ?, sort_order = ?, method = ?, path = ?, headers_json = ?, body = ?, expected_status = ?, expected_body_contains = ?, extract_json_path = ?, extract_variable = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: DeleteLoop :exec
DELETE FROM loops WHERE id = ?;

-- name: CountLoops :one
SELECT COUNT(*) FROM loops WHERE harness_id = ?;
