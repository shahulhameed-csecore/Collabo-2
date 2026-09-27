const { Jimp } = require('jimp');

async function cropLogos() {
  const image = await Jimp.read('./public/logo-source.png');
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  
  // The DALL-E image usually has 3 rows with text above each.
  // We need to crop very tightly to get just the logo, no text.
  
  // Full Logo: Tight crop on the first logo
  const fullLogo = image.clone().crop({ 
    x: w * 0.15, 
    y: h * 0.08, 
    w: w * 0.75, 
    h: h * 0.22 
  });
  await fullLogo.write('./public/logo-full.png');
  console.log('Wrote logo-full.png');
  
  // Icon Only: Tight crop on the second logo
  const iconOnly = image.clone().crop({ 
    x: w * 0.35, 
    y: h * 0.42, 
    w: w * 0.3, 
    h: h * 0.23 
  });
  await iconOnly.write('./public/logo-icon.png');
  console.log('Wrote logo-icon.png');
}

cropLogos().catch(console.error);
