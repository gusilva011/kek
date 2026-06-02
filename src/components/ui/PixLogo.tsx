/** Marca do Pix (aproximação em SVG) + wordmark, na cor oficial (#32BCAD). */
export function PixLogo({ size = 18, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <rect x="9" y="9" width="22" height="22" rx="6" transform="rotate(45 20 20)" fill="#32BCAD" />
        <rect
          x="14.5"
          y="14.5"
          width="11"
          height="11"
          rx="3"
          transform="rotate(45 20 20)"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          opacity="0.9"
        />
      </svg>
      {showText && (
        <span className="font-extrabold tracking-tight" style={{ color: "#32BCAD" }}>
          Pix
        </span>
      )}
    </span>
  );
}
