// end-of-turn 보안 리뷰(재프롬프트 층). CLAUDE.md 섹션 13.
// 턴 종료 시 보안 민감 경로가 변경됐으면 총괄에게 보안 리뷰를 지시한다.
// warn-only: 커밋·push를 막지 않는다. 다만 설계상 "재프롬프트"라 턴은 연장된다(섹션 13 배선 주의).
// 기본 off — settings.json 의 env.ENABLE_STOP_REVIEW=1 일 때만 동작(최고위험 구간 한시 on, 구간 종료 시 0 복귀).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const crypto = require("crypto");

if (process.env.ENABLE_STOP_REVIEW !== "1") {
  process.exit(0); // 기본 off.
}

let stopHookActive = false;
try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  stopHookActive = input.stop_hook_active === true;
} catch (_) {
  process.exit(0); // 파싱 실패 시 무반응(fail-open). 기존 훅 2종과 동일 패턴.
}

// 이미 이 훅이 재프롬프트한 턴이면 재발동하지 않는다(무한 루프 방지).
if (stopHookActive) {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function git(args) {
  return execFileSync("git", args, {
    cwd: projectDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

// 리뷰 범위 = **미push 커밋만**. 에픽 단위로 push 하므로 에픽 누적분이 대상이 된다.
// (push 이후에는 자연히 비므로 다음 에픽 변경분부터 다시 잡힌다.)
//
// 워킹트리(dirty·untracked)는 일부러 제외한다. 서브에이전트가 백그라운드로 도는 구조에서는
// **턴 종료 ≠ 작업 완료**라, 워킹트리를 포함하면 매 턴 "작성 중인 미완성 코드"를 가리키게 된다.
// 미완성 코드 리뷰는 오탐만 만들고 완성 후 재리뷰가 필요해 값이 낮다. 에이전트에게는 의미 단위마다
// 커밋하도록 지시하므로 "커밋됨 = 정착됨"이 신뢰할 수 있는 완료 신호다.
let changed = [];
try {
  changed = git(["diff", "--name-only", "origin/master...HEAD"])
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
} catch (_) {
  process.exit(0); // git 실패 시 무반응(fail-open) — 턴을 막지 않는다.
}

// 보안 민감 경로. 입찰·정산·화폐·인증·인가·경매 에스크로가 대상(섹션 13 최고위험).
const SENSITIVE = [
  /domain\/bid\//i,
  /domain\/auction\//i,
  /domain\/settlement\//i,
  /domain\/(currency|account|balance)\//i,
  /domain\/(auth|member)\//i,
  /money_?hold/i,
  /infra\/config\/SecurityConfig/i,
  /(jwt|token|password|secret)/i,
  /db\/migration\//i,
];

const hits = [...new Set(changed)].filter((f) =>
  SENSITIVE.some((re) => re.test(f))
);

if (hits.length === 0) {
  process.exit(0);
}

// 동일 상태에서 매 턴 반복 발동하지 않도록 서명으로 중복 억제.
// 서명 = 리뷰 대상 파일들의 **HEAD 기준 blob 해시**. 내용이 실제로 달라질 때만 서명이 바뀐다.
//
// headSha 를 그대로 쓰지 않는다 — 민감 파일이 하나도 안 바뀌어도 무관한 커밋(문서 등) 하나에
// 서명이 바뀌어 재발동한다. 그 경고는 새 정보가 없어 경고 피로만 만들고, 피로해진 층은 무시당한다.
// 워킹트리에서 읽지 않는 이유는 위 범위 결정과 같다(작성 중 내용이 서명을 흔든다).
let signature;
try {
  signature = crypto
    .createHash("sha256")
    .update(git(["ls-tree", "HEAD", "--", ...[...hits].sort()]))
    .digest("hex");
} catch (_) {
  process.exit(0); // 서명을 못 만들면 중복 억제가 불가능 → 침묵(경고 피로 방지 우선).
}
const stateFile = path.join(projectDir, ".claude", ".stop-review-state");
try {
  if (fs.existsSync(stateFile)) {
    if (fs.readFileSync(stateFile, "utf8").trim() === signature) {
      process.exit(0); // 직전 재프롬프트 이후 변경 없음 → 침묵.
    }
  }
  fs.writeFileSync(stateFile, signature);
} catch (_) {
  // 상태 파일 실패는 무시하고 계속(중복 억제만 못 할 뿐).
}

const shown = hits.slice(0, 15);
const more = hits.length - shown.length;
const reason =
  "end-of-turn 보안 리뷰(ENABLE_STOP_REVIEW=1, 섹션 13). 미push 커밋에 보안 민감 경로 변경이 있습니다:\n" +
  shown.map((f) => `  - ${f}`).join("\n") +
  (more > 0 ? `\n  ... 외 ${more}건` : "") +
  "\n\n턴을 마치기 전에 이 변경분을 보안 관점으로 점검하세요 — 도메인 인가(주체=SecurityContext·IDOR)," +
  " 에스크로·홀드 정합, 상태 전이 경쟁조건(CAS/분산락), 입력 검증, 응답 데이터 노출." +
  " 참조: .claude/claude-security-guidance.md\n" +
  "발견이 있으면 보고하고, 없으면 '보안 점검: 이상 없음'으로 한 줄 보고하세요." +
  " 이 층은 warn-only라 커밋·push를 막지 않습니다.";

process.stdout.write(JSON.stringify({ decision: "block", reason }));
process.exit(0);
