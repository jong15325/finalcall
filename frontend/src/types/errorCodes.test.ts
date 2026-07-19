import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLIENT_ERROR_CODES, ERROR_CODES } from './errorCodes'

/**
 * 에러 코드 표 ↔ 계약 §5 대조 (FC-056).
 *
 * ★★ **왜 문서를 파싱하나** — 이 표는 계약의 사본이고, 사본이 원본보다 뒤처지는 사고가 실제로
 *    두 번 있었다(`BID_007` v1.8 신설분 · `ITEM_003` v1.6 신설분). 손으로 옮기는 한 또 난다.
 *    누락된 코드는 런타임에 조용히 "미등록 코드" 폴백으로 흘러가 화면상 티가 나지 않는다.
 *    → **계약 문서를 진실원으로 삼아 빌드에서 잡는다.** 계약이 개정되면 이 테스트가 먼저 붉어진다.
 */

// vitest 의 cwd 는 `frontend/` 다(루트 기준 한 칸 위가 레포 루트).
const CONTRACT_PATH = resolve(process.cwd(), '../docs/spec/api-contract.md')

/** 계약 §5 표에서 `| CODE | 의미 | HTTP |` 행의 코드만 뽑는다. */
function readContractErrorCodes(): string[] {
    const markdown = readFileSync(CONTRACT_PATH, 'utf-8')
    const section = markdown.split('## 5. 에러코드 표')[1]
    expect(section, '계약 §5 에러코드 표 절을 찾지 못했다').toBeDefined()

    const codes = [...section.matchAll(/^\|\s*([A-Z]+_\d{3})\s*\|/gm)].map(
        (match) => match[1],
    )
    return [...new Set(codes)]
}

describe('ERROR_CODES ↔ 계약 §5', () => {
    const contractCodes = readContractErrorCodes()

    it('계약 §5 표를 파싱해 코드를 얻는다 (파서가 죽으면 대조가 무의미해진다)', () => {
        expect(contractCodes.length).toBeGreaterThan(30)
        // 표에 반드시 있어야 할 표본 — 파서가 헛돌지 않는지 확인
        expect(contractCodes).toContain('AUTH_003')
        expect(contractCodes).toContain('GATEWAY_429')
    })

    it('계약에 등재된 코드가 프론트에 전부 있다 (BID_007·ITEM_003 누락 재발 방지)', () => {
        const missing = contractCodes.filter((code) => !(code in ERROR_CODES))
        expect(missing).toEqual([])
    })

    it('프론트에만 있는 유령 코드가 없다 (계약에서 삭제된 코드가 남지 않는다)', () => {
        const extra = Object.keys(ERROR_CODES).filter(
            (code) => !contractCodes.includes(code),
        )
        expect(extra).toEqual([])
    })

    it('키와 값이 같다 (오타 방지 — 분기가 조용히 빗나가는 경로를 막는다)', () => {
        for (const [key, value] of Object.entries(ERROR_CODES)) {
            expect(value).toBe(key)
        }
    })

    it('클라 전용 코드는 계약 표와 섞이지 않는다', () => {
        expect(CLIENT_ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR')
        expect(contractCodes).not.toContain('NETWORK_ERROR')
        expect(ERROR_CODES).not.toHaveProperty('NETWORK_ERROR')
    })
})
