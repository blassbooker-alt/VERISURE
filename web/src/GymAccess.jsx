import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, ArrowRight, Check, Clock3, MapPin, Nfc, Printer, QrCode, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Brand from "./Brand.jsx";
import {
  buildPlateUrl, createGymAccessContract, createGymPlate, createGymUnit, getCheckinFailureMessage,
  loadAdminGymListings, loadAdminGymPlates, loadAdminGymUnits, loadAdminPlateHistory,
  loadPublicPlate, recordGymPlateEvent, setGymAccessContractStatus, setGymPlateStatus,
} from "./gymAccessService.js";

const STATUS_LABELS = {
  pending_installation: "Aguardando instalação",
  active: "Ativa",
  disabled: "Desativada",
  replaced: "Substituída",
};

function errorText(error) {
  if (["PGRST202", "PGRST205", "42P01"].includes(error?.code)) {
    return "A estrutura do FortalPass ainda não está instalada no Supabase. Aplique FORTALFY_GYM_PLATES_AND_CHECKINS_V1.sql e tente novamente.";
  }
  return error?.message || "Não foi possível concluir esta operação.";
}

function locationOnce() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este navegador não oferece localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

export function GymCheckInPage({ client, session }) {
  const { publicId } = useParams();
  const [searchParams] = useSearchParams();
  const methodClaimed = searchParams.get("via") === "nfc" ? "nfc" : "qr";
  const [unit, setUnit] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeCheckin, setActiveCheckin] = useState(null);
  const secureContext = window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const refresh = useCallback(async () => {
    if (!client) {
      setError("O Supabase não está configurado. O check-in não foi registrado.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [plateInfo, visits] = await Promise.all([
        loadPublicPlate(client, publicId),
        session?.user?.id
          ? client.from("fortalfy_gym_checkins")
            .select("id,unit_id,started_at,completed_at,status,financial_status")
            .eq("user_id", session.user.id)
            .order("started_at", { ascending: false })
            .limit(10)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (!plateInfo) {
        setUnit(null);
        setError("Esta placa não está cadastrada no FortalPass.");
      } else {
        setUnit(plateInfo);
      }
      if (visits.error) throw visits.error;
      setHistory(visits.data || []);
      setActiveCheckin((visits.data || []).find(visit => visit.status === "in_progress") || null);
    } catch (failure) {
      console.error("Falha ao carregar a unidade e o histórico do FortalPass.", failure);
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, [client, publicId, session?.user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submitCheckIn = async () => {
    if (!client || !session?.user?.id || !secureContext) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const position = await locationOnce();
      const { data, error: rpcError } = await client.rpc("fortalfy_checkin_with_plate", {
        p_public_id: publicId,
        p_request_key: crypto.randomUUID(),
        p_method_claimed: methodClaimed,
        p_latitude: position.coords.latitude,
        p_longitude: position.coords.longitude,
        p_location_accuracy_m: position.coords.accuracy,
      });
      if (rpcError) throw rpcError;
      if (!data?.accepted) {
        setError(getCheckinFailureMessage(data?.reason));
        return;
      }
      setMessage("Presença operacional registrada. Nenhum valor ou repasse foi criado.");
      await refresh();
    } catch (failure) {
      console.error("O servidor não concluiu o check-in FortalPass.", failure);
      setError(failure?.code === 1
        ? "A permissão de localização foi negada. Autorize a localização para continuar."
        : failure?.code === 2 || failure?.code === 3
          ? "Não foi possível obter uma localização precisa. Tente novamente perto da placa."
          : errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const submitCheckOut = async () => {
    if (!client || !activeCheckin) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error: rpcError } = await client.rpc("fortalfy_checkout_gym_visit", {
        p_checkin_id: activeCheckin.id,
      });
      if (rpcError) throw rpcError;
      if (!data?.completed) throw new Error("O servidor não confirmou a finalização.");
      setMessage("Treino finalizado por confirmação no aplicativo. Isso não é uma leitura física de saída.");
      await refresh();
    } catch (failure) {
      console.error("Falha ao finalizar o check-in FortalPass.", failure);
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const plateActive = unit?.status === "active" && unit?.unit_active && unit?.partner_approved;
  return <div className="gym-access-content">
    <div className="gym-access-brand"><Brand /><div><small>FORTALPASS · ACESSO À UNIDADE</small></div></div>
    {loading && <p className="social-inline-status" role="status">Validando placa e acesso…</p>}
    {!loading && unit && <section className="gym-access-card">
      <span className="eyebrow">UNIDADE IDENTIFICADA</span>
      <h2>{unit.unit_name}</h2>
      <p className="gym-access-address">{unit.city}</p>
      {!plateActive && <div className="gym-access-alert" role="alert"><AlertTriangle size={18} /> Esta placa ou academia está inativa. O servidor não aceitará check-ins.</div>}
      {plateActive && !unit.contract_active && <div className="gym-access-alert" role="alert"><AlertTriangle size={18} /> Esta unidade não tem contrato de acesso vigente aprovado; o check-in permanece bloqueado.</div>}
      {session?.user?.id
        ? <p className="gym-access-method"><ShieldCheck size={16} /> Meio informado pelo link: {methodClaimed === "nfc" ? "NFC" : "QR Code"}. Esse parâmetro não é uma prova física do meio usado.</p>
        : <div className="gym-access-alert"><ShieldCheck size={18} /> Entre em uma conta Fortalfy para validar sua assinatura e registrar a presença.<Link to="/profile">Entrar na conta <ArrowRight size={15} /></Link></div>}
      {activeCheckin && activeCheckin.unit_id !== unit.unit_id && <div className="gym-access-alert"><Clock3 size={18} /> Há um acesso em andamento nesta conta. Finalize-o pelo app antes de iniciar outra visita.</div>}
      {!secureContext && <div className="gym-access-alert" role="alert"><AlertTriangle size={18} /> Check-in indisponível sem HTTPS válido. Não envie credenciais neste endereço.</div>}
      <div className="gym-access-proof"><MapPin size={18} /><span>O servidor verifica a assinatura, o status da academia, a localização e o limite diário. GPS pode ser impreciso ou falsificado; não é prova antifraude absoluta.</span></div>
      {activeCheckin
        ? <button className="button primary wide-button" type="button" onClick={submitCheckOut} disabled={busy}>{busy ? "Finalizando…" : "Finalizar treino (confirmação no app)"} <Check size={16} /></button>
        : <button className="button primary wide-button" type="button" onClick={submitCheckIn} disabled={busy || !session?.user?.id || !secureContext || !plateActive || !unit.contract_active}>{busy ? "Validando…" : "Validar e registrar presença"} <ArrowRight size={16} /></button>}
      {message && <p className="gym-access-success" role="status"><Check size={16} />{message}</p>}
      {error && <div className="social-feed-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={refresh}>Tentar novamente</button></div>}
      <p className="gym-access-finance">O acesso gera apenas registro operacional. Não há contrato tarifário, créditos, saldo ou pagamentos configurados.</p>
    </section>}
    {!loading && !unit && error && <div className="social-feed-error" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}
    {session?.user?.id && history.length > 0 && <section className="gym-access-history">
      <h3><Clock3 size={17} /> Histórico de acessos</h3>
      {history.map(visit => <div key={visit.id} className="gym-access-history-row"><span>{new Date(visit.started_at).toLocaleString("pt-BR")}</span><strong>{visit.status === "completed" ? "Finalizado no app" : "Em andamento"}</strong><small>Remuneração: não configurada</small></div>)}
    </section>}
    <p className="gym-access-footer">QR fixo identifica somente esta placa. A autorização é sempre decidida pelo servidor.</p>
  </div>;
}

export function GymPartnerCheckinsPage({ client, session }) {
  const [units, setUnits] = useState([]);
  const [visits, setVisits] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!client || !session?.user?.id) {
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    setError("");
    try {
      const unitResult = await client.from("fortalfy_gym_units")
        .select("id,unit_name,address")
        .eq("profile_id", session.user.id)
        .order("unit_name");
      if (unitResult.error) throw unitResult.error;
      const nextUnits = unitResult.data || [];
      setUnits(nextUnits);
      if (!nextUnits.length) {
        setVisits([]);
        setProfiles({});
        setUpdatedAt(new Date());
        return;
      }
      const result = await client.from("fortalfy_gym_checkins")
        .select("id,user_id,unit_id,service_date,access_method_claimed,status,financial_status,started_at,completed_at")
        .in("unit_id", nextUnits.map(unit => unit.id))
        .order("started_at", { ascending: false })
        .limit(100);
      if (result.error) throw result.error;
      const nextVisits = result.data || [];
      setVisits(nextVisits);
      const memberIds = [...new Set(nextVisits.map(visit => visit.user_id))];
      if (memberIds.length) {
        const memberResult = await client.from("profiles").select("id,display_name").in("id", memberIds);
        if (memberResult.error) throw memberResult.error;
        setProfiles(Object.fromEntries((memberResult.data || []).map(profile => [profile.id, profile.display_name])));
      } else {
        setProfiles({});
      }
      setUpdatedAt(new Date());
    } catch (failure) {
      console.error("Falha ao atualizar o painel de acessos da academia.", failure);
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, [client, session?.user?.id]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!session?.user?.id) return <div className="gym-access-content"><div className="gym-access-alert"><ShieldCheck size={18} /> Entre com a conta aprovada da academia para consultar acessos reais.<Link to="/profile">Entrar <ArrowRight size={15} /></Link></div></div>;
  if (!client) return <div className="gym-access-content"><div className="gym-access-alert" role="alert">Configure o Supabase para consultar os acessos reais.</div></div>;

  return <div className="gym-partner-content">
    <div className="gym-access-proof"><Clock3 size={18} /> Atualização automática a cada 30 segundos. Esta tela é um painel de registros, não uma confirmação física de entrada/saída.</div>
    <button className="button subtle small-button" type="button" onClick={() => refresh()} disabled={loading}><RefreshCw size={15} /> Atualizar agora</button>
    {updatedAt && <small className="gym-admin-disclaimer">Atualizado em {updatedAt.toLocaleTimeString("pt-BR")}</small>}
    {error && <div className="social-feed-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => refresh()}>Tentar novamente</button></div>}
    {loading && <p className="social-inline-status" role="status">Carregando acessos…</p>}
    {!loading && !error && !units.length && <div className="gym-admin-empty">Nenhuma unidade FortalPass foi vinculada a esta academia pela equipe Fortalfy.</div>}
    {!loading && !error && units.length > 0 && visits.length === 0 && <div className="gym-admin-empty">Nenhum acesso real registrado para suas unidades.</div>}
    {units.map(unit => <section className="gym-partner-unit" key={unit.id}>
      <div><span className="eyebrow">UNIDADE FORTALPASS</span><h2>{unit.unit_name}</h2><p>{unit.address}</p></div>
      {!visits.some(visit => visit.unit_id === unit.id) && <p className="gym-admin-empty">Nenhum acesso registrado nesta unidade.</p>}
      {visits.filter(visit => visit.unit_id === unit.id).map(visit => <article className="gym-partner-visit" key={visit.id}>
        <span className="gym-partner-visit-icon"><Check size={17} /></span>
        <div><strong>{profiles[visit.user_id] || "Cliente FortalPass"}</strong><small>{new Date(visit.started_at).toLocaleString("pt-BR")} · {visit.access_method_claimed.toUpperCase()} informado</small></div>
        <span className={`gym-plate-status ${visit.status === "completed" ? "active" : "pending_installation"}`}>{visit.status === "completed" ? "Finalizado no app" : "Em andamento"}</span>
      </article>)}
    </section>)}
    <p className="gym-admin-disclaimer">O status financeiro permanece “não configurado”. O histórico da academia não mostra coordenadas precisas do cliente.</p>
  </div>;
}

export function GymPlateAdminPage({ client, session }) {
  const isAdmin = session?.user?.app_metadata?.role === "admin";
  const [listings, setListings] = useState([]);
  const [units, setUnits] = useState([]);
  const [plates, setPlates] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyPlate, setHistoryPlate] = useState("");
  const [qrByPlate, setQrByPlate] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedListing, setSelectedListing] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitAddress, setUnitAddress] = useState("");
  const [unitLatitude, setUnitLatitude] = useState("");
  const [unitLongitude, setUnitLongitude] = useState("");
  const [timezoneName, setTimezoneName] = useState("");
  const [radius, setRadius] = useState("");
  const [contractUnitId, setContractUnitId] = useState("");
  const [contractReference, setContractReference] = useState("");
  const [contractValidFrom, setContractValidFrom] = useState("");
  const [contractValidUntil, setContractValidUntil] = useState("");
  const [contractNotes, setContractNotes] = useState("");
  const [contractConfirmed, setContractConfirmed] = useState(false);
  const [plateUnit, setPlateUnit] = useState("");
  const [nfcLabel, setNfcLabel] = useState("");
  const [eventForPlate, setEventForPlate] = useState("");
  const [eventType, setEventType] = useState("installation");
  const [eventNotes, setEventNotes] = useState("");
  const [printPlate, setPrintPlate] = useState("");
  const selectedPartner = listings.find(item => item.listing_id === selectedListing);
  const selectedContractUnit = units.find(unit => unit.unit_id === contractUnitId);

  const refresh = useCallback(async () => {
    if (!client || !isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextListings, nextUnits, nextPlates] = await Promise.all([
        loadAdminGymListings(client),
        loadAdminGymUnits(client),
        loadAdminGymPlates(client),
      ]);
      setListings(nextListings);
      setUnits(nextUnits);
      setPlates(nextPlates);
      setPlateUnit(current => current || nextUnits[0]?.unit_id || "");
      setContractUnitId(current => current || nextUnits[0]?.unit_id || "");
      setSelectedListing(current => current || nextListings[0]?.listing_id || "");
    } catch (failure) {
      console.error("Falha ao carregar a administração das placas Fortalfy.", failure);
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, [client, isAdmin]);

  useEffect(() => {
    if (!selectedPartner) return;
    setUnitName(current => current || selectedPartner.business_name || "");
    setUnitAddress(current => current || selectedPartner.address || "");
    setUnitLatitude(current => current || String(selectedPartner.latitude ?? ""));
    setUnitLongitude(current => current || String(selectedPartner.longitude ?? ""));
  }, [selectedPartner]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const buildCodes = async () => {
      const entries = await Promise.all(plates.map(async plate => {
        try {
          const qrUrl = buildPlateUrl(window.location.origin + window.location.pathname, plate.public_id, "qr");
          const nfcUrl = buildPlateUrl(window.location.origin + window.location.pathname, plate.public_id, "nfc");
          const dataUrl = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "H", margin: 2, width: 280 });
          return [plate.plate_id, { qrUrl, nfcUrl, dataUrl, error: "" }];
        } catch (failure) {
          return [plate.plate_id, { error: failure.message }];
        }
      }));
      if (!cancelled) setQrByPlate(Object.fromEntries(entries));
    };
    buildCodes();
    return () => { cancelled = true; };
  }, [plates]);

  useEffect(() => {
    if (!printPlate) return undefined;
    const timer = window.setTimeout(() => window.print(), 50);
    const afterPrint = () => setPrintPlate("");
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [printPlate]);

  const loadHistory = async plateId => {
    setHistoryPlate(plateId);
    setHistory([]);
    try {
      setHistory(await loadAdminPlateHistory(client, plateId));
    } catch (failure) {
      console.error("Falha ao carregar auditoria da placa Fortalfy.", failure);
      setError(errorText(failure));
    }
  };

  const perform = async action => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice("Alteração registrada no servidor.");
      await refresh();
      if (historyPlate) await loadHistory(historyPlate);
    } catch (failure) {
      console.error("Falha na administração das placas Fortalfy.", failure);
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const submitUnit = event => {
    event.preventDefault();
    if (!selectedPartner || !unitName.trim() || !unitAddress.trim() || !unitLatitude || !unitLongitude || !timezoneName.trim() || !radius) return;
    perform(async () => {
      await createGymUnit(client, {
        profileId: selectedPartner.profile_id,
        listingId: selectedPartner.listing_id,
        unitName: unitName.trim(),
        address: unitAddress.trim(),
        latitude: Number(unitLatitude),
        longitude: Number(unitLongitude),
        timezoneName: timezoneName.trim(),
        checkinRadiusM: Number(radius),
      });
      setUnitName("");
      setUnitAddress("");
      setUnitLatitude("");
      setUnitLongitude("");
      setTimezoneName("");
      setRadius("");
    });
  };

  const submitPlate = event => {
    event.preventDefault();
    if (!plateUnit) return;
    perform(async () => {
      await createGymPlate(client, plateUnit, nfcLabel.trim());
      setNfcLabel("");
    });
  };

  const submitContract = event => {
    event.preventDefault();
    if (!selectedContractUnit || !contractReference.trim() || !contractValidFrom || !contractNotes.trim() || !contractConfirmed) return;
    perform(async () => {
      await createGymAccessContract(client, {
        unitId: selectedContractUnit.unit_id,
        contractReference: contractReference.trim(),
        validFrom: new Date(contractValidFrom).toISOString(),
        validUntil: contractValidUntil ? new Date(contractValidUntil).toISOString() : null,
        notes: contractNotes.trim(),
      });
      setContractReference("");
      setContractValidFrom("");
      setContractValidUntil("");
      setContractNotes("");
      setContractConfirmed(false);
    });
  };

  const submitEvent = event => {
    event.preventDefault();
    if (!eventForPlate || !eventNotes.trim()) return;
    perform(async () => {
      await recordGymPlateEvent(client, {
        plateId: eventForPlate,
        eventType,
        notes: eventNotes.trim(),
        nfcTagLabel: eventType === "nfc_registration" ? nfcLabel.trim() : null,
      });
      setEventNotes("");
      setNfcLabel("");
      setEventForPlate("");
    });
  };

  const copyNfcUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrByPlate[eventForPlate]?.nfcUrl || "");
      setNotice("URL NDEF copiada. Grave-a em uma etiqueta NFC física e teste em dispositivos reais.");
    } catch (failure) {
      console.error("Não foi possível copiar a URL NDEF da placa.", failure);
      setError("O navegador não permitiu copiar a URL. Abra o link HTTPS da placa e copie-o manualmente.");
    }
  };

  const signUrl = useMemo(() => printPlate ? qrByPlate[printPlate]?.qrUrl : "", [printPlate, qrByPlate]);
  if (!isAdmin) return <div className="gym-access-content"><div className="gym-access-alert" role="alert"><ShieldCheck size={18} /> Administração disponível somente para contas com papel Fortalfy admin no app_metadata.</div></div>;
  if (!client) return <div className="gym-access-content"><div className="gym-access-alert" role="alert">Configure o Supabase para administrar placas reais.</div></div>;

  return <div className="gym-admin-content">
    <header className="gym-admin-heading"><div className="gym-access-brand"><Brand /><div><small>GESTÃO DE PLACAS OFICIAIS</small></div></div><p>O identificador impresso é público; contrato, assinatura, estado da academia e presença são validados no servidor.</p></header>
    <aside className="gym-admin-warning"><AlertTriangle size={19} /><span>QR e NFC abrem o mesmo fluxo. GPS é apenas um sinal de proximidade e pode ser falsificado. Nenhuma remuneração, ledger ou repasse está disponível. HTTPS válido e instalação física real são pré-requisitos.</span></aside>
    {error && <div className="social-feed-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={refresh}>Tentar novamente</button></div>}
    {notice && <p className="gym-access-success" role="status"><Check size={16} />{notice}</p>}
    {loading && <p className="social-inline-status" role="status">Carregando unidades e placas…</p>}
    <section className="gym-admin-panel">
      <h2><MapPin size={19} /> Cadastrar unidade</h2>
      <p>Somente academias aprovadas. O endereço e as coordenadas vêm preenchidos do cadastro atual e devem ser confirmados para cada unidade física.</p>
      {!listings.length && !loading && <p className="gym-admin-empty">Não há listagens de academias aprovadas disponíveis.</p>}
      <form className="gym-admin-form" onSubmit={submitUnit}>
        <label>Academia aprovada<select value={selectedListing} onChange={event => { const next = listings.find(item => item.listing_id === event.target.value); setSelectedListing(event.target.value); setUnitName(next?.business_name || ""); setUnitAddress(next?.address || ""); setUnitLatitude(next ? String(next.latitude) : ""); setUnitLongitude(next ? String(next.longitude) : ""); }} required><option value="">Selecione uma academia</option>{listings.map(item => <option key={item.listing_id} value={item.listing_id}>{item.business_name} · {item.address}</option>)}</select></label>
        <label>Nome da unidade<input value={unitName} onChange={event => setUnitName(event.target.value)} maxLength={120} placeholder={selectedPartner?.business_name || "Nome real da unidade"} required /></label>
        <label>Endereço físico da unidade<input value={unitAddress} onChange={event => setUnitAddress(event.target.value)} maxLength={300} required /></label>
        <label>Latitude<input type="number" min="-90" max="90" step="any" value={unitLatitude} onChange={event => setUnitLatitude(event.target.value)} required /></label>
        <label>Longitude<input type="number" min="-180" max="180" step="any" value={unitLongitude} onChange={event => setUnitLongitude(event.target.value)} required /></label>
        <label>Fuso IANA da unidade<input value={timezoneName} onChange={event => setTimezoneName(event.target.value)} placeholder="Ex.: America/Fortaleza" required /></label>
        <label>Raio permitido em metros<input type="number" min="25" max="1000" value={radius} onChange={event => setRadius(event.target.value)} placeholder="Defina conforme o local" required /></label>
        <button className="button primary" type="submit" disabled={busy || !selectedPartner}>{busy ? "Salvando…" : "Criar unidade"}</button>
      </form>
    </section>
    <section className="gym-admin-panel">
      <h2><ShieldCheck size={19} /> Contrato de acesso da unidade</h2>
      <p>Check-ins exigem um contrato real vigente. Registre a referência somente depois que a equipe verificar o documento assinado. Nenhuma tarifa é definida aqui.</p>
      <label className="gym-contract-unit-select">Unidade<select value={contractUnitId} onChange={event => setContractUnitId(event.target.value)} required><option value="">Selecione uma unidade</option>{units.map(unit => <option key={unit.unit_id} value={unit.unit_id}>{unit.business_name} · {unit.unit_name}</option>)}</select></label>
      {selectedContractUnit?.contract_reference && <div className="gym-access-proof"><ShieldCheck size={17} /> Contrato {selectedContractUnit.contract_reference} · {selectedContractUnit.contract_status || "sem status"}{selectedContractUnit.contract_valid_until ? ` · até ${new Date(selectedContractUnit.contract_valid_until).toLocaleDateString("pt-BR")}` : " · sem data final"}{selectedContractUnit.contract_status === "active" && <button className="button subtle small-button" type="button" disabled={busy} onClick={() => perform(() => setGymAccessContractStatus(client, { contractId: selectedContractUnit.active_contract_id, status: "suspended", notes: "Suspensão administrativa do contrato de acesso." }))}>Suspender contrato</button>}</div>}
      {selectedContractUnit && selectedContractUnit.contract_status !== "active" && <form className="gym-admin-form" onSubmit={submitContract}>
        <label>Referência do contrato assinado<input value={contractReference} onChange={event => setContractReference(event.target.value)} minLength={3} maxLength={120} required /></label>
        <label>Início da vigência<input type="datetime-local" value={contractValidFrom} onChange={event => setContractValidFrom(event.target.value)} required /></label>
        <label>Fim da vigência (opcional)<input type="datetime-local" value={contractValidUntil} onChange={event => setContractValidUntil(event.target.value)} /></label>
        <label>Registro da revisão administrativa<textarea value={contractNotes} onChange={event => setContractNotes(event.target.value)} minLength={5} maxLength={2000} placeholder="Informe quem verificou o contrato assinado e observações" required /></label>
        <label className="gym-contract-confirm"><input type="checkbox" checked={contractConfirmed} onChange={event => setContractConfirmed(event.target.checked)} required /> Confirmo que a referência corresponde a um contrato real revisado pela equipe.</label>
        <button className="button primary" type="submit" disabled={busy}>{busy ? "Registrando…" : "Registrar contrato aprovado"}</button>
      </form>}
      {!units.length && <p className="gym-admin-empty">Cadastre uma unidade antes de vincular seu contrato.</p>}
    </section>
    <section className="gym-admin-panel">
      <h2><QrCode size={19} /> Emitir placa</h2>
      <p>Uma placa nasce pendente. Só uma instalação física registrada por admin permite ativá-la.</p>
      <form className="gym-admin-form gym-admin-inline-form" onSubmit={submitPlate}>
        <label>Unidade<select value={plateUnit} onChange={event => setPlateUnit(event.target.value)} required><option value="">Selecione uma unidade</option>{units.map(unit => <option key={unit.unit_id} value={unit.unit_id}>{unit.business_name} · {unit.unit_name}</option>)}</select></label>
        <label>Referência física NFC (opcional)<input value={nfcLabel} onChange={event => setNfcLabel(event.target.value)} maxLength={120} placeholder="Identificação operacional, não é segredo" /></label>
        <button className="button primary" type="submit" disabled={busy || !units.length}>{busy ? "Salvando…" : "Criar placa"}</button>
      </form>
    </section>
    <section className="gym-admin-panel">
      <h2><ShieldCheck size={19} /> Placas registradas</h2>
      {!plates.length && !loading && <p className="gym-admin-empty">Nenhuma placa cadastrada. Não há instalações presumidas.</p>}
      <div className="gym-admin-plates">{plates.map(plate => {
        const code = qrByPlate[plate.plate_id];
        return <article className={`gym-admin-plate${printPlate === plate.plate_id ? " is-printing" : ""}`} key={plate.plate_id}>
          <div className="gym-admin-plate-details">
            <div className="gym-admin-plate-title"><div><span className="eyebrow">{plate.business_name}</span><h3>{plate.unit_name}</h3></div><span className={`gym-plate-status ${plate.plate_status}`}>{STATUS_LABELS[plate.plate_status]}</span></div>
            <p>{plate.address} · {plate.timezone_name} · raio {plate.checkin_radius_m} m</p>
            <small>ID público: {plate.public_id}</small>
            <small>NFC: {plate.nfc_tag_label || "ainda não registrado"} · {plate.checkin_count} acessos · {plate.event_count} eventos</small>
            {code?.error && <p className="social-inline-error" role="alert">{code.error}</p>}
            <div className="gym-admin-actions">
              {code?.dataUrl && <button className="button subtle small-button" type="button" onClick={() => setPrintPlate(plate.plate_id)}><Printer size={15} /> Imprimir placa</button>}
              <button className="button subtle small-button" type="button" onClick={() => { setEventForPlate(plate.plate_id); setEventType("installation"); }}><Wrench size={15} /> Instalação / manutenção</button>
              <button className="button subtle small-button" type="button" onClick={() => loadHistory(plate.plate_id)}><Clock3 size={15} /> Histórico / alertas</button>
              {plate.plate_status === "pending_installation" && plate.installation_recorded && <button className="button primary small-button" type="button" disabled={busy} onClick={() => perform(() => setGymPlateStatus(client, { plateId: plate.plate_id, status: "active", notes: "Ativação administrativa após registro de instalação física." }))}>Ativar</button>}
              {plate.plate_status === "active" && <button className="button subtle small-button" type="button" disabled={busy} onClick={() => perform(() => setGymPlateStatus(client, { plateId: plate.plate_id, status: "disabled", notes: "Desativação administrativa da placa." }))}>Desativar</button>}
              {plate.plate_status !== "replaced" && <button className="button subtle small-button" type="button" disabled={busy} onClick={() => perform(() => setGymPlateStatus(client, { plateId: plate.plate_id, status: "replaced", notes: "Placa marcada como substituída; novos check-ins bloqueados." }))}>Substituir</button>}
            </div>
          </div>
          {code?.dataUrl && <div className="gym-plate-print-content"><div className="gym-qr-frame"><img src={code.dataUrl} alt={`QR Code da unidade ${plate.unit_name}`} /></div><strong>APONTE A CÂMERA PARA FAZER CHECK-IN</strong><span>Ou aproxime o celular do símbolo NFC</span><small>Fortalfy · QR identifica a unidade; servidor valida o acesso</small></div>}
        </article>;
      })}</div>
    </section>
    {eventForPlate && <section className="gym-admin-panel">
      <h2><Wrench size={19} /> Registrar evento físico</h2>
      <p>O registro documenta a declaração da equipe; não é uma verificação automática da instalação nem uma autenticação do chip.</p>
      <form className="gym-admin-form" onSubmit={submitEvent}>
        <label>Tipo<select value={eventType} onChange={event => setEventType(event.target.value)}><option value="installation">Instalação física</option><option value="maintenance">Manutenção</option><option value="nfc_registration">Cadastro NDEF/NFC</option><option value="replacement">Substituição</option></select></label>
        {eventType === "nfc_registration" && <label>Referência do componente NFC<input value={nfcLabel} onChange={event => setNfcLabel(event.target.value)} maxLength={120} required /></label>}
        <label>Relato de execução<textarea value={eventNotes} onChange={event => setEventNotes(event.target.value)} minLength={5} maxLength={2000} placeholder="Informe quem executou, data e observações reais" required /></label>
        {eventType === "nfc_registration" && <div className="gym-nfc-setup"><p className="gym-access-proof"><Nfc size={17} /> Grave manualmente em uma etiqueta NFC física compatível exatamente a URL abaixo. O identificador é público e não autentica a etiqueta. NFC Web não é suportado em todos os dispositivos; ainda é necessário teste físico, incluindo iOS e Android.</p><code>{qrByPlate[eventForPlate]?.nfcUrl || "URL indisponível até abrir o app sob HTTPS válido."}</code><button className="button subtle small-button" type="button" onClick={copyNfcUrl} disabled={!qrByPlate[eventForPlate]?.nfcUrl}>Copiar URL NDEF</button></div>}
        <div className="gym-admin-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar registro"}</button><button className="button subtle" type="button" onClick={() => setEventForPlate("")}>Cancelar</button></div>
      </form>
    </section>}
    {!!historyPlate && <section className="gym-admin-panel">
      <h2><Clock3 size={19} /> Auditoria da placa</h2>
      <button className="button subtle small-button" type="button" onClick={() => loadHistory(historyPlate)}><RefreshCw size={15} /> Atualizar histórico</button>
      {!history.length && <p className="gym-admin-empty">Nenhum evento ou acesso registrado para esta placa.</p>}
      {history.map((entry, index) => <div className="gym-audit-row" key={`${entry.entry_type}-${entry.occurred_at}-${index}`}><span>{new Date(entry.occurred_at).toLocaleString("pt-BR")}</span><strong>{entry.entry_type === "checkin_attempt" && entry.result === "denied" ? "Tentativa negada" : entry.entry_type === "checkin" ? "Acesso aceito" : "Evento da placa"}</strong><small>{entry.detail}</small></div>)}
    </section>}
    <p className="gym-admin-disclaimer">A etiqueta NFC gravada com uma URL comum é clonável. O QR impresso também pode ser copiado. Validação de assinatura, GPS, status e limite diário reduz abuso, mas não prova presença física; uma proteção mais forte exige confirmação humana ou hardware criptográfico com chaves/validação próprias.</p>
    {printPlate && codeForPrint(plates, printPlate, signUrl, qrByPlate[printPlate]?.dataUrl)}
  </div>;
}

function codeForPrint(plates, plateId, qrUrl, dataUrl) {
  const plate = plates.find(item => item.plate_id === plateId);
  if (!plate || !dataUrl) return null;
  return <div className="gym-print-only">
    <div className="gym-print-card">
      <div className="gym-access-brand"><Brand /><div><small>FORTALPASS · ACADEMIA PARCEIRA</small></div></div>
      <h1>{plate.unit_name}</h1><p>{plate.business_name} · {plate.address}</p>
      <img src={dataUrl} alt={`QR Code fixo da unidade ${plate.unit_name}`} />
      <h2>ESCANEIE PARA VALIDAR SEU ACESSO</h2>
      <p>Ou aproxime o celular do NFC. O acesso depende da validação da sua conta pelo servidor.</p>
      <small>Placa {plate.public_id} · {qrUrl}</small>
    </div>
  </div>;
}
