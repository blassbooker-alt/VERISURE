import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, LoaderCircle, RotateCw, X } from "lucide-react";
import {
  cropReelVideo, FORTALREEL_MAX_DURATION_SECONDS, FORTALREEL_MAX_FILE_BYTES, inspectReelVideo, isFortalReelDurationAllowed, isFortalReelRatio,
} from "./reelMedia.js";

const roundTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function ReelVideoEditor({ file, onCancel, onReady, notify }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let active = true;
    setPreviewUrl(url);
    setMetadata(null);
    setError("");
    inspectReelVideo(file, { allowOversize: true }).then(data => {
      if (!active) return;
      setMetadata(data);
    }).catch(failure => active && setError(failure.message));
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  const prepare = async () => {
    if (!metadata || !isFortalReelDurationAllowed(metadata.duration)) {
      setError(`O vídeo completo precisa ter até ${FORTALREEL_MAX_DURATION_SECONDS} segundos.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const needsProcessing = !["video/mp4", "video/webm"].includes(file.type)
        || !isFortalReelRatio(metadata.width, metadata.height)
        || file.size > FORTALREEL_MAX_FILE_BYTES;
      const prepared = needsProcessing
        ? await cropReelVideo(file, {
          width: metadata.width,
          height: metadata.height,
          start: 0,
          end: metadata.duration,
          onProgress: setProgress,
        })
        : file;
      await onReady(prepared);
    } catch (failure) {
      console.error("Falha ao preparar vídeo vertical do FortalReels.", failure);
      setError(failure.message || "Não foi possível preparar o vídeo.");
      notify(failure.message || "Não foi possível preparar o vídeo.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const verticalSource = metadata && isFortalReelRatio(metadata.width, metadata.height);
  return <div className="reel-editor-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && onCancel()}>
    <section className="reel-editor-dialog" role="dialog" aria-modal="true" aria-label="Editar vídeo FortalReels">
      <header><div><span className="eyebrow">FORTALREELS · TELA CHEIA 9:16</span><h2>Prepare seu vídeo completo</h2></div><button type="button" className="icon-button" aria-label="Fechar editor" onClick={onCancel} disabled={busy}><X size={19} /></button></header>
      {error && <p className="reel-editor-error" role="alert"><CircleAlert size={16} />{error}</p>}
      {!metadata ? <p className="social-inline-status"><LoaderCircle className="spin" size={17} /> Lendo vídeo…</p> : <>
        <div className="reel-editor-layout">
          <div className="reel-editor-preview"><video src={previewUrl} controls playsInline /><span>PRÉVIA 9:16</span></div>
          <div className="reel-editor-controls">
            <p>{metadata.width} × {metadata.height} · duração completa {roundTime(metadata.duration)}{verticalSource ? " · formato vertical" : " · imagem integral preservada"}</p>
            {!isFortalReelDurationAllowed(metadata.duration) && <p className="reel-editor-error">O vídeo completo excede o limite de {FORTALREEL_MAX_DURATION_SECONDS / 60} minutos e não será cortado.</p>}
            <p className="reel-editor-note">O vídeo e o áudio originais serão preservados do início ao fim. A adaptação para 9:16 mantém toda a imagem, com fundo preenchido quando necessário. Arquivos grandes serão comprimidos para publicação.</p>
          </div>
        </div>
        {busy && <div className="reel-editor-progress" role="status"><span style={{ width: `${Math.round(progress * 100)}%` }} />Preparando vídeo vertical…</div>}
        <footer><button className="button subtle" onClick={onCancel} disabled={busy}>Cancelar</button><button className="button primary" onClick={prepare} disabled={busy || !metadata || !isFortalReelDurationAllowed(metadata.duration)}><Check size={16} />{busy ? "Processando…" : "Usar vídeo completo"}</button></footer>
      </>}
    </section>
  </div>;
}

export function ReelCameraRecorder({ onCancel, onCaptured }) {
  const [facingMode, setFacingMode] = useState("environment");
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(0);
  const cancelledRef = useRef(false);
  const [recorder, setRecorder] = useState(null);

  useEffect(() => {
    let active = true;
    let stream;
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Este dispositivo não oferece acesso à câmera pelo navegador.");
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1080 }, height: { ideal: 1920 } },
    }).then(result => {
      if (!active) {
        result.getTracks().forEach(track => track.stop());
        return;
      }
      stream = result;
      setCameraStream(result);
    }).catch(failure => {
      if (active) setCameraError(failure.name === "NotAllowedError" ? "Permita o acesso à câmera e ao microfone para gravar." : "Não foi possível abrir a câmera deste dispositivo.");
    });
    return () => {
      active = false;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => setCameraError("Toque na prévia para iniciar a câmera."));
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!recording) return undefined;
    const interval = window.setInterval(() => setElapsed(value => {
      const next = value + 0.25;
      if (next >= FORTALREEL_MAX_DURATION_SECONDS) recorder?.stop();
      return Math.min(next, FORTALREEL_MAX_DURATION_SECONDS);
    }), 250);
    return () => window.clearInterval(interval);
  }, [recording, recorder]);

  const startRecording = () => {
    const videoElement = videoRef.current;
    const canvas = canvasRef.current;
    if (!cameraStream || !videoElement || !canvas) return;
    try {
      const supported = window.MediaRecorder && [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4",
        "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm",
      ].find(type => MediaRecorder.isTypeSupported(type));
      if (!supported) throw new Error("Este navegador não oferece um formato de gravação compatível.");
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext("2d", { alpha: false });
      const canvasStream = canvas.captureStream(30);
      cameraStream.getAudioTracks().forEach(track => canvasStream.addTrack(track.clone()));
      const nextRecorder = new MediaRecorder(canvasStream, { mimeType: supported, videoBitsPerSecond: 2_400_000, audioBitsPerSecond: 128_000 });
      const chunks = [];
      nextRecorder.ondataavailable = event => event.data.size && chunks.push(event.data);
      nextRecorder.onerror = () => { setCameraError("O navegador encontrou um erro durante a gravação."); setRecording(false); };
      nextRecorder.onstop = () => {
        setRecording(false);
        cancelAnimationFrame(animationFrameRef.current);
        canvasStream.getTracks().forEach(track => track.stop());
        if (cancelledRef.current) return;
        const blob = new Blob(chunks, { type: supported.split(";")[0] });
        if (blob.size > 40 * 1024 * 1024) {
          setCameraError("A gravação ultrapassou 40 MB. Tente um vídeo mais curto.");
          return;
        }
        const extension = blob.type === "video/mp4" ? "mp4" : "webm";
        const file = new File([blob], `fortalreel-${Date.now()}.${extension}`, { type: blob.type });
        onCaptured(file);
      };
      setElapsed(0);
      setRecorder(nextRecorder);
      nextRecorder.start(250);
      setRecording(true);
      const draw = () => {
        if (nextRecorder.state === "inactive") return;
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;
        if (width && height && context) {
          const crop = calculateReelCrop(width, height);
          context.drawImage(videoElement, crop.left, crop.top, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
        }
        animationFrameRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (failure) {
      setCameraError(failure.message || "Não foi possível iniciar a gravação.");
    }
  };

  const stopRecording = () => {
    if (recorder?.state === "recording") recorder.stop();
    setRecording(false);
  };
  const switchCamera = () => {
    if (recording) return;
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    setFacingMode(value => value === "environment" ? "user" : "environment");
  };
  const close = () => {
    cancelledRef.current = true;
    if (recorder?.state === "recording") recorder.stop();
    cameraStream?.getTracks().forEach(track => track.stop());
    onCancel();
  };

  return <div className="reel-editor-scrim" role="presentation">
    <section className="reel-camera-dialog" role="dialog" aria-modal="true" aria-label="Gravar FortalReel">
      <header><div><span className="eyebrow">GRAVAÇÃO VERTICAL 9:16</span><h2>Gravar Reel</h2></div><button className="icon-button" aria-label="Fechar câmera" onClick={close}><X size={19} /></button></header>
      <div className="reel-camera-preview"><video ref={videoRef} autoPlay playsInline muted /><span>9:16</span></div>
      {cameraError && <p className="reel-editor-error" role="alert">{cameraError}</p>}
      <p className="reel-camera-timer" aria-live="polite">{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")} / 1:30</p>
      <div className="reel-camera-controls"><button className="button subtle" onClick={switchCamera} disabled={recording || !cameraStream}><RotateCw size={16} /> Trocar câmera</button>{recording ? <button className="button primary" onClick={stopRecording}>Parar gravação</button> : <button className="button primary" onClick={startRecording} disabled={!cameraStream}><Camera size={16} /> Gravar</button>}</div>
      <canvas ref={canvasRef} className="sr-only" aria-hidden="true" />
      {!cameraStream && !cameraError && <p className="social-inline-status"><LoaderCircle className="spin" size={16} /> Abrindo câmera…</p>}
    </section>
  </div>;
}
