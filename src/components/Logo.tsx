export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="60" cy="60" r="56" fill="url(#logoGrad)" />
      {/* Shopping bag body */}
      <rect x="30" y="48" width="60" height="45" rx="6" fill="white" fillOpacity="0.95" />
      {/* Bag handle */}
      <path
        d="M42 48V40C42 33.373 47.373 28 54 28H66C72.627 28 78 33.373 78 40V48"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Leaf */}
      <path
        d="M58 72C58 72 62 58 74 54C74 54 70 68 58 72Z"
        fill="#16a34a"
      />
      <path
        d="M58 72C64 66 68 60 74 54"
        stroke="#15803d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Small leaf */}
      <path
        d="M50 68C50 68 48 60 42 57C42 57 44 66 50 68Z"
        fill="#22c55e"
      />
      {/* Sparkle */}
      <circle cx="80" cy="38" r="3" fill="#fde047" />
      <circle cx="85" cy="32" r="1.5" fill="#fde047" fillOpacity="0.6" />
      {/* Gradient definition */}
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22c55e" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}
