/** Inline brand mark: an orange poker card with a checkmark. */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Plan It Nice logo"
      className="logo"
    >
      <rect x="14" y="6" width="30" height="44" rx="6" fill="#fff" opacity="0.35" />
      <rect x="20" y="12" width="30" height="44" rx="6" fill="#fff" />
      <path
        d="M28 34l5 5 10-12"
        fill="none"
        stroke="#ec6608"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
