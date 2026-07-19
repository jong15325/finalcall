import classNames from '@/utils/classNames'
import { APP_NAME } from '@/constants/app.constant'

/**
 * 브랜드 워드마크 — **단일 출처** (FC-057).
 *
 * ★★ 이 파일이 브랜드 표현의 **유일한 정의**다. 구 프론트에서 `AuthFormLayout` 과
 *    `AdminLayout` 이 각자 워드마크를 그려 **표현이 갈라진 전력**이 있다. 헤더·푸터·404
 *    어디서든 이 컴포넌트를 부르고, **직접 활자를 조립하지 마라.**
 *
 * ★ **왜 자체 컴포넌트인가** — 템플릿 `components/template/Logo.tsx` 는
 *   `/img/logo/logo-{light|dark}-{full|streamline}.png` 4종을 불러오는 **이미지** 컴포넌트인데
 *   **우리에겐 로고 이미지가 없다.** 없는 파일을 가리키면 깨진 이미지가 뜬다.
 *   그래서 활자 워드마크가 불가피하다(템플릿에 없어 만든 것 — 보고 대상).
 *
 * ★★ **시각 표현은 전부 템플릿 관례를 따른다**(사용자 방침 2026-07-19 — "우리가 정한 디자인
 *    메인색·아이콘 스타일은 적용하지 않는다. 최대한 템플릿 디자인을 적용한다").
 *    - 색: 템플릿 heading 관례 `text-gray-900 dark:text-gray-100`
 *      (`assets/styles/tailwind/index.css` 의 `h1~h6`·`.heading-text` 와 같은 값)
 *    - 굵기: 템플릿 heading 관례 `font-bold`
 *    - 크기: 템플릿 타입 스케일(`text-lg`/`text-xl`/`text-3xl`)
 *
 *    **폐기된 것**: `CALL` 퍼플 2px 마감선과 `--brand-accent`(#6E2A9F / 다크 파생 #A855D6).
 *    브랜드 액센트라는 **개념 자체를 쓰지 않는다** — 액센트가 필요하면 템플릿 `--primary` 다.
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
             * 접근성 이름을 한 덩어리로 준다 — 전각 대문자 활자는 스크린리더가 철자 단위로
             * 읽는 경우가 있다. 이건 시각 장치가 아니라 a11y 장치라 방침 변경과 무관하다.
             */}
            <span aria-hidden="true">FINALCALL</span>
            <span className="sr-only">{APP_NAME}</span>
        </span>
    )
}

export default BrandWordmark
