import { Moon } from "lucide-react";

export default function ThemeSettings() {
  return <section className="theme-settings-card" aria-labelledby="appearance-heading">
    <div className="theme-settings-heading"><span className="theme-settings-icon"><Moon size={19} /></span><div><span className="eyebrow">PERSONALIZE SEU FORTALFY</span><h2 id="appearance-heading">Aparência</h2><p>O app está usando o tema escuro.</p></div></div>
    <div className="theme-choice-list" aria-label="Tema do aplicativo">
      <div className="theme-choice selected" role="status">
        <span className="theme-choice-icon"><Moon size={19} /></span><span className="theme-choice-copy"><strong>Escuro</strong><small>Grafite e verde-limão</small></span><span className="theme-choice-check" aria-hidden="true" />
      </div>
    </div>
    <p className="theme-settings-caption">A versão clara está desativada temporariamente.</p>
  </section>;
}
