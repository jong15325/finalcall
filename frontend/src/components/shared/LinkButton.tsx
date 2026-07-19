import { Link } from 'react-router'
import Button from '@/components/ui/Button'
import type { ButtonProps } from '@/components/ui/Button'
import type { LinkProps } from 'react-router'

/**
 * 라우터 링크로 렌더되는 버튼 (FC-057).
 *
 * ★ **새 버튼을 만든 것이 아니다.** 시각·크기·포커스·press 피드백은 전부 템플릿 `Button`
 *   그대로다. 이 파일은 **타입 어댑터**다 — 템플릿 `ButtonProps` 가
 *   `ComponentPropsWithRef<'button'>` 를 상속해서 `asElement={Link}` 를 런타임엔 지원하는데
 *   `to` prop 이 타입에 없다. 호출부마다 캐스팅을 흩뿌리는 대신 여기 한 번만 둔다.
 *
 * ★ 이동은 **버튼이 아니라 링크여야 한다.** `onClick={() => navigate(...)}` 로 처리하면
 *   새 탭 열기·가운데 클릭·주소 복사·크롤러가 전부 죽는다(템플릿 데모가 그렇게 한다).
 */
type LinkButtonProps = Omit<ButtonProps, 'asElement'> & Pick<LinkProps, 'to'>

const LinkButton = ({ to, ...buttonProps }: LinkButtonProps) => {
    /*
     * `to` 는 `Button` 이 `asElement` 로 그대로 흘려보내지만 `ButtonProps` 타입엔 없다.
     * 캐스팅을 **이 한 줄에만** 가둔다.
     */
    const linkProps = { to } as unknown as ButtonProps

    return <Button asElement={Link} {...linkProps} {...buttonProps} />
}

export default LinkButton
