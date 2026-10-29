import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.resolve(testDirectory, "../src");
const appSource = readFileSync(path.join(sourceDirectory, "App.jsx"), "utf8");

function listJsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? listJsxFiles(entryPath)
      : entry.isFile() && entry.name.endsWith(".jsx") ? [entryPath] : [];
  });
}

function routeMatchesTarget(route, target) {
  const routeSegments = route.split("/").filter(Boolean);
  const targetSegments = target.split("/").filter(Boolean);
  return routeSegments.length === targetSegments.length
    && routeSegments.every((segment, index) => segment.startsWith(":") || segment === targetSegments[index]);
}

test("every static internal JSX link resolves to a registered route", () => {
  const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map(match => match[1])
    .filter(route => route !== "*");
  const targets = new Set();

  for (const file of listJsxFiles(sourceDirectory)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bto="(\/[^"]*)"/g)) {
      const target = match[1].split(/[?#]/, 1)[0];
      if (!target.includes("${")) targets.add(target);
    }
  }

  const unresolved = [...targets].filter(target => !routes.some(route => routeMatchesTarget(route, target)));
  assert.deepEqual(unresolved, [], `Internal links without a route: ${unresolved.join(", ")}`);
});
