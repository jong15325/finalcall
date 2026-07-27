import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import VerificationCard from './VerificationCard'
import {
    okEnvelope,
    renderWithProviders,
    signInForTest,
} from '@/test/renderWithProviders'
import { ERROR_CODES } from '@/types/errorCodes'
import type { MeResponse } from '@/lib/api/auth'

/**
 * 본인 인증 카드 — 이메일 인증 (FC-138·FC-139) · 목업 `template-email-verify.html`.
 *
 * 고정하는 것:
 *  1. 3상태 분기 — emailMasked(null 여부)·emailVerified 조합으로 미설정/미인증/인증완료.
 *  2. 원문 미노출 — 마스킹만 표시(GET /me 는 원문을 주지 않는다, 계약 §2.5).
 *  3. 코드 발송 → OTP 입력 → 확인 전이(계약 §2 email 3종).
 *  4. 에러 code 매핑 — EMAIL_001(불일치·시도 카운트)·EMAIL_003(코드 폐기). 원문 미노출.
 *  5. 쿨다운 게이팅 — 코드 발송 직후 "다시 받기"는 쿨다운으로 잠긴다.
 *  6. 휴대폰 인증은 "준비 중" 유지.
 */

/** 코드 유효시간(spec §3 = 10분) — 만료 가드 테스트에서 타이머를 이만큼 소진시킨다. */
const CODE_TTL_MS = 600_000

const BASE: MeResponse = {
    userPublicId: 'U-1',
    nickname: '레온',
    isAdmin: false,
    createdAt: '2025-11-04T09:00:00Z',
    emailVerified: false,
    emailMasked: null,
}

function errEnvelope(
    code: string,
    status: number,
    message = 'raw server text',
) {
    return new Response(
        JSON.stringify({
            success: false,
            code,
            message,
            timestamp: '2026-07-27T00:00:00Z',
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
    )
}

/** method+path 별 응답을 지정하는 fetch 스텁. */
function stubFetch(handler: (url: string, method: string) => Response) {
    const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(handler(String(input), init?.method ?? 'GET')),
    )
    vi.stubGlobal('fetch', fn)
    return fn
}

function renderCard(profile: Partial<MeResponse> = {}) {
    signInForTest()
    return renderWithProviders(
        <VerificationCard profile={{ ...BASE, ...profile }} />,
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('<VerificationCard> 3상태', () => {
    it('미설정(emailMasked=null) → 이메일 등록 폼 + 미설정 배지', () => {
        renderCard({ emailMasked: null })
        expect(screen.getByLabelText('이메일')).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: '이메일 저장' }),
        ).toBeInTheDocument()
        expect(screen.getByText('미설정')).toBeInTheDocument()
    })

    it('설정·미인증 → 마스킹 + 미인증 + 인증 코드 받기·이메일 변경', () => {
        renderCard({ emailMasked: 'a***@naver.com', emailVerified: false })
        expect(screen.getByText('a***@naver.com')).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: '인증 코드 받기' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: '이메일 변경' }),
        ).toBeInTheDocument()
    })

    it('인증완료 → 인증됨 + 성공 배너', () => {
        renderCard({ emailMasked: 'a***@naver.com', emailVerified: true })
        expect(screen.getByText('이메일이 인증되었어요')).toBeInTheDocument()
        expect(screen.getAllByText('인증됨').length).toBeGreaterThan(0)
    })

    it('휴대폰 인증은 준비 중을 유지한다', () => {
        renderCard()
        expect(screen.getByText('휴대폰 인증')).toBeInTheDocument()
        expect(screen.getByText('준비 중')).toBeInTheDocument()
    })
})

describe('<VerificationCard> 이메일 설정', () => {
    it('형식 오류는 제출을 막고 서버를 부르지 않는다', () => {
        const fetchMock = stubFetch(() => okEnvelope({}))
        renderCard({ emailMasked: null })
        fireEvent.change(screen.getByLabelText('이메일'), {
            target: { value: 'not-an-email' },
        })
        fireEvent.click(screen.getByRole('button', { name: '이메일 저장' }))
        expect(
            screen.getByText('올바른 이메일 형식이 아닙니다.'),
        ).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('유효한 이메일은 PUT /me/email 을 호출한다', async () => {
        const fetchMock = stubFetch(() =>
            okEnvelope({ email: 'leon@naver.com', emailVerified: false }),
        )
        renderCard({ emailMasked: null })
        fireEvent.change(screen.getByLabelText('이메일'), {
            target: { value: 'leon@naver.com' },
        })
        fireEvent.click(screen.getByRole('button', { name: '이메일 저장' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain('/me/email')
        expect(init?.method).toBe('PUT')
        expect(JSON.parse(String(init?.body))).toEqual({
            email: 'leon@naver.com',
        })
    })
})

describe('<VerificationCard> 코드 발송·확인', () => {
    it('인증 코드 받기 → OTP 입력 화면으로 전이한다(202)', async () => {
        stubFetch((url, method) => {
            if (url.includes('/verification-request') && method === 'POST')
                return new Response(null, { status: 202 })
            return okEnvelope({})
        })
        renderCard({ emailMasked: 'a***@naver.com' })
        fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }))

        await waitFor(() =>
            expect(screen.getByLabelText('1번째 자리')).toBeInTheDocument(),
        )
        expect(screen.getByText(/시도/)).toHaveTextContent('0')
        expect(screen.getByText(/남은 시간/)).toBeInTheDocument()
    })

    it('★ 코드 발송 직후 재전송은 쿨다운으로 잠긴다', async () => {
        stubFetch((url) => {
            if (url.includes('/verification-request'))
                return new Response(null, { status: 202 })
            return okEnvelope({})
        })
        renderCard({ emailMasked: 'a***@naver.com' })
        fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }))
        await waitFor(() =>
            expect(screen.getByLabelText('1번째 자리')).toBeInTheDocument(),
        )
        // 쿨다운 중 → "다시 받기" 버튼은 없고 카운트다운 문구만.
        expect(
            screen.queryByRole('button', { name: '코드 다시 받기' }),
        ).toBeNull()
        expect(
            screen.getByText(/초 후 다시 받을 수 있어요/),
        ).toBeInTheDocument()
    })

    it('6자리 입력 → verify 성공 시 인증됨으로 전이한다', async () => {
        stubFetch((url, method) => {
            if (url.includes('/verification-request'))
                return new Response(null, { status: 202 })
            if (url.includes('/verify') && method === 'POST')
                return okEnvelope({ emailVerified: true })
            if (url.endsWith('/me')) return okEnvelope(BASE) // 무효화 재조회
            return okEnvelope({})
        })
        renderCard({ emailMasked: 'a***@naver.com' })
        fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }))
        await waitFor(() =>
            expect(screen.getByLabelText('1번째 자리')).toBeInTheDocument(),
        )
        // 붙여넣기로 6자리 채우면 자동 제출.
        fireEvent.paste(screen.getByLabelText('1번째 자리'), {
            clipboardData: { getData: () => '429170' },
        })
        await waitFor(() =>
            expect(
                screen.getByText('이메일이 인증되었어요'),
            ).toBeInTheDocument(),
        )
    })

    it('★ verify EMAIL_001(불일치)은 문구·시도 카운트를 내고 코드를 비운다(원문 미노출)', async () => {
        stubFetch((url) => {
            if (url.includes('/verification-request'))
                return new Response(null, { status: 202 })
            if (url.includes('/verify'))
                return errEnvelope(ERROR_CODES.EMAIL_001, 422)
            return okEnvelope({})
        })
        renderCard({ emailMasked: 'a***@naver.com' })
        fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }))
        await waitFor(() =>
            expect(screen.getByLabelText('1번째 자리')).toBeInTheDocument(),
        )
        fireEvent.paste(screen.getByLabelText('1번째 자리'), {
            clipboardData: { getData: () => '000000' },
        })
        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                '일치하지 않아요',
            ),
        )
        // 시도 1회 반영 → 남은 시도 4회 안내.
        expect(screen.getByRole('alert')).toHaveTextContent('남은 시도 4회')
        expect(screen.queryByText('raw server text')).toBeNull()
        // 코드 비움 → 첫 칸이 빈 값.
        expect(
            (screen.getByLabelText('1번째 자리') as HTMLInputElement).value,
        ).toBe('')
    })

    it('★ verify EMAIL_003(시도초과)은 코드 폐기 배너를 낸다', async () => {
        stubFetch((url) => {
            if (url.includes('/verification-request'))
                return new Response(null, { status: 202 })
            if (url.includes('/verify'))
                return errEnvelope(ERROR_CODES.EMAIL_003, 429)
            return okEnvelope({})
        })
        renderCard({ emailMasked: 'a***@naver.com' })
        fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }))
        await waitFor(() =>
            expect(screen.getByLabelText('1번째 자리')).toBeInTheDocument(),
        )
        fireEvent.paste(screen.getByLabelText('1번째 자리'), {
            clipboardData: { getData: () => '000000' },
        })
        await waitFor(() =>
            expect(screen.getByText(/코드가 폐기됐어요/)).toBeInTheDocument(),
        )
    })

    it('★ 인증 코드 받기가 EMAIL_004(쿨다운)이면 코드 입력으로 진입시키고 쿨다운만 잠근다(M-1)', async () => {
        stubFetch((url) => {
            if (url.includes('/verification-request'))
                return errEnvelope(ERROR_CODES.EMAIL_004, 429)
            return okEnvelope({})
        })
        renderCard({ emailMasked: 'a***@naver.com' })
        fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }))

        // 이미 보낸 코드가 있으므로 코드 입력 화면으로 진입한다.
        await waitFor(() =>
            expect(screen.getByLabelText('1번째 자리')).toBeInTheDocument(),
        )
        // 안내 배너 + 쿨다운 잠금(재전송 버튼 없음, 카운트다운만).
        expect(screen.getByText(/이미 코드를 보냈어요/)).toBeInTheDocument()
        expect(
            screen.queryByRole('button', { name: '코드 다시 받기' }),
        ).toBeNull()
        expect(
            screen.getByText(/초 후 다시 받을 수 있어요/),
        ).toBeInTheDocument()
    })

    it('★ 만료(남은시간 0) 후에는 붙여넣기 자동제출이 verify 를 부르지 않는다(M-2)', async () => {
        vi.useFakeTimers()
        const fetchMock = stubFetch((url) => {
            if (url.includes('/verification-request'))
                return new Response(null, { status: 202 })
            if (url.includes('/verify'))
                return okEnvelope({ emailVerified: true })
            return okEnvelope({})
        })
        renderCard({ emailMasked: 'a***@naver.com' })
        fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }))
        // 발송 mutation(비동기 fetch/unwrap) flush → 코드 입력 진입. 전체 스위트에서 스케줄링
        // 편차가 있어 OTP 가 뜰 때까지 마이크로태스크/0ms 타이머를 유한 반복으로 비운다.
        for (
            let i = 0;
            i < 30 && !screen.queryByLabelText('1번째 자리');
            i += 1
        ) {
            await vi.advanceTimersByTimeAsync(0)
        }
        expect(screen.getByLabelText('1번째 자리')).toBeInTheDocument()

        // TTL(10분) 소진 → 만료. 배너 렌더까지 유한 반복으로 flush 한다.
        await vi.advanceTimersByTimeAsync(CODE_TTL_MS)
        for (let i = 0; i < 30 && !screen.queryByText(/만료됐어요/); i += 1) {
            await vi.advanceTimersByTimeAsync(0)
        }
        expect(screen.getByText(/만료됐어요/)).toBeInTheDocument()

        const verifyCalls = () =>
            fetchMock.mock.calls.filter((c) => String(c[0]).includes('/verify'))
                .length
        const before = verifyCalls()
        fireEvent.paste(screen.getByLabelText('1번째 자리'), {
            clipboardData: { getData: () => '429170' },
        })
        await vi.advanceTimersByTimeAsync(0)
        // 만료 가드로 자동제출이 막힌다 — verify 호출 증가 없음.
        expect(verifyCalls()).toBe(before)
    })
})
