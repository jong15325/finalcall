import { useEffect, useState } from 'react'

const DESKTOP_QUERY = '(min-width: 1280px)'

export default function useDesktopLayout() {
    const [desktop, setDesktop] = useState(() =>
        window.matchMedia(DESKTOP_QUERY).matches,
    )

    useEffect(() => {
        const media = window.matchMedia(DESKTOP_QUERY)
        const update = () => setDesktop(media.matches)
        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])

    return desktop
}
