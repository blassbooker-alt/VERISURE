import { MonitorCog, Moon, Sun } from "lucide-react";

const options = [
  { value: "dark", label: "Escuro", description: "Grafite e verde-limão", icon: Moon },
  { value: "light", label: "Claro", description: "Superfícies claras e verdes da marca", icon: Sun },
  { value: "system", label: "Automático", description: "Segue a aparência deste dispositivo", icon: MonitorCog },
];

export default function ThemeSettings({ value, onChange }) {
  return <section className="theme-settings-card" aria-labelledby="appearance-heading">
    <div className="theme-settings-heading"><span className="theme-settings-icon"><Sun size={19} /></span><div><span className="eyebrow">PERSONALIZE SEU FORTALFY</span><h2 id="appearance-heading">Aparência</h2><p>Escolha como o app aparece neste perfil.</p></div></div>
    <div className="theme-choice-list" role="group" aria-label="Tema do aplicativo">
      {options.map(({ value: option, label, description, icon: Icon }) => <button key={option} type="button" className={`theme-choice${value === option ? " selected" : ""}`} aria-pressed={value === option} onClick={() => onChange(option)}>
        <span className="theme-choice-icon"><Icon size={19} /></span><span className="theme-choice-copy"><strong>{label}</strong><small>{description}</small></span><span className="theme-choice-check" aria-hidden="true" />
      </button>)}
    </div>
    <p className="theme-settings-caption">A mudança é imediata. Sua escolha fica salva na conta quando você está conectado.</p>
  </section>;
}
