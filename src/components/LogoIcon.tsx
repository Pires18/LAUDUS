
interface Props {
  className?: string;
  size?: number;
}

export function LogoIcon({ className = '', size = 36 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Elite Brand Blue Gradient (Ultra high-end medical clinical colors) */}
        <linearGradient id="ultrasound-blue-gradient" x1="0" y1="100" x2="100" y2="0">
          <stop offset="0%" stopColor="#2563eb" />   {/* Royal Blue-600 */}
          <stop offset="50%" stopColor="#3b82f6" />  {/* Active Blue-500 */}
          <stop offset="100%" stopColor="#0ea5e9" /> {/* Electric Sky Blue */}
        </linearGradient>
      </defs>

      {/* Wave 1: Small/Inner Arc (Start of wave from transducer - centered) */}
      <path
        d="M 39 74 A 14 14 0 0 1 61 74"
        stroke="url(#ultrasound-blue-gradient)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* Wave 2: Medium/Middle Arc (Centered) */}
      <path
        d="M 29 56 A 29 29 0 0 1 71 56"
        stroke="url(#ultrasound-blue-gradient)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* Wave 3: Large/Outer Arc (Expanding wavefront - centered) */}
      <path
        d="M 19 38 A 44 44 0 0 1 81 38"
        stroke="url(#ultrasound-blue-gradient)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </svg>
  );
}


