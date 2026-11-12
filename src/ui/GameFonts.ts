/** Bundled OFL subsets; load before Phaser measures and rasterizes its text. */
export async function loadGameFonts():Promise<void> {
  if(typeof FontFace==='undefined'||!document.fonts)return;
  const base=import.meta.env.BASE_URL;
  const faces=[new FontFace('IMWarTitle',`url("${base}assets/fonts/war-title.woff2")`,{weight:'400'}),new FontFace('IMWarHeading',`url("${base}assets/fonts/war-heading.woff2")`,{weight:'600'})];
  for(const face of faces)document.fonts.add(face);
  // Fallback families keep the game usable if a font file cannot be loaded.
  await Promise.allSettled(faces.map(face=>face.load()));
}
