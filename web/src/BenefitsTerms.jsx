import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { acceptCustomerBenefitTerms, CUSTOMER_BENEFITS_TERMS_VERSION } from "./commercialService.js";

const PLAN_LABELS = { start: "Start", plus: "Plus", master: "Master" };
const INITIAL_RANGES = [
  ["1–10", "1%", "2%", "5%"],
  ["11–20", "2%", "4%", "10%"],
  ["21–25", "3%", "6%", "15%"],
  ["26–fim do mês", "5%", "10%", "20%"],
];

export default function BenefitsTerms({ client, session, notify }) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(Boolean(session?.user?.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const userId = session?.user?.id;

  useEffect(() => {
    let active = true;
    if (!userId || !client) {
      setLoading(false);
      return undefined;
    }
    client.from("fortalfy_customer_benefit_consents")
      .select("id")
      .eq("profile_id", userId)
      .eq("declaration_version", CUSTOMER_BENEFITS_TERMS_VERSION)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError(queryError.message || "Não foi possível consultar seu aceite.");
          return;
        }
        setAccepted(Boolean(data));
      })
      .catch(failure => {
        if (active) setError(failure.message || "Não foi possível consultar seu aceite.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, userId]);

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      await acceptCustomerBenefitTerms(client);
      setAccepted(true);
      setSaved(true);
      notify("Seu aceite dos benefícios foi registrado.");
    } catch (failure) {
      setError(failure.message || "Não foi possível registrar seu aceite.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="app-screen">
    <header className="mobile-header"><Link to="/home" aria-label="Voltar à Fortalfy">FORTALFY</Link></header>
    <section className="screen-content">
      <div className="screen-heading"><div><span className="eyebrow">BENEFÍCIOS FORTALFY</span><h1>Declaração de ciência e adesão</h1></div></div>
      <article className="professional-review-card">
        <p>Ao contratar um plano pago elegível da Fortalfy, posso ter acesso a descontos progressivos em produtos e serviços participantes. A elegibilidade depende de assinatura ativa, aceite vigente, oferta e parceiro participantes.</p>
        <p>Os percentuais aplicáveis serão informados antes da finalização de cada compra. Os parceiros definem seus próprios preços e o desconto incide sobre o preço válido informado na Fortalfy; não compara automaticamente preços de loja física.</p>
        <p>Nem todos os produtos ou serviços participam. Os descontos não são cumulativos, salvo quando a oferta informar expressamente outra condição. A assinatura não garante desconto em todos os itens nem garante 20%: esse é o limite máximo inicial do plano Master, conforme faixa de calendário e regras vigentes.</p>
        <p>O aceite não renuncia a direitos previstos na legislação de defesa do consumidor. Os descontos dependem também de adesão voluntária do parceiro e de configuração comercial válida.</p>
        <h2>Configuração inicial pretendida</h2>
        <div className="table-scroll"><table><thead><tr><th>Dia da compra</th>{Object.values(PLAN_LABELS).map(label => <th key={label}>Fortal {label}</th>)}</tr></thead>
          <tbody>{INITIAL_RANGES.map(([period, ...percentages]) => <tr key={period}><td>{period}</td>{percentages.map((value, index) => <td key={PLAN_LABELS[Object.keys(PLAN_LABELS)[index]]}>{value}</td>)}</tr>)}</tbody>
        </table></div>
        <p role="note"><strong>Disponibilidade:</strong> o projeto ainda não possui integração de assinaturas pagas nem checkout de compras habilitado para todos os módulos. Portanto, esses percentuais não estão ativos para compras reais e nenhum desconto será aplicado até essa integração ser validada.</p>
        {!userId
          ? <p><Link to="/profile">Entre ou crie sua conta</Link> para registrar seu aceite, se desejar.</p>
          : loading
            ? <p><LoaderCircle className="spin" size={16} /> Consultando seu aceite…</p>
            : accepted
              ? <p className="professional-application-status status-approved"><CheckCircle2 size={17} /> Aceite registrado para a versão fortalfy-benefits-v1.{saved && " Obrigado."}</p>
              : <div className="professional-form-actions"><button type="button" className="button primary" disabled={busy} onClick={accept}>{busy ? <LoaderCircle className="spin" size={16} /> : "Li e concordo com as regras dos benefícios e descontos Fortalfy"}</button></div>}
        {error && <p className="professional-error" role="alert"><CircleAlert size={15} /> {error}</p>}
      </article>
    </section>
  </main>;
}
