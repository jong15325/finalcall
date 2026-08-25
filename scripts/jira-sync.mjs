#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOARD_DIRS = [
    path.join(ROOT, "docs", "board", "epics"),
    path.join(ROOT, "docs", "board", "tickets"),
];

function loadLocalEnv() {
    const envFile = path.join(ROOT, "backend", ".env");
    if (!fs.existsSync(envFile)) return;
    for (const rawLine of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key] !== undefined) continue;
        let value = rawValue.trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
}

loadLocalEnv();

const args = new Set(process.argv.slice(2));
const selectedModes = ["--local", "--check", "--apply"].filter((flag) => args.has(flag));
if (selectedModes.length > 1) {
    process.stderr.write(`실행 모드는 하나만 선택하세요: ${selectedModes.join(", ")}\n`);
    process.exit(1);
}
const mode = args.has("--apply") ? "apply" : args.has("--check") ? "check" : "local";
const verbose = args.has("--verbose");
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).toUpperCase() : null;

function usage(exitCode = 0) {
    process.stdout.write(`사용법: node scripts/jira-sync.mjs [--local|--check|--apply] [--only=FC-001|EPIC-NAME] [--verbose]\n\n`);
    process.stdout.write("  --local  파일 보드 형식만 검사합니다. 인증값이 필요 없습니다(기본값).\n");
    process.stdout.write("  --check  Jira를 읽어 드리프트를 검사합니다. Jira와 파일은 변경하지 않습니다.\n");
    process.stdout.write("  --apply  파일을 정본으로 Jira를 멱등 보정합니다. 신규 이슈의 jira_key만 파일에 기록합니다.\n");
    process.exit(exitCode);
}

if (args.has("--help") || args.has("-h")) {
    usage();
}

function scalar(value) {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "~") return null;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const inner = trimmed.slice(1, -1).trim();
        return inner ? inner.split(",").map((item) => item.trim()).filter(Boolean) : [];
    }
    return trimmed.replace(/^['"]|['"]$/g, "");
}

function parseBoardFile(file) {
    const text = fs.readFileSync(file, "utf8");
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {file, text, data: null, body: ""};
    const data = {};
    const listFields = new Set(["artifacts", "blocks", "children", "depends_on"]);
    let listKey = null;
    for (const line of match[1].split(/\r?\n/)) {
        const listMatch = line.match(/^\s+-\s+(.+)$/);
        if (listMatch && listKey) {
            data[listKey].push(scalar(listMatch[1]));
            continue;
        }
        const fieldMatch = line.match(/^([a-z_]+):\s*(.*)$/);
        if (!fieldMatch) continue;
        const [, key, raw] = fieldMatch;
        if (raw.trim() === "" && listFields.has(key)) {
            data[key] = [];
            listKey = key;
        } else {
            data[key] = scalar(raw);
            listKey = null;
        }
    }
    return {file, text, data, body: text.slice(match[0].length).trim()};
}

function loadBoard() {
    const records = [];
    for (const dir of BOARD_DIRS) {
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir).sort()) {
            if (!name.endsWith(".md") || name.startsWith("_")) continue;
            const record = parseBoardFile(path.join(dir, name));
            if (record.data && ["task", "epic"].includes(record.data.type)) records.push(record);
        }
    }
    return records;
}

function expectedSummary(record) {
    return `${record.data.id} · ${record.data.title}`;
}

function summaryMatches(record, actual) {
    if (record.data.type === "task") return actual === expectedSummary(record);
    return [
        expectedSummary(record),
        `${record.data.id}: ${record.data.title}`,
        record.data.title,
    ].includes(actual);
}

function expectedLabels(record) {
    const labels = [];
    if (record.data.owner) labels.push(`agent:${record.data.owner}`);
    if (record.data.gate) labels.push(`gate:${record.data.gate}`);
    return labels.sort();
}

function localDrift(records) {
    const drift = [];
    const warnings = [];
    const ids = new Map();
    const supportedStates = new Set(["todo", "doing", "blocked", "review", "done", "cancelled", "superseded"]);
    for (const record of records) {
        const {data, file} = record;
        const name = path.basename(file, ".md");
        if (!data.id) drift.push(`${name}: id가 없습니다.`);
        if (!data.title) drift.push(`${data.id ?? name}: title이 없습니다.`);
        if (!("jira_key" in data)) drift.push(`${data.id ?? name}: jira_key 필드가 없습니다.`);
        if (!supportedStates.has(data.state)) drift.push(`${data.id ?? name}: 지원하지 않는 state(${data.state})입니다.`);
        if (data.type === "task" && !/^FC-\d{3}$/.test(data.id ?? "")) {
            drift.push(`${name}: task id가 FC-NNN 형식이 아닙니다.`);
        }
        if (data.type === "task" && name !== data.id) {
            drift.push(`${data.id ?? name}: 파일명이 ${data.id}.md가 아닙니다.`);
        }
        if (ids.has(data.id)) drift.push(`${data.id}: id가 중복됩니다.`);
        ids.set(data.id, record);
    }
    for (const record of records) {
        const {data} = record;
        const refs = [data.epic, data.derived_from, ...(data.depends_on ?? []), ...(data.blocks ?? []),
            ...(data.children ?? [])].filter(Boolean);
        for (const ref of refs) {
            if (!ids.has(ref)) warnings.push(`${data.id}: 참조 대상 ${ref} 파일이 없습니다.`);
        }
    }
    return {drift, warnings, ids};
}

function requireRemoteConfig() {
    const required = ["JIRA_CLOUD_ID", "JIRA_API_TOKEN"];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
        throw new Error(`환경변수가 없습니다: ${missing.join(", ")}. 루트 .env 또는 현재 프로세스에 설정하세요.`);
    }
}

const cloudId = process.env.JIRA_CLOUD_ID;
const projectKey = process.env.JIRA_PROJECT_KEY || "KAN";
const apiBase = cloudId ? `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3` : null;

async function jira(method, resource, body, retryCount = 0) {
    const authorization = process.env.JIRA_ACCOUNT_EMAIL
        ? `Basic ${Buffer.from(`${process.env.JIRA_ACCOUNT_EMAIL}:${process.env.JIRA_API_TOKEN}`, "utf8").toString("base64")}`
        : `Bearer ${process.env.JIRA_API_TOKEN}`;
    const response = await fetch(`${apiBase}${resource}`, {
        method,
        headers: {
            Accept: "application/json",
            Authorization: authorization,
            ...(body ? {"Content-Type": "application/json"} : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 429) {
        if (retryCount >= 5) throw new Error(`${method} ${resource} 요청 제한 재시도 횟수를 초과했습니다.`);
        const header = Number(response.headers.get("retry-after"));
        const retryAfter = Number.isFinite(header)
            ? Math.min(Math.max(header, 1), 30)
            : Math.min(2 ** retryCount, 30);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return jira(method, resource, body, retryCount + 1);
    }
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const detail = payload?.errorMessages?.join("; ") || JSON.stringify(payload);
        throw new Error(`${method} ${resource} 실패(${response.status}): ${detail}`);
    }
    return payload;
}

function adf(record) {
    const canonicalPath = path.relative(ROOT, record.file).replaceAll("\\", "/");
    const sections = markdownSections(record.body);
    const section = (...names) => {
        for (const [heading, content] of sections) {
            if (names.some((name) => heading.toLowerCase().includes(name.toLowerCase()))) return content;
        }
        return null;
    };
    const goal = section("목표") || record.data.title;
    const dod = section("dod", "완료 기준") || "파일 티켓의 완료 조건 및 reviewer 판정을 충족";
    const lines = record.data.type === "epic"
        ? [
            `배경: ${sections.get("__preamble__") || section("왜 ", "배경") || "파일 티켓 보드에서 관리하는 FinalCall 에픽"}`,
            `목표: ${goal}`,
            `범위: ${section("범위", "분해안") || (record.data.children ?? []).join(", ") || "하위 작업 없음"}`,
            `하위 작업: ${(record.data.children ?? []).join(", ") || "없음"}`,
            `완료 기준: ${dod}`,
            `게이트: ${record.data.gate ?? "없음"}`,
            `정본 경로: ${canonicalPath}`,
        ]
        : [
            `목표: ${goal}`,
            `완료 기준: ${dod}`,
            `의존: ${(record.data.depends_on ?? []).join(", ") || "없음"}`,
            `게이트: ${record.data.gate ?? "없음"}`,
            `정본 경로: ${canonicalPath}`,
        ];
    return {
        type: "doc",
        version: 1,
        content: lines.map((line) => ({
            type: "paragraph",
            content: [{type: "text", text: line}],
        })),
    };
}

function markdownSections(body) {
    const result = new Map();
    let heading = "__preamble__";
    let lines = [];
    const flush = () => {
        const content = lines.join("\n").trim();
        if (content) result.set(heading, content);
    };
    for (const line of body.split(/\r?\n/)) {
        const match = line.match(/^#{1,6}\s+(.+)$/);
        if (match) {
            flush();
            heading = match[1].trim();
            lines = [];
        } else {
            lines.push(line);
        }
    }
    flush();
    return result;
}

function issueFields(record, ids) {
    const fields = {
        project: {key: projectKey},
        summary: expectedSummary(record),
        description: adf(record),
        issuetype: {name: record.data.type === "epic"
            ? (process.env.JIRA_EPIC_ISSUE_TYPE || "Epic")
            : (process.env.JIRA_TASK_ISSUE_TYPE || "Task")},
        labels: [...expectedLabels(record), `mirror-id:${record.data.id}`],
    };
    if (record.data.type === "task" && record.data.epic) {
        const parent = ids.get(record.data.epic);
        if (parent?.data.jira_key) fields.parent = {key: parent.data.jira_key};
    } else if (record.data.type === "task") {
        fields.parent = null;
    }
    return fields;
}

function jqlQuoted(value) {
    return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function recoverCreatedIssue(record) {
    const jql = `project = ${projectKey} AND labels = ${jqlQuoted(`mirror-id:${record.data.id}`)}`;
    const result = await jira("GET", `/search/jql?jql=${encodeURIComponent(jql)}&fields=key&maxResults=2`);
    const issues = result.issues ?? [];
    if (issues.length > 1) throw new Error(`${record.data.id}: mirror-id 라벨을 가진 Jira 이슈가 중복됩니다.`);
    return issues[0]?.key ?? null;
}

function updateJiraKey(record, key) {
    const next = record.text.replace(/^(jira_key:[\t ]*).*$/m, `$1${key}`);
    if (next === record.text) throw new Error(`${record.data.id}: jira_key 필드를 갱신할 수 없습니다.`);
    fs.writeFileSync(record.file, next, "utf8");
    record.text = next;
    record.data.jira_key = key;
}

const stateNames = {
    todo: ["할 일", "해야 할 일", "대기", "todo", "to do", "open"],
    doing: ["진행 중", "진행중", "in progress", "doing"],
    blocked: ["진행 중", "진행중", "in progress", "doing", "blocked"],
    review: ["검토 중", "검토중", "review", "in review"],
    done: ["완료", "done", "closed"],
    cancelled: ["완료", "done", "closed"],
    superseded: ["완료", "done", "closed"],
};

function statusMatches(state, name) {
    return (stateNames[state] || [state]).includes(String(name).toLowerCase());
}

async function moveState(record) {
    const key = record.data.jira_key;
    const desired = record.data.state;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const issue = await jira("GET", `/issue/${key}?fields=status`);
        if (statusMatches(desired, issue.fields.status.name)) return;
        const result = await jira("GET", `/issue/${key}/transitions`);
        const transition = result.transitions.find((item) => statusMatches(desired, item.to?.name || item.name));
        if (!transition) {
            throw new Error(`${record.data.id}: ${issue.fields.status.name}에서 ${desired}(으)로 가능한 전이가 없습니다.`);
        }
        await jira("POST", `/issue/${key}/transitions`, {transition: {id: transition.id}});
    }
    throw new Error(`${record.data.id}: 상태 전이가 수렴하지 않았습니다.`);
}

function relationSpecs(record, ids) {
    const specs = [];
    const add = (kind, outwardId, inwardId) => {
        const outward = ids.get(outwardId)?.data.jira_key;
        const inward = ids.get(inwardId)?.data.jira_key;
        if (outward && inward) specs.push({kind, outward, inward});
    };
    if (record.data.derived_from) add("Relates", record.data.id, record.data.derived_from);
    for (const dependency of record.data.depends_on ?? []) add("Blocks", dependency, record.data.id);
    for (const blocked of record.data.blocks ?? []) add("Blocks", record.data.id, blocked);
    return specs;
}

function hasLink(issue, spec, currentKey) {
    return (issue.fields.issuelinks ?? []).some((link) => {
        const name = link.type?.name?.toLowerCase();
        if (name !== spec.kind.toLowerCase()) return false;
        const outward = link.outwardIssue?.key;
        const inward = link.inwardIssue?.key;
        if (spec.kind === "Relates") {
            const other = outward || inward;
            return other === (currentKey === spec.outward ? spec.inward : spec.outward);
        }
        // Jira는 현재 issue가 outward 쪽이면 상대를 inwardIssue에,
        // 현재 issue가 inward 쪽이면 상대를 outwardIssue에 담아 반환한다.
        if (currentKey === spec.outward) return inward === spec.inward;
        if (currentKey === spec.inward) return outward === spec.outward;
        return false;
    });
}

async function ensureLinks(record, ids) {
    const specs = relationSpecs(record, ids);
    if (!specs.length) return;
    const issue = await jira("GET", `/issue/${record.data.jira_key}?fields=issuelinks`);
    for (const spec of specs) {
        if (hasLink(issue, spec, record.data.jira_key)) continue;
        await jira("POST", "/issueLink", {
            type: {name: spec.kind},
            outwardIssue: {key: spec.outward},
            inwardIssue: {key: spec.inward},
        });
    }
}

async function createMissing(records, ids) {
    for (const record of records) {
        if (record.data.jira_key) continue;
        const recoveredKey = await recoverCreatedIssue(record);
        if (recoveredKey) {
            updateJiraKey(record, recoveredKey);
            process.stdout.write(`복구 ${record.data.id} -> ${recoveredKey}\n`);
            continue;
        }
        const created = await jira("POST", "/issue", {fields: issueFields(record, ids)});
        updateJiraKey(record, created.key);
        process.stdout.write(`생성 ${record.data.id} -> ${created.key}\n`);
    }
}

function managedLabels(record) {
    return expectedLabels(record);
}

function adfText(node) {
    if (!node || typeof node !== "object") return "";
    const own = typeof node.text === "string" ? node.text : "";
    const children = Array.isArray(node.content) ? node.content.map(adfText).join(" ") : "";
    return `${own} ${children}`.replace(/\s+/g, " ").trim();
}

function descriptionMatches(record, actual) {
    const canonicalPath = path.relative(ROOT, record.file).replaceAll("\\", "/");
    return adfText(actual).includes(canonicalPath);
}

function expectedIssueType(record) {
    return record.data.type === "epic"
        ? (process.env.JIRA_EPIC_ISSUE_TYPE || "Epic")
        : (process.env.JIRA_TASK_ISSUE_TYPE || "Task");
}

function issueTypeMatches(record, actual) {
    if (actual === expectedIssueType(record)) return true;
    return record.data.type === "task" && ["Bug", "버그"].includes(actual);
}

async function inspect(record, ids) {
    const key = record.data.jira_key;
    if (!key) return [`${record.data.id}: jira_key 없음`];
    const issue = await jira("GET", `/issue/${key}?fields=summary,status,labels,parent,issuelinks,description,issuetype,project`);
    const drift = [];
    if (!summaryMatches(record, issue.fields.summary)) drift.push("summary");
    if (!statusMatches(record.data.state, issue.fields.status.name)) drift.push(`status(${issue.fields.status.name})`);
    const actualManagedLabels = (issue.fields.labels ?? [])
        .filter((label) => label.startsWith("agent:") || label.startsWith("gate:"))
        .sort();
    if (JSON.stringify(actualManagedLabels) !== JSON.stringify(managedLabels(record))) drift.push("labels");
    if (!descriptionMatches(record, issue.fields.description)) drift.push("description");
    if (!issueTypeMatches(record, issue.fields.issuetype?.name)) drift.push(`issuetype(${issue.fields.issuetype?.name})`);
    if (issue.fields.project?.key !== projectKey) drift.push(`project(${issue.fields.project?.key})`);
    const expectedParent = record.data.epic ? ids.get(record.data.epic)?.data.jira_key : null;
    if ((issue.fields.parent?.key ?? null) !== (expectedParent ?? null)) drift.push("parent");
    for (const spec of relationSpecs(record, ids)) {
        if (!hasLink(issue, spec, key)) drift.push(`link(${spec.kind}:${spec.outward}->${spec.inward})`);
    }
    return drift.map((item) => `${record.data.id}/${key}: ${item}`);
}

async function apply(record, ids) {
    const fields = issueFields(record, ids);
    delete fields.project;
    delete fields.issuetype;
    delete fields.labels;
    const issue = await jira("GET", `/issue/${record.data.jira_key}?fields=labels,project,issuetype,summary,description`);
    if (issue.fields.project?.key !== projectKey || !issueTypeMatches(record, issue.fields.issuetype?.name)) {
        throw new Error(`${record.data.id}: project/issuetype 불일치로 안전하게 중단합니다.`);
    }
    if (summaryMatches(record, issue.fields.summary)) fields.summary = issue.fields.summary;
    if (descriptionMatches(record, issue.fields.description)) fields.description = issue.fields.description;
    const actualManaged = (issue.fields.labels ?? []).filter((label) =>
        label.startsWith("agent:") || label.startsWith("gate:") || label.startsWith("mirror-id:"));
    const existingMirrorLabels = (issue.fields.labels ?? []).filter((label) => label === `mirror-id:${record.data.id}`);
    const desiredManaged = [...managedLabels(record), ...existingMirrorLabels];
    const labelUpdates = [
        ...actualManaged.filter((label) => !desiredManaged.includes(label)).map((label) => ({remove: label})),
        ...desiredManaged.filter((label) => !actualManaged.includes(label)).map((label) => ({add: label})),
    ];
    const body = {fields};
    if (labelUpdates.length) body.update = {labels: labelUpdates};
    await jira("PUT", `/issue/${record.data.jira_key}`, body);
    await moveState(record);
    await ensureLinks(record, ids);
    if (verbose) process.stdout.write(`보정 ${record.data.id}/${record.data.jira_key}\n`);
}

async function main() {
    let records = loadBoard();
    const {drift: localErrors, warnings: localWarnings, ids} = localDrift(records);
    if (localErrors.length) {
        process.stderr.write(`로컬 보드 오류 ${localErrors.length}건\n${localErrors.join("\n")}\n`);
        process.exitCode = 1;
        return;
    }
    if (localWarnings.length) {
        process.stderr.write(`로컬 보드 경고 ${localWarnings.length}건\n${localWarnings.join("\n")}\n`);
    }
    const allRecords = records;
    if (only && !ids.has(only)) throw new Error(`${only} 티켓을 찾지 못했습니다.`);
    if (only) records = [ids.get(only)];
    process.stdout.write(`로컬 보드 정상: ${ids.size}건${only ? ` (대상 ${only})` : ""}\n`);
    if (mode === "local") return;

    requireRemoteConfig();
    await jira("GET", `/project/${encodeURIComponent(projectKey)}`);
    process.stdout.write(`Jira 인증 정상: ${projectKey}\n`);

    if (mode === "check") {
        const remoteDrift = [];
        for (const record of records) remoteDrift.push(...await inspect(record, ids));
        if (remoteDrift.length) {
            process.stderr.write(`Jira 드리프트 ${remoteDrift.length}건\n${remoteDrift.join("\n")}\n`);
            process.exitCode = 2;
        } else {
            process.stdout.write(`Jira 패리티 정상: ${records.length}건\n`);
        }
        return;
    }

    const creationSet = new Map(records.map((record) => [record.data.id, record]));
    const queue = [...records];
    while (queue.length) {
        const record = queue.shift();
        const refs = [record.data.epic, record.data.derived_from, ...(record.data.depends_on ?? []),
            ...(record.data.blocks ?? []), ...(record.data.children ?? [])].filter(Boolean);
        for (const ref of refs) {
            const target = ids.get(ref);
            if (target && !target.data.jira_key && !creationSet.has(ref)) {
                creationSet.set(ref, target);
                queue.push(target);
            }
        }
    }
    const creationRecords = [...creationSet.values()];
    const closureIds = new Set(creationRecords.map((record) => record.data.id));
    const relevantWarnings = localWarnings.filter((warning) => closureIds.has(warning.slice(0, warning.indexOf(":"))));
    if (relevantWarnings.length) {
        throw new Error("참조 폐쇄에 대상 파일이 없는 보드 경고가 있어 --apply를 중단합니다.");
    }
    const epicsFirst = [...creationRecords].sort((a, b) => (a.data.type === "epic" ? -1 : 1) - (b.data.type === "epic" ? -1 : 1));
    await createMissing(epicsFirst, ids);
    const applyRecords = only ? records : allRecords;
    for (const record of applyRecords) await apply(record, ids);
    process.stdout.write(`Jira 보정 완료: ${applyRecords.length}건\n`);
}

main().catch((error) => {
    process.stderr.write(`Jira 미러 실패: ${error.message}\n`);
    process.exitCode = 1;
});
