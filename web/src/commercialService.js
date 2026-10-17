export const FREE_BUSINESS_TERMS_VERSION = "fortalfy-free-business-v1";
export const CUSTOMER_BENEFITS_TERMS_VERSION = "fortalfy-benefits-v1";
export const PARTNER_DISCOUNT_TERMS_VERSION = "fortalfy-partner-discounts-v1";

export async function acceptFreeBusinessRegistration(client, category) {
  const { error } = await client.rpc("fortalfy_record_free_registration_terms", {
    p_category: category,
    p_terms_version: FREE_BUSINESS_TERMS_VERSION,
  });
  if (error) throw error;
}

export async function loadPartnerCommercialState(client, profileId) {
  if (!client || !profileId) throw new Error("Não foi possível carregar os dados comerciais.");
  const [businessResult, enrollmentResult, eligibilityResult, pricesResult, scheduleResult] = await Promise.all([
    client.from("fortalfy_commercial_businesses")
      .select("profile_id,category,status,advertising_enabled,free_registration_terms_version,free_registration_accepted_at,reviewer_note,updated_at")
      .eq("profile_id", profileId)
      .maybeSingle(),
    client.from("fortalfy_discount_program_enrollments")
      .select("profile_id,terms_version,funding_source,included_conditions,cancellation_terms,accepted_at,active")
      .eq("profile_id", profileId)
      .maybeSingle(),
    client.from("fortalfy_discount_item_eligibility")
      .select("target_kind,target_id,enabled")
      .eq("profile_id", profileId),
    client.from("fortalfy_commercial_price_history")
      .select("id,target_kind,target_id,old_price,new_price,suspicious_increase,changed_at")
      .eq("profile_id", profileId)
      .order("changed_at", { ascending: false })
      .limit(30),
    client.from("fortalfy_discount_rules")
      .select("plan,day_from,day_to,percent")
      .order("plan")
      .order("day_from"),
  ]);
  for (const result of [businessResult, enrollmentResult, eligibilityResult, pricesResult, scheduleResult]) {
    if (result.error) throw result.error;
  }
  return {
    business: businessResult.data,
    enrollment: enrollmentResult.data,
    eligibility: eligibilityResult.data || [],
    priceHistory: pricesResult.data || [],
    schedule: scheduleResult.data || [],
  };
}

export async function setPartnerDiscountEnrollment(client, accepted) {
  const { error } = await client.rpc("fortalfy_set_discount_program_enrollment", {
    p_accept: accepted,
    p_terms_version: accepted ? PARTNER_DISCOUNT_TERMS_VERSION : null,
  });
  if (error) throw error;
}

export async function setDiscountItemEligibility(client, targetKind, targetId, enabled) {
  const { error } = await client.rpc("fortalfy_set_discount_item_eligibility", {
    p_target_kind: targetKind,
    p_target_id: targetId,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function reportCommercialContent(client, targetKind, targetId, reason) {
  const { data, error } = await client.rpc("fortalfy_report_commercial_content", {
    p_target_kind: targetKind,
    p_target_id: targetId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function loadAdminCommercialData(client) {
  const [
    businessResult, reportResult, contentResult, scheduleResult, priceResult,
    businessAuditResult, moderationAuditResult, ruleAuditResult, contentAuditResult,
  ] = await Promise.all([
    client.rpc("fortalfy_admin_list_commercial_businesses"),
    client.rpc("fortalfy_admin_list_commercial_reports"),
    client.rpc("fortalfy_admin_list_commercial_content"),
    client.from("fortalfy_discount_rules")
      .select("plan,day_from,day_to,percent")
      .order("plan")
      .order("day_from"),
    client.from("fortalfy_commercial_price_history")
      .select("id,target_kind,target_id,profile_id,old_price,new_price,changed_at")
      .order("changed_at", { ascending: false })
      .limit(200),
    client.from("fortalfy_commercial_audit")
      .select("id,profile_id,actor_id,action,previous_values,new_values,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    client.from("fortalfy_commercial_moderation_audit")
      .select("id,report_id,actor_id,previous_status,new_status,decision_note,changed_at")
      .order("changed_at", { ascending: false })
      .limit(200),
    client.from("fortalfy_discount_rule_audit")
      .select("id,plan,old_day_from,old_day_to,day_from,day_to,old_percent,new_percent,actor_id,changed_at")
      .order("changed_at", { ascending: false })
      .limit(200),
    client.from("fortalfy_commercial_content_audit")
      .select("id,target_kind,target_id,actor_id,action,previous_status,new_status,reviewer_note,changed_at")
      .order("changed_at", { ascending: false })
      .limit(200),
  ]);
  for (const result of [
    businessResult, reportResult, contentResult, scheduleResult, priceResult,
    businessAuditResult, moderationAuditResult, ruleAuditResult, contentAuditResult,
  ]) {
    if (result.error) throw result.error;
  }
  return {
    businesses: businessResult.data || [],
    reports: reportResult.data || [],
    commercialContent: contentResult.data || [],
    schedule: scheduleResult.data || [],
    priceHistory: priceResult.data || [],
    suspiciousPrices: (priceResult.data || []).filter(change => change.suspicious_increase),
    businessAudit: businessAuditResult.data || [],
    moderationAudit: moderationAuditResult.data || [],
    ruleAudit: ruleAuditResult.data || [],
    commercialContentAudit: contentAuditResult.data || [],
  };
}

export async function reviewCommercialBusiness(client, profileId, status, advertisingEnabled, note) {
  const { error } = await client.rpc("fortalfy_admin_set_commercial_status", {
    p_profile_id: profileId,
    p_status: status,
    p_advertising_enabled: advertisingEnabled,
    p_reviewer_note: note || null,
  });
  if (error) throw error;
}

export async function reviewCommercialReport(client, reportId, status, note) {
  const { error } = await client.rpc("fortalfy_admin_review_commercial_report", {
    p_report_id: reportId,
    p_status: status,
    p_decision_note: note || null,
  });
  if (error) throw error;
}

export async function reviewCommercialItem(client, targetKind, targetId, status, note) {
  const { error } = await client.rpc("fortalfy_admin_review_commercial_content", {
    p_target_kind: targetKind,
    p_target_id: targetId,
    p_status: status,
    p_reviewer_note: note || null,
  });
  if (error) throw error;
}

export async function saveDiscountRule(client, rule, previousDayFrom) {
  const { error } = await client.rpc("fortalfy_admin_set_discount_rule", {
    p_plan: rule.plan,
    p_previous_day_from: Number(previousDayFrom),
    p_day_from: Number(rule.day_from),
    p_day_to: Number(rule.day_to),
    p_percent: Number(rule.percent),
  });
  if (error) throw error;
}

export async function acceptCustomerBenefitTerms(client) {
  const { error } = await client.rpc("fortalfy_accept_customer_benefit_terms", {
    p_declaration_version: CUSTOMER_BENEFITS_TERMS_VERSION,
    p_terms_version: CUSTOMER_BENEFITS_TERMS_VERSION,
  });
  if (error) throw error;
}

export function getDiscountSchedulePercent(schedule, plan, day) {
  const dateDay = Number(day);
  if (!Number.isInteger(dateDay) || dateDay < 1 || dateDay > 31) return null;
  const rule = schedule.find(item => item.plan === plan
    && dateDay >= Number(item.day_from) && dateDay <= Number(item.day_to));
  return rule ? Number(rule.percent) : null;
}
