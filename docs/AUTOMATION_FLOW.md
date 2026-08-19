# 自動生成フロー

```text
USER_BRIEF（粗いテーマ）
  ↓
RESEARCH_STATUS（未実行）
  ↓
DESIGN_DECISIONS（補完値と理由）
  ↓
GAME_SPEC
  ↓
IMPLEMENTATION_TASK
  ↓
Game Implementation
  ↓
PLAYER_AGENCY_CONTRACT
  ↓
RESPONSIVENESS_CONTRACT
  ↓
LOOP_CONTINUITY_CONTRACT
  ↓
Measurement / Growth automated review
  ↓
HUMAN_APP_REVIEW
  ↓
PUBLISH_PREVIEW（承認待ち）
```

HTTPリクエスト中に外部処理を実行する構成ではなく、各段階を独立したJSON成果物として保存する。今回は外部APIを使わない縦切り検証のため、Jobキューは未実装。GitHub Pagesは試遊プレビューとして公開し、正式公開とは分離する。
