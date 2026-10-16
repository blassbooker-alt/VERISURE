import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_DURATION_SECONDS = 90;
const REEL_RATIO = 9 / 16;
const RATIO_TOLERANCE = 0.0025;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function readU32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

function readU64(bytes: Uint8Array, offset: number) {
  const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Vídeo inválido.");
  return Number(value);
}

function readI32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(offset);
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder().decode(bytes.subarray(offset, offset + length));
}

function readMp4Boxes(bytes: Uint8Array, start: number, end: number) {
  const boxes: Array<{ type: string; start: number; payload: number; end: number }> = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = readU32(bytes, offset);
    const type = readAscii(bytes, offset + 4, 4);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new Error("Vídeo MP4 inválido.");
      size = readU64(bytes, offset + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) throw new Error("Vídeo MP4 inválido.");
    boxes.push({ type, start: offset, payload: offset + headerSize, end: offset + size });
    offset += size;
  }
  return boxes;
}

function parseMp4(bytes: Uint8Array) {
  const root = readMp4Boxes(bytes, 0, bytes.length);
  const moov = root.find(box => box.type === "moov");
  if (!moov) throw new Error("O servidor não encontrou os metadados de vídeo MP4.");
  const tracks = readMp4Boxes(bytes, moov.payload, moov.end).filter(box => box.type === "trak");
  for (const track of tracks) {
    const children = readMp4Boxes(bytes, track.payload, track.end);
    const tkhd = children.find(box => box.type === "tkhd");
    const mdia = children.find(box => box.type === "mdia");
    if (!tkhd || !mdia) continue;
    const mediaChildren = readMp4Boxes(bytes, mdia.payload, mdia.end);
    const handler = mediaChildren.find(box => box.type === "hdlr");
    const mdhd = mediaChildren.find(box => box.type === "mdhd");
    if (!handler || !mdhd || readAscii(bytes, handler.payload + 8, 4) !== "vide") continue;

    const tkhdVersion = bytes[tkhd.payload];
    const matrixOffset = tkhd.payload + (tkhdVersion === 1 ? 52 : 40);
    const dimensionOffset = matrixOffset + 36;
    if (dimensionOffset + 8 > tkhd.end) throw new Error("Vídeo MP4 inválido.");
    let width = readU32(bytes, dimensionOffset) / 65536;
    let height = readU32(bytes, dimensionOffset + 4) / 65536;
    const a = readI32(bytes, matrixOffset) / 65536;
    const b = readI32(bytes, matrixOffset + 4) / 65536;
    const rotation = ((Math.round(Math.atan2(b, a) * 180 / Math.PI / 90) * 90) % 360 + 360) % 360;
    if (rotation === 90 || rotation === 270) [width, height] = [height, width];

    const mdhdVersion = bytes[mdhd.payload];
    const timescaleOffset = mdhd.payload + (mdhdVersion === 1 ? 20 : 12);
    const durationOffset = mdhd.payload + (mdhdVersion === 1 ? 24 : 16);
    const timescale = readU32(bytes, timescaleOffset);
    const duration = mdhdVersion === 1 ? readU64(bytes, durationOffset) : readU32(bytes, durationOffset);
    if (!timescale) throw new Error("O servidor não conseguiu validar a duração do vídeo MP4.");
    return { width: Math.round(width), height: Math.round(height), durationSeconds: duration / timescale };
  }
  throw new Error("O servidor não encontrou uma faixa de vídeo MP4 válida.");
}

function readEbmlVint(bytes: Uint8Array, offset: number, retainMarker = false) {
  if (offset >= bytes.length || bytes[offset] === 0) throw new Error("Vídeo WebM inválido.");
  const first = bytes[offset];
  let length = 1;
  let marker = 0x80;
  while (!(first & marker) && length <= 8) {
    marker >>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > bytes.length) throw new Error("Vídeo WebM inválido.");
  let value = retainMarker ? first : first & (marker - 1);
  for (let index = 1; index < length; index += 1) value = value * 256 + bytes[offset + index];
  const unknown = !retainMarker && value === (2 ** (7 * length) - 1);
  return { value, length, unknown };
}

type EbmlElement = { id: number; start: number; payload: number; end: number };

function readEbmlElements(bytes: Uint8Array, start: number, end: number): EbmlElement[] {
  const result: EbmlElement[] = [];
  let offset = start;
  let count = 0;
  while (offset < end && count < 200000) {
    count += 1;
    const id = readEbmlVint(bytes, offset, true);
    const size = readEbmlVint(bytes, offset + id.length);
    const payload = offset + id.length + size.length;
    const elementEnd = size.unknown ? end : payload + size.value;
    if (elementEnd > end || elementEnd < payload) throw new Error("Vídeo WebM inválido.");
    result.push({ id: id.value, start: offset, payload, end: elementEnd });
    offset = elementEnd;
  }
  if (offset < end && count >= 200000) throw new Error("O vídeo WebM contém metadados excessivos.");
  return result;
}

function readEbmlInteger(bytes: Uint8Array, element: EbmlElement) {
  let value = 0;
  for (let offset = element.payload; offset < element.end; offset += 1) value = value * 256 + bytes[offset];
  return value;
}

function readEbmlFloat(bytes: Uint8Array, element: EbmlElement) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + element.payload, element.end - element.payload);
  if (element.end - element.payload === 4) return view.getFloat32(0);
  if (element.end - element.payload === 8) return view.getFloat64(0);
  throw new Error("Metadados de duração WebM inválidos.");
}

function readEbmlBlock(bytes: Uint8Array, block: EbmlElement) {
  const track = readEbmlVint(bytes, block.payload);
  const timecodeOffset = block.payload + track.length;
  if (timecodeOffset + 3 > block.end) throw new Error("Vídeo WebM inválido.");
  const relative = new DataView(bytes.buffer, bytes.byteOffset + timecodeOffset, 2).getInt16(0);
  return { track: track.value, relative };
}

function parseWebm(bytes: Uint8Array) {
  const root = readEbmlElements(bytes, 0, bytes.length);
  const segment = root.find(element => element.id === 0x18538067);
  if (!segment) throw new Error("O servidor não encontrou os metadados de vídeo WebM.");
  const segmentElements = readEbmlElements(bytes, segment.payload, segment.end);
  const info = segmentElements.find(element => element.id === 0x1549a966);
  const tracks = segmentElements.find(element => element.id === 0x1654ae6b);
  if (!tracks) throw new Error("O servidor não encontrou uma faixa de vídeo WebM.");
  let timecodeScale = 1_000_000;
  let declaredDurationTicks = 0;
  if (info) {
    for (const element of readEbmlElements(bytes, info.payload, info.end)) {
      if (element.id === 0x2ad7b1) timecodeScale = readEbmlInteger(bytes, element);
      if (element.id === 0x4489) declaredDurationTicks = readEbmlFloat(bytes, element);
    }
  }

  let videoTrack = 0;
  let defaultFrameDuration = 0;
  let width = 0;
  let height = 0;
  let roll = 0;
  for (const entry of readEbmlElements(bytes, tracks.payload, tracks.end).filter(element => element.id === 0xae)) {
    const fields = readEbmlElements(bytes, entry.payload, entry.end);
    const trackType = fields.find(element => element.id === 0x83);
    if (!trackType || readEbmlInteger(bytes, trackType) !== 1) continue;
    videoTrack = readEbmlInteger(bytes, fields.find(element => element.id === 0xd7)!);
    const defaultDuration = fields.find(element => element.id === 0x23e383);
    if (defaultDuration) defaultFrameDuration = readEbmlInteger(bytes, defaultDuration);
    const video = fields.find(element => element.id === 0xe0);
    if (!video) continue;
    const videoFields = readEbmlElements(bytes, video.payload, video.end);
    width = readEbmlInteger(bytes, videoFields.find(element => element.id === 0xb0)!);
    height = readEbmlInteger(bytes, videoFields.find(element => element.id === 0xba)!);
    const projection = videoFields.find(element => element.id === 0x7670);
    if (projection) {
      const pose = readEbmlElements(bytes, projection.payload, projection.end).find(element => element.id === 0x7676);
      if (pose) roll = readEbmlFloat(bytes, pose);
    }
    break;
  }
  if (!videoTrack || !width || !height || !timecodeScale) throw new Error("O servidor não conseguiu ler as dimensões do vídeo WebM.");
  const displayWidth = Math.round(roll / 90) % 2 !== 0;
  if (displayWidth) [width, height] = [height, width];

  const timestamps: number[] = [];
  let lastBlockDuration = 0;
  for (const cluster of segmentElements.filter(element => element.id === 0x1f43b675)) {
    const clusterElements = readEbmlElements(bytes, cluster.payload, cluster.end);
    const clusterTimecodeElement = clusterElements.find(element => element.id === 0xe7);
    const clusterTimecode = clusterTimecodeElement ? readEbmlInteger(bytes, clusterTimecodeElement) : 0;
    for (const element of clusterElements) {
      if (element.id === 0xa3) {
        const block = readEbmlBlock(bytes, element);
        if (block.track === videoTrack) timestamps.push(clusterTimecode + block.relative);
      } else if (element.id === 0xa0) {
        const group = readEbmlElements(bytes, element.payload, element.end);
        const blockElement = group.find(item => item.id === 0xa1);
        const blockDuration = group.find(item => item.id === 0x9b);
        if (blockElement) {
          const block = readEbmlBlock(bytes, blockElement);
          if (block.track === videoTrack) {
            timestamps.push(clusterTimecode + block.relative);
            if (blockDuration) lastBlockDuration = readEbmlInteger(bytes, blockDuration);
          }
        }
      }
    }
  }
  if (!timestamps.length) throw new Error("O servidor não encontrou quadros de vídeo WebM válidos.");
  const lastTimestamp = timestamps.reduce((latest, timestamp) => Math.max(latest, timestamp), 0);
  const adjacentFrames = timestamps.slice(-31).sort((left, right) => left - right);
  const inferredFrameTicks = adjacentFrames.length > 1
    ? adjacentFrames.slice(1).reduce((sum, timestamp, index) => sum + timestamp - adjacentFrames[index], 0) / (adjacentFrames.length - 1)
    : 0;
  const frameTicks = lastBlockDuration || (defaultFrameDuration ? defaultFrameDuration / timecodeScale : inferredFrameTicks || 1);
  const durationSeconds = Math.max(declaredDurationTicks, lastTimestamp + frameTicks) * timecodeScale / 1_000_000_000;
  return { width, height, durationSeconds };
}

function inspectVideo(bytes: Uint8Array, mimeType: string) {
  const metadata = mimeType === "video/mp4" ? parseMp4(bytes)
    : mimeType === "video/webm" ? parseWebm(bytes)
    : null;
  if (!metadata) throw new Error("O servidor aceita apenas vídeos MP4 ou WebM.");
  if (!metadata.width || !metadata.height || metadata.width > 7680 || metadata.height > 7680
      || Math.abs((metadata.width / metadata.height) / REEL_RATIO - 1) > RATIO_TOLERANCE) {
    throw new Error("O vídeo processado não está no formato vertical 9:16.");
  }
  if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0 || metadata.durationSeconds > MAX_DURATION_SECONDS) {
    throw new Error("O vídeo processado precisa ter duração entre 1 e 90 segundos.");
  }
  return metadata;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return response({}, 200);
  if (request.method !== "POST") return response({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "Validação de vídeo ainda não está configurada no servidor." }, 503);
  }

  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return response({ error: "Entre na sua conta para validar este vídeo." }, 401);
  const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
  if (authError || !authData.user) return response({ error: "Sua sessão expirou. Entre novamente." }, 401);

  let storagePath: string;
  let postId: string;
  let caption: string;
  let visibility: string;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4096) {
      return response({ error: "A solicitação de validação é muito grande." }, 413);
    }
    const body = JSON.parse(rawBody);
    storagePath = body?.storagePath;
    postId = body?.postId;
    caption = typeof body?.caption === "string" ? body.caption.trim() : "";
    visibility = body?.visibility;
  } catch {
    return response({ error: "Não foi possível ler os dados do vídeo." }, 400);
  }
  const pathParts = typeof storagePath === "string" ? storagePath.split("/") : [];
  if (pathParts.length !== 4 || pathParts[0] !== authData.user.id || pathParts[1] !== "posts"
      || !uuidPattern.test(pathParts[2]) || !/^\d{2}\.(mp4|webm)$/i.test(pathParts[3])) {
    return response({ error: "O caminho do vídeo enviado não pertence a esta conta." }, 403);
  }
  if (!uuidPattern.test(postId || "") || pathParts[2] !== postId
      || !["public", "followers"].includes(visibility) || caption.length > 5000) {
    return response({ error: "Os dados da publicação do FortalReels são inválidos." }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: videoBlob, error: downloadError } = await serviceClient.storage.from("social-media").download(storagePath);
  if (downloadError || !videoBlob) return response({ error: "O servidor não conseguiu abrir o vídeo enviado." }, 422);
  if (videoBlob.size > MAX_BYTES) return response({ error: "O vídeo processado ultrapassa o limite de 40 MB." }, 413);

  try {
    const bytes = new Uint8Array(await videoBlob.arrayBuffer());
    const storedType = videoBlob.type.split(";")[0].toLowerCase();
    const mimeType = ["video/mp4", "video/webm"].includes(storedType)
      ? storedType
      : storagePath.toLowerCase().endsWith(".mp4") ? "video/mp4" : "video/webm";
    const metadata = inspectVideo(bytes, mimeType);
    const { data: publishedPostId, error: publishError } = await serviceClient.rpc("publish_fortalreel", {
      p_post_id: postId,
      p_author_id: authData.user.id,
      p_storage_path: storagePath,
      p_body: caption,
      p_visibility: visibility,
      p_width: metadata.width,
      p_height: metadata.height,
      p_duration_seconds: Number(metadata.durationSeconds.toFixed(3)),
    });
    if (publishError || publishedPostId !== postId) {
      console.error("Could not publish FortalReels video.", publishError?.code || "invalid_response");
      return response({ error: publishError?.code === "42501"
        ? "Sua conta não tem autorização ativa para publicar no FortalReels."
        : "O servidor validou o vídeo, mas não conseguiu concluir a publicação." }, publishError?.code === "42501" ? 403 : 503);
    }
    return response({
      valid: true,
      postId: publishedPostId,
      storagePath,
      width: metadata.width,
      height: metadata.height,
      durationSeconds: Number(metadata.durationSeconds.toFixed(3)),
    }, 200);
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "O servidor não conseguiu validar este vídeo.";
    return response({ error: message }, 422);
  }
});
