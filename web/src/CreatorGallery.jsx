import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ZoomIn, X } from "lucide-react";

const images = [
  {
    file: "10_pack_completo.jpg",
    alt: "Creator apresenta o kit completo de produtos Fortalfy em uma caixa aberta",
    title: "O kit completo Fortalfy",
    description: "Uma visão de todos os itens que compõem a experiência.",
  },
  {
    file: "01_abertura_da_caixa.jpg",
    alt: "Creator abrindo uma caixa Fortalfy com itens de treino sobre a mesa",
    title: "Abrindo a caixa",
    description: "A descoberta dos detalhes, do primeiro ao último item.",
  },
  {
    file: "04_reacao_do_creator.jpg",
    alt: "Creator observa uma camiseta e produtos em uma caixa Fortalfy aberta",
    title: "Uma experiência para compartilhar",
    description: "Momentos espontâneos que ganham forma em conteúdo.",
  },
  {
    file: "08_unboxing_no_treino.jpg",
    alt: "Creator registra o unboxing de uma caixa Fortalfy em um espaço de treino",
    title: "Unboxing no treino",
    description: "Uma experiência registrada em meio à rotina de movimento.",
  },
  {
    file: "02_mostrando_camiseta.jpg",
    alt: "Creator apresenta uma camiseta Fortalfy diante de uma caixa com acessórios",
    title: "Mostrando a camiseta",
    description: "A identidade Fortalfy em uma composição criada pelo creator.",
  },
  {
    file: "05_camisa_no_espelho.jpg",
    alt: "Creator mostra uma camiseta Fortalfy diante do espelho em um espaço de treino",
    title: "Estilo dentro e fora da academia",
    description: "Uma forma pessoal de apresentar a camiseta no dia a dia.",
  },
  {
    file: "03_itens_sobre_a_mesa.jpg",
    alt: "Caixa de unboxing Fortalfy aberta com camiseta e acessórios organizados",
    title: "Produtos que fazem parte da rotina",
    description: "Itens organizados para inspirar novas ideias de conteúdo.",
  },
  {
    file: "07_creator_separando_os_itens.jpg",
    alt: "Creator organiza produtos Fortalfy ao lado de uma caixa aberta",
    title: "Criatividade em movimento",
    description: "Um olhar criativo para cada detalhe da experiência.",
  },
  {
    file: "06_acessorios_de_academia.jpg",
    alt: "Caixa Fortalfy com camiseta e acessórios de treino apresentados em detalhe",
    title: "Detalhes que inspiram",
    description: "Texturas, cores e acessórios em uma composição visual.",
  },
  {
    file: "09_detalhe_dos_produtos.jpg",
    alt: "Detalhe de camiseta e squeeze Fortalfy em uma caixa de unboxing aberta",
    title: "Conteúdo autêntico",
    description: "Histórias contadas com o estilo próprio de cada creator.",
  },
];

const imagePath = image => `/assets/creator/unboxing/${image.file}`;

export default function CreatorGallery({ onApply, onLearn, images: suppliedImages, title = "Conteúdo que aproxima marcas e creators", eyebrow = "CONTEÚDO, COMUNIDADE E POSSIBILIDADES", description = "Creators podem mostrar sua rotina, seus conteúdos e suas experiências de forma autêntica, conectando comunidade, criatividade e novas possibilidades.", context = "FORTALCREATOR", disclosure = "Imagens ilustrativas de uma campanha de unboxing. O recebimento de produtos e as oportunidades de colaboração dependem de critérios, disponibilidade e seleção da Fortalfy.", galleryId = "creator-unboxing-title", className = "" }) {
  const galleryImages = suppliedImages || images;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const lightboxIndexRef = useRef(lightboxIndex);
  lightboxIndexRef.current = lightboxIndex;
  const trackRef = useRef(null);
  const cardRefs = useRef([]);
  const lightboxRef = useRef(null);
  const closeButtonRef = useRef(null);
  const triggerButtonRef = useRef(null);
  const isLightboxOpen = lightboxIndex !== null;

  useEffect(() => {
    if (!isLightboxOpen) return undefined;
    const previousFocus = triggerButtonRef.current || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (lightboxIndexRef.current + direction + galleryImages.length) % galleryImages.length;
        navigateLightbox(nextIndex);
      }
      if (event.key === "Tab") {
        const buttons = lightboxRef.current?.querySelectorAll("button:not([disabled])");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [isLightboxOpen, galleryImages.length]);

  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  function handlePointerDown(event) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragRef.current = { x: event.clientX, scrollLeft: trackRef.current?.scrollLeft || 0, moved: false };
    trackRef.current?.classList.add("is-dragging");
  }
  function handlePointerMove(event) {
    if (!dragRef.current || !trackRef.current) return;
    const delta = event.clientX - dragRef.current.x;
    if (Math.abs(delta) > 12) dragRef.current.moved = true;
    if (dragRef.current.moved) {
      event.preventDefault();
      trackRef.current.scrollLeft = dragRef.current.scrollLeft - delta;
    }
  }
  function handlePointerUp() {
    if (!dragRef.current) return;
    suppressClickRef.current = dragRef.current.moved;
    if (suppressClickRef.current) window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    dragRef.current = null;
    trackRef.current?.classList.remove("is-dragging");
  }

  function scrollToImage(index) {
    const track = trackRef.current;
    const card = cardRefs.current[index];
    if (!track || !card) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const left = track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left
      - (track.clientWidth - card.clientWidth) / 2;
    track.scrollTo({
      left,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    setActiveIndex(index);
  }

  function handleTrackKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const index = event.key === "Home" ? 0
      : event.key === "End" ? galleryImages.length - 1
        : direction ? (activeIndex + direction + galleryImages.length) % galleryImages.length : null;
    if (index === null) return;
    event.preventDefault();
    setActiveIndex(index);
    cardRefs.current[index]?.focus();
    scrollToImage(index);
  }

  function handleTrackScroll() {
    if (isLightboxOpen) return;
    const track = trackRef.current;
    if (!track) return;
    const trackCenter = track.getBoundingClientRect().left + track.clientWidth / 2;
    const nearestIndex = cardRefs.current.reduce((nearest, card, index) => {
      if (!card) return nearest;
      const bounds = card.getBoundingClientRect();
      const distance = Math.abs(bounds.left + bounds.width / 2 - trackCenter);
      return distance < nearest.distance ? { index, distance } : nearest;
    }, { index: activeIndex, distance: Infinity }).index;
    setActiveIndex(nearestIndex);
  }

  function openImage(event, index) {
    triggerButtonRef.current = event.currentTarget;
    setActiveIndex(index);
    setLightboxIndex(index);
    scrollToImage(index);
  }

  function navigateLightbox(index) {
    setActiveIndex(index);
    setLightboxIndex(index);
    scrollToImage(index);
  }

  return <>
    <section className={`creator-unboxing ${className}`} aria-labelledby={galleryId}>
      <div className="creator-unboxing-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={galleryId}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="creator-gallery-wrap">
        <div className="creator-gallery-track" ref={trackRef} onKeyDown={handleTrackKeyDown} onScroll={handleTrackScroll} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} role="group" aria-label={`Galeria de imagens. ${galleryImages.length} imagens. Use as setas do teclado para navegar.`}>
          {galleryImages.map((image, index) => {
            const active = index === activeIndex;
            return <button
              key={image.file || image.src}
              ref={node => { cardRefs.current[index] = node; }}
              type="button"
              className={`creator-gallery-card${active ? " is-active" : ""}`}
              aria-label={`${String(index + 1).padStart(2, "0")} de ${galleryImages.length}: ${image.title}. ${image.description} ${active ? "Em destaque." : "Ativar destaque."} Abrir imagem ampliada.`}
              aria-pressed={active}
              onFocus={() => setActiveIndex(index)}
              onClick={event => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } openImage(event, index); }}
            >
              <img
                className="creator-gallery-image"
                src={image.src || imagePath(image)}
                alt={image.alt}
                width="1400"
                height="1750"
                loading={index === 0 ? "eager" : "lazy"}
                fetchpriority={index === 0 ? "high" : "auto"}
                decoding="async"
              />
              <span className="creator-gallery-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="creator-gallery-copy" aria-hidden="true">
                <span className="creator-gallery-eyebrow">{context} · {String(index + 1).padStart(2, "0")}</span>
                <span className="creator-gallery-title">{image.title}</span>
                <span className="creator-gallery-description">{image.description}</span>
              </span>
              <span className="creator-gallery-zoom" aria-hidden="true"><ZoomIn size={19}/></span>
            </button>;
          })}
        </div>
        <p className="creator-gallery-hint" aria-hidden="true">Arraste para o lado para ver todas as fotos</p>
        <div className="creator-gallery-controls">
          <button type="button" className="creator-gallery-arrow" aria-label="Imagem anterior" onClick={() => scrollToImage((activeIndex - 1 + galleryImages.length) % galleryImages.length)}><ArrowLeft size={18}/></button>
          <span className="creator-gallery-count" aria-live="polite">{String(activeIndex + 1).padStart(2, "0")} <span>/ {String(galleryImages.length).padStart(2, "0")}</span></span>
          <button type="button" className="creator-gallery-arrow" aria-label="Próxima imagem" onClick={() => scrollToImage((activeIndex + 1) % galleryImages.length)}><ArrowRight size={18}/></button>
        </div>
      </div>
      {disclosure && <p className="creator-unboxing-disclosure">{disclosure}</p>}
      {onApply && onLearn && <div className="creator-unboxing-cta">
        <div><h3>Mostre sua criatividade para o mundo</h3><p>Crie conteúdos autênticos, desenvolva sua presença digital e faça parte de uma comunidade que também está evoluindo.</p></div>
        <div className="creator-unboxing-actions">
          <button type="button" className="button creator-unboxing-primary" onClick={onApply}>Quero ser FortalCreator <ArrowRight size={16}/></button>
          <button type="button" className="creator-unboxing-secondary" onClick={onLearn}>Conhecer o programa</button>
        </div>
      </div>}
      {onApply && onLearn && <p className="creator-unboxing-transparency">As imagens são ilustrativas e representam conceitos de campanha. O recebimento de produtos, convites e colaborações não é automático e depende de critérios, disponibilidade e seleção da Fortalfy.</p>}
    </section>
    {isLightboxOpen && createPortal(<div className="creator-unboxing-lightbox" role="presentation" onTouchStart={event => { dragRef.current = { touchX: event.touches[0]?.clientX }; }} onTouchEnd={event => { if (dragRef.current?.touchX == null) return; const delta = event.changedTouches[0]?.clientX - dragRef.current.touchX; if (Math.abs(delta) > 50) { const next = (lightboxIndex + (delta < 0 ? 1 : -1) + galleryImages.length) % galleryImages.length; navigateLightbox(next); } dragRef.current = null; }} onMouseDown={event => event.target === event.currentTarget && setLightboxIndex(null)}>
      <section className="creator-unboxing-dialog" ref={lightboxRef} role="dialog" aria-modal="true" aria-label={`Galeria de imagens ${context}`}>
        <button ref={closeButtonRef} type="button" className="creator-unboxing-close" aria-label="Fechar imagem" onClick={() => setLightboxIndex(null)}><X size={23}/></button>
        <button type="button" className="creator-unboxing-lightbox-arrow creator-unboxing-lightbox-previous" aria-label="Imagem anterior" onClick={() => {
          const index = (lightboxIndex - 1 + galleryImages.length) % galleryImages.length;
          navigateLightbox(index);
        }}><ArrowLeft size={22}/></button>
        <figure>
          <img src={galleryImages[lightboxIndex].src || imagePath(galleryImages[lightboxIndex])} alt={galleryImages[lightboxIndex].alt} width="1400" height="1750"/>
          <figcaption aria-live="polite">{String(lightboxIndex + 1).padStart(2, "0")} de {String(galleryImages.length).padStart(2, "0")} · {galleryImages[lightboxIndex].title} — {galleryImages[lightboxIndex].description}</figcaption>
        </figure>
        <button type="button" className="creator-unboxing-lightbox-arrow creator-unboxing-lightbox-next" aria-label="Próxima imagem" onClick={() => {
          const index = (lightboxIndex + 1) % galleryImages.length;
          navigateLightbox(index);
        }}><ArrowRight size={22}/></button>
      </section>
    </div>, document.body)}
  </>;
}
