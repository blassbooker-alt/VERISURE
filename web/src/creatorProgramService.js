import { signMedia } from "./socialService.js";

function assertClient(client) {
  if (!client) throw new Error("O Supabase não está configurado.");
}

export async function loadCreatorCourses(client, profileId = "", isAdmin = false) {
  assertClient(client);
  let query = client.from("creator_courses").select("id,instructor_id,title,summary,price_cents,currency,status,created_at,instructor:profiles!creator_courses_instructor_id_fkey(id,display_name,username)");
  if (!isAdmin) query = profileId ? query.or(`status.eq.published,instructor_id.eq.${profileId}`) : query.eq("status", "published");
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function loadCreatorCourseLessons(client, courseId) {
  assertClient(client);
  const { data, error } = await client.from("creator_course_lessons")
    .select("id,course_id,title,body,media_path,position,is_preview")
    .eq("course_id", courseId).order("position").limit(200);
  if (error) throw error;
  return data || [];
}

export async function createCreatorCourseLesson(client, courseId, lesson) {
  assertClient(client);
  const title = String(lesson.title || "").trim();
  const body = String(lesson.body || "").trim();
  if (!courseId || !title || title.length > 160 || body.length > 50000) throw new Error("Confira título e conteúdo da aula.");
  const { data, error } = await client.from("creator_course_lessons").insert({ course_id: courseId, title, body, position: Number(lesson.position) || 0, is_preview: Boolean(lesson.isPreview) }).select("id,course_id,title,body,media_path,position,is_preview").single();
  if (error) throw error;
  return data;
}

export async function publishCreatorCourse(client, courseId) {
  assertClient(client);
  if (!courseId) throw new Error("Selecione um curso.");
  const lessons = await loadCreatorCourseLessons(client, courseId);
  if (!lessons.length) throw new Error("Adicione ao menos uma aula antes de publicar o curso.");
  const { data, error } = await client.from("creator_courses").update({ status: "published" }).eq("id", courseId).select("id,status").single();
  if (error) throw error;
  return data;
}

export async function authorizeCreatorInstructor(client, adminId, profileId) {
  assertClient(client);
  if (!adminId || !profileId) throw new Error("Informe a conta que receberá permissão de professor.");
  const { error } = await client.from("creator_course_instructors").upsert({ profile_id: profileId, approved_by: adminId }, { onConflict: "profile_id" });
  if (error) throw error;
}

export async function createCreatorLive(client, instructorId, live) {
  assertClient(client);
  const title = String(live.title || "").trim();
  const startsAt = new Date(live.startsAt);
  if (!instructorId || title.length < 3 || title.length > 160 || Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) throw new Error("Informe um título e uma data futura para a live.");
  const values = normalizeCreatorLive(live, title, startsAt);
  let coverPath = "";
  if (live.coverFile) coverPath = await uploadCreatorLiveCover(client, instructorId, live.coverFile);
  const { data, error } = await client.from("creator_live_events").insert({ instructor_id: instructorId, ...values, cover_url: coverPath ? client.storage.from("creator-live-covers").getPublicUrl(coverPath).data.publicUrl : values.cover_url, status: "draft" }).select("id").single();
  if (error && coverPath) await client.storage.from("creator-live-covers").remove([coverPath]).catch(() => {});
  if (error) throw error;
  return data;
}

function normalizeCreatorLive(live, title, startsAt) {
  const categories = new Set(["treino", "nutricao", "emagrecimento", "hipertrofia", "saude_bem_estar", "marketing_fitness"]);
  const description = String(live.description || "").trim();
  const priceCents = Number(live.priceCents) || 0;
  const durationMinutes = Number(live.durationMinutes) || 60;
  const participantLimit = live.participantLimit === "" || live.participantLimit == null ? null : Number(live.participantLimit);
  const coverUrl = String(live.coverUrl || "").trim();
  const category = live.category || "treino";
  if (description.length > 3000 || !categories.has(category) || !["public", "approved_creator"].includes(live.accessMode) || !Number.isSafeInteger(priceCents) || priceCents < 0 || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480 || (participantLimit !== null && (!Number.isInteger(participantLimit) || participantLimit < 1 || participantLimit > 100000)) || (coverUrl && !/^https:\/\//i.test(coverUrl))) {
    throw new Error("Confira categoria, descrição, duração, valor, limite de participantes e capa HTTPS.");
  }
  return {
    title, description, starts_at: startsAt.toISOString(), access_mode: live.accessMode,
    category, duration_minutes: durationMinutes, price_cents: priceCents,
    participant_limit: participantLimit, cover_url: coverUrl || null,
    cancellation_policy: String(live.cancellationPolicy || "").trim().slice(0, 2000),
    participant_information: String(live.participantInformation || "").trim().slice(0, 2000),
  };
}

async function uploadCreatorLiveCover(client, instructorId, file) {
  if (!file?.type || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error("A capa deve ser JPG, PNG ou WebP e ter no máximo 5 MB.");
  }
  const suffix = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${instructorId}/${randomId}.${suffix}`;
  const { error } = await client.storage.from("creator-live-covers").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

export async function updateCreatorLive(client, liveId, live) {
  assertClient(client);
  if (!liveId) throw new Error("Selecione uma transmissão.");
  const title = String(live.title || "").trim();
  const startsAt = new Date(live.startsAt);
  if (title.length < 3 || title.length > 160 || Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) throw new Error("Informe um título e uma data futura para a live.");
  const values = normalizeCreatorLive(live, title, startsAt);
  let coverPath = "";
  if (live.coverFile) {
    coverPath = await uploadCreatorLiveCover(client, live.instructorId, live.coverFile);
    values.cover_url = client.storage.from("creator-live-covers").getPublicUrl(coverPath).data.publicUrl;
  }
  const { data, error } = await client.from("creator_live_events").update(values).eq("id", liveId).select("id").single();
  if (error && coverPath) await client.storage.from("creator-live-covers").remove([coverPath]).catch(() => {});
  if (error) throw error;
  return data;
}

export async function publishCreatorLive(client, liveId, isAdmin = false) {
  assertClient(client);
  const status = isAdmin ? "published" : "pending_approval";
  const { data, error } = await client.from("creator_live_events").update({ status }).eq("id", liveId).select("id,status").single();
  if (error) throw error;
  return data;
}

export async function cancelCreatorLive(client, liveId) {
  assertClient(client);
  if (!liveId) throw new Error("Selecione uma transmissão.");
  const { data, error } = await client.from("creator_live_events")
    .update({ status: "cancelled" }).eq("id", liveId)
    .in("status", ["draft", "pending_approval", "published"])
    .select("id,status").single();
  if (error) throw error;
  return data;
}

export async function createCreatorCampaign(client, adminId, campaign) {
  assertClient(client);
  const title = String(campaign.title || "").trim();
  if (!adminId || title.length < 3 || title.length > 160 || !["collab", "unboxing", "campaign", "product"].includes(campaign.opportunityType)) throw new Error("Confira o título e o tipo da oportunidade.");
  const { data, error } = await client.from("creator_campaigns").insert({ created_by: adminId, title, description: String(campaign.description || "").trim(), opportunity_type: campaign.opportunityType, status: "open" }).select("id").single();
  if (error) throw error;
  return data;
}

export async function loadMyCreatorLearning(client, profileId) {
  assertClient(client);
  if (!profileId) return { enrollments: [], orders: [] };
  const [enrollmentResult, orderResult] = await Promise.all([
    client.from("creator_course_enrollments").select("id,course_id,status,enrolled_at").eq("profile_id", profileId).order("enrolled_at", { ascending: false }).limit(100),
    client.from("creator_course_orders").select("id,course_id,amount_cents,currency,status,created_at").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (enrollmentResult.error) throw enrollmentResult.error;
  if (orderResult.error) throw orderResult.error;
  return { enrollments: enrollmentResult.data || [], orders: orderResult.data || [] };
}

export async function enrollFreeCreatorCourse(client, courseId) {
  assertClient(client);
  if (!courseId) throw new Error("Selecione um curso válido.");
  const { data, error } = await client.rpc("enroll_free_creator_course", { p_course_id: courseId });
  if (error) throw error;
  return data;
}

export async function loadCreatorLives(client, profileId = "", isAdmin = false) {
  assertClient(client);
  let query = client.from("creator_live_events").select("id,instructor_id,title,description,starts_at,access_mode,status,category,cover_url,duration_minutes,price_cents,participant_limit,cancellation_policy,participant_information");
  if (!isAdmin) query = profileId ? query.or(`status.eq.published,instructor_id.eq.${profileId}`) : query.eq("status", "published");
  const { data, error } = await query.gte("starts_at", new Date().toISOString()).order("starts_at").limit(100);
  if (error) throw error;
  return data || [];
}

export async function loadCreatorLiveRegistrations(client, liveIds) {
  assertClient(client);
  if (!Array.isArray(liveIds) || !liveIds.length) return [];
  const { data, error } = await client.from("creator_live_registrations")
    .select("id,live_id,profile_id,status,created_at")
    .in("live_id", liveIds.slice(0, 100))
    .order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return data || [];
}

export async function loadCreatorLiveOrders(client, liveIds) {
  assertClient(client);
  if (!Array.isArray(liveIds) || !liveIds.length) return [];
  const { data, error } = await client.from("creator_live_orders")
    .select("id,live_id,profile_id,amount_cents,status,created_at")
    .in("live_id", liveIds.slice(0, 100))
    .order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return data || [];
}

// The public Live catalog only exposes events that the existing RLS policy
// makes available to every signed-in member. `public` is the audience scope;
// this catalog currently has no payment or playback provider integration.
export async function loadPublicCreatorLiveCatalog(client) {
  assertClient(client);
  const { data, error } = await client.from("creator_live_events")
    .select("id,instructor_id,title,description,starts_at,access_mode,status,category,cover_url,duration_minutes,price_cents,participant_limit,cancellation_policy,participant_information")
    .eq("status", "published")
    .eq("access_mode", "public")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  const events = data || [];
  const instructorIds = [...new Set(events.map(event => event.instructor_id).filter(Boolean))];
  if (!instructorIds.length) return events.map(event => ({ ...event, instructor: null }));

  const { data: profiles, error: profileError } = await client.from("profiles")
    .select("id,display_name,username,bio,avatar_path,kind,verified_at,partner_approved_at")
    .in("id", instructorIds);
  if (profileError) return events.map(event => ({ ...event, instructor: null }));
  const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));
  return Promise.all(events.map(async event => {
    const instructor = profileById.get(event.instructor_id) || null;
    let avatar = "";
    if (instructor?.avatar_path) { try { avatar = await signMedia(client, instructor.avatar_path); } catch { /* Name and event remain visible if a profile photo cannot be signed. */ } }
    return { ...event, instructor: instructor ? { ...instructor, avatar } : null };
  }));
}

export async function loadMyCreatorLiveRegistrations(client, profileId) {
  assertClient(client);
  if (!profileId) return [];
  const { data, error } = await client.from("creator_live_registrations")
    .select("id,live_id,status,created_at").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function registerCreatorLive(client, liveId) {
  assertClient(client);
  if (!liveId) throw new Error("Selecione uma live válida.");
  const { data, error } = await client.rpc("register_creator_live", { p_live_id: liveId });
  if (error) throw error;
  return data;
}

export async function loadCreatorCampaigns(client) {
  assertClient(client);
  const { data, error } = await client.from("creator_campaigns")
    .select("id,title,description,opportunity_type,starts_at,ends_at,status")
    .eq("status", "open").order("starts_at", { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function loadMyCreatorCampaignApplications(client, profileId, isAdmin = false) {
  assertClient(client);
  if (!profileId && !isAdmin) return [];
  let query = client.from("creator_campaign_applications").select("id,campaign_id,profile_id,status,message,created_at");
  if (!isAdmin) query = query.eq("profile_id", profileId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function applyToCreatorCampaign(client, campaignId, message = "") {
  assertClient(client);
  if (!campaignId) throw new Error("Selecione uma campanha válida.");
  if (message.length > 2000) throw new Error("A apresentação deve ter até 2.000 caracteres.");
  const { data, error } = await client.rpc("apply_to_creator_campaign", { p_campaign_id: campaignId, p_message: message });
  if (error) throw error;
  return data;
}

export async function reviewCreatorCampaignApplication(client, applicationId, status, note = "") {
  assertClient(client);
  if (!applicationId || !["selected", "declined"].includes(status) || note.length > 2000) throw new Error("Confira a decisão da campanha.");
  const { error } = await client.rpc("review_creator_campaign_application", { p_application_id: applicationId, p_status: status, p_note: note });
  if (error) throw error;
}

export async function loadCreatorMetrics(client, profileId) {
  assertClient(client);
  if (!profileId) return null;
  const { data, error } = await client.from("creator_metrics_snapshots")
    .select("valid_referral_visits,activated_users,fortalfy_followers,content_quality_score,content_regularity_score,assigned_level,calculated_at")
    .eq("profile_id", profileId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadCreatorInstructorAuthorization(client, profileId) {
  assertClient(client);
  if (!profileId) return false;
  const { data, error } = await client.from("creator_course_instructors").select("profile_id").eq("profile_id", profileId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function createCreatorCourse(client, profileId, course) {
  assertClient(client);
  const title = String(course.title || "").trim();
  const summary = String(course.summary || "").trim();
  const priceCents = Number(course.priceCents);
  if (!profileId || title.length < 3 || title.length > 160 || summary.length > 3000 || !Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new Error("Confira título, descrição e preço do curso.");
  }
  const { data, error } = await client.from("creator_courses").insert({
    instructor_id: profileId, title, summary, price_cents: priceCents, status: "draft",
  }).select("id,instructor_id,title,summary,price_cents,currency,status,created_at").single();
  if (error) throw error;
  return data;
}
