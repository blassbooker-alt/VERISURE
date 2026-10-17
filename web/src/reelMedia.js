export const FORTALREEL_MAX_DURATION_SECONDS = 180;
export const FORTALREEL_MAX_FILE_BYTES = 40 * 1024 * 1024;
export const FORTALREEL_WIDTH = 1080;
export const FORTALREEL_HEIGHT = 1920;
export const FORTALREEL_RATIO = FORTALREEL_WIDTH / FORTALREEL_HEIGHT;
export const FORTALREEL_RATIO_TOLERANCE = 0.0025;
const FORTALREEL_SOUNDTRACK_URL = new URL("./assets/fortalfy-reel-instrumental.wav", import.meta.url).href;

export function isFortalReelDurationAllowed(duration) {
  return Number.isFinite(duration) && duration > 0 && duration <= FORTALREEL_MAX_DURATION_SECONDS;
}

export function isFortalReelRatio(width, height) {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    && Math.abs((width / height) / FORTALREEL_RATIO - 1) <= FORTALREEL_RATIO_TOLERANCE;
}

export function calculateReelCrop(width, height, x = 0.5, y = 0.5) {
  if (![width, height, x, y].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error("As dimensões do vídeo não são válidas.");
  }
  const sourceRatio = width / height;
  let cropWidth = width;
  let cropHeight = height;
  if (sourceRatio > FORTALREEL_RATIO) cropWidth = height * FORTALREEL_RATIO;
  else cropHeight = width / FORTALREEL_RATIO;
  const left = (width - cropWidth) * Math.max(0, Math.min(1, x));
  const top = (height - cropHeight) * Math.max(0, Math.min(1, y));
  return { left, top, width: cropWidth, height: cropHeight };
}

function readBoxes(view, start, end) {
  const boxes = [];
  for (let offset = start; offset + 8 <= end;) {
    const size32 = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4), view.getUint8(offset + 5),
      view.getUint8(offset + 6), view.getUint8(offset + 7),
    );
    const headerSize = size32 === 1 ? 16 : 8;
    const size = size32 === 1 ? Number(view.getBigUint64(offset + 8)) : size32 || end - offset;
    if (!Number.isSafeInteger(size) || size < headerSize || offset + size > end) break;
    boxes.push({ type, start: offset + headerSize, end: offset + size });
    offset += size;
  }
  return boxes;
}

function hasAudioTrackInMovie(movieBuffer) {
  const view = new DataView(movieBuffer);
  const tracks = readBoxes(view, 0, view.byteLength).filter(box => box.type === "trak");
  return tracks.some(track => {
    const media = readBoxes(view, track.start, track.end).find(box => box.type === "mdia");
    const handler = media && readBoxes(view, media.start, media.end).find(box => box.type === "hdlr");
    if (!handler || handler.start + 12 > handler.end) return false;
    const type = String.fromCharCode(
      view.getUint8(handler.start + 8), view.getUint8(handler.start + 9),
      view.getUint8(handler.start + 10), view.getUint8(handler.start + 11),
    );
    return type === "soun";
  });
}

export async function inspectMp4AudioTrack(file) {
  if (!file || !["video/mp4", "video/quicktime"].includes(file.type)) return null;
  for (let offset = 0; offset + 8 <= file.size;) {
    const header = await file.slice(offset, offset + 16).arrayBuffer();
    if (header.byteLength < 8) break;
    const view = new DataView(header);
    const size32 = view.getUint32(0);
    const type = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7));
    const headerSize = size32 === 1 ? 16 : 8;
    const size = size32 === 1 ? Number(view.getBigUint64(8)) : size32 || file.size - offset;
    if (!Number.isSafeInteger(size) || size < headerSize || offset + size > file.size) {
      throw new Error("Não foi possível validar a faixa de áudio do vídeo MP4.");
    }
    if (type === "moov") {
      const movie = await file.slice(offset + headerSize, offset + size).arrayBuffer();
      return hasAudioTrackInMovie(movie);
    }
    offset += size;
  }
  throw new Error("O arquivo MP4 não contém os metadados necessários para validar o áudio.");
}

export async function inspectReelVideo(file, { allowOversize = false } = {}) {
  if (!file || !["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
    throw new Error("Selecione um vídeo MP4, WebM ou MOV válido.");
  }
  if (!allowOversize && file.size > FORTALREEL_MAX_FILE_BYTES) {
    throw new Error("O vídeo selecionado ultrapassa o limite de 40 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Não foi possível ler os dados deste vídeo."));
    });
    const metadata = { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
    if (!Number.isFinite(metadata.width) || !Number.isFinite(metadata.height) || !Number.isFinite(metadata.duration)
        || metadata.width < 1 || metadata.height < 1 || metadata.duration <= 0) {
      throw new Error("Não foi possível validar as dimensões e a duração deste vídeo.");
    }
    return metadata;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getRecorderMimeType() {
  const candidates = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  const supported = candidates.find(([type]) => MediaRecorder.isTypeSupported(type));
  if (!supported) throw new Error("Este navegador não oferece um formato de gravação compatível com o FortalReels.");
  return { mimeType: supported[0], extension: supported[1] };
}

export async function cropReelVideo(file, {
  width,
  height,
  x = 0.5,
  y = 0.5,
  start = 0,
  end,
  addSoundtrack = false,
  onProgress = () => {},
} = {}) {
  const duration = Number.isFinite(end) ? end - start : NaN;
  if (start < 0 || !isFortalReelDurationAllowed(duration)) {
    throw new Error("Escolha um trecho com até 180 segundos.");
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error("Não foi possível definir o enquadramento do vídeo.");
  }
  if (typeof HTMLCanvasElement.prototype.captureStream !== "function" || typeof MediaRecorder === "undefined") {
    throw new Error("Este navegador não consegue processar o recorte de vídeo. Tente um navegador atualizado.");
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  video.src = url;
  let audioContext;
  let soundtrackSource;
  let stream;
  let animationFrame = 0;
  let recorder;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Não foi possível abrir o vídeo para recorte."));
    });
    const backgroundCrop = calculateReelCrop(video.videoWidth, video.videoHeight, x, y);
    const canvas = document.createElement("canvas");
    canvas.width = FORTALREEL_WIDTH;
    canvas.height = FORTALREEL_HEIGHT;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Não foi possível preparar o recorte vertical do vídeo.");
    stream = canvas.captureStream(30);

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Este navegador não oferece suporte ao processamento de áudio.");
      audioContext = new AudioContextClass();
      const audioSource = audioContext.createMediaElementSource(video);
      const audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      audioSource.connect(audioContext.destination);
      audioDestination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      await audioContext.resume();
      if (addSoundtrack) {
        const response = await fetch(FORTALREEL_SOUNDTRACK_URL);
        if (!response.ok) throw new Error("Não foi possível carregar a trilha instrumental Fortalfy.");
        const soundtrackBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
        soundtrackSource = audioContext.createBufferSource();
        soundtrackSource.buffer = soundtrackBuffer;
        soundtrackSource.loop = true;
        const soundtrackGain = audioContext.createGain();
        soundtrackGain.gain.value = 0.55;
        soundtrackSource.connect(soundtrackGain);
        soundtrackGain.connect(audioDestination);
        soundtrackSource.start();
      }
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error(`Não foi possível preparar o áudio deste vídeo: ${error.message}`);
    }

    const { mimeType, extension } = getRecorderMimeType();
    const maxVideoBitrate = Math.floor((FORTALREEL_MAX_FILE_BYTES * 8 * 0.85) / duration) - 128_000;
    const videoBitsPerSecond = Math.max(350_000, Math.min(2_400_000, maxVideoBitrate));
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond: 128_000 });
    const chunks = [];
    const renderedFile = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => event.data.size && chunks.push(event.data);
      recorder.onerror = () => reject(new Error("O navegador encontrou um erro ao processar o vídeo."));
      recorder.onstop = () => {
        if (!chunks.length) {
          reject(new Error("O vídeo processado ficou vazio. Tente novamente."));
          return;
        }
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        if (blob.size > FORTALREEL_MAX_FILE_BYTES) {
          reject(new Error("O vídeo recortado ultrapassa o limite de 40 MB."));
          return;
        }
        const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "-") || "fortalreel";
        resolve(new File([blob], `${baseName}-vertical.${extension}`, { type: blob.type, lastModified: Date.now() }));
      };
    });
    if (start > 0) {
      await new Promise((resolve, reject) => {
        video.onseeked = resolve;
        video.onerror = () => reject(new Error("Não foi possível acessar o trecho selecionado."));
        video.currentTime = start;
      });
    }

    const fittedScale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const fittedWidth = video.videoWidth * fittedScale;
    const fittedHeight = video.videoHeight * fittedScale;
    const fittedLeft = (canvas.width - fittedWidth) / 2;
    const fittedTop = (canvas.height - fittedHeight) / 2;
    let lastProgressAt = 0;
    const drawFrame = () => {
      context.save();
      context.filter = "blur(36px) brightness(.65)";
      context.drawImage(video, backgroundCrop.left, backgroundCrop.top, backgroundCrop.width, backgroundCrop.height, 0, 0, canvas.width, canvas.height);
      context.restore();
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, fittedLeft, fittedTop, fittedWidth, fittedHeight);
      const now = performance.now();
      if (now - lastProgressAt >= 250) {
        lastProgressAt = now;
        onProgress(Math.min(1, Math.max(0, (video.currentTime - start) / duration)));
      }
      if (video.currentTime >= end || video.ended) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      animationFrame = requestAnimationFrame(drawFrame);
    };
    await video.play();
    recorder.start(250);
    drawFrame();
    return await renderedFile;
  } finally {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    cancelAnimationFrame(animationFrame);
    stream?.getTracks().forEach(track => track.stop());
    if (soundtrackSource) {
      try {
        soundtrackSource.stop();
      } catch (error) {
        if (error.name !== "InvalidStateError") throw error;
      }
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
  }
}
