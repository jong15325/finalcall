import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

interface PageIntroProps {
    icon: IconType
    eyebrow: string
    title: string
    description: ReactNode
    action?: ReactNode
}

/** 모든 주요 화면에서 동일한 제목·설명·액션 위계를 제공한다. */
export default function PageIntro({
    icon: Icon,
    eyebrow,
    title,
    description,
    action,
}: PageIntroProps) {
    return (
        <header data-page-intro data-market-page-intro>
            <div data-market-page-identity>
                <span data-market-page-icon>
                    <Icon aria-hidden className="size-6" />
                </span>
                <div className="min-w-0">
                    <span data-market-page-eyebrow>{eyebrow}</span>
                    <h1>{title}</h1>
                    <p>{description}</p>
                </div>
            </div>
            {action}
        </header>
    )
}

