import { useState } from "react";
import { ArrowRight, Check, Download, ImagePlus, Layers3, Plus, Save, Send, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "./MobileNavigation.jsx";

const artworkTypes = ["Post", "Story", "Capa de treino", "Dica de nutrição", "Capa de curso", "Banner de evento", "Produto", "Capa de perfil"];
const canvasSizes = [
  { id: "square", label: "Quadrado", note: "Feed 1:1", width: 1080, height: 1080 },
  { id: "portrait", label: "Vertical", note: "Feed 4:5", width: 1080, height: 1350 },
  { id: "story", label: "Story", note: "Tela 9:16", width: 1080, height: 1920 },
  { id: "banner", label: "Banner", note: "Horizontal", width: 1600, height: 900 },
];
const themes = [
  { label: "Verde", background: "#e8f0e5", accent: "#0b5035", foreground: "#103826" },
  { label: "Floresta", background: "#103c2c", accent: "#c1f55b", foreground: "#f6f9f1" },
  { label: "Lima", background: "#c9f58a", accent: "#17432e", foreground: "#113522" },
  { label: "Areia", background: "#f4eddf", accent: "#617f4f", foreground: "#253b2e" },
  { label: "Branco", background: "#fbfcf9", accent: "#39704a", foreground: "#153a29" },
];
const styles = ["Editorial", "Orgânico", "Minimalista", "Energético"];

const escapeSvg = text => text.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[character]));

function wrapText(text, maxCharacters, maxLines) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxCharacters && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxCharacters - 1).trimEnd()}…`;
  }
  return lines;
}

function textLines(lines, x, y, fontSize, color, weight, lineHeight, anchor = "middle") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="${weight}" letter-spacing="-1">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeSvg(line)}</tspan>`).join("")}</text>`;
}

export function generateImageArtwork(options, version = 0) {
  const canvas = canvasSizes.find(size => size.id === options.format) || canvasSizes[0];
  const theme = themes.find(item => item.label === options.theme) || themes[0];
  const { width, height } = canvas;
  const centerX = width / 2;
  const isBanner = canvas.id === "banner";
  const titleFontSize = isBanner ? 84 : canvas.id === "story" ? 103 : 92;
  const titleLines = wrapText(options.title || "Seu movimento, no seu ritmo.", isBanner ? 24 : 20, 3);
  const subtitleLines = wrapText(options.subtitle || "Bem-estar começa com um próximo passo possível.", isBanner ? 44 : 33, 2);
  const titleY = Math.round(height * (canvas.id === "story" ? 0.4 : isBanner ? 0.29 : 0.43));
  const subtitleY = titleY + titleLines.length * (titleFontSize * 1.12) + 25;
  const safeTitle = textLines(titleLines, centerX, titleY, titleFontSize, theme.foreground, 700, titleFontSize * 1.12);
  const safeSubtitle = textLines(subtitleLines, centerX, subtitleY, isBanner ? 33 : 31, theme.foreground, 400, 43);
  const motif = options.style === "Minimalista"
    ? `<circle cx="${centerX}" cy="${Math.round(height * .18)}" r="10" fill="${theme.accent}"/><circle cx="${centerX + 34}" cy="${Math.round(height * .18)}" r="4" fill="${theme.accent}" opacity=".45"/>`
    : options.style === "Orgânico"
      ? `<path d="M0 ${height * .16} C${width * .2} ${height * .24} ${width * .34} ${height * .02} ${centerX} ${height * .15} S${width * .82} ${height * .23} ${width} ${height * .12}" fill="none" stroke="${theme.accent}" stroke-width="3" opacity=".33"/><circle cx="${width * .82}" cy="${height * .77}" r="${width * .14}" fill="${theme.accent}" opacity=".07"/>`
      : options.style === "Energético"
        ? `<path d="m${width * .08} ${height * .78} ${width * .18} -${height * .35} ${width * .1} ${height * .12} ${width * .1} -${height * .27} ${width * .3} ${height * .3}" fill="${theme.accent}" opacity=".08"/><circle cx="${width * .86}" cy="${height * .2}" r="${width * .095}" fill="${theme.accent}" opacity=".12"/>`
        : `<rect x="${width * .08}" y="${height * .09}" width="${width * .84}" height="${height * .82}" rx="${Math.min(width, height) * .035}" fill="none" stroke="${theme.accent}" stroke-width="2" opacity=".27"/><circle cx="${width * .86}" cy="${height * .13}" r="7" fill="${theme.accent}" opacity=".65"/>`;
  const eyebrow = options.includeBrand ? `<text x="${centerX}" y="${height * .105}" text-anchor="middle" fill="${theme.accent}" font-family="Arial,Helvetica,sans-serif" font-size="${isBanner ? 23 : 20}" font-weight="700" letter-spacing="5">FORTALFY  ·  ${escapeSvg(options.type.toUpperCase())}</text>` : "";
  const cta = options.cta.trim()
    ? `<rect x="${centerX - 142}" y="${subtitleY + subtitleLines.length * 44 + 52}" width="284" height="70" rx="35" fill="${theme.accent}"/><text x="${centerX}" y="${subtitleY + subtitleLines.length * 44 + 98}" text-anchor="middle" fill="${theme.background}" font-family="Arial,Helvetica,sans-serif" font-size="23" font-weight="700" letter-spacing="1">${escapeSvg(options.cta.toUpperCase())}</text>`
    : "";
  const motifVariant = version % 4 === 0 ? `<circle cx="${width * .13}" cy="${height * .83}" r="${width * .07}" fill="${theme.accent}" opacity=".09"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${theme.background}"/><circle cx="${width * .78}" cy="${height * .28}" r="${width * .24}" fill="${theme.accent}" opacity=".055"/>${motif}${motifVariant}${eyebrow}${safeTitle}${safeSubtitle}${cta}<text x="${centerX}" y="${height * .94}" text-anchor="middle" fill="${theme.foreground}" opacity=".62" font-family="Arial,Helvetica,sans-serif" font-size="${isBanner ? 18 : 16}" letter-spacing="3">MOVIMENTO  ·  ROTINA  ·  BEM-ESTAR</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function savePng(dataUrl, filename, notify) {
  const image = new Image();
  const source = URL.createObjectURL(new Blob([decodeURIComponent(dataUrl.split(",")[1])], { type: "image/svg+xml" }));
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(source);
      notify("Este navegador não disponibilizou o recurso de exportação para PNG.");
      return;
    }
    context.drawImage(image, 0, 0);
    canvas.toBlob(blob => {
      URL.revokeObjectURL(source);
      if (!blob) {
        notify("Não foi possível preparar o PNG. Tente baixar a arte em SVG.");
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      notify("Arte exportada em PNG.");
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(source);
    notify("Não foi possível abrir a arte para exportação.");
  };
  image.src = source;
}

function downloadSvg(dataUrl, filename) {
  const svg = decodeURIComponent(dataUrl.split(",")[1]);
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export default function FortalfyStudio({ artwork, setArtwork, savedArts, setSavedArts, setFeedArts, notify }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("create");
  const [type, setType] = useState(artwork?.type || artworkTypes[0]);
  const [format, setFormat] = useState(artwork?.format || "square");
  const [style, setStyle] = useState(artwork?.style || styles[0]);
  const [theme, setTheme] = useState(artwork?.theme || themes[0].label);
  const [title, setTitle] = useState(artwork?.title || "Seu movimento, no seu ritmo.");
  const [subtitle, setSubtitle] = useState(artwork?.subtitle || "Bem-estar começa com um próximo passo possível.");
  const [cta, setCta] = useState(artwork?.cta || "Comece hoje");
  const [includeBrand, setIncludeBrand] = useState(true);
  const [version, setVersion] = useState(0);
  const activeCanvas = canvasSizes.find(size => size.id === format) || canvasSizes[0];
  const preview = artwork?.dataUrl;
  const previewSaved = artwork && savedArts.some(item => item.id === artwork.id);

  const generate = () => {
    const options = { type, format, style, theme, title, subtitle, cta, includeBrand };
    const nextArtwork = {
      id: `studio-${Date.now()}`,
      dataUrl: generateImageArtwork(options, version),
      type, format, style, theme,
      title: title.trim() || "Seu movimento, no seu ritmo.",
      subtitle: subtitle.trim() || "Bem-estar começa com um próximo passo possível.",
      createdAt: new Date().toLocaleString("pt-BR"),
    };
    setArtwork(nextArtwork);
    setVersion(current => current + 1);
    notify("Nova arte criada no Studio. Revise e salve se quiser usá-la depois.");
  };
  const saveArtwork = () => {
    if (!artwork) return;
    if (!savedArts.some(item => item.id === artwork.id)) setSavedArts(current => [artwork, ...current]);
    notify("Arte salva na biblioteca desta sessão.");
  };
  const useInFeed = item => {
    setFeedArts(current => [item, ...current.filter(art => art.id !== item.id)]);
    notify("Arte adicionada ao Feed desta sessão.");
    navigate("/feed");
  };

  return <div className="app-screen studio-screen">
    <header className="mobile-header studio-header"><Link to="/home" aria-label="Fortalfy, página inicial"><span className="logo-mark">fortal<span>fy</span></span></Link><span className="studio-header-label"><Sparkles size={15} /> STUDIO CRIATIVO</span></header>
    <main className="screen-content studio-content">
      <div className="studio-page-title"><div><span className="eyebrow">FORTALFY STUDIO · PRÉVIA LOCAL</span><h1>Ideias que viram<br />movimento.</h1></div><span className="studio-title-mark"><Sparkles size={21} /></span></div>
      <p className="studio-intro">Crie artes originais para contar sua jornada, divulgar seu trabalho ou inspirar a comunidade.</p>
      <div className="studio-tabs" role="tablist" aria-label="Studio"><button role="tab" aria-selected={tab === "create"} className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><ImagePlus size={16} /> Criar arte</button><button role="tab" aria-selected={tab === "library"} className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}><Layers3 size={16} /> Minha biblioteca <span>{savedArts.length}</span></button></div>
      {tab === "create" ? <div className="studio-workspace">
        <section className="studio-controls">
          <div className="studio-section-label"><span>01</span><div><strong>Escolha um formato</strong><small>Imagem para cada momento.</small></div></div>
          <div className="studio-format-grid">{canvasSizes.map(size => <button key={size.id} className={`studio-format ${format === size.id ? "active" : ""}`} onClick={() => setFormat(size.id)}><i className={`format-shape ${size.id}`} /><span><strong>{size.label}</strong><small>{size.note}</small></span><span className="studio-radio" /></button>)}</div>
          <div className="studio-section-label"><span>02</span><div><strong>O que vamos criar?</strong><small>Escolha o tema da sua arte.</small></div></div>
          <div className="studio-type-grid">{artworkTypes.map(item => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>)}</div>
          <label className="studio-input-label">Título da arte<input maxLength={90} value={title} onChange={event => setTitle(event.target.value)} placeholder="Escreva uma frase para sua arte" /></label>
          <label className="studio-input-label">Mensagem complementar<textarea maxLength={150} value={subtitle} onChange={event => setSubtitle(event.target.value)} placeholder="Conte um pouco mais" rows={2} /></label>
          <label className="studio-input-label">Texto do botão <span className="studio-optional">(opcional)</span><input maxLength={26} value={cta} onChange={event => setCta(event.target.value)} placeholder="Ex.: Saiba mais" /></label>
          <div className="studio-section-label studio-section-label-small"><span>03</span><div><strong>Escolha o estilo</strong><small>Uma paleta que combina com a sua mensagem.</small></div></div>
          <div className="studio-style-grid">{styles.map(item => <button key={item} className={style === item ? "active" : ""} onClick={() => setStyle(item)}>{item}</button>)}</div>
          <div className="studio-palette" aria-label="Paleta de cores">{themes.map(item => <button key={item.label} className={theme === item.label ? "active" : ""} aria-label={`Paleta ${item.label}`} aria-pressed={theme === item.label} onClick={() => setTheme(item.label)}><i style={{ background: item.background, borderColor: item.accent }} /><span>{item.label}</span></button>)}</div>
          <label className="studio-brand-toggle"><input type="checkbox" checked={includeBrand} onChange={event => setIncludeBrand(event.target.checked)} /><span className="studio-toggle-check"><Check size={13} /></span><span><strong>Assinatura Fortalfy</strong><small>Identifique a arte como conceito do app.</small></span></label>
          <button className="button primary wide-button studio-generate-button" onClick={generate}><Sparkles size={17} /> Criar minha arte <ArrowRight size={17} /></button>
        </section>
        <section className="studio-preview-column">
          <div className="studio-preview-heading"><div><span className="eyebrow">PRÉVIA DA SUA ARTE</span><h2>Veja antes de compartilhar.</h2></div><span className="studio-live-dot"><i /> LOCAL</span></div>
          <div className={`studio-canvas-frame ${format}`} style={{ "--studio-ratio": `${activeCanvas.width} / ${activeCanvas.height}` }}>
            {preview ? <img src={preview} alt={`Prévia: ${artwork.title}`} /> : <div className="studio-first-preview"><span className="studio-preview-sparkle"><Sparkles size={23} /></span><span className="eyebrow">FORTALFY STUDIO</span><h3>Sua próxima<br />ideia começa aqui.</h3><p>Escolha um formato, conte sua mensagem e crie uma arte original.</p><span className="studio-preview-orbit" /></div>}
            {!preview && <span className="studio-canvas-placeholder">Prévia do formato · {activeCanvas.width} × {activeCanvas.height}</span>}
          </div>
          {preview && <div className="studio-art-actions">
            <button className="button primary" onClick={saveArtwork} disabled={previewSaved}><Save size={16} /> {previewSaved ? "Salva na biblioteca" : "Salvar na biblioteca"}</button>
            <button className="button subtle" onClick={() => useInFeed(artwork)}><Send size={16} /> Usar no Feed</button>
          </div>}
          {preview && <div className="studio-download-actions"><button onClick={() => savePng(preview, `fortalfy-${artwork.type.toLowerCase().replace(/\s+/g, "-")}.png`, notify)}><Download size={15} /> Baixar PNG</button><button onClick={() => { downloadSvg(preview, `fortalfy-${artwork.type.toLowerCase().replace(/\s+/g, "-")}.svg`); notify("Arte exportada em SVG."); }}>Exportar SVG</button></div>}
          <div className="studio-note"><Sparkles size={17} /><p><strong>Criação local, privacidade em primeiro lugar.</strong> As artes são montadas neste dispositivo com modelos vetoriais do Fortalfy. Não é uma geração por IA; nenhuma foto pessoal é enviada para um serviço externo.</p></div>
          <div className="studio-uses"><span>DESENHADO PARA VOCÊ</span><div><span>Feed</span><span>Stories</span><span>Rotina</span><span>Profissionais</span></div></div>
        </section>
      </div> : <section className="studio-library">
        <div className="studio-library-heading"><div><span className="eyebrow">ARQUIVOS DESTA SESSÃO</span><h2>Seu espaço criativo.</h2><p>Artes salvas ficam disponíveis enquanto o app permanecer aberto.</p></div>{savedArts.length > 0 && <span className="studio-library-count">{savedArts.length} {savedArts.length === 1 ? "arte" : "artes"}</span>}</div>
        {savedArts.length ? <div className="studio-library-grid">{savedArts.map(item => <article className="studio-library-card" key={item.id}><img src={item.dataUrl} alt={item.title} /><div><span>{item.type} · {item.format === "square" ? "Quadrado" : item.format === "story" ? "Story" : item.format === "banner" ? "Banner" : "Vertical"}</span><h3>{item.title}</h3><small>{item.createdAt}</small><div><button className="button subtle small-button" onClick={() => { setArtwork(item); setType(item.type); setFormat(item.format); setStyle(item.style); setTheme(item.theme); setTitle(item.title); setSubtitle(item.subtitle); setTab("create"); }}>Editar e pré-visualizar</button><button className="studio-use-link" onClick={() => useInFeed(item)}>Usar no Feed <ArrowRight size={14} /></button></div></div></article>)}</div> : <div className="studio-library-empty"><span><Layers3 size={25} /></span><h3>Sua biblioteca está começando agora.</h3><p>Crie uma arte no Studio e salve para reutilizar ou publicar no Feed.</p><button className="button primary" onClick={() => setTab("create")}><Plus size={16} /> Criar primeira arte</button></div>}
      </section>}
      <section className="studio-shop-link"><div><span className="studio-shop-link-icon"><Sparkles size={19} /></span><span><strong>Uma ideia para a sua marca?</strong><small>Veja como as novas imagens aparecem na FortalShop.</small></span></div><Link to="/shop" className="button subtle small-button">Ver loja <ArrowRight size={15} /></Link></section>
      <p className="studio-disclaimer">As imagens geradas e salvas nesta tela são prévias locais. Modelos vetoriais simples, sem geração de IA e sem upload. Nada é publicado até você escolher “Usar no Feed”; nesse caso, a arte só aparece nesta sessão demonstrativa.</p>
    </main>
    <BottomNav />
  </div>;
}
