
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
        <linearGradient id="ultrasound-blue-gradient" x1="0" y1="100" x2="100" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>

      {/* Fundo arredondado — acompanha o token --surface (branco no claro, grafite no escuro) */}
      <rect x="3" y="3" width="94" height="94" rx="22" fill="rgb(var(--surface))" />

      {/* Onda 1 (interna) */}
      <path
        d="M 39 74.4 A 14 14 0 0 1 61 74.4"
        stroke="url(#ultrasound-blue-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Onda 2 (média) */}
      <path
        d="M 29 56.4 A 29 29 0 0 1 71 56.4"
        stroke="url(#ultrasound-blue-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Onda 3 (externa) */}
      <path
        d="M 19 38.4 A 44 44 0 0 1 81 38.4"
        stroke="url(#ultrasound-blue-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}


