// 게이트3: git push 차단. 에이전트/세션은 push할 수 없고, 사용자가 에픽 완료 시 직접 실행한다.
// git commit 등 다른 git 하위명령은 통과. (CLAUDE.md 섹션 13)
const fs = require("fs");

let cmd = "";
try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  cmd = (input.tool_input && input.tool_input.command) || "";
} catch (_) {
  process.exit(0); // 파싱 실패 시 차단하지 않음(fail-open). 무관한 명령 차단으로 개발 중단 방지.
}

// git [전역옵션]* push  — push가 git의 하위명령일 때만. (commit 메시지 내 "push" 등 오탐 회피)
const pushRe =
  /(^|[\s;&|(`{])git(\.exe)?(\s+(-{1,2}[^\s]+(=[^\s]*)?|-C\s+[^\s]+|-c\s+[^\s]+))*\s+push(\s|$|[;&|)`])/;

if (pushRe.test(cmd)) {
  process.stderr.write(
    "게이트3 차단: git push는 에이전트/세션이 실행할 수 없습니다. 에픽 완료 시 사용자가 직접 push하세요."
  );
  process.exit(2); // exit 2 = PreToolUse 차단, stderr가 사유로 전달됨
}
process.exit(0);
