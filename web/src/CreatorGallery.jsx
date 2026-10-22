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

export default function CreatorGallery({ onApply, onLearn }) {
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
        const nextIndex = (lightboxIndexRef.current + direction + images.length) % images.length;
        setActiveIndex(nextIndex);
        setLightboxIndex(nextIndex);
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
  }, [isLightboxOpen]);

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
      : event.key === "End" ? images.length - 1
        : direction ? (activeIndex + direction + images.length) % images.length : null;
    if (index === null) return;
    event.preventDefault();
    setActiveIndex(index);
    cardRefs.current[index]?.focus();
  }

  function handleTrackScroll() {
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
  }

  return <>
    <section className="creator-unboxing" aria-labelledby="creator-unboxing-title">
      <div className="creator-unboxing-heading">
        <span className="eyebrow">CONTEÚDO, COMUNIDADE E POSSIBILIDADES</span>
        <h2 id="creator-unboxing-title">Conteúdo que aproxima marcas e creators</h2>
        <p>Creators podem mostrar sua rotina, seus conteúdos e suas experiências de forma autêntica, conectando comunidade, criatividade e novas possibilidades.</p>
      </div>
      <div className="creator-gallery-wrap">
        <div className="creator-gallery-track" ref={trackRef} onKeyDown={handleTrackKeyDown} onScroll={handleTrackScroll} role="group" aria-label="Galeria ilustrativa de unboxing. Use as setas do teclado para navegar.">
          {images.map((image, index) => {
            const active = index === activeIndex;
            return <button
              key={image.file}
              ref={node => { cardRefs.current[index] = node; }}
              type="button"
              className={`creator-gallery-card${active ? " is-active" : ""}`}
              aria-label={`${String(index + 1).padStart(2, "0")} de ${images.length}: ${image.title}. ${image.description} ${active ? "Em destaque." : "Ativar destaque."} Abrir imagem ampliada.`}
              aria-pressed={active}
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={event => openImage(event, index)}
            >
              <img
                className="creator-gallery-image"
                src={imagePath(image)}
                alt={image.alt}
                width="1400"
                height="1750"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
              />
              <span className="creator-gallery-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="creator-gallery-copy" aria-hidden="true">
                <span className="creator-gallery-eyebrow">FORTALCREATOR · {String(index + 1).padStart(2, "0")}</span>
                <span className="creator-gallery-title">{image.title}</span>
                <span className="creator-gallery-description">{image.description}</span>
              </span>
              <span className="creator-gallery-zoom" aria-hidden="true"><ZoomIn size={19}/></span>
            </button>;
          })}
        </div>
        <p className="creator-gallery-hint" aria-hidden="true">Arraste para o lado para ver todas as fotos</p>
        <div className="creator-gallery-controls">
          <button type="button" className="creator-gallery-arrow" aria-label="Imagem anterior" onClick={() => scrollToImage((activeIndex - 1 + images.length) % images.length)}><ArrowLeft size={18}/></button>
          <span className="creator-gallery-count" aria-live="polite">{String(activeIndex + 1).padStart(2, "0")} <span>/ {String(images.length).padStart(2, "0")}</span></span>
          <button type="button" className="creator-gallery-arrow" aria-label="Próxima imagem" onClick={() => scrollToImage((activeIndex + 1) % images.length)}><ArrowRight size={18}/></button>
        </div>
      </div>
      <p className="creator-unboxing-disclosure">Imagens ilustrativas de uma campanha de unboxing. O recebimento de produtos e as oportunidades de colaboração dependem de critérios, disponibilidade e seleção da Fortalfy.</p>
      <div className="creator-unboxing-cta">
        <div><h3>Mostre sua criatividade para o mundo</h3><p>Crie conteúdos autênticos, desenvolva sua presença digital e faça parte de uma comunidade que também está evoluindo.</p></div>
        <div className="creator-unboxing-actions">
          <button type="button" className="button creator-unboxing-primary" onClick={onApply}>Quero ser FortalCreator <ArrowRight size={16}/></button>
          <button type="button" className="creator-unboxing-secondary" onClick={onLearn}>Conhecer o programa</button>
        </div>
      </div>
      <p className="creator-unboxing-transparency">As imagens são ilustrativas e representam conceitos de campanha. O recebimento de produtos, convites e colaborações não é automático e depende de critérios, disponibilidade e seleção da Fortalfy.</p>
    </section>
    {isLightboxOpen && createPortal(<div className="creator-unboxing-lightbox" role="presentation" onMouseDown={event => event.target === event.currentTarget && setLightboxIndex(null)}>
      <section className="creator-unboxing-dialog" ref={lightboxRef} role="dialog" aria-modal="true" aria-label="Galeria de imagens ilustrativas FortalCreator">
        <button ref={closeButtonRef} type="button" className="creator-unboxing-close" aria-label="Fechar imagem" onClick={() => setLightboxIndex(null)}><X size={23}/></button>
        <button type="button" className="creator-unboxing-lightbox-arrow creator-unboxing-lightbox-previous" aria-label="Imagem anterior" onClick={() => {
          const index = (lightboxIndex - 1 + images.length) % images.length;
          setActiveIndex(index);
          setLightboxIndex(index);
        }}><ArrowLeft size={22}/></button>
        <figure>
          <img src={imagePath(images[lightboxIndex])} alt={images[lightboxIndex].alt} width="1400" height="1750"/>
          <figcaption aria-live="polite">{String(lightboxIndex + 1).padStart(2, "0")} de {String(images.length).padStart(2, "0")} · {images[lightboxIndex].title} — {images[lightboxIndex].alt}</figcaption>
        </figure>
        <button type="button" className="creator-unboxing-lightbox-arrow creator-unboxing-lightbox-next" aria-label="Próxima imagem" onClick={() => {
          const index = (lightboxIndex + 1) % images.length;
          setActiveIndex(index);
          setLightboxIndex(index);
        }}><ArrowRight size={22}/></button>
      </section>
    </div>, document.body)}
  </>;
}
