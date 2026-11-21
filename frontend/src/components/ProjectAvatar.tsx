import type { CSSProperties } from 'react'

// A stable color per project name, so each project gets a recognisable avatar.
const HUES = [18, 38, 152, 188, 222, 262, 330]

export function projectHue(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return HUES[h % HUES.length]
}

export function ProjectAvatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ '--hue': projectHue(name), width: size, height: size, fontSize: size * 0.46 } as CSSProperties}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
