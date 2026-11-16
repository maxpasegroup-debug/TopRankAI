export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14 16h36v9H36.5v25h-9V25H14z" fill="currentColor" />
      <path
        d="M40 48l9-9m0 0v8m0-8h-8"
        fill="none"
        stroke="#ffd7cf"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
