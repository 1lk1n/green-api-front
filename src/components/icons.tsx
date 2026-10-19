import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

// Paths from Material Icons (Apache License 2.0), 24×24 grid.
function Icon({ path, size = 24, ...props }: IconProps & { path: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d={path} />
    </svg>
  )
}

export function ChatsIcon(props: IconProps) {
  return <Icon {...props} path="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
}

export function ComposeIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
    />
  )
}

export function SendIcon(props: IconProps) {
  return <Icon {...props} path="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
}

export function BackIcon(props: IconProps) {
  return <Icon {...props} path="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
    />
  )
}

export function LogoutIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="m17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
    />
  )
}

export function PersonIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
    />
  )
}

export function CheckIcon(props: IconProps) {
  return <Icon {...props} path="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
}

export function DoubleCheckIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="m18 7-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41 6 19l1.41-1.41L1.83 12 .41 13.41z"
    />
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
    />
  )
}

export function ErrorIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
    />
  )
}

export function WarningIcon(props: IconProps) {
  return <Icon {...props} path="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
}

/** App logo: a chat bubble on the MAX brand gradient. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00b8ff" />
          <stop offset="1" stopColor="#b210db" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#logo-gradient)" />
      <path
        fill="#fff"
        d="M24 11c-7.7 0-14 5.4-14 12.2 0 3.8 2 7.2 5.1 9.4L14 38l6.3-3.2c1.2.3 2.4.4 3.7.4 7.7 0 14-5.4 14-12.1S31.7 11 24 11z"
      />
    </svg>
  )
}
