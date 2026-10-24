import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adPackAsset } from "./assetPath.js";

/** Editorial image creative with accessible attribution outside the artwork. */
export default function SponsoredCreative({ image, alt, label, to, onActivate, className = "", eager = false, frequencyKey = "" }) {
  const [frequencyAllowed, setFrequencyAllowed] = useState(() => {
    if (!frequencyKey || typeof window === "undefined") return true;
    try { return window.sessionStorage.getItem(frequencyKey) !== "shown"; } catch { return true; }
  });
  useEffect(() => {
    if (!frequencyKey || !frequencyAllowed) return;
    try { window.sessionStorage.setItem(frequencyKey, "shown"); } catch { /* Storage can be disabled; keep the creative available. */ }
  }, [frequencyAllowed, frequencyKey]);
  if (!frequencyAllowed) return null;
  return <aside className={`sponsored-creative ${className}`} aria-label={label || alt}>
    {label && <p className="sponsored-creative-label">{label}</p>}
    {onActivate ? <button type="button" className="sponsored-creative-link" onClick={onActivate} aria-label={`${alt}. Abrir item em destaque`}><img src={adPackAsset(image)} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" /></button>
      : <Link to={to} className="sponsored-creative-link" aria-label={`${alt}. Abrir ${label || "conteúdo"}`}><img src={adPackAsset(image)} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" /></Link>}
  </aside>;
}
