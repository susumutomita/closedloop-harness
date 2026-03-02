-- name: ListRuns :many
SELECT * FROM runs WHERE harness_id = ? ORDER BY created_at DESC LIMIT 50;

-- name: GetRun :one
SELECT * FROM runs WHERE id = ?;

-- name: CreateRun :one
INSERT INTO runs (harness_id, status, started_at, created_at)
VALUES (?, 'running', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateRunStatus :exec
UPDATE runs SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: CreateStepResult :one
INSERT INTO step_results (run_id, loop_id, status, actual_status, actual_body, extracted_value, error_message, duration_ms, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
RETURNING *;

-- name: ListStepResults :many
SELECT sr.*, l.name as loop_name, l.method, l.path, l.expected_status, l.expected_body_contains
FROM step_results sr
JOIN loops l ON sr.loop_id = l.id
WHERE sr.run_id = ?
ORDER BY sr.id ASC;

-- name: UpsertRunVariable :exec
INSERT INTO run_variables (run_id, name, value)
VALUES (?, ?, ?)
ON CONFLICT(run_id, name) DO UPDATE SET value = excluded.value;

-- name: GetRunVariables :many
SELECT * FROM run_variables WHERE run_id = ?;

-- name: CountRunsByHarness :one
SELECT COUNT(*) FROM runs WHERE harness_id = ?;

-- name: LastRunByHarness :one
SELECT * FROM runs WHERE harness_id = ? ORDER BY created_at DESC LIMIT 1;
