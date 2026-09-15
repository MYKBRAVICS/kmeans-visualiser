/**
 * kmeans.test.mjs — assertions for the clustering maths in index.html.
 *
 *     node tests/kmeans.test.mjs
 *
 * No build step, no dependencies, no test framework. The functions are
 * extracted straight out of the single HTML file, so the code under test is
 * literally the code that ships — there is no second copy to drift.
 *
 * Several of these assertions exist to protect claims the page makes in
 * words. If the noise dataset stops scoring far below the separated one, the
 * page's whole argument breaks, and a silent change to the generator would
 * otherwise never be noticed.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");

const script = html.match(/<script>\n"use strict";([\s\S]*?)<\/script>/)[1];
const maths = script.split("/* ====================================================================\n   State")[0];
const bestAtK = script.match(/function bestAtK[\s\S]*?^}/m)[0];

const mod = await import(
  "data:text/javascript," +
  encodeURIComponent(maths + "\n" + bestAtK +
    "\nexport {mulberry32,assign,update,inertia,silhouette,makeData,bestAtK};")
);

const { mulberry32, assign, update, inertia, silhouette, makeData, bestAtK: best } = mod;

const W = 1560, H = 1040;
const DEFAULT_SEED = 6;   // must match state.seedSeed in index.html

let failures = 0;
function check(name, pass, detail = "") {
  console.log(`${pass ? "ok  " : "FAIL"}  ${name}${detail ? "   " + detail : ""}`);
  if (!pass) failures++;
}

/** Reproduces the page's seedCentroids + run-to-convergence exactly. */
function runToConvergence(points, k, seedSeed) {
  const rand = mulberry32(seedSeed);
  const picked = new Set();
  let centroids = [], guard = 0;
  while (centroids.length < k && guard++ < 5000) {
    const i = Math.floor(rand() * points.length);
    if (picked.has(i)) continue;
    picked.add(i);
    centroids.push([points[i][0] + (rand() - 0.5) * 60,
                    points[i][1] + (rand() - 0.5) * 60]);
  }
  while (centroids.length < k) centroids.push([W / 2, H / 2]);

  let labels = assign(points, centroids);
  for (let it = 0; it < 100; it++) {
    centroids = update(points, labels, k, centroids);
    const next = assign(points, centroids);
    const same = next.every((v, i) => v === labels[i]);
    labels = next;
    if (same) break;
  }
  return { labels, centroids, sil: silhouette(points, labels, k) };
}

const separated  = makeData("separated", 1);
const overlapping = makeData("overlapping", 1);
const noise      = makeData("noise", 1);

console.log("\nFirst impression — the default view must be correct\n");

check("default seed finds the four groups",
      runToConvergence(separated, 4, DEFAULT_SEED).sil > 0.79,
      "s=" + runToConvergence(separated, 4, DEFAULT_SEED).sil.toFixed(3));

check("default seed is sensible at the opening k=3",
      runToConvergence(separated, 3, DEFAULT_SEED).sil > 0.60,
      "s=" + runToConvergence(separated, 3, DEFAULT_SEED).sil.toFixed(3));

console.log("\nThe page's central claim — noise must score far below signal\n");

const sSep = runToConvergence(separated, 4, DEFAULT_SEED).sil;
const sNoi = runToConvergence(noise, 4, DEFAULT_SEED).sil;
const sOvl = runToConvergence(overlapping, 4, DEFAULT_SEED).sil;

check("separated beats noise by a wide margin", sSep - sNoi > 0.35,
      "gap=" + (sSep - sNoi).toFixed(3));
check("noise still returns a POSITIVE silhouette", sNoi > 0,
      "s=" + sNoi.toFixed(3) + " — the algorithm partitions nothing, confidently");
check("overlapping sits between the two", sOvl > sNoi && sOvl < sSep,
      "s=" + sOvl.toFixed(3));

console.log("\nLocal minima must remain visible via the reseed button\n");

let stuck = 0;
for (let s = 1; s <= 200; s++) if (runToConvergence(separated, 4, s).sil < 0.7) stuck++;
check("a meaningful share of random seeds land in a local minimum",
      stuck > 40 && stuck < 130, (stuck / 2).toFixed(0) + "% of 200 seeds");

console.log("\nThe k curve uses restarts, and must behave\n");

for (const [label, data] of [["separated", separated],
                             ["overlapping", overlapping],
                             ["noise", noise]]) {
  const rows = [];
  for (let k = 2; k <= 8; k++) rows.push({ k, ...best(data, k, 12) });

  // Only guaranteed for the best solution at each k — which is the entire
  // reason this panel uses restarts and the live demo does not.
  let monotone = true;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].wss > rows[i - 1].wss * 1.001) monotone = false;
  }
  check(`within-cluster SS falls as k rises (${label})`, monotone);

  const peak = rows.reduce((a, b) => (b.sil > a.sil ? b : a));
  if (label === "separated") {
    check("  silhouette peaks at the true k=4", peak.k === 4,
          "peak k=" + peak.k + " s=" + peak.sil.toFixed(3));
  }
  if (label === "noise") {
    check("  noise keeps improving with k", peak.k >= 6,
          "peak k=" + peak.k + " — the signature of splitting noise");
  }
}

console.log("\nMaths\n");

const clean = [[0, 0], [1, 0], [0, 1], [1, 1],
               [100, 100], [101, 100], [100, 101], [101, 101]];
check("perfect separation scores near 1",
      silhouette(clean, [0, 0, 0, 0, 1, 1, 1, 1], 2) > 0.95,
      "s=" + silhouette(clean, [0, 0, 0, 0, 1, 1, 1, 1], 2).toFixed(4));

check("singleton clusters do not produce NaN",
      Number.isFinite(silhouette([[0, 0], [1, 1], [50, 50]], [0, 0, 1], 2)));

const emptied = update([[0, 0], [1, 1]], [0, 0], 2, [[5, 5], [9, 9]]);
check("an empty cluster keeps its previous centroid",
      emptied[1][0] === 9 && emptied[1][1] === 9 && Number.isFinite(emptied[0][0]));

check("inertia is zero when every point is its own centroid",
      inertia([[3, 4]], [0], [[3, 4]]) === 0);

for (let k = 2; k <= 8; k++) {
  const { labels } = runToConvergence(separated, k, DEFAULT_SEED);
  if (labels.length !== separated.length || !labels.every(v => v >= 0 && v < k)) {
    check(`labels valid at k=${k}`, false);
  }
}
check("labels are valid at every k", true);

console.log(failures ? `\n${failures} failed\n` : "\nall assertions passed\n");
process.exit(failures ? 1 : 0);
