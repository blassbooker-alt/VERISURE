export default function Brand({ light = false }) {
  return <span className={`logo-mark ${light ? "light" : ""}`} aria-label="Fortalfy">
    <img className="logo-symbol" src={`${import.meta.env.BASE_URL}assets/fortalfy-official-logo.png`} alt="" />
    <span className="logo-word">fortal<span className="logo-accent">fy</span></span>
  </span>;
}
