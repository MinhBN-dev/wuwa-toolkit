interface Props {
  size?: number
  className?: string
}

export default function Logo({ size = 36, className = '' }: Props) {
  return (
    <img
      src="/logo.jpeg"
      alt="Wuwa Toolkit"
      width={size}
      height={size}
      className={`rounded-md object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
