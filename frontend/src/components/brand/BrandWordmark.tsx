import classNames from '@/utils/classNames'
import { APP_NAME } from '@/constants/app.constant'

/**
 * 브랜드 워드마크 — **단일 출처** (FC-057).
 *
 * ★★ 이 파일이 브랜드 표현의 **유일한 정의**다. 구 프론트에서 `AuthFormLayout` 과
 *    `AdminLayout` 이 각자 워드마크를 그려 **표현이 갈라진 전력**이 있다. 헤더·탭바·404·인증
 *    화면 어디서든 이 컴포넌트를 부르고, **직접 활자를 조립하지 마라.**
 *
 * ★ 로고 이미지가 아니라 **활자 덩어리**다. 템플릿 `components/template/Logo.tsx` 는
 *   `/img/logo/logo-*.png` 를 불러오는 이미지 컴포넌트라 쓸 수 없었다(자체 제작 사유).
 *
 * ★ **색분할이 아니다.** `FINAL` 과 `CALL` 은 같은 near-black 이고, `CALL` 아래
 *   **퍼플 2px 마감선**만 브랜드 액센트다(`--brand-accent`). 글자를 퍼플로 칠하면
 *   design-system [1.2] 의 "퍼플은 액센트, 채움 아님" 규칙과 어긋난다.
 *
 * 대비(WCAG): 활자 near-black — 라이트 `gray-900`/흰 헤더 **17.93:1**,
 * 다크 `gray-100`/`gray-900` 헤더 **16.44:1**. 마감선(비텍스트, 3:1 요구) —
 * 라이트 #6E2A9F/흰 **8.42:1**, 다크 #A855D6/#171717 **4.21:1**.
 */

interface BrandWordmarkProps {
    /** sm = 모바일 헤더·푸터, md = 데스크톱 헤더, lg = 404 등 큰 자리 */
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const SIZE_CLASS: Record<NonNullable<BrandWordmarkProps['size']>, string> = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
}

const BrandWordmark = ({ size = 'md', className }: BrandWordmarkProps) => {
    return (
        <span
            className={classNames(
                'inline-flex items-baseline font-bold tracking-tight select-none',
                'text-gray-900 dark:text-gray-100',
                SIZE_CLASS[size],
                className,
            )}
        >
            {/*
             * 접근성 이름은 한 덩어리로 읽히게 한다 — 스크린리더가 "FINAL" "CALL" 로 끊어
             * 읽으면 브랜드가 두 단어로 들린다.
             */}
            <span aria-hidden="true">FINAL</span>
            <span
                aria-hidden="true"
                className="border-b-2 border-[var(--brand-accent)] pb-px"
            >
                CALL
            </span>
            <span className="sr-only">{APP_NAME}</span>
        </span>
    )
}

export default BrandWordmark
