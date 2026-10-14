export default function Brand({ light = false }) {
  return <span className={`logo-mark ${light ? "light" : ""}`} aria-label="Fortalfy">
    <svg className="logo-symbol" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#0c3f2d" />
      <path d="M7 22c4.5-.2 7-2.8 8.1-7.3" fill="none" stroke="#d8ff91" strokeLinecap="round" strokeWidth="3" />
      <path d="M7 16.5c3-.2 4.8-2 5.7-5.2" fill="none" stroke="#8ce0a2" strokeLinecap="round" strokeWidth="3" />
      <path d="M18.5 8.2c2.6-2.2 5.4-2.7 8.5-2.3-.2 3.4-1.4 6.1-3.6 8-2.1 1.8-4.9 2.3-8.3 1.6.2-3.2 1.3-5.6 3.4-7.3Z" fill="#caff70" />
      <path d="m11.7 23.5 9.4-10.1" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2.1" />
    </svg>
    <span className="logo-word">fortal<span className="logo-accent">fy</span></span>
  </span>;
}
