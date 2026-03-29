# Agent OS - Tomorrow Planner MVP

AIを制御しながら業務ループを回す - 明日の仕事を自動生成して提案するシステム

## コンセプト

LLMは「提案役」であり、最終決定はルールエンジン（Governor）と人間の承認で行います。

**設計原則:**
- State管理の厳密化（状態遷移は定義済みパスのみ許可）
- ルール強制（Governor が全提案を検証）
- 監査性（全操作を AuditLog に記録）
- 承認ワークフロー（本番変更は必ず人間が承認）

## アーキテクチャ

```
Google Calendar → [Planner (LLM)] → [Governor (Rules)] → [Evaluator (Quality)]
                        ↓                    ↓                    ↓
                  Schedule Draft        Validation           Evaluation
                        ↓                    ↓                    ↓
                  [State Store] ←── [Approval Workflow] ──→ [Audit Log]
                        ↓
                  [Executor] → Slack通知 / Calendar反映
```

### モジュール構成

| モジュール | 役割 |
|-----------|------|
| **Planner** | LLMでスケジュール案を生成（mock/Anthropic/OpenAI対応） |
| **Governor** | ルールエンジンで提案を検証（会議重複・集中時間上限・信頼度チェック等） |
| **Evaluator** | 提案品質を4つの基準で評価 |
| **Executor** | Slack通知・Google Calendar反映（dry-run対応） |
| **State Store** | Drizzle ORM + SQLiteでデータ管理 |
| **Audit** | 全操作の監査ログ |

### Governor ルール

1. **no_conflict_with_meetings** - 既存会議と重複しない
2. **max_focus_hours** - 1日の集中作業は最大6時間
3. **meetings_preserved** - 会議ブロックを勝手に削除しない
4. **sufficient_information** - 情報不足なら STOP
5. **confidence_check** - 信頼度が低い場合は STOP
6. **unknown_task_check** - 不明タスクは review_required

### 状態遷移

```
draft → validated → approved → applied
  ↓        ↓           ↓
rejected rejected   rejected
```

## 技術スタック

- **Runtime**: Bun
- **Framework**: Next.js 14 (App Router)
- **ORM**: Drizzle ORM
- **DB**: SQLite (bun:sqlite)
- **Validation**: Zod
- **LLM**: Anthropic / OpenAI / Mock
- **UI**: Tailwind CSS

## セットアップ

### 前提条件

- [Bun](https://bun.sh/) v1.0+

### インストール

```bash
cd agent-os

# 依存関係インストール
bun install

# 環境変数設定
cp .env.example .env
# .env を編集（デフォルトのmockモードならそのままでOK）

# データベース初期化
bun run db:migrate

# シードデータ投入
bun run db:seed

# 開発サーバー起動
bun run dev
```

http://localhost:3000 でアクセス可能。

## API

| Endpoint | Method | 説明 |
|----------|--------|------|
| `/api/plans/generate` | POST | 明日のスケジュール案を生成 |
| `/api/plans/:id/validate` | POST | Governor でドラフトを再検証 |
| `/api/plans/:id/approve` | POST | ドラフトを承認/却下 |
| `/api/plans/:id/apply` | POST | 承認済みドラフトをカレンダーに反映 |
| `/api/audit` | GET | 監査ログ一覧 |
| `/api/tasks` | GET/POST | タスク管理 |
| `/api/drafts` | GET | ドラフト一覧 |

### 使い方の流れ

```bash
# 1. プラン生成
curl -X POST http://localhost:3000/api/plans/generate

# 2. 検証（自動で実行済みだが再検証可能）
curl -X POST http://localhost:3000/api/plans/{id}/validate

# 3. 承認
curl -X POST http://localhost:3000/api/plans/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "comment": "LGTM"}'

# 4. Dry Run
curl -X POST http://localhost:3000/api/plans/{id}/apply \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# 5. 本番反映
curl -X POST http://localhost:3000/api/plans/{id}/apply \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'

# 監査ログ確認
curl http://localhost:3000/api/audit
```

## UI画面

1. **Dashboard** (`/dashboard`) - 明日の提案一覧、優先タスク、review_required項目
2. **Draft Review** (`/drafts/:id`) - 提案の詳細、各ブロックの理由、承認/却下/編集
3. **Audit Log** (`/audit`) - 全操作の履歴一覧

## ディレクトリ構成

```
agent-os/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   │   ├── plans/generate/   # POST プラン生成
│   │   │   ├── plans/[id]/       # validate, approve, apply
│   │   │   ├── audit/            # GET 監査ログ
│   │   │   ├── tasks/            # GET/POST タスク
│   │   │   └── drafts/           # GET ドラフト一覧
│   │   ├── dashboard/            # Dashboard UI
│   │   ├── drafts/[id]/          # Draft Review UI
│   │   └── audit/                # Audit Log UI
│   ├── domain/                   # ドメインロジック
│   │   ├── types/                # Zod schemas & TypeScript types
│   │   ├── planner/              # LLM プランナー
│   │   ├── governor/             # ルールエンジン
│   │   └── evaluator/            # 品質評価
│   ├── infra/                    # インフラ層
│   │   ├── db/                   # Drizzle schema, migration, seed
│   │   ├── store/                # Repository implementations
│   │   ├── llm/                  # LLM provider abstraction
│   │   ├── calendar/             # Google Calendar integration
│   │   ├── slack/                # Slack notification
│   │   └── audit/                # Audit logger
│   └── lib/                      # Shared utilities
├── data/                         # SQLite DB (gitignored)
└── drizzle.config.ts
```

## 今後の拡張ポイント

- [ ] Google Calendar OAuth2 連携の実装
- [ ] Slack Bot の双方向連携（Slack上で承認/却下）
- [ ] ユーザー認証（NextAuth.js）
- [ ] 複数ユーザー対応
- [ ] 学習フィードバック（承認/却下パターンの学習）
- [ ] リカーリングタスクの自動検出
- [ ] カレンダー変更の差分検知とリプラン
- [ ] WebSocket でリアルタイム更新
- [ ] E2Eテスト（Playwright）
