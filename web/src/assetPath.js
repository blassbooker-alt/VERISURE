export function fortalfyAsset(category, filename) {
  const basePath = import.meta.env?.BASE_URL || "/";
  return `${basePath}assets/fortalfy/${category}/${filename}`;
}

export function visualPackAsset(filename) {
  const basePath = import.meta.env?.BASE_URL || "/";
  return `${basePath}assets/visual-pack/${filename}`;
}

export function publicAsset(filename) {
  const basePath = import.meta.env?.BASE_URL || "/";
  return `${basePath}assets/${filename}`;
}
