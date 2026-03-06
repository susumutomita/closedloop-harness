// ClosedLoop Harness - SPA with Tutorial

const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];
const $main = () => $('#main');

// ─── API ──────────────────────────────────────────
const api = {
  async get(u) { const r = await fetch(u); return r.json(); },
  async post(u, b) { const r = await fetch(u, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b)}); return r.json(); },
  async put(u, b) { const r = await fetch(u, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b)}); return r.json(); },
  async del(u) { const r = await fetch(u, {method:'DELETE'}); return r.json(); },
};

// ─── Router ───────────────────────────────────────
const router = {
  go(p) { history.pushState(null,'',p); this.route(); },
  route() {
    const p = location.pathname; let m;
    if (p === '/') return renderHome();
    if (p === '/tutorial') return tutorial.start();
    if ((m = p.match(/^\/harness\/(\d+)\/run\/(\d+)$/))) return renderRunDetail(+m[1],+m[2]);
    if ((m = p.match(/^\/harness\/(\d+)$/))) return renderHarnessDetail(+m[1]);
    renderHome();
  }
};
window.addEventListener('popstate', () => router.route());

// ─── Helpers ──────────────────────────────────────
function esc(s) { if(s==null) return ''; const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
function fmtTime(t) { if(!t) return '—'; try { return new Date(t).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}); } catch { return t; } }
function methodPill(m) { return `<span class="method method-${m}">${m}</span>`; }

// ─── HOME ─────────────────────────────────────────
async function renderHome() {
  const main = $main();
  let harnesses = [];
  try { harnesses = await api.get('/api/harnesses'); } catch(e) {}
  const hasData = harnesses && harnesses.length > 0;
  const doneTutorial = localStorage.getItem('cl_tutorial_done');

  main.innerHTML = `
    ${!hasData ? `
      <div class="hero">
        <h2>APIテストを簡単に自動化</h2>
        <p>ClosedLoopは、APIのリクエストを順番に実行して結果を検証する「クローズドループテスト」を簡単に作れるツールです。</p>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="tutorial.start()" id="start-tutorial-btn">📖 チュートリアルを始める</button>
          <button class="btn btn-ghost" onclick="showCreateHarness()">自分で作る</button>
        </div>
      </div>
      <div class="concepts">
        <div class="concept">
          <div class="concept-icon">📦</div>
          <div class="concept-title">ハーネス</div>
          <div class="concept-desc">テストスイート。テスト対象のBase URLを設定</div>
        </div>
        <div class="concept">
          <div class="concept-icon">🔗</div>
          <div class="concept-title">ループ</div>
          <div class="concept-desc">各テストステップ。HTTPリクエストと期待値を定義</div>
        </div>
        <div class="concept">
          <div class="concept-icon">▶️</div>
          <div class="concept-title">実行</div>
          <div class="concept-desc">全ループを順番に実行し結果をDBに記録</div>
        </div>
      </div>
    ` : `
      <div class="section-header">
        <span class="section-title"><span class="icon">📦</span> ハーネス一覧</span>
        <div style="display:flex;gap:8px">
          ${!doneTutorial ? '<button class="btn btn-ghost btn-sm" onclick="tutorial.start()">📖 チュートリアル</button>' : ''}
          <button class="btn btn-primary btn-sm" onclick="showCreateHarness()">＋ 新規作成</button>
        </div>
      </div>
    `}
    <div id="harness-form-area"></div>
    <div id="harness-list">
      ${hasData ? harnesses.map(h => harnessCard(h)).join('') : ''}
    </div>
  `;
}

function harnessCard(h) {
  return `
    <div class="card card-hover" onclick="router.go('/harness/${h.id}')">
      <h3>${esc(h.name)}</h3>
      ${h.description ? `<div class="desc">${esc(h.description)}</div>` : ''}
      <div class="meta">
        <code>${esc(h.base_url || '未設定')}</code>
        · 更新: ${fmtTime(h.updated_at)}
      </div>
    </div>
  `;
}

function showCreateHarness() {
  const area = $('#harness-form-area');
  if (area.innerHTML) { area.innerHTML=''; return; }
  area.innerHTML = `
    <div class="card" id="create-harness-form">
      <h3>新しいハーネスを作成</h3>
      <div class="form-group">
        <label>名前</label>
        <input id="h-name" placeholder="例: ユーザーAPI テスト">
        <div class="hint">テストスイートの名前</div>
      </div>
      <div class="form-group">
        <label>説明</label>
        <input id="h-desc" placeholder="例: ユーザー登録〜削除の一連テスト">
      </div>
      <div class="form-group">
        <label>Base URL</label>
        <input id="h-url" placeholder="例: https://api.example.com">
        <div class="hint">テスト対象APIのベースURL。各ループのパスがこのURLに追加される</div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="createHarness()">作成</button>
        <button class="btn btn-ghost" onclick="$('#harness-form-area').innerHTML=''">キャンセル</button>
      </div>
    </div>
  `;
  $('#h-name').focus();
}

async function createHarness() {
  const name = $('#h-name').value.trim();
  if (!name) return alert('名前を入力してください');
  const h = await api.post('/api/harnesses', {
    name, description: $('#h-desc').value.trim(), base_url: $('#h-url').value.trim()
  });
  if (tutorial.active && tutorial.step === 1) { tutorial.onHarnessCreated(h); return; }
  router.go(`/harness/${h.id}`);
}

// ─── HARNESS DETAIL ───────────────────────────────
async function renderHarnessDetail(id) {
  const main = $main();
  main.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const [harness, loops, runs] = await Promise.all([
      api.get(`/api/harnesses/${id}`),
      api.get(`/api/harnesses/${id}/loops`),
      api.get(`/api/harnesses/${id}/runs`),
    ]);
    if (harness.error) { main.innerHTML = `<div class="flash flash-error">${esc(harness.error)}</div>`; return; }

    main.innerHTML = `
      <a href="/" onclick="event.preventDefault();router.go('/')" class="back-link">← ハーネス一覧</a>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <h3>${esc(harness.name)}</h3>
            ${harness.description ? `<div class="desc">${esc(harness.description)}</div>` : ''}
            <div class="meta"><code>${esc(harness.base_url || '未設定')}</code></div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-run" id="run-btn" onclick="executeRun(${id})" ${loops.length===0?'disabled':''}>
              ▶ 実行
            </button>
            <button class="btn btn-ghost btn-sm" onclick="showEditHarness(${id})">編集</button>
            <button class="btn btn-danger btn-sm" onclick="deleteHarness(${id})">削除</button>
          </div>
        </div>
      </div>
      <div id="edit-harness-area"></div>

      <div class="section">
        <div class="section-header">
          <span class="section-title"><span class="icon">🔗</span> テストループ (${loops.length})</span>
          <button class="btn btn-primary btn-sm" id="add-loop-btn" onclick="showCreateLoop(${id})">＋ ループ追加</button>
        </div>
        <div id="loop-form-area"></div>
        <div id="loop-list">${renderLoopList(loops, id)}</div>
        ${loops.length === 0 ? `
          <div class="empty">
            <div class="empty-icon">🔗</div>
            <p>まだループがありません<br><strong>「＋ ループ追加」</strong>でテストステップを定義しましょう</p>
          </div>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-header">
          <span class="section-title"><span class="icon">📊</span> 実行履歴</span>
        </div>
        <div id="run-list">${renderRunList(runs, id)}</div>
        <div id="run-result-area"></div>
      </div>
    `;
  } catch (e) {
    main.innerHTML = `<div class="flash flash-error">エラー: ${esc(e.message)}</div>`;
  }
}

function renderLoopList(loops, hid) {
  if (!loops || loops.length===0) return '';
  return loops.map((l,i) => `
    <div class="card loop-card">
      <span class="loop-num">${i+1}</span>
      ${methodPill(l.method)}
      <div class="loop-info">
        <div class="loop-name">${esc(l.name)}</div>
        <div class="loop-path">${esc(l.path)}</div>
        ${l.expected_body_contains ? `<div class="loop-meta">含む: <code>${esc(l.expected_body_contains)}</code></div>` : ''}
        ${l.extract_variable ? `<div class="loop-meta">抽出: {{${esc(l.extract_variable)}}} ← <code>${esc(l.extract_json_path)}</code></div>` : ''}
      </div>
      <span class="badge badge-pending">${l.expected_status}</span>
      <div class="loop-actions">
        <button class="btn btn-ghost btn-sm" onclick='event.stopPropagation();showEditLoop(${JSON.stringify(l).replace(/'/g,"\\'")})'>編集</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteLoop(${l.id},${hid})">✕</button>
      </div>
    </div>
  `).join('');
}

function renderRunList(runs, hid) {
  if (!runs || runs.length===0) return '<div class="empty" style="padding:20px"><p>まだ実行していません。 ▶ 実行 を押してテストを開始</p></div>';
  return `<table>
    <tr><th>#</th><th>結果</th><th>開始</th><th>終了</th><th></th></tr>
    ${runs.map(r => `
      <tr class="clickable" onclick="router.go('/harness/${hid}/run/${r.id}')">
        <td>${r.id}</td>
        <td><span class="badge badge-${r.status}">${r.status==='pass'?'✓ PASS':r.status==='fail'?'✗ FAIL':r.status}</span></td>
        <td>${fmtTime(r.started_at)}</td>
        <td>${r.finished_at ? fmtTime(r.finished_at) : '—'}</td>
        <td><a href="/harness/${hid}/run/${r.id}" onclick="event.preventDefault();event.stopPropagation();router.go('/harness/${hid}/run/${r.id}')">詳細→</a></td>
      </tr>
    `).join('')}
  </table>`;
}

// ─── LOOP FORM ────────────────────────────────────
function showCreateLoop(hid) {
  const area = $('#loop-form-area');
  if (area.innerHTML) { area.innerHTML=''; return; }
  area.innerHTML = loopFormHTML(hid, {});
  $('#l-name').focus();
}

function loopFormHTML(hid, l, isEdit=false) {
  return `
    <div class="card" id="loop-form">
      <h3>${isEdit?'ループを編集':'ループを追加'}</h3>
      <div class="form-row">
        <div class="form-group" style="flex:3"><label>名前</label><input id="l-name" value="${esc(l.name||'')}" placeholder="例: ユーザー作成"></div>
        <div class="form-group" style="flex:0 0 80px"><label>順序</label><input id="l-order" type="number" value="${l.sort_order||0}"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:0 0 110px"><label>メソッド</label>
          <select id="l-method">${['GET','POST','PUT','PATCH','DELETE'].map(m=>`<option ${(l.method||'GET')===m?'selected':''}>${m}</option>`).join('')}</select>
        </div>
        <div class="form-group" style="flex:3"><label>パス</label><input id="l-path" value="${esc(l.path||'/')}" placeholder="/api/users">
          <div class="hint">Base URLに追加されるパス。{{変数名}} で変数展開可能</div>
        </div>
      </div>
      <div class="form-group"><label>ヘッダー（JSON）</label><input id="l-headers" value='${esc(l.headers_json||'{}')}' placeholder='{"Authorization":"Bearer xxx"}'></div>
      <div class="form-group"><label>リクエストボディ</label><textarea id="l-body" placeholder='POST/PUTの場合のJSONボディ。{{変数名}} 使用可'>${esc(l.body||'')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>期待ステータス</label><input id="l-status" type="number" value="${l.expected_status||200}">
          <div class="hint">このステータスコードでなければ失敗</div>
        </div>
        <div class="form-group"><label>ボディに含む文字列</label><input id="l-contains" value="${esc(l.expected_body_contains||'')}">
          <div class="hint">レスポンスにこの文字列が含まれるか確認</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>JSON抽出パス</label><input id="l-extract-path" value="${esc(l.extract_json_path||'')}" placeholder="例: id">
          <div class="hint">レスポンスJSONから値を取得（ドット区切り）</div>
        </div>
        <div class="form-group"><label>変数名</label><input id="l-extract-var" value="${esc(l.extract_variable||'')}" placeholder="例: userId">
          <div class="hint">次のループで {{変数名}} として使用可能</div>
        </div>
      </div>
      <div class="form-actions">
        ${isEdit
          ? `<button class="btn btn-primary" onclick="updateLoop(${l.id},${hid})">更新</button>`
          : `<button class="btn btn-primary" id="save-loop-btn" onclick="saveLoop(${hid})">追加</button>`
        }
        <button class="btn btn-ghost" onclick="$('#loop-form-area').innerHTML=''">キャンセル</button>
      </div>
    </div>
  `;
}

function showEditLoop(l) {
  const area = $('#loop-form-area');
  area.innerHTML = loopFormHTML(l.harness_id, l, true);
  $('#l-name').focus();
}

function getLoopFormData() {
  return {
    name: $('#l-name').value.trim(),
    sort_order: +$('#l-order').value||0,
    method: $('#l-method').value,
    path: $('#l-path').value.trim()||'/',
    headers_json: $('#l-headers').value.trim()||'{}',
    body: $('#l-body').value,
    expected_status: +$('#l-status').value||200,
    expected_body_contains: $('#l-contains').value.trim(),
    extract_json_path: $('#l-extract-path').value.trim(),
    extract_variable: $('#l-extract-var').value.trim(),
  };
}

async function saveLoop(hid) {
  const data = getLoopFormData();
  if (!data.name) return alert('名前を入力してください');
  await api.post(`/api/harnesses/${hid}/loops`, data);
  if (tutorial.active && tutorial.step === 2) { tutorial.onLoopCreated(hid); return; }
  renderHarnessDetail(hid);
}

async function updateLoop(lid, hid) {
  const data = getLoopFormData();
  if (!data.name) return alert('名前を入力してください');
  await api.put(`/api/loops/${lid}`, data);
  renderHarnessDetail(hid);
}

async function deleteLoop(lid, hid) {
  if (!confirm('このループを削除しますか？')) return;
  await api.del(`/api/loops/${lid}`);
  renderHarnessDetail(hid);
}

async function deleteHarness(id) {
  if (!confirm('このハーネスと全てのデータを削除しますか？')) return;
  await api.del(`/api/harnesses/${id}`);
  router.go('/');
}

function showEditHarness(id) {
  const area = $('#edit-harness-area');
  if (area.innerHTML) { area.innerHTML=''; return; }
  api.get(`/api/harnesses/${id}`).then(h => {
    area.innerHTML = `
      <div class="card">
        <h3>ハーネスを編集</h3>
        <div class="form-group"><label>名前</label><input id="eh-name" value="${esc(h.name)}"></div>
        <div class="form-group"><label>説明</label><input id="eh-desc" value="${esc(h.description)}"></div>
        <div class="form-group"><label>Base URL</label><input id="eh-url" value="${esc(h.base_url)}"></div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="updateHarness(${id})">保存</button>
          <button class="btn btn-ghost" onclick="$('#edit-harness-area').innerHTML=''">キャンセル</button>
        </div>
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

// ─── EXECUTE RUN ──────────────────────────────────
async function executeRun(hid) {
  const btn = $('#run-btn');
  if(btn) { btn.disabled=true; btn.innerHTML='<span class="spinner"></span> 実行中...'; }
  try {
    const result = await api.post(`/api/harnesses/${hid}/run`, {});
    const area = $('#run-result-area');
    if (result.run && result.steps) {
      const passed = result.run.status === 'pass';
      area.innerHTML = `
        <div class="card" style="border-color:${passed?'#166534':'#5c2020'}">
          <h3 style="margin-bottom:8px">Run #${result.run.id}
            <span class="badge badge-${result.run.status}">${passed?'✓ ALL PASS':'✗ FAIL'}</span>
          </h3>
          ${renderStepDetails(result.steps)}
        </div>
      `;
    }
    const runs = await api.get(`/api/harnesses/${hid}/runs`);
    $('#run-list').innerHTML = renderRunList(runs, hid);
    if (tutorial.active && tutorial.step === 3) tutorial.onRunDone(result);
  } catch(e) { alert('実行失敗: '+e.message); }
  finally { if(btn) { btn.disabled=false; btn.innerHTML='▶ 実行'; } }
}

// ─── RUN DETAIL ───────────────────────────────────
async function renderRunDetail(hid, rid) {
  const main = $main();
  main.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const [run, steps] = await Promise.all([
      api.get(`/api/runs/${rid}`), api.get(`/api/runs/${rid}/steps`),
    ]);
    const passed = run.status==='pass';
    main.innerHTML = `
      <a href="/harness/${hid}" onclick="event.preventDefault();router.go('/harness/${hid}')" class="back-link">← ハーネスに戻る</a>
      <div class="card">
        <h3>Run #${run.id} <span class="badge badge-${run.status}">${passed?'✓ PASS':'✗ FAIL'}</span></h3>
        <div class="meta">開始: ${fmtTime(run.started_at)} · 終了: ${run.finished_at ? fmtTime(run.finished_at) : '—'}</div>
      </div>
      <div class="section">
        <div class="section-title" style="margin-bottom:10px"><span class="icon">📋</span> ステップ結果</div>
        ${renderStepDetails(steps)}
      </div>
    `;
  } catch(e) { main.innerHTML = `<div class="flash flash-error">${esc(e.message)}</div>`; }
}

function renderStepDetails(steps) {
  if (!steps || steps.length===0) return '<p style="color:var(--fg3)">ステップなし</p>';
  return steps.map((s,i) => {
    const ok = s.status==='pass';
    return `
    <div class="step step-${s.status}">
      <div class="step-header">
        <div class="step-left">
          <span class="badge badge-${s.status}">${ok?'✓':'✗'}</span>
          ${methodPill(s.method)}
          <strong style="font-size:13px">${esc(s.loop_name)}</strong>
          <code style="color:var(--fg3);font-size:11px">${esc(s.path)}</code>
        </div>
        <div class="step-right">
          ${s.actual_status!=null ? s.actual_status : ''} · ${s.duration_ms}ms
        </div>
      </div>
      ${s.error_message ? `<div class="flash flash-error" style="margin-top:6px;padding:6px 10px;font-size:11px">${esc(s.error_message)}</div>` : ''}
      ${s.extracted_value ? `<div style="font-size:11px;color:var(--fg3);margin-top:4px">抽出: <code style="color:var(--green)">${esc(s.extracted_value)}</code></div>` : ''}
      <span class="step-body-toggle" onclick="const d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.textContent=d.style.display==='none'?'▸ レスポンス表示':'▾ レスポンス非表示'">▸ レスポンス表示</span>
      <div class="step-body" style="display:none">${esc(s.actual_body||'(空)')}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// TUTORIAL SYSTEM
// ═══════════════════════════════════════════════════
const tutorial = {
  active: false,
  step: 0,
  harnessId: null,

  steps: [
    { title: 'ClosedLoop チュートリアル', desc: 'APIテストの自動化を3ステップで体験しましょう。\nこのチュートリアルでは、このアプリ自身のAPIをテストするハーネスを作ります。' },
    { title: 'Step 1: ハーネスを作る', desc: 'ハーネスはテストスイートです。\nテスト対象のBase URLと名前を設定します。' },
    { title: 'Step 2: ループを追加', desc: 'ループはテストの各ステップです。\nHTTPリクエストの内容と期待する結果を定義します。' },
    { title: 'Step 3: 実行する', desc: '全ループが順番に実行され、結果がDBに保存されます。\n変数の受け渡しも自動で行われます。' },
    { title: '🎉 完了！', desc: 'おめでとうございます！\nクローズドループテストの基本を覚えました。' },
  ],

  start() {
    this.active = true;
    this.step = 0;
    this.showModal();
  },

  showModal() {
    this.removeModal();
    const s = this.steps[this.step];
    const total = this.steps.length;
    const isFirst = this.step === 0;
    const isLast = this.step === total - 1;

    const overlay = document.createElement('div');
    overlay.className = 'tut-overlay';
    overlay.id = 'tut-overlay';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'tut-modal';
    modal.id = 'tut-modal';
    modal.innerHTML = `
      <div class="tut-step-indicator">
        ${this.steps.map((_,i) => `<div class="tut-dot ${i<this.step?'done':''} ${i===this.step?'active':''}"></div>`).join('')}
      </div>
      <h2>${s.title}</h2>
      <p>${s.desc.replace(/\n/g,'<br>')}</p>
      ${this.step === 0 ? `
        <div style="background:var(--bg3);border-radius:var(--radius);padding:12px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;color:var(--fg);margin-bottom:6px">📝 このチュートリアルで作るもの:</div>
          <div style="font-size:12px;color:var(--fg2);line-height:1.6">
            1. ハーネス作成（テスト対象URLを設定）<br>
            2. ループ追加（APIを叩いて結果を検証）<br>
            3. 実行してPASS/FAILを確認
          </div>
        </div>
      ` : ''}
      ${this.step === 4 ? `
        <div style="background:var(--bg3);border-radius:var(--radius);padding:12px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;color:var(--fg);margin-bottom:6px">💡 次にやること:</div>
          <div style="font-size:12px;color:var(--fg2);line-height:1.6">
            ・ループをもっと追加してテストを充実させる<br>
            ・<code>{{変数名}}</code>でステップ間のデータ受け渡し<br>
            ・外部APIのURLを設定して本番テスト<br>
            ・実行履歴で回帰テストの結果を追跡
          </div>
        </div>
      ` : ''}
      <div class="tut-actions">
        <button class="tut-skip" onclick="tutorial.end()">${isLast ? '' : 'スキップ'}</button>
        ${isFirst ? `<button class="btn btn-primary" onclick="tutorial.next()">始める →</button>` : ''}
        ${isLast ? `<button class="btn btn-primary" onclick="tutorial.end()">閉じる</button>` : ''}
        ${!isFirst && !isLast && this.step===3 ? '' : ''}
      </div>
    `;
    document.body.appendChild(modal);
  },

  removeModal() {
    const o = $('#tut-overlay'); if(o) o.remove();
    const m = $('#tut-modal'); if(m) m.remove();
    $$('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
  },

  async next() {
    this.step++;
    if (this.step === 1) {
      // Show create harness form
      this.removeModal();
      await renderHome();
      showCreateHarness();
      // Pre-fill
      setTimeout(() => {
        const n = $('#h-name'); if(n) { n.value = 'セルフテスト'; }
        const d = $('#h-desc'); if(d) { d.value = 'このアプリのAPIをテスト'; }
        const u = $('#h-url'); if(u) { u.value = 'http://localhost:8000'; }
        const form = $('#create-harness-form'); if(form) form.classList.add('tut-highlight');
        this.showTooltip('フォームの内容を確認して「作成」を押してください');
      }, 100);
    } else if (this.step === 2) {
      this.removeModal();
    } else if (this.step === 3) {
      this.removeModal();
    }
  },

  showTooltip(msg) {
    let tip = $('#tut-tooltip');
    if (tip) tip.remove();
    tip = document.createElement('div');
    tip.id = 'tut-tooltip';
    tip.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:1000;background:var(--blue-bg);border:1px solid #2563eb;color:var(--blue);padding:10px 18px;border-radius:var(--radius);font-size:13px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:90%;text-align:center;';
    tip.textContent = msg;
    document.body.appendChild(tip);
    setTimeout(() => { if(tip.parentNode) tip.remove(); }, 6000);
  },

  removeTooltip() {
    const t = $('#tut-tooltip'); if(t) t.remove();
  },

  async onHarnessCreated(h) {
    this.harnessId = h.id;
    this.removeTooltip();
    // Navigate to harness detail
    router.go(`/harness/${h.id}`);
    await new Promise(r => setTimeout(r, 500));
    // Step 2: add a loop
    this.step = 2;
    showCreateLoop(h.id);
    setTimeout(() => {
      // Pre-fill with a GET /api/harnesses test
      const n = $('#l-name'); if(n) n.value = 'ハーネス一覧を取得';
      const m = $('#l-method'); if(m) m.value = 'GET';
      const p = $('#l-path'); if(p) p.value = '/api/harnesses';
      const s = $('#l-status'); if(s) s.value = '200';
      const c = $('#l-contains'); if(c) c.value = 'セルフテスト';
      const form = $('#loop-form'); if(form) form.classList.add('tut-highlight');
      this.showTooltip('ループの内容を確認して「追加」を押してください');
    }, 200);
  },

  async onLoopCreated(hid) {
    this.removeTooltip();
    await renderHarnessDetail(hid);
    await new Promise(r => setTimeout(r, 300));
    this.step = 3;
    const btn = $('#run-btn');
    if (btn) btn.classList.add('tut-highlight');
    this.showTooltip('「▶ 実行」ボタンを押してテストを実行しましょう！');
  },

  onRunDone(result) {
    this.removeTooltip();
    $$('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    this.step = 4;
    setTimeout(() => this.showModal(), 800);
  },

  end() {
    this.active = false;
    this.step = 0;
    this.removeModal();
    this.removeTooltip();
    localStorage.setItem('cl_tutorial_done', '1');
    if (this.harnessId) {
      router.go(`/harness/${this.harnessId}`);
    } else {
      router.go('/');
    }
  }
};

// ─── Init ─────────────────────────────────────────
router.route();
