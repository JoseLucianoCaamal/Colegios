import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, normalize, relative } from 'node:path';

const root = process.cwd();
function collectHtml(directory) {
  return readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !['.git', 'node_modules', 'graphify-out'].includes(entry.name)) return collectHtml(path);
    return entry.isFile() && extname(entry.name) === '.html' ? [path] : [];
  });
}
const htmlFiles = collectHtml(root).sort();
const ignored = /^(?:https?:|mailto:|tel:|#|data:|javascript:)/i;
const issues = [];
const stats = { pages: htmlFiles.length, inlineStyles: 0, inlineScripts: 0, links: 0 };

for (const absoluteFile of htmlFiles) {
  const file = relative(root, absoluteFile);
  const source = readFileSync(absoluteFile, 'utf8');
  stats.inlineStyles += (source.match(/<style[\s>]/gi) || []).length;
  stats.inlineScripts += (source.match(/<script(?![^>]*\bsrc=)[^>]*>/gi) || []).length;

  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  for (const id of new Set(ids)) {
    if (ids.filter(value => value === id).length > 1) issues.push(`${file}: ID duplicado “${id}”.`);
  }

  for (const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const target = match[1].trim();
    if (!target || ignored.test(target) || target.includes('${')) continue;
    stats.links += 1;
    const clean = decodeURIComponent(target.split(/[?#]/)[0]).replace(/^\/Colegios\//i, '');
    if (!clean) continue;
    const localPath = target.startsWith('/Colegios/') ? normalize(join(root, clean)) : normalize(join(dirname(absoluteFile), clean));
    if (!existsSync(localPath)) issues.push(`${file}: no existe “${target}”.`);
  }
}

console.log(`Auditoría: ${stats.pages} páginas · ${stats.links} recursos · ${stats.inlineStyles} estilos incrustados · ${stats.inlineScripts} scripts incrustados`);
if (issues.length) {
  console.error(`\nSe encontraron ${issues.length} problema(s):`);
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exitCode = 1;
} else {
  console.log('Sin enlaces locales rotos ni IDs duplicados.');
}
