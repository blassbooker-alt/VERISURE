import { useRef, useState } from "react";
import { Accessibility, Contrast, Eye, Minus, Plus, RotateCcw, Sparkles, Type } from "lucide-react";
import { ACCESSIBILITY_TEXT_SCALES, DEFAULT_ACCESSIBILITY_PREFERENCES } from "./accessibilityService.js";

const scaleLabels = new Map([
  [85, "Pequeno"],
  [100, "Padrão"],
  [115, "Grande"],
  [130, "Muito grande"],
  [150, "Extra grande"],
]);

export default function AccessibilitySettings({ preferences, onChange, onReset }) {
  const [saveFeedback, setSaveFeedback] = useState("");
  const saveSequence = useRef(0);
  const scaleIndex = ACCESSIBILITY_TEXT_SCALES.indexOf(preferences.textScale);
  const scale = ACCESSIBILITY_TEXT_SCALES[scaleIndex] ?? DEFAULT_ACCESSIBILITY_PREFERENCES.textScale;

  function persist(action) {
    const sequence = ++saveSequence.current;
    setSaveFeedback("Salvando suas preferências…");
    Promise.resolve().then(action).then(result => {
      if (sequence !== saveSequence.current) return;
      setSaveFeedback(result?.synced
        ? "Preferências atualizadas e sincronizadas com sua conta."
        : result?.localSaved
          ? "Preferências atualizadas e salvas neste aparelho."
          : "Preferências atualizadas nesta sessão; não foi possível salvá-las.");
    }).catch(() => {
      if (sequence === saveSequence.current) setSaveFeedback("Preferências aplicadas, mas não foi possível concluir o salvamento.");
    });
  }

  function update(patch) {
    persist(() => onChange(patch));
  }

  function selectScale(index) {
    const boundedIndex = Math.max(0, Math.min(ACCESSIBILITY_TEXT_SCALES.length - 1, index));
    update({ textScale: ACCESSIBILITY_TEXT_SCALES[boundedIndex] });
  }

  function restoreDefaults() {
    if (!window.confirm("Restaurar somente as configurações de acessibilidade? O tema, as notificações e as outras preferências serão mantidos.")) return;
    persist(onReset);
  }

  return <section className="accessibility-settings-card" aria-labelledby="accessibility-heading">
    <div className="accessibility-settings-heading">
      <span className="accessibility-settings-icon"><Accessibility size={20} /></span>
      <div><span className="eyebrow">CONFORTO E LEITURA</span><h2 id="accessibility-heading">Acessibilidade</h2><p>Personalize a visualização da Fortalfy para tornar sua experiência mais confortável e facilitar a leitura.</p></div>
    </div>

    <section className="accessibility-setting-group" aria-labelledby="text-size-heading">
      <div className="accessibility-setting-title"><span className="accessibility-option-icon"><Type size={18} /></span><div><h3 id="text-size-heading">Tamanho do texto</h3><p>Ajuste os textos do aplicativo sem ampliar imagens ou ícones.</p></div></div>
      <div className="accessibility-scale-controls">
        <button type="button" className="accessibility-step-button" aria-label="Diminuir tamanho do texto" disabled={scaleIndex <= 0} onClick={() => selectScale(scaleIndex - 1)}><Minus size={18} /></button>
        <div className="accessibility-scale-options" role="group" aria-label="Nível do tamanho do texto">
          {ACCESSIBILITY_TEXT_SCALES.map(value => <button key={value} type="button" className={`accessibility-scale-option${scale === value ? " selected" : ""}`} aria-pressed={scale === value} onClick={() => update({ textScale: value })}>
            <strong>{scaleLabels.get(value)}</strong><span>{value}%</span>
          </button>)}
        </div>
        <button type="button" className="accessibility-step-button" aria-label="Aumentar tamanho do texto" disabled={scaleIndex >= ACCESSIBILITY_TEXT_SCALES.length - 1} onClick={() => selectScale(scaleIndex + 1)}><Plus size={18} /></button>
      </div>
      <div className="accessibility-preview" aria-live="polite">
        <div className="accessibility-preview-heading"><Eye size={16} /><strong>Pré-visualização da leitura</strong><span>{scale}%</span></div>
        <h4>Bem-vindo à Fortalfy</h4>
        <p>Descubra atividades, encontre profissionais e conecte-se com uma comunidade que valoriza o movimento e o bem-estar.</p>
        <small>Uma experiência que acompanha seu ritmo.</small>
        <span className="button primary accessibility-preview-button">Conhecer atividades</span>
      </div>
    </section>

    <section className="accessibility-setting-group" aria-labelledby="contrast-heading">
      <div className="accessibility-setting-title"><span className="accessibility-option-icon"><Contrast size={18} /></span><div><h3 id="contrast-heading">Contraste e legibilidade</h3><p>Realce textos, contornos e controles sem mudar o tema atual.</p></div></div>
      <button type="button" className="accessibility-toggle-row" aria-pressed={preferences.highContrast} onClick={() => update({ highContrast: !preferences.highContrast })}>
        <span><strong>Contraste aprimorado</strong><small>Aumenta a distinção entre texto, superfícies e controles.</small></span><span className={`accessibility-switch${preferences.highContrast ? " is-on" : ""}`} aria-hidden="true"><span /></span>
      </button>
    </section>

    <section className="accessibility-setting-group" aria-labelledby="motion-heading">
      <div className="accessibility-setting-title"><span className="accessibility-option-icon"><Sparkles size={18} /></span><div><h3 id="motion-heading">Movimento e animações</h3><p>Escolha como elementos decorativos se movem na interface.</p></div></div>
      <button type="button" className="accessibility-toggle-row" aria-pressed={preferences.reduceMotion} onClick={() => update({ reduceMotion: !preferences.reduceMotion })}>
        <span><strong>Reduzir animações</strong><small>Reduza movimentos e transições visuais para uma experiência mais confortável.</small></span><span className={`accessibility-switch${preferences.reduceMotion ? " is-on" : ""}`} aria-hidden="true"><span /></span>
      </button>
      <p className="accessibility-system-note">A preferência de movimento reduzido do seu dispositivo também é respeitada.</p>
    </section>

    <div className="accessibility-settings-footer">
      <p aria-live="polite">{saveFeedback || "As opções são aplicadas imediatamente e salvas separadamente das demais configurações."}</p>
      <button type="button" className="button subtle accessibility-reset-button" onClick={restoreDefaults}><RotateCcw size={16} /> Restaurar configurações de acessibilidade</button>
    </div>
  </section>;
}
