export default function Brand({ light = false }) {
  return <span className={`logo-mark ${light ? "light" : ""}`} aria-label="Fortalfy">
    <img className="logo-symbol" src={`${import.meta.env.BASE_URL}assets/fortalfy-symbol-official.png`} alt="" />
    <span className="logo-word">Fortalfy</span>
  </span>;
}
