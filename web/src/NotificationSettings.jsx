import { useEffect, useState } from "react";
import { BellRing, Check, CircleAlert, Clock3, LoaderCircle, Volume2, VolumeX } from "lucide-react";
import {
  disableWebPush, enableWebPush, loadNotificationPreferences, notificationErrorMessage, playNotificationSound, sendTestNotification,
  NOTIFICATION_PREFERENCES_DEFAULTS, saveNotificationPreferences,
} from "./notificationService.js";
import { isInterfaceSoundEnabled, setInterfaceSoundEnabled } from "./uiSoundService.js";

const preferenceGroups = [
  { key: "likes_enabled", label: "Curtidas", description: "Quando alguém curtir suas publicações." },
  { key: "comments_enabled", label: "Comentários e respostas", description: "Novos comentários e respostas nas suas publicações." },
  { key: "mentions_enabled", label: "Menções", description: "Quando alguém mencionar você em um comentário." },
  { key: "messages_enabled", label: "Mensagens", description: "Quando você receber uma mensagem privada." },
  { key: "workout_reminders_enabled", label: "Treinos e lembretes", description: "Lembretes e mudanças na sua rotina de treino." },
  { key: "partner_updates_enabled", label: "FortalPass e parceiros", description: "Atualizações de profissionais, parceiros e agendamentos." },
  { key: "shop_updates_enabled", label: "Loja e pedidos", description: "Atualizações importantes sobre pedidos." },
  { key: "marketing_enabled", label: "Novidades da Fortalfy", description: "Novos recursos e comunicações promocionais." },
];

export default function NotificationSettings({ client, userId }) {
  const [preferences, setPreferences] = useState({ ...NOTIFICATION_PREFERENCES_DEFAULTS });
  const [permission, setPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [pushActive, setPushActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [interfaceSounds, setInterfaceSounds] = useState(() => isInterfaceSoundEnabled());
  const [testSent, setTestSent] = useState(false);
  const [soundTested, setSoundTested] = useState(false);

  useEffect(() => {
    let active = true;
    if (!client || !userId) return () => { active = false; };
    loadNotificationPreferences(client, userId).then(value => { if (active) setPreferences(value); })
      .catch(failure => { if (active) setError(notificationErrorMessage(failure, "Não foi possível carregar as preferências.")); });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => registration?.pushManager?.getSubscription())
        .then(subscription => { if (active) setPushActive(Boolean(subscription)); })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [client, userId]);

  const updatePreferences = async patch => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setError("");
    setSaved(false);
    try {
      await saveNotificationPreferences(client, userId, next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (failure) {
      setPreferences(preferences);
      setError(notificationErrorMessage(failure, "Não foi possível salvar esta preferência."));
    }
  };

  const activate = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await enableWebPush(client, userId);
      setPermission(result.permission);
      setPushActive(result.permission === "granted");
      if (result.permission === "denied") setError("A permissão foi negada. Reative as notificações nas configurações do navegador.");
      else if (!result.supported) setError("Este navegador não oferece push para o Fortalfy. Você continuará vendo os avisos na central do app.");
    } catch (failure) {
      setError(notificationErrorMessage(failure, "Não foi possível ativar as notificações."));
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setError("");
    try {
      await disableWebPush(client);
      setPushActive(false);
    } catch (failure) {
      setError(notificationErrorMessage(failure, "Não foi possível desativar este dispositivo."));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setError("");
    setTestSent(false);
    try {
      await sendTestNotification();
      setTestSent(true);
      window.setTimeout(() => setTestSent(false), 5000);
    } catch (failure) {
      setError(notificationErrorMessage(failure, "Não foi possível enviar a notificação de teste."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = key => updatePreferences({ [key]: !preferences[key] });
  const toggleInterfaceSounds = () => {
    const enabled = !interfaceSounds;
    setInterfaceSounds(enabled);
    setInterfaceSoundEnabled(enabled);
  };

  const previewNotificationSound = async () => {
    setError("");
    setSoundTested(false);
    const played = await playNotificationSound(preferences, { preview: true });
    if (!played) {
      setError("Não foi possível reproduzir o som. Verifique o volume do dispositivo e tente novamente.");
      return;
    }
    setSoundTested(true);
    window.setTimeout(() => setSoundTested(false), 2500);
  };

  return <section className="notification-settings-card" aria-labelledby="notification-settings-heading">
    <div className="notification-settings-heading"><span className="notification-settings-icon"><BellRing size={19} /></span><div><span className="eyebrow">AVISOS NO SEU RITMO</span><h2 id="notification-settings-heading">Notificações</h2><p>Escolha quais avisos receber e em que horário.</p></div></div>
    {!userId && <p className="notification-settings-notice">Entre na sua conta para sincronizar notificações e preferências entre dispositivos.</p>}
    {userId && <div className="notification-push-card"><div><strong>Notificações neste dispositivo</strong><p>{pushActive ? "Este dispositivo pode receber avisos mesmo com o Fortalfy fechado." : "Receba mensagens e atualizações importantes fora do app."}</p></div>{pushActive ? <button type="button" className="button subtle small-button" onClick={deactivate} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : "Desativar"}</button> : permission === "denied" ? <span className="notification-permission-label">Ative nas configurações do navegador</span> : <button type="button" className="button primary small-button" onClick={activate} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : "Ativar notificações"}</button>}</div>}
    {permission === "default" && !pushActive && <p className="notification-settings-explainer">A permissão só será solicitada quando você tocar em “Ativar notificações”.</p>}
    {pushActive && <div className="notification-test-card"><div><strong>Testar notificação</strong><p>Envia um aviso de teste para a barra de notificações deste telefone.</p></div><button type="button" className="button subtle small-button" onClick={sendTest} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : "Enviar teste"}</button></div>}
    <div className="notification-preference-list">{preferenceGroups.map(({ key, label, description }) => <label className="notification-preference-row" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={Boolean(preferences[key])} onChange={() => toggle(key)} disabled={!userId} /></label>)}</div>
    <div className="notification-quiet-hours"><div><Clock3 size={17} /><span><strong>Horário silencioso</strong><small>Não enviar push normal neste período. Alertas críticos de segurança continuam ativos.</small></span></div><label>De<input type="time" value={preferences.quiet_hours_start} onChange={event => updatePreferences({ quiet_hours_start: event.target.value })} disabled={!userId} /></label><label>Até<input type="time" value={preferences.quiet_hours_end} onChange={event => updatePreferences({ quiet_hours_end: event.target.value })} disabled={!userId} /></label></div>
    <div className="notification-sound-row"><span>{preferences.sound_enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}<span><strong>Som das mensagens</strong><small>Toque em “Testar som” para conferir o áudio. As mensagens respeitam o horário silencioso definido abaixo. Em segundo plano, o dispositivo usa o som padrão do sistema.</small></span></span><button type="button" className="button subtle small-button notification-sound-preview" onClick={previewNotificationSound} disabled={!preferences.sound_enabled}>Testar som</button><input type="checkbox" checked={Boolean(preferences.sound_enabled)} onChange={() => toggle("sound_enabled")} disabled={!userId} /></div>
    <div className="notification-sound-row"><span>{interfaceSounds ? <Volume2 size={17} /> : <VolumeX size={17} />}<span><strong>Sons da interface</strong><small>Som discreto ao digitar e ao selecionar botões e opções. Esta preferência fica salva neste dispositivo.</small></span></span><input type="checkbox" checked={interfaceSounds} onChange={toggleInterfaceSounds} /></div>
    <div className="notification-sound-row"><span><BellRing size={17} /><span><strong>Vibração compatível</strong><small>Disponível apenas em navegadores e dispositivos que aceitam vibração em push.</small></span></span><input type="checkbox" checked={Boolean(preferences.vibration_enabled)} onChange={() => toggle("vibration_enabled")} disabled={!userId} /></div>
    {saved && <p className="notification-settings-saved" role="status"><Check size={14} /> Preferências salvas.</p>}
    {testSent && <p className="notification-settings-saved" role="status"><Check size={14} /> Notificação de teste enviada. Confira a barra do telefone.</p>}
    {soundTested && <p className="notification-settings-saved" role="status"><Check size={14} /> Som reproduzido neste dispositivo.</p>}
    {error && <p className="notification-settings-error" role="alert"><CircleAlert size={15} /> {error}</p>}
  </section>;
}
