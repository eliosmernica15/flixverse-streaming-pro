/**
 * Extract dominant color from a poster image for ambient glow.
 */
export async function extractPosterColors(posterUrl: string): Promise<string> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = posterUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "rgba(239, 68, 68, 0.15)";
    canvas.width = 64;
    canvas.height = 64;
    ctx.drawImage(img, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  } catch {
    return "rgba(239, 68, 68, 0.15)";
  }
}
