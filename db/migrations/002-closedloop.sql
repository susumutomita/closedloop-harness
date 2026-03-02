-- Closed-Loop Test Harness schema

-- A harness is a test suite / collection of test loops
CREATE TABLE IF NOT EXISTS harnesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    base_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A loop is a single test case within a harness
-- It defines: method, path, request body, expected status, expected body pattern
CREATE TABLE IF NOT EXISTS loops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    harness_id INTEGER NOT NULL REFERENCES harnesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    method TEXT NOT NULL DEFAULT 'GET',
    path TEXT NOT NULL DEFAULT '/',
    headers_json TEXT NOT NULL DEFAULT '{}',
    body TEXT NOT NULL DEFAULT '',
    expected_status INTEGER NOT NULL DEFAULT 200,
    expected_body_contains TEXT NOT NULL DEFAULT '',
    extract_json_path TEXT NOT NULL DEFAULT '',
    extract_variable TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A run is a single execution of a harness (all its loops)
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    harness_id INTEGER NOT NULL REFERENCES harnesses(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A step result is the outcome of executing one loop in a run
CREATE TABLE IF NOT EXISTS step_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    loop_id INTEGER NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    actual_status INTEGER,
    actual_body TEXT NOT NULL DEFAULT '',
    extracted_value TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Extracted variables from a run (shared state between loops)
CREATE TABLE IF NOT EXISTS run_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    UNIQUE(run_id, name)
);

INSERT OR IGNORE INTO migrations (migration_number, migration_name)
VALUES (002, '002-closedloop');
