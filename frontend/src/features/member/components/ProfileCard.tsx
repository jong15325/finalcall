import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { TbArchive, TbBackpack, TbPencil } from 'react-icons/tb'
import { paths } from '@/app/paths'
import { nicknameErrorMessage } from '@/features/member/lib/memberErrors'
import type { MeResponse } from '@/lib/api/auth'

/**
 * 프로필 카드 (FC-074 — 목업 `.account-profile-card`(accountOverview) · design-brief B-7).
 *
 * ★ **계약 데이터(4필드)만 렌더한다** — `nickname`·`createdAt`·`isAdmin`. 목업의 아바타 이미지·
 *   레벨·서버·거래건수·진행경매 배지는 **계약에 데이터가 없어 드롭**(undefined 렌더 방지,
 *   rebuild-contract-map 부록 주의1). 아바타는 닉네임 이니셜의 중립 자리로 대체한다.
 * ★ **상단 탭을 쓰지 않는다**(HANDOVER §13). 인벤토리·임시보관은 우측 액션 버튼 =
 *   `/me/inventory`·`/me/temp-storage` **라우트 링크**(목업의 tab-panel 방식 아님).
 * ★ 닉네임 수정은 인라인 편집(`PATCH /me`). 서버 에러는 code 로 문구(`memberErrors`), 원문 미노출.
 *   성공 판정은 "직전 pending → 현재 not-pending & no-error" 전이로 편집기를 닫는다.
 */

interface ProfileCardProps {
    profile: MeResponse
    /** 닉네임 저장 요청(부모가 변이 실행) */
    onSaveNickname: (nickname: string) => void
    savePending: boolean
    /** 마지막 저장 실패(ApiError). 성공·초기화 시 null */
    saveError: unknown
}

const joinDateFormat = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
})

function formatJoinDate(iso: string): string {
    const ms = Date.parse(iso)
    return Number.isFinite(ms)
        ? `${joinDateFormat.format(ms)} 가입`
        : '가입일 미상'
}

function ProfileCard({
    profile,
    onSaveNickname,
    savePending,
    saveError,
}: ProfileCardProps) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(profile.nickname)
    /** 제출 전 클라 검증 실패(빈 값 등) — 서버 응답과 별개 */
    const [localError, setLocalError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    /** 직전 렌더의 pending — 성공 전이(pending→idle&무에러) 판정용 */
    const wasPendingRef = useRef(false)

    // 저장 성공 시 편집기 닫기 — 캐시 갱신이 새 nickname 을 prop 으로 흘려보낸다.
    useEffect(() => {
        if (wasPendingRef.current && !savePending && !saveError) {
            setEditing(false)
        }
        wasPendingRef.current = savePending
    }, [savePending, saveError])

    const openEditor = () => {
        setDraft(profile.nickname)
        setLocalError(null)
        setEditing(true)
    }

    const closeEditor = () => {
        setEditing(false)
        setLocalError(null)
    }

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const next = draft.trim()
        if (next.length === 0) {
            setLocalError('닉네임을 입력해 주세요.')
            inputRef.current?.focus()
            return
        }
        // 변경 없음이면 서버를 부르지 않고 그대로 닫는다.
        if (next === profile.nickname) {
            closeEditor()
            return
        }
        setLocalError(null)
        onSaveNickname(next)
    }

    const serverError =
        saveError != null ? nicknameErrorMessage(saveError) : null
    const errorMessage = localError ?? serverError
    const initial = [...profile.nickname][0] ?? '?'

    return (
        <section className="rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                {/* 아바타 — 계약에 이미지 없음 → 닉네임 이니셜 중립 자리 */}
                <span
                    aria-hidden
                    className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-structure text-2xl font-bold text-brand-highlight-bright"
                >
                    {initial}
                </span>

                <div className="min-w-0 flex-1">
                    {editing ? (
                        <form noValidate onSubmit={handleSubmit}>
                            <label
                                htmlFor="profileNickname"
                                className="text-sm font-semibold text-content-fg"
                            >
                                닉네임
                            </label>
                            <div className="mt-1.5 flex flex-col gap-2 xs:flex-row">
                                <input
                                    ref={inputRef}
                                    autoFocus
                                    id="profileNickname"
                                    name="nickname"
                                    autoComplete="off"
                                    aria-invalid={
                                        errorMessage ? true : undefined
                                    }
                                    aria-describedby={
                                        errorMessage
                                            ? 'profileNicknameError'
                                            : undefined
                                    }
                                    className={`min-w-0 flex-1 rounded-lg border bg-content-surface px-3.5 py-2.5 text-base font-semibold text-content-fg focus:outline-none focus:ring-2 ${
                                        errorMessage
                                            ? 'border-danger focus:ring-danger/30'
                                            : 'border-content-line focus:border-control-action focus:ring-control-action/30'
                                    }`}
                                    value={draft}
                                    onChange={(event) => {
                                        setLocalError(null)
                                        setDraft(event.target.value)
                                    }}
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={savePending}
                                        className="rounded-lg bg-control-action px-4 py-2.5 text-sm font-bold text-control-action-ink hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {savePending ? '저장 중…' : '저장'}
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-lg border border-content-line bg-content-surface px-4 py-2.5 text-sm font-bold text-content-muted hover:bg-content-soft"
                                        onClick={closeEditor}
                                    >
                                        취소
                                    </button>
                                </div>
                            </div>
                            {errorMessage && (
                                <p
                                    id="profileNicknameError"
                                    role="alert"
                                    className="mt-2 text-sm text-danger-ink"
                                >
                                    {errorMessage}
                                </p>
                            )}
                        </form>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-bold text-content-fg">
                                    {profile.nickname}
                                </h2>
                                {profile.isAdmin && (
                                    <span className="rounded-full bg-brand-highlight-soft px-2.5 py-0.5 text-xs font-bold text-brand-highlight-deep">
                                        관리자
                                    </span>
                                )}
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-content-subtle hover:bg-content-soft hover:text-brand-structure"
                                    onClick={openEditor}
                                >
                                    <TbPencil
                                        aria-hidden
                                        className="size-3.5"
                                    />
                                    닉네임 수정
                                </button>
                            </div>
                            <p className="mt-1 text-sm text-content-subtle">
                                {formatJoinDate(profile.createdAt)}
                            </p>
                        </>
                    )}
                </div>

                {/* 우측 액션 — 인벤토리·임시보관 라우트 링크(탭 아님, HANDOVER §13) */}
                <div className="flex shrink-0 flex-col gap-2 xs:flex-row lg:ms-auto">
                    <Link
                        to={paths.inventory}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-structure px-4 py-2.5 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                    >
                        <TbBackpack aria-hidden className="size-4" />
                        인벤토리
                    </Link>
                    <Link
                        to={paths.tempStorage}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-content-line bg-content-surface px-4 py-2.5 text-sm font-bold text-content-fg hover:bg-content-soft"
                    >
                        <TbArchive aria-hidden className="size-4" />
                        임시 보관함
                    </Link>
                </div>
            </div>
        </section>
    )
}

export default ProfileCard
