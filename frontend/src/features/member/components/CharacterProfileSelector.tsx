import { useState } from 'react'
import { TbCheck } from 'react-icons/tb'
import {
    CHARACTER_IDS,
    normalCharacterSources,
    specialCharacterSources,
} from '../lib/characterProfile'

interface Props {
    value: number
    onChange: (id: number) => void
    disabled?: boolean
}

export default function CharacterProfileSelector({
    value,
    onChange,
    disabled,
}: Props) {
    return (
        <section aria-label="기본 캐릭터" className="min-w-0">
            <div
                data-character-roster
                className="grid grid-cols-4 gap-0 overflow-hidden xl:grid-cols-8"
            >
                {CHARACTER_IDS.map((id) => (
                    <CharacterButton
                        key={id}
                        disabled={disabled}
                        id={id}
                        selected={value === id}
                        sources={
                            id <= 12
                                ? normalCharacterSources(id)
                                : specialCharacterSources(id)
                        }
                        onClick={() => onChange(id)}
                    />
                ))}
            </div>
        </section>
    )
}

function CharacterButton({
    id,
    selected,
    sources,
    disabled,
    onClick,
}: {
    id: number
    selected: boolean
    sources: { defaultSrc: string; hoverSrc: string }
    disabled?: boolean
    onClick: () => void
}) {
    const [hovered, setHovered] = useState(false)
    return (
        <button
            type="button"
            aria-label={`캐릭터 ${id} 선택`}
            aria-pressed={selected}
            disabled={disabled}
            className="relative flex aspect-square w-full min-w-0 items-center justify-center focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-control-focus disabled:opacity-50"
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <img
                alt=""
                src={hovered ? sources.hoverSrc : sources.defaultSrc}
                className="h-full w-full object-contain [image-rendering:pixelated]"
            />
            {selected && (
                <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-control-action text-control-action-ink">
                    <TbCheck aria-hidden className="size-3.5" />
                </span>
            )}
        </button>
    )
}
