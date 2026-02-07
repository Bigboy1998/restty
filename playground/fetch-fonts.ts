import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const fontsDir = resolve("playground/public/fonts");
const jbUrl =
  "https://github.com/JetBrains/JetBrainsMono/raw/v2.304/fonts/ttf/JetBrainsMono-Regular.ttf";
const nerdUrl = "https://deps.files.ghostty.org/NerdFontsSymbolsOnly-3.4.0.tar.gz";
const openmojiUrl =
  "https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/font/OpenMoji-black-glyf/OpenMoji-black-glyf.ttf";

const jbPath = resolve(fontsDir, "JetBrainsMono-Regular.ttf");
const nerdPath = resolve(fontsDir, "SymbolsNerdFontMono-Regular.ttf");
const openmojiPath = resolve(fontsDir, "OpenMoji-black-glyf.ttf");
const nerdLicense = resolve(fontsDir, "NerdFontsSymbolsOnly.LICENSE");
const tarPath = resolve(fontsDir, "NerdFontsSymbolsOnly-3.4.0.tar.gz");

await mkdir(dirname(jbPath), { recursive: true });

async function download(url: string, outPath: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeFile(outPath, buf);
}

await download(jbUrl, jbPath);
console.log(`saved ${jbPath}`);

await download(openmojiUrl, openmojiPath);
console.log(`saved ${openmojiPath}`);

await download(nerdUrl, tarPath);
await new Promise<void>((resolvePromise, reject) => {
  const proc = spawn("tar", [
    "-xf",
    tarPath,
    "-C",
    fontsDir,
    "./SymbolsNerdFontMono-Regular.ttf",
    "./LICENSE",
  ]);
  proc.on("error", reject);
  proc.on("exit", (code) => {
    if (code === 0) resolvePromise();
    else reject(new Error(`tar exited with code ${code}`));
  });
});
await rename(resolve(fontsDir, "LICENSE"), nerdLicense).catch(() => {});
console.log(`saved ${nerdPath}`);
