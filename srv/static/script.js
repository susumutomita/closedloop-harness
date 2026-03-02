// Closed-Loop Test Harness - SPA

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $main = () => $('#main');

// --- API ---
const api = {
  async get(url) { const r = await fetch(url); return r.json(); },
  async post(url, body) { const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); return r.json(); },
  async put(url, body) { const r = await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); return r.json(); },
  async del(url) { const r = await fetch(url, { method:'DELETE' }); return r.json(); },
};

// --- Router ---
const router = {
  go(path) { history.pushState(null, '', path); this.route(); },
  route() {
    const path = location.pathname;
    if (path === '/') return renderHarnessList();
    let m;
    if ((m = path.match(/^\/harness\/(\d+)\/run\/(\d+)$/))) return renderRunDetail(+m[1], +m[2]);
    if ((m = path.match(/^\/harness\/(\d+)$/))) return renderHarnessDetail(+m[1]);
    renderHarnessList();
  }
};
window.addEventListener('popstate', () => router.route());

// --- Render: Harness List ---
async function renderHarnessList() {
  const main = $main();
  main.innerHTML = `
    <div class="toolbar">
      <h2>📦 Test Harnesses</h2>
      <button class="btn btn-primary" onclick="showCreateHarness()">+ New Harness</button>
    </div>
    <div id="harness-form-area"></div>
    <div id="harness-list"><div class="spinner"></div></div>
  `;
  try {
    const harnesses = await api.get('/api/harnesses');
    const list = $('#harness-list');
    if (!harnesses || harnesses.length === 0) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">🧪</div><p>No harnesses yet. Create one to get started!</p></div>';
      return;
    }
    list.innerHTML = harnesses.map(h => `
      <div class="card" style="cursor:pointer" onclick="router.go('/harness/${h.id}')">
        <h3>${esc(h.name)}</h3>
        <div class="meta">${esc(h.description || 'No description')} · Base: <code>${esc(h.base_url || 'not set')}</code></div>
        <div class="meta" style="margin-top:4px">Updated: ${fmtTime(h.updated_at)}</div>
      </div>
    `).join('');
  } catch (e) {
    $('#harness-list').innerHTML = `<div class="flash flash-error">Failed to load: ${esc(e.message)}</div>`;
  }
}

function showCreateHarness() {
  const area = $('#harness-form-area');
  if (area.innerHTML) { area.innerHTML = ''; return; }
  area.innerHTML = `
    <div class="card">
      <h3>Create New Harness</h3>
      <div class="form-group"><label>Name</label><input id="h-name" placeholder="e.g. User API Tests"></div>
      <div class="form-group"><label>Description</label><input id="h-desc" placeholder="Optional description"></div>
      <div class="form-group"><label>Base URL</label><input id="h-url" placeholder="e.g. https://api.example.com"></div>
      <button class="btn btn-primary" onclick="createHarness()">Create</button>
      <button class="btn btn-ghost" onclick="$('#harness-form-area').innerHTML=''">Cancel</button>
    </div>
  `;
  $('#h-name').focus();
}

async function createHarness() {
  const name = $('#h-name').value.trim();
  if (!name) return alert('Name is required');
  await api.post('/api/harnesses', {
    name,
    description: $('#h-desc').value.trim(),
    base_url: $('#h-url').value.trim()
  });
  renderHarnessList();
}

// --- Render: Harness Detail ---
async function renderHarnessDetail(id) {
  const main = $main();
  main.innerHTML = '<div class="spinner"></div>';
  try {
    const [harness, loops, runs] = await Promise.all([
      api.get(`/api/harnesses/${id}`),
      api.get(`/api/harnesses/${id}/loops`),
      api.get(`/api/harnesses/${id}/runs`),
    ]);
    if (harness.error) { main.innerHTML = `<div class="flash flash-error">${esc(harness.error)}</div>`; return; }

    main.innerHTML = `
      <div style="margin-bottom:16px">
        <a href="/" onclick="event.preventDefault(); router.go('/')">← All Harnesses</a>
      </div>
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <div>
            <h3>${esc(harness.name)}</h3>
            <div class="meta">${esc(harness.description || '')} · Base: <code>${esc(harness.base_url || 'not set')}</code></div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btn-success" id="run-btn" onclick="executeRun(${id})">▶ Run All</button>
            <button class="btn btn-ghost btn-sm" onclick="showEditHarness(${id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteHarness(${id})">Delete</button>
          </div>
        </div>
      </div>
      <div id="edit-harness-area"></div>

      <div class="toolbar">
        <h2>🔗 Test Loops (${loops.length})</h2>
        <button class="btn btn-primary btn-sm" onclick="showCreateLoop(${id})">+ Add Loop</button>
      </div>
      <div id="loop-form-area"></div>
      <div id="loop-list">${renderLoopList(loops, id)}</div>

      <div class="toolbar" style="margin-top:24px">
        <h2>📊 Run History</h2>
      </div>
      <div id="run-list">${renderRunList(runs, id)}</div>
      <div id="run-result-area"></div>
    `;
  } catch (e) {
    main.innerHTML = `<div class="flash flash-error">Error: ${esc(e.message)}</div>`;
  }
}

function renderLoopList(loops, harnessId) {
  if (!loops || loops.length === 0) {
    return '<div class="empty"><div class="empty-icon">➰</div><p>No loops yet. Add one to define a test step.</p></div>';
  }
  return loops.map(l => `
    <div class="card" style="padding:14px">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div>
          <span class="method method-${l.method}">${l.method}</span>
          <strong style="margin-left:8px">${esc(l.name)}</strong>
          <code style="margin-left:8px; color:#888">${esc(l.path)}</code>
        </div>
        <div style="display:flex; gap:6px; align-items:center">
          <span class="badge badge-pending">expect ${l.expected_status}</span>
          <button class="btn btn-ghost btn-sm" onclick='showEditLoop(${JSON.stringify(l).replace(/'/g, "\\'")})'>Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteLoop(${l.id}, ${harnessId})">Del</button>
        </div>
      </div>
      ${l.expected_body_contains ? `<div class="meta" style="margin-top:4px">Body contains: <code>${esc(l.expected_body_contains)}</code></div>` : ''}
      ${l.extract_variable ? `<div class="meta" style="margin-top:2px">Extract: <code>\$\{${esc(l.extract_variable)}\}</code> from <code>${esc(l.extract_json_path)}</code></div>` : ''}
    </div>
  `).join('');
}

function renderRunList(runs, harnessId) {
  if (!runs || runs.length === 0) return '<div class="empty"><p>No runs yet. Hit ▶ Run All to execute.</p></div>';
  return `<table>
    <tr><th>#</th><th>Status</th><th>Started</th><th>Finished</th><th></th></tr>
    ${runs.map(r => `
      <tr style="cursor:pointer" onclick="router.go('/harness/${harnessId}/run/${r.id}')">
        <td>${r.id}</td>
        <td><span class="badge badge-${r.status}">${r.status}</span></td>
        <td>${fmtTime(r.started_at)}</td>
        <td>${r.finished_at ? fmtTime(r.finished_at) : '-'}</td>
        <td><a href="/harness/${harnessId}/run/${r.id}" onclick="event.preventDefault(); router.go('/harness/${harnessId}/run/${r.id}')">Details →</a></td>
      </tr>
    `).join('')}
  </table>`;
}

function showCreateLoop(harnessId) {
  const area = $('#loop-form-area');
  if (area.innerHTML) { area.innerHTML = ''; return; }
  area.innerHTML = loopForm(harnessId, {});
  $('#l-name').focus();
}

function loopForm(harnessId, l, isEdit = false) {
  return `
    <div class="card">
      <h3>${isEdit ? 'Edit' : 'Add'} Loop</h3>
      <div class="form-row">
        <div class="form-group"><label>Name</label><input id="l-name" value="${esc(l.name || '')}"></div>
        <div class="form-group" style="max-width:100px"><label>Order</label><input id="l-order" type="number" value="${l.sort_order || 0}"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="max-width:120px"><label>Method</label>
          <select id="l-method">
            ${['GET','POST','PUT','PATCH','DELETE'].map(m => `<option ${(l.method||'GET')===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Path</label><input id="l-path" value="${esc(l.path || '/')}" placeholder="/api/users"></div>
      </div>
      <div class="form-group"><label>Headers (JSON)</label><input id="l-headers" value='${esc(l.headers_json || '{}')}' placeholder='{"Authorization":"Bearer xxx"}'></div>
      <div class="form-group"><label>Request Body</label><textarea id="l-body">${esc(l.body || '')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Expected Status</label><input id="l-status" type="number" value="${l.expected_status || 200}"></div>
        <div class="form-group"><label>Expected Body Contains</label><input id="l-contains" value="${esc(l.expected_body_contains || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Extract JSON Path</label><input id="l-extract-path" value="${esc(l.extract_json_path || '')}" placeholder="e.g. data.id"></div>
        <div class="form-group"><label>Variable Name</label><input id="l-extract-var" value="${esc(l.extract_variable || '')}" placeholder="e.g. userId"></div>
      </div>
      ${isEdit
        ? `<button class="btn btn-primary" onclick="updateLoop(${l.id}, ${harnessId})">Update</button>`
        : `<button class="btn btn-primary" onclick="saveLoop(${harnessId})">Add Loop</button>`
      }
      <button class="btn btn-ghost" onclick="$('#loop-form-area').innerHTML=''">Cancel</button>
    </div>
  `;
}

function showEditLoop(l) {
  const area = $('#loop-form-area');
  area.innerHTML = loopForm(l.harness_id, l, true);
  $('#l-name').focus();
}

function getLoopFormData() {
  return {
    name: $('#l-name').value.trim(),
    sort_order: +$('#l-order').value || 0,
    method: $('#l-method').value,
    path: $('#l-path').value.trim() || '/',
    headers_json: $('#l-headers').value.trim() || '{}',
    body: $('#l-body').value,
    expected_status: +$('#l-status').value || 200,
    expected_body_contains: $('#l-contains').value.trim(),
    extract_json_path: $('#l-extract-path').value.trim(),
    extract_variable: $('#l-extract-var').value.trim(),
  };
}

async function saveLoop(harnessId) {
  const data = getLoopFormData();
  if (!data.name) return alert('Name is required');
  await api.post(`/api/harnesses/${harnessId}/loops`, data);
  renderHarnessDetail(harnessId);
}

async function updateLoop(loopId, harnessId) {
  const data = getLoopFormData();
  if (!data.name) return alert('Name is required');
  await api.put(`/api/loops/${loopId}`, data);
  renderHarnessDetail(harnessId);
}

async function deleteLoop(loopId, harnessId) {
  if (!confirm('Delete this loop?')) return;
  await api.del(`/api/loops/${loopId}`);
  renderHarnessDetail(harnessId);
}

async function deleteHarness(id) {
  if (!confirm('Delete this harness and all its loops and runs?')) return;
  await api.del(`/api/harnesses/${id}`);
  router.go('/');
}

function showEditHarness(id) {
  const area = $('#edit-harness-area');
  if (area.innerHTML) { area.innerHTML = ''; return; }
  // Fetch current values from the card above
  api.get(`/api/harnesses/${id}`).then(h => {
    area.innerHTML = `
      <div class="card">
        <h3>Edit Harness</h3>
        <div class="form-group"><label>Name</label><input id="eh-name" value="${esc(h.name)}"></div>
        <div class="form-group"><label>Description</label><input id="eh-desc" value="${esc(h.description)}"></div>
        <div class="form-group"><label>Base URL</label><input id="eh-url" value="${esc(h.base_url)}"></div>
        <button class="btn btn-primary" onclick="updateHarness(${id})">Save</button>
        <button class="btn btn-ghost" onclick="$('#edit-harness-area').innerHTML=''">Cancel</button>
      </div>
    `;
  });
}

async function updateHarness(id) {
  await api.put(`/api/harnesses/${id}`, {
    name: $('#eh-name').value.trim(),
    description: $('#eh-desc').value.trim(),
    base_url: $('#eh-url').value.trim(),
  });
  renderHarnessDetail(id);
}

// --- Execute Run ---
async function executeRun(harnessId) {
  const btn = $('#run-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running...';
  try {
    const result = await api.post(`/api/harnesses/${harnessId}/run`, {});
    // Show inline result
    const area = $('#run-result-area');
    if (result.run && result.steps) {
      area.innerHTML = `
        <div class="card" style="border-color:${result.run.status === 'pass' ? '#166534' : '#7f1d1d'}">
          <h3>Run #${result.run.id}: <span class="badge badge-${result.run.status}">${result.run.status}</span></h3>
          ${renderStepDetails(result.steps)}
        </div>
      `;
    }
    // Refresh run list
    const runs = await api.get(`/api/harnesses/${harnessId}/runs`);
    $('#run-list').innerHTML = renderRunList(runs, harnessId);
  } catch (e) {
    alert('Run failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '▶ Run All';
  }
}

// --- Render: Run Detail ---
async function renderRunDetail(harnessId, runId) {
  const main = $main();
  main.innerHTML = '<div class="spinner"></div>';
  try {
    const [run, steps] = await Promise.all([
      api.get(`/api/runs/${runId}`),
      api.get(`/api/runs/${runId}/steps`),
    ]);
    main.innerHTML = `
      <div style="margin-bottom:16px">
        <a href="/harness/${harnessId}" onclick="event.preventDefault(); router.go('/harness/${harnessId}')">← Back to Harness</a>
      </div>
      <div class="card">
        <h3>Run #${run.id} <span class="badge badge-${run.status}">${run.status}</span></h3>
        <div class="meta">Started: ${fmtTime(run.started_at)} · Finished: ${run.finished_at ? fmtTime(run.finished_at) : 'N/A'}</div>
      </div>
      <h2 style="margin-bottom:12px">Step Results</h2>
      ${renderStepDetails(steps)}
    `;
  } catch (e) {
    main.innerHTML = `<div class="flash flash-error">Error: ${esc(e.message)}</div>`;
  }
}

function renderStepDetails(steps) {
  if (!steps || steps.length === 0) return '<p>No steps.</p>';
  return steps.map(s => `
    <div class="step" style="border-color:${s.status === 'pass' ? '#166534' : '#7f1d1d'}">
      <div class="step-header">
        <div>
          <span class="badge badge-${s.status}">${s.status}</span>
          <span class="method method-${s.method}">${s.method}</span>
          <strong>${esc(s.loop_name)}</strong>
          <code style="color:#888">${esc(s.path)}</code>
        </div>
        <div class="meta">
          ${s.actual_status != null ? `Status: ${s.actual_status}` : ''}
          · ${s.duration_ms}ms
        </div>
      </div>
      ${s.error_message ? `<div class="flash flash-error" style="margin-top:8px;font-size:12px">${esc(s.error_message)}</div>` : ''}
      ${s.extracted_value ? `<div class="meta" style="margin-top:4px">Extracted: <code>${esc(s.extracted_value)}</code></div>` : ''}
      <div style="margin-top:6px"><a href="#" class="toggle-body" onclick="event.preventDefault();const d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.textContent=d.style.display==='none'?'Show Response Body':'Hide Response Body'" style="color:#888;font-size:12px">Show Response Body</a>
        <div class="step-detail" style="display:none">${esc(s.actual_body || '(empty)')}</div>
      </div>
    </div>
  `).join('');
}

// --- Helpers ---
function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}
function fmtTime(t) {
  if (!t) return '-';
  try { return new Date(t).toLocaleString(); } catch { return t; }
}

// --- Init ---
router.route();
