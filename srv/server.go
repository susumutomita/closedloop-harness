package srv

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"srv.exe.dev/db"
	"srv.exe.dev/db/dbgen"
)

type Server struct {
	DB           *sql.DB
	Hostname     string
	TemplatesDir string
	StaticDir    string
}

func New(dbPath, hostname string) (*Server, error) {
	_, thisFile, _, _ := runtime.Caller(0)
	baseDir := filepath.Dir(thisFile)
	srv := &Server{
		Hostname:     hostname,
		TemplatesDir: filepath.Join(baseDir, "templates"),
		StaticDir:    filepath.Join(baseDir, "static"),
	}
	if err := srv.setUpDatabase(dbPath); err != nil {
		return nil, err
	}
	return srv, nil
}

func (s *Server) setUpDatabase(dbPath string) error {
	wdb, err := db.Open(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open db: %w", err)
	}
	s.DB = wdb
	if err := db.RunMigrations(wdb); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}
	return nil
}

func (s *Server) Serve(addr string) error {
	mux := http.NewServeMux()

	// SPA: serve index.html for all non-API, non-static routes
	mux.HandleFunc("GET /{$}", s.serveIndex)
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.Dir(s.StaticDir))))

	// API: Harnesses
	mux.HandleFunc("GET /api/harnesses", s.apiListHarnesses)
	mux.HandleFunc("POST /api/harnesses", s.apiCreateHarness)
	mux.HandleFunc("GET /api/harnesses/{id}", s.apiGetHarness)
	mux.HandleFunc("PUT /api/harnesses/{id}", s.apiUpdateHarness)
	mux.HandleFunc("DELETE /api/harnesses/{id}", s.apiDeleteHarness)

	// API: Loops
	mux.HandleFunc("GET /api/harnesses/{id}/loops", s.apiListLoops)
	mux.HandleFunc("POST /api/harnesses/{id}/loops", s.apiCreateLoop)
	mux.HandleFunc("PUT /api/loops/{id}", s.apiUpdateLoop)
	mux.HandleFunc("DELETE /api/loops/{id}", s.apiDeleteLoop)

	// API: Runs
	mux.HandleFunc("GET /api/harnesses/{id}/runs", s.apiListRuns)
	mux.HandleFunc("POST /api/harnesses/{id}/run", s.apiExecuteRun)
	mux.HandleFunc("GET /api/runs/{id}", s.apiGetRun)
	mux.HandleFunc("GET /api/runs/{id}/steps", s.apiListStepResults)

	// Catch-all for SPA routes
	mux.HandleFunc("GET /", s.serveIndex)

	slog.Info("starting server", "addr", addr)
	return http.ListenAndServe(addr, mux)
}

func (s *Server) serveIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, filepath.Join(s.StaticDir, "index.html"))
}

// --- JSON helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func parseID(r *http.Request) (int64, error) {
	return strconv.ParseInt(r.PathValue("id"), 10, 64)
}

// --- Harness handlers ---

func (s *Server) apiListHarnesses(w http.ResponseWriter, r *http.Request) {
	q := dbgen.New(s.DB)
	harnesses, err := q.ListHarnesses(r.Context())
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, harnesses)
}

func (s *Server) apiGetHarness(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	q := dbgen.New(s.DB)
	h, err := q.GetHarness(r.Context(), id)
	if err != nil {
		writeError(w, 404, "not found")
		return
	}
	writeJSON(w, 200, h)
}

func (s *Server) apiCreateHarness(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		BaseURL     string `json:"base_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, 400, "name is required")
		return
	}
	q := dbgen.New(s.DB)
	h, err := q.CreateHarness(r.Context(), dbgen.CreateHarnessParams{
		Name:        req.Name,
		Description: req.Description,
		BaseUrl:     req.BaseURL,
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, h)
}

func (s *Server) apiUpdateHarness(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		BaseURL     string `json:"base_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	q := dbgen.New(s.DB)
	h, err := q.UpdateHarness(r.Context(), dbgen.UpdateHarnessParams{
		Name:        req.Name,
		Description: req.Description,
		BaseUrl:     req.BaseURL,
		ID:          id,
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, h)
}

func (s *Server) apiDeleteHarness(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	q := dbgen.New(s.DB)
	if err := q.DeleteHarness(r.Context(), id); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deleted"})
}

// --- Loop handlers ---

func (s *Server) apiListLoops(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	q := dbgen.New(s.DB)
	loops, err := q.ListLoops(r.Context(), id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, loops)
}

func (s *Server) apiCreateLoop(w http.ResponseWriter, r *http.Request) {
	harnessID, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid harness id")
		return
	}
	var req struct {
		Name                 string `json:"name"`
		SortOrder            int64  `json:"sort_order"`
		Method               string `json:"method"`
		Path                 string `json:"path"`
		HeadersJSON          string `json:"headers_json"`
		Body                 string `json:"body"`
		ExpectedStatus       int64  `json:"expected_status"`
		ExpectedBodyContains string `json:"expected_body_contains"`
		ExtractJSONPath      string `json:"extract_json_path"`
		ExtractVariable      string `json:"extract_variable"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if req.Method == "" {
		req.Method = "GET"
	}
	if req.ExpectedStatus == 0 {
		req.ExpectedStatus = 200
	}
	if req.HeadersJSON == "" {
		req.HeadersJSON = "{}"
	}
	q := dbgen.New(s.DB)
	l, err := q.CreateLoop(r.Context(), dbgen.CreateLoopParams{
		HarnessID:            harnessID,
		Name:                 req.Name,
		SortOrder:            req.SortOrder,
		Method:               req.Method,
		Path:                 req.Path,
		HeadersJson:          req.HeadersJSON,
		Body:                 req.Body,
		ExpectedStatus:       req.ExpectedStatus,
		ExpectedBodyContains: req.ExpectedBodyContains,
		ExtractJsonPath:      req.ExtractJSONPath,
		ExtractVariable:      req.ExtractVariable,
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, l)
}

func (s *Server) apiUpdateLoop(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	var req struct {
		Name                 string `json:"name"`
		SortOrder            int64  `json:"sort_order"`
		Method               string `json:"method"`
		Path                 string `json:"path"`
		HeadersJSON          string `json:"headers_json"`
		Body                 string `json:"body"`
		ExpectedStatus       int64  `json:"expected_status"`
		ExpectedBodyContains string `json:"expected_body_contains"`
		ExtractJSONPath      string `json:"extract_json_path"`
		ExtractVariable      string `json:"extract_variable"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid json")
		return
	}
	if req.HeadersJSON == "" {
		req.HeadersJSON = "{}"
	}
	q := dbgen.New(s.DB)
	l, err := q.UpdateLoop(r.Context(), dbgen.UpdateLoopParams{
		Name:                 req.Name,
		SortOrder:            req.SortOrder,
		Method:               req.Method,
		Path:                 req.Path,
		HeadersJson:          req.HeadersJSON,
		Body:                 req.Body,
		ExpectedStatus:       req.ExpectedStatus,
		ExpectedBodyContains: req.ExpectedBodyContains,
		ExtractJsonPath:      req.ExtractJSONPath,
		ExtractVariable:      req.ExtractVariable,
		ID:                   id,
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, l)
}

func (s *Server) apiDeleteLoop(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	q := dbgen.New(s.DB)
	if err := q.DeleteLoop(r.Context(), id); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deleted"})
}

// --- Run handlers ---

func (s *Server) apiListRuns(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	q := dbgen.New(s.DB)
	runs, err := q.ListRuns(r.Context(), id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, runs)
}

func (s *Server) apiGetRun(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	q := dbgen.New(s.DB)
	run, err := q.GetRun(r.Context(), id)
	if err != nil {
		writeError(w, 404, "not found")
		return
	}
	writeJSON(w, 200, run)
}

func (s *Server) apiListStepResults(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	q := dbgen.New(s.DB)
	steps, err := q.ListStepResults(r.Context(), id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, steps)
}

// --- Run execution ---

func (s *Server) apiExecuteRun(w http.ResponseWriter, r *http.Request) {
	harnessID, err := parseID(r)
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	ctx := r.Context()
	q := dbgen.New(s.DB)

	// Get harness
	harness, err := q.GetHarness(ctx, harnessID)
	if err != nil {
		writeError(w, 404, "harness not found")
		return
	}

	// Get loops
	loops, err := q.ListLoops(ctx, harnessID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if len(loops) == 0 {
		writeError(w, 400, "no loops defined in this harness")
		return
	}

	// Create run
	run, err := q.CreateRun(ctx, harnessID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Execute each loop in order
	variables := make(map[string]string)
	allPassed := true
	client := &http.Client{Timeout: 30 * time.Second}

	for _, loop := range loops {
		step := s.executeStep(ctx, client, q, run.ID, loop, harness.BaseUrl, variables)
		if step.Status != "pass" {
			allPassed = false
		}
	}

	finalStatus := "pass"
	if !allPassed {
		finalStatus = "fail"
	}
	q.UpdateRunStatus(ctx, dbgen.UpdateRunStatusParams{Status: finalStatus, ID: run.ID})

	// Return the completed run
	run, _ = q.GetRun(ctx, run.ID)
	steps, _ := q.ListStepResults(ctx, run.ID)
	writeJSON(w, 200, map[string]any{
		"run":   run,
		"steps": steps,
	})
}

func (s *Server) executeStep(ctx context.Context, client *http.Client, q *dbgen.Queries, runID int64, loop dbgen.Loop, baseURL string, variables map[string]string) dbgen.StepResult {
	// Substitute variables in path and body
	path := substituteVars(loop.Path, variables)
	body := substituteVars(loop.Body, variables)
	url := strings.TrimRight(baseURL, "/") + path

	start := time.Now()

	// Build request
	var bodyReader io.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, loop.Method, url, bodyReader)
	if err != nil {
		return s.saveStepResult(ctx, q, runID, loop.ID, "fail", nil, "", err.Error(), 0)
	}

	// Parse and set headers
	if loop.HeadersJson != "" && loop.HeadersJson != "{}" {
		var headers map[string]string
		if json.Unmarshal([]byte(loop.HeadersJson), &headers) == nil {
			for k, v := range headers {
				req.Header.Set(k, substituteVars(v, variables))
			}
		}
	}
	if req.Header.Get("Content-Type") == "" && body != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Execute
	resp, err := client.Do(req)
	duration := time.Since(start).Milliseconds()
	if err != nil {
		return s.saveStepResult(ctx, q, runID, loop.ID, "fail", nil, "", err.Error(), duration)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB max
	respBodyStr := string(respBody)

	// Check status
	actualStatus := int64(resp.StatusCode)
	status := "pass"
	var errMsg string

	if actualStatus != loop.ExpectedStatus {
		status = "fail"
		errMsg = fmt.Sprintf("expected status %d, got %d", loop.ExpectedStatus, actualStatus)
	}

	// Check body contains
	if loop.ExpectedBodyContains != "" && !strings.Contains(respBodyStr, loop.ExpectedBodyContains) {
		status = "fail"
		if errMsg != "" {
			errMsg += "; "
		}
		errMsg += fmt.Sprintf("body does not contain %q", loop.ExpectedBodyContains)
	}

	// Extract variable from JSON response
	var extractedValue string
	if loop.ExtractJsonPath != "" && loop.ExtractVariable != "" {
		extractedValue = extractJSONValue(respBodyStr, loop.ExtractJsonPath)
		if extractedValue != "" {
			variables[loop.ExtractVariable] = extractedValue
			q.UpsertRunVariable(ctx, dbgen.UpsertRunVariableParams{
				RunID: runID,
				Name:  loop.ExtractVariable,
				Value: extractedValue,
			})
		}
	}

	return s.saveStepResult(ctx, q, runID, loop.ID, status, &actualStatus, respBodyStr, errMsg, duration)
}

func (s *Server) saveStepResult(ctx context.Context, q *dbgen.Queries, runID, loopID int64, status string, actualStatus *int64, actualBody, errMsg string, durationMs int64) dbgen.StepResult {
	// Truncate body for storage
	if len(actualBody) > 4096 {
		actualBody = actualBody[:4096] + "...(truncated)"
	}
	result, err := q.CreateStepResult(ctx, dbgen.CreateStepResultParams{
		RunID:        runID,
		LoopID:       loopID,
		Status:       status,
		ActualStatus: actualStatus,
		ActualBody:   actualBody,
		ErrorMessage: errMsg,
		DurationMs:   durationMs,
	})
	if err != nil {
		slog.Error("save step result", "error", err)
	}
	return result
}

// substituteVars replaces {{varName}} with variable values
func substituteVars(s string, vars map[string]string) string {
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{{"+k+"}}", v)
	}
	return s
}

// extractJSONValue extracts a simple dot-path value from JSON
// e.g., "id" extracts the top-level "id" field
// e.g., "data.id" extracts nested
func extractJSONValue(jsonStr, path string) string {
	var obj any
	if err := json.Unmarshal([]byte(jsonStr), &obj); err != nil {
		return ""
	}
	parts := strings.Split(path, ".")
	current := obj
	for _, part := range parts {
		m, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		current, ok = m[part]
		if !ok {
			return ""
		}
	}
	switch v := current.(type) {
	case string:
		return v
	case float64:
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}
