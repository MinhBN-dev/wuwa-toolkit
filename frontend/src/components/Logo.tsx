interface Props {
  size?: number
  className?: string
}

export default function Logo({ size = 36, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Echoes Optimizer"
    >
      <defs>
        <linearGradient id="logo-stroke" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="50%" stopColor="#e8a045" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <radialGradient id="logo-fill" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(103,232,249,0.18)" />
          <stop offset="100%" stopColor="rgba(7,9,18,0)" />
        </radialGradient>
      </defs>

      {/* Outer hexagonal frame with diagonal cuts */}
      <path
        d="M 14 4 L 50 4 L 60 14 L 60 50 L 50 60 L 14 60 L 4 50 L 4 14 Z"
        stroke="url(#logo-stroke)"
        strokeWidth="1.5"
        fill="url(#logo-fill)"
      />

      {/* Inner hex ring (the 'O') */}
      <circle
        cx="32"
        cy="32"
        r="14"
        stroke="#e8a045"
        strokeWidth="2.5"
        fill="none"
      />
      <circle
        cx="32"
        cy="32"
        r="9"
        stroke="#67e8f9"
        strokeWidth="1"
        fill="none"
        opacity="0.7"
      />

      {/* Center diamond — echo cost motif, slow rotate */}
      <g
        style={{
          transformOrigin: '32px 32px',
          animation: 'spin 12s linear infinite',
        }}
      >
        <rect
          x="29"
          y="29"
          width="6"
          height="6"
          fill="#e8a045"
          transform="rotate(45 32 32)"
        />
      </g>

      {/* Corner ticks (top-left, bottom-right) */}
      <path d="M 8 4 L 4 4 L 4 8" stroke="#67e8f9" strokeWidth="1.5" fill="none" />
      <path d="M 56 60 L 60 60 L 60 56" stroke="#67e8f9" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
