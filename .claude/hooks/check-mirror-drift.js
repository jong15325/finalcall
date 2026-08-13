// Jira 미러 드리프트 가드레일(계층①: 파일-단독 탐지). CLAUDE.md 섹션 12.
// git commit 직전, 보드 에픽 중 state≠todo 인데 jira_key 가 비어있는(=Jira 미생성) 항목을 경고.
// warn-only: 항상 exit 0(커밋 차단 안 함). 드리프트는 즉시 치명 아님·비차단 원칙(섹션 12).
// 계층②(보드 done인데 Jira 미완료)는 Jira 읽기가 필요 → 훅 대상 아님. 총괄이 HANDOVER 패리티로 대조.
const fs = require("fs");
const path = require("path");

let cmd = "";
try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  cmd = (input.tool_input && input.tool_input.command) || "";
} catch (_) {
  process.exit(0); // 파싱 실패 시 무반응(fail-open). block-git-push.js 와 동일 패턴.
}

// git commit 일 때만 동작. 무관한 Bash 명령엔 반응하지 않음(커밋 메시지 내 "commit" 오탐 회피).
const commitRe =
  /(^|[\s;&|(`{])git(\.exe)?(\s+(-{1,2}[^\s]+(=[^\s]*)?|-C\s+[^\s]+|-c\s+[^\s]+))*\s+commit(\s|$|[;&|)`])/;
if (!commitRe.test(cmd)) {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dirs = [path.join(projectDir, "docs", "board", "epics")];

// 프론트매터에서 key 값을 읽는다(첫 `---`~다음 `---` 블록의 `key: value`).
function frontmatterValue(text, key) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const line = m[1]
    .split(/\r?\n/)
    .find((l) => new RegExp("^" + key + "\\s*:").test(l));
  if (!line) return null;
  return line.slice(line.indexOf(":") + 1).trim();
}

function isEmpty(v) {
  return v === null || v === "" || v === "null" || v === "~";
}

const drift = [];
try {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md") || f.startsWith("_")) continue; // _TEMPLATE.md 등 비티켓 제외
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      if (frontmatterValue(text, "type") !== "epic") continue;
      const state = frontmatterValue(text, "state");
      if (isEmpty(state) || state === "todo") continue; // todo 는 미러 전이 전 → 정상
      const jiraKey = frontmatterValue(text, "jira_key");
      if (isEmpty(jiraKey)) {
        const id = frontmatterValue(text, "id") || f;
        drift.push(`  - ${id} (state: ${state}) — jira_key 없음`);
      }
    }
  }
} catch (_) {
  process.exit(0); // 스캔 실패 시 무반응(fail-open) — 커밋을 막지 않는다.
}

if (drift.length > 0) {
  process.stderr.write(
    "Jira 미러 드리프트 경고(계층①: Jira 에픽 미생성). state≠todo 에픽인데 jira_key 가 비어 있습니다:\n" +
      drift.join("\n") +
      "\n총괄은 상태 전이 시 미러를 즉시 반영하세요(비차단=실패 허용이지 생략 아님). 커밋은 계속 진행됩니다.\n"
  );
}
process.exit(0); // 항상 통과(warn-only).
