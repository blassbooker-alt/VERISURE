export function fortalfyAsset(category, filename) {
  const basePath = import.meta.env?.BASE_URL || "/";
  return `${basePath}assets/fortalfy/${category}/${filename}`;
}

export function visualPackAsset(filename) {
  const basePath = import.meta.env?.BASE_URL || "/";
  return `${basePath}assets/visual-pack/${filename}`;
}

export function brandCampaignAsset(filename) {
  const basePath = import.meta.env?.BASE_URL || "/";
  return `${basePath}assets/brand-campaign/${filename}`;
}

export function publicAsset(filename) {
  const basePath = import.meta.env?.BASE_URL || "/";
  return `${basePath}assets/${filename}`;
}

export function adPackAsset(filename) {
  const basePath = import.meta.env?.BASE_URL || "/";
  return `${basePath}assets/ad-pack/${filename}`;
}
