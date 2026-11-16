import Image from "next/image"
import Link from "next/link"

type BrandMarkProps = {
  href?: string | null
  className?: string
  priority?: boolean
  size?: "sm" | "md" | "lg"
}

const SIZES = {
  sm: { width: 120, height: 36, className: "h-8 w-auto" },
  md: { width: 168, height: 50, className: "h-11 w-auto" },
  lg: { width: 220, height: 66, className: "h-14 w-auto md:h-16" },
} as const

export function BrandMark(props: BrandMarkProps) {
  const size = SIZES[props.size ?? "md"]
  const mark = (
    <Image
      src="/agenda-logo.png"
      alt="Agenda"
      width={size.width}
      height={size.height}
      priority={props.priority}
      className={`${size.className} object-contain ${props.className ?? "object-left"}`}
    />
  )
  if (props.href === null) return mark
  return (
    <Link href={props.href ?? "/"} className="inline-flex no-underline" aria-label="Agenda">
      {mark}
    </Link>
  )
}
