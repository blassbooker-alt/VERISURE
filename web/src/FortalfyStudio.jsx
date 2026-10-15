import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, ImagePlus, Layers3, Plus, Save, Send, Sparkles, Upload, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "./Brand.jsx";
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
const CREATOR_PHOTO_LIMIT = 12 * 1024 * 1024;
const photoOptions = [
  { id: "coach", label: "Treino orientado", src: "./assets/stories/workout-coach.jpg", category: "Treino" },
  { id: "functional", label: "Movimento", src: "./assets/stories/workout-functional.jpg", category: "Treino" },
  { id: "yoga", label: "Bem-estar", src: "./assets/stories/workout-yoga.jpg", category: "Bem-estar" },
  { id: "running", label: "Corrida", src: "./assets/stories/workout-running.jpg", category: "Rotina" },
  { id: "meal", label: "Alimentação", src: "./assets/stories/workout-meal.jpg", category: "Nutrição" },
];
const creatorPresets = [
  { label: "Creator", type: "Post", format: "portrait", title: "Uma rotina real, sem atalhos.", subtitle: "Compartilhe o que funciona para você e inspire sua comunidade.", cta: "Acompanhe", photo: "running" },
  { label: "Personal", type: "Capa de treino", format: "portrait", title: "Treino com propósito.", subtitle: "Orientação individual para evoluir com consistência e segurança.", cta: "Agende uma avaliação", photo: "coach" },
  { label: "Nutrição", type: "Dica de nutrição", format: "square", title: "Comer bem também é equilíbrio.", subtitle: "Dicas práticas para escolhas mais conscientes no dia a dia.", cta: "Salve esta dica", photo: "meal" },
  { label: "Negócio local", type: "Banner de evento", format: "banner", title: "Seu próximo encontro com o movimento.", subtitle: "Apresente sua aula, evento ou espaço à comunidade.", cta: "Saiba mais", photo: "functional" },
];

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

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("Escolha uma imagem JPG, PNG ou WebP."));
      return;
    }
    if (file.size > CREATOR_PHOTO_LIMIT) {
      reject(new Error("A foto deve ter até 12 MB."));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      URL.revokeObjectURL(objectUrl);
      if (!context) {
        reject(new Error("Este navegador não disponibilizou o processamento de imagens."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível abrir esta imagem. Tente outro arquivo."));
    };
    image.src = objectUrl;
  });
}

export function generateImageArtwork(options, version = 0) {
  const canvas = canvasSizes.find(size => size.id === options.format) || canvasSizes[0];
  const theme = themes.find(item => item.label === options.theme) || themes[0];
  const { width, height } = canvas;
  const centerX = width / 2;
  const isBanner = canvas.id === "banner";
  const titleFontSize = isBanner ? 84 : canvas.id === "story" ? 103 : 92;
  const foreground = options.photoDataUrl ? "#ffffff" : theme.foreground;
  const photo = options.photoDataUrl
    ? `<image href="${escapeSvg(options.photoDataUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/><rect width="${width}" height="${height}" fill="#071c14" opacity=".48"/>`
    : "";
  const titleLines = wrapText(options.title || "Seu movimento, no seu ritmo.", isBanner ? 24 : 20, 3);
  const subtitleLines = wrapText(options.subtitle || "Bem-estar começa com um próximo passo possível.", isBanner ? 44 : 33, 2);
  const titleY = Math.round(height * (canvas.id === "story" ? 0.4 : isBanner ? 0.29 : 0.43));
  const subtitleY = titleY + titleLines.length * (titleFontSize * 1.12) + 25;
  const safeTitle = textLines(titleLines, centerX, titleY, titleFontSize, foreground, 700, titleFontSize * 1.12);
  const safeSubtitle = textLines(subtitleLines, centerX, subtitleY, isBanner ? 33 : 31, foreground, 400, 43);
  const motif = options.style === "Minimalista"
    ? `<circle cx="${centerX}" cy="${Math.round(height * .18)}" r="10" fill="${theme.accent}"/><circle cx="${centerX + 34}" cy="${Math.round(height * .18)}" r="4" fill="${theme.accent}" opacity=".45"/>`
    : options.style === "Orgânico"
      ? `<path d="M0 ${height * .16} C${width * .2} ${height * .24} ${width * .34} ${height * .02} ${centerX} ${height * .15} S${width * .82} ${height * .23} ${width} ${height * .12}" fill="none" stroke="${theme.accent}" stroke-width="3" opacity=".33"/><circle cx="${width * .82}" cy="${height * .77}" r="${width * .14}" fill="${theme.accent}" opacity=".07"/>`
      : options.style === "Energético"
        ? `<path d="m${width * .08} ${height * .78} ${width * .18} -${height * .35} ${width * .1} ${height * .12} ${width * .1} -${height * .27} ${width * .3} ${height * .3}" fill="${theme.accent}" opacity=".08"/><circle cx="${width * .86}" cy="${height * .2}" r="${width * .095}" fill="${theme.accent}" opacity=".12"/>`
        : `<rect x="${width * .08}" y="${height * .09}" width="${width * .84}" height="${height * .82}" rx="${Math.min(width, height) * .035}" fill="none" stroke="${theme.accent}" stroke-width="2" opacity=".27"/><circle cx="${width * .86}" cy="${height * .13}" r="7" fill="${theme.accent}" opacity=".65"/>`;
  const brandName = (options.brandName || "FORTALFY").trim().toUpperCase();
  const eyebrow = options.includeBrand ? `<text x="${centerX}" y="${height * .105}" text-anchor="middle" fill="${options.photoDataUrl ? "#d4ff8a" : theme.accent}" font-family="Arial,Helvetica,sans-serif" font-size="${isBanner ? 23 : 20}" font-weight="700" letter-spacing="5">${escapeSvg(brandName)}  ·  ${escapeSvg(options.type.toUpperCase())}</text>` : "";
  const cta = options.cta.trim()
    ? `<rect x="${centerX - 142}" y="${subtitleY + subtitleLines.length * 44 + 52}" width="284" height="70" rx="35" fill="${options.photoDataUrl ? "#c1f55b" : theme.accent}"/><text x="${centerX}" y="${subtitleY + subtitleLines.length * 44 + 98}" text-anchor="middle" fill="${options.photoDataUrl ? "#103826" : theme.background}" font-family="Arial,Helvetica,sans-serif" font-size="23" font-weight="700" letter-spacing="1">${escapeSvg(options.cta.toUpperCase())}</text>`
    : "";
  const motifVariant = version % 4 === 0 ? `<circle cx="${width * .13}" cy="${height * .83}" r="${width * .07}" fill="${theme.accent}" opacity=".09"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${theme.background}"/>${photo}<circle cx="${width * .78}" cy="${height * .28}" r="${width * .24}" fill="${theme.accent}" opacity="${options.photoDataUrl ? ".12" : ".055"}"/>${options.photoDataUrl ? "" : `${motif}${motifVariant}`}${eyebrow}${safeTitle}${safeSubtitle}${cta}<text x="${centerX}" y="${height * .94}" text-anchor="middle" fill="${foreground}" opacity=".78" font-family="Arial,Helvetica,sans-serif" font-size="${isBanner ? 18 : 16}" letter-spacing="3">MOVIMENTO  ·  ROTINA  ·  BEM-ESTAR</text></svg>`;
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
  const [cta, setCta] = useState(artwork?.cta || "Saiba mais");
  const [brandName, setBrandName] = useState(artwork?.brandName || "");
  const [includeBrand, setIncludeBrand] = useState(artwork?.includeBrand ?? false);
  const [photoId, setPhotoId] = useState(artwork?.photoId || photoOptions[0].id);
  const [photoDataUrl, setPhotoDataUrl] = useState(artwork?.photoDataUrl || "");
  const [photoError, setPhotoError] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const [version, setVersion] = useState(0);
  const activeCanvas = canvasSizes.find(size => size.id === format) || canvasSizes[0];
  const preview = artwork?.dataUrl;
  const previewSaved = artwork && savedArts.some(item => item.id === artwork.id);

  useEffect(() => {
    if (photoId === "custom") return undefined;
    const photo = photoOptions.find(item => item.id === photoId);
    if (!photo) return undefined;
    const controller = new AbortController();
    setLoadingPhoto(true);
    setPhotoError("");
    fetch(`${import.meta.env.BASE_URL}${photo.src.replace(/^\.\//, "")}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("A foto de referência não pôde ser carregada.");
        return response.blob();
      })
      .then(blob => imageFileToDataUrl(new File([blob], `${photo.id}.jpg`, { type: blob.type || "image/jpeg" })))
      .then(dataUrl => setPhotoDataUrl(dataUrl))
      .catch(error => {
        if (error.name !== "AbortError") {
          console.error("Não foi possível carregar a foto de referência do Studio.", error);
          setPhotoError(error.message || "Não foi possível carregar a foto. Tente outra imagem.");
          setPhotoDataUrl("");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPhoto(false);
      });
    return () => controller.abort();
  }, [photoId]);

  const selectPhoto = id => {
    if (id !== photoId) setPhotoId(id);
    setArtwork(null);
    if (id !== "custom" && id !== photoId) setPhotoDataUrl("");
  };

  const selectCustomPhoto = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await imageFileToDataUrl(file);
      setPhotoId("custom");
      setPhotoDataUrl(dataUrl);
      setArtwork(null);
      setPhotoError("");
    } catch (error) {
      setPhotoError(error.message || "Não foi possível processar esta imagem.");
    }
  };

  const applyPreset = preset => {
    setType(preset.type);
    setFormat(preset.format);
    setTitle(preset.title);
    setSubtitle(preset.subtitle);
    setCta(preset.cta);
    selectPhoto(preset.photo);
  };

  const generate = () => {
    const options = { type, format, style, theme, title, subtitle, cta, includeBrand, brandName, photoDataUrl };
    const nextArtwork = {
      id: `studio-${Date.now()}`,
      dataUrl: generateImageArtwork(options, version),
      type, format, style, theme, brandName, photoDataUrl, photoId, includeBrand, cta,
      title: title.trim() || "Seu movimento, no seu ritmo.",
      subtitle: subtitle.trim() || "Bem-estar começa com um próximo passo possível.",
      createdAt: new Date().toLocaleString("pt-BR"),
    };
    setArtwork(nextArtwork);
    setVersion(current => current + 1);
    notify(photoDataUrl ? "Arte fotográfica criada. Revise e salve para baixar ou reutilizar." : "Arte criada. Revise e salve para baixar ou reutilizar.");
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
    <header className="mobile-header studio-header"><Link to="/home" aria-label="Fortalfy, página inicial"><Brand /></Link><span className="studio-header-label"><Sparkles size={15} /> STUDIO CRIATIVO</span></header>
    <main className="screen-content studio-content">
      <div className="studio-page-title"><div><span className="eyebrow">FORTALFY STUDIO · FERRAMENTAS PARA CREATORS</span><h1>Conte sua história.<br />Crie com intenção.</h1></div><span className="studio-title-mark"><Sparkles size={21} /></span></div>
      <p className="studio-intro">Monte posts, Stories e materiais de divulgação com fotos, sua identidade e formatos prontos para a comunidade.</p>
      <section className="studio-creator-hero" aria-label="Para quem é o Studio">
        <div className="studio-creator-hero-copy"><span>SEU CONTEÚDO, SUA IDENTIDADE</span><strong>Uma ferramenta para quem inspira e empreende.</strong><small>Creators · profissionais · academias · negócios locais</small></div>
        <div className="studio-creator-hero-photos" aria-hidden="true">{photoOptions.slice(0, 3).map(photo => <img key={photo.id} src={photo.src} alt="" loading="lazy" />)}</div>
      </section>
      <div className="studio-tabs" role="tablist" aria-label="Studio"><button role="tab" aria-selected={tab === "create"} className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><ImagePlus size={16} /> Criar arte</button><button role="tab" aria-selected={tab === "library"} className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}><Layers3 size={16} /> Minha biblioteca <span>{savedArts.length}</span></button></div>
      {tab === "create" ? <div className="studio-workspace">
        <section className="studio-controls">
          <div className="studio-section-label"><span>01</span><div><strong>Comece com um modelo</strong><small>Personalize o exemplo para o seu público.</small></div></div>
          <div className="studio-template-grid">{creatorPresets.map(preset => <button type="button" key={preset.label} onClick={() => applyPreset(preset)}><span><UserRound size={15} /></span><strong>{preset.label}</strong><small>{preset.type}</small></button>)}</div>
          <div className="studio-section-label"><span>02</span><div><strong>Escolha o formato</strong><small>Pronto para feed, Story ou divulgação.</small></div></div>
          <div className="studio-format-grid">{canvasSizes.map(size => <button key={size.id} className={`studio-format ${format === size.id ? "active" : ""}`} onClick={() => setFormat(size.id)}><i className={`format-shape ${size.id}`} /><span><strong>{size.label}</strong><small>{size.note}</small></span><span className="studio-radio" /></button>)}</div>
          <div className="studio-section-label"><span>03</span><div><strong>Use uma imagem</strong><small>Escolha uma foto de referência ou envie uma autorizada.</small></div></div>
          <div className="studio-photo-grid" role="group" aria-label="Fotos de referência">
            {photoOptions.map(photo => <button type="button" key={photo.id} className={`studio-photo-option ${photoId === photo.id ? "active" : ""}`} aria-pressed={photoId === photo.id} onClick={() => selectPhoto(photo.id)}><img src={photo.src} alt="" loading="lazy" /><span><strong>{photo.label}</strong><small>{photo.category}</small></span></button>)}
            <button type="button" className={`studio-photo-upload ${photoId === "custom" ? "active" : ""}`} onClick={() => photoInputRef.current?.click()}><Upload size={17} /><span>{photoId === "custom" ? "Foto selecionada" : "Enviar sua foto"}</span><small>JPG, PNG ou WebP · até 12 MB</small></button>
            <input ref={photoInputRef} className="studio-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectCustomPhoto} aria-label="Enviar foto própria" />
          </div>
          {loadingPhoto && <p className="studio-photo-status" role="status">Preparando foto…</p>}
          {photoError && <p className="studio-photo-error" role="alert">{photoError}</p>}
          <p className="studio-photo-credit">Fotos de referência incluídas no app para composição visual; não retratam clientes, profissionais ou estabelecimentos parceiros. Para divulgar seu trabalho, use fotos próprias ou com autorização.</p>
          <div className="studio-section-label"><span>04</span><div><strong>Defina o assunto</strong><small>Escolha o tipo de conteúdo.</small></div></div>
          <div className="studio-type-grid">{artworkTypes.map(item => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>)}</div>
          <label className="studio-input-label">Título da arte<input maxLength={90} value={title} onChange={event => setTitle(event.target.value)} placeholder="Escreva uma frase para sua arte" /></label>
          <label className="studio-input-label">Mensagem complementar<textarea maxLength={150} value={subtitle} onChange={event => setSubtitle(event.target.value)} placeholder="Conte um pouco mais" rows={2} /></label>
          <label className="studio-input-label">Texto do botão <span className="studio-optional">(opcional)</span><input maxLength={26} value={cta} onChange={event => setCta(event.target.value)} placeholder="Ex.: Saiba mais" /></label>
          <label className="studio-input-label">Sua marca ou @perfil <span className="studio-optional">(opcional)</span><input maxLength={30} value={brandName} onChange={event => setBrandName(event.target.value)} placeholder="Ex.: @seuperfil" /></label>
          <div className="studio-section-label studio-section-label-small"><span>05</span><div><strong>Escolha o estilo</strong><small>Uma paleta que combina com a sua mensagem.</small></div></div>
          <div className="studio-style-grid">{styles.map(item => <button key={item} className={style === item ? "active" : ""} onClick={() => setStyle(item)}>{item}</button>)}</div>
          <div className="studio-palette" aria-label="Paleta de cores">{themes.map(item => <button key={item.label} className={theme === item.label ? "active" : ""} aria-label={`Paleta ${item.label}`} aria-pressed={theme === item.label} onClick={() => setTheme(item.label)}><i style={{ background: item.background, borderColor: item.accent }} /><span>{item.label}</span></button>)}</div>
          <label className="studio-brand-toggle"><input type="checkbox" checked={includeBrand} onChange={event => setIncludeBrand(event.target.checked)} /><span className="studio-toggle-check"><Check size={13} /></span><span><strong>Mostrar assinatura no criativo</strong><small>{brandName.trim() || "Fortalfy"} aparecerá no topo da arte.</small></span></label>
          <button className="button primary wide-button studio-generate-button" onClick={generate} disabled={loadingPhoto}><Sparkles size={17} /> Criar prévia profissional <ArrowRight size={17} /></button>
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
          <div className="studio-note"><Sparkles size={17} /><p><strong>Feito para uma presença consistente.</strong> Use uma imagem autorizada, mantenha sua assinatura visual e adapte o conteúdo a cada formato. O Studio não é uma ferramenta de geração por IA.</p></div>
          <div className="studio-uses"><span>IDEIAS PARA SUA PRESENÇA DIGITAL</span><div><span>Conteúdo de creator</span><span>Divulgação profissional</span><span>Academias</span><span>Negócios locais</span></div></div>
        </section>
      </div> : <section className="studio-library">
        <div className="studio-library-heading"><div><span className="eyebrow">ARQUIVOS DESTA SESSÃO</span><h2>Seu espaço criativo.</h2><p>Artes salvas ficam disponíveis enquanto o app permanecer aberto.</p></div>{savedArts.length > 0 && <span className="studio-library-count">{savedArts.length} {savedArts.length === 1 ? "arte" : "artes"}</span>}</div>
        {savedArts.length ? <div className="studio-library-grid">{savedArts.map(item => <article className="studio-library-card" key={item.id}><img src={item.dataUrl} alt={item.title} /><div><span>{item.type} · {item.format === "square" ? "Quadrado" : item.format === "story" ? "Story" : item.format === "banner" ? "Banner" : "Vertical"}</span><h3>{item.title}</h3><small>{item.createdAt}</small><div><button className="button subtle small-button" onClick={() => { setArtwork(item); setType(item.type); setFormat(item.format); setStyle(item.style); setTheme(item.theme); setTitle(item.title); setSubtitle(item.subtitle); setCta(item.cta || ""); setBrandName(item.brandName || ""); setPhotoId(item.photoId || photoOptions[0].id); setPhotoDataUrl(item.photoDataUrl || ""); setTab("create"); }}>Editar e pré-visualizar</button><button className="studio-use-link" onClick={() => useInFeed(item)}>Usar no Feed <ArrowRight size={14} /></button></div></div></article>)}</div> : <div className="studio-library-empty"><span><Layers3 size={25} /></span><h3>Sua biblioteca está começando agora.</h3><p>Crie uma arte no Studio e salve para reutilizar ou publicar no Feed.</p><button className="button primary" onClick={() => setTab("create")}><Plus size={16} /> Criar primeira arte</button></div>}
      </section>}
      <p className="studio-disclaimer">O Fortalfy Studio permite criar artes exclusivas para impulsionar sua rotina e compartilhar suas conquistas com toda a comunidade.</p>
    </main>
    <BottomNav />
  </div>;
}
