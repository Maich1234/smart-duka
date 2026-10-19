// Render the editable vector source; no network or image-generation dependency.
// Run with `node scripts/generate-brand-assets.cjs` after installing sharp locally.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'assets/images');
const green = '#004B39';
async function main() {
  const svg = await fs.readFile(path.join(root, 'assets/brand/symbol.svg'), 'utf8');
  const mono = svg.replace('#E0A653', '#FFFFFF');
  const render = (source, size) => sharp(Buffer.from(source)).resize(size, size).png().toBuffer();
  const symbol = await render(svg, 1024);
  await fs.writeFile(path.join(out, 'brand-symbol.png'), symbol);
  await fs.writeFile(path.join(out, 'splash-icon.png'), symbol);
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: green } })
    .composite([{ input: await render(svg, 820), gravity: 'centre' }]).removeAlpha().png().toFile(path.join(out, 'icon.png'));
  // Actual artwork fits inside Android's central circular safe zone.
  for (const [name, source] of [['android-icon-foreground.png', svg], ['android-icon-monochrome.png', mono]]) {
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
      .composite([{ input: await render(source, 680), gravity: 'centre' }]).png().toFile(path.join(out, name));
  }
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: green } }).png().toFile(path.join(out, 'android-icon-background.png'));
  await sharp({ create: { width: 64, height: 64, channels: 3, background: green } })
    .composite([{ input: await render(svg, 60), gravity: 'centre' }]).removeAlpha().png().toFile(path.join(out, 'favicon.png'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
