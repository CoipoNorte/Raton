/** La misma cuña de queso dorada que se recoge dentro del juego. */
export default function CheeseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M4 15.5h16l-1.6 3.7H5.6L4 15.5Z"
        fill="#e09a1c"
        stroke="#a97c1c"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M4 15.5C7 9.3 10.2 5.2 12 5.2s5 4.1 8 10.3H4Z"
        fill="#ffc94a"
        stroke="#a97c1c"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="12.9" r="1.35" fill="#d98f1f" />
      <circle cx="14.8" cy="13.8" r="1.05" fill="#d98f1f" />
      <circle cx="12" cy="9.6" r="0.95" fill="#d98f1f" />
    </svg>
  );
}
