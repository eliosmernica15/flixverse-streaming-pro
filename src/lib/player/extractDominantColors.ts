export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export function rgbToCss(color: RGBColor, alpha = 1): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

// Fallback colors based on TMDB genre IDs
export const GENRE_COLOR_MAP: Record<number, RGBColor[]> = {
  28: [ // Action
    { r: 229, g: 9, b: 20 },   // Red
    { r: 217, g: 119, b: 6 },  // Amber/Orange
    { r: 31, g: 41, b: 55 },   // Dark Grey
    { r: 17, g: 24, b: 39 }
  ],
  12: [ // Adventure
    { r: 4, g: 120, b: 87 },   // Green
    { r: 217, g: 119, b: 6 },  // Amber/Orange
    { r: 30, g: 58, b: 138 },  // Blue
    { r: 17, g: 24, b: 39 }
  ],
  16: [ // Animation
    { r: 236, g: 72, b: 153 }, // Pink
    { r: 59, g: 130, b: 246 }, // Blue
    { r: 245, g: 158, b: 11 }, // Yellow
    { r: 17, g: 24, b: 39 }
  ],
  35: [ // Comedy
    { r: 245, g: 158, b: 11 }, // Yellow
    { r: 236, g: 72, b: 153 }, // Pink
    { r: 16, g: 185, b: 129 }, // Green
    { r: 17, g: 24, b: 39 }
  ],
  80: [ // Crime
    { r: 185, g: 28, b: 28 },  // Dark Red
    { r: 75, g: 85, b: 99 },   // Grey
    { r: 31, g: 41, b: 55 },
    { r: 17, g: 24, b: 39 }
  ],
  99: [ // Documentary
    { r: 107, g: 114, b: 128 },// Grey
    { r: 209, g: 213, b: 219 },// Light Grey
    { r: 55, g: 65, b: 81 },
    { r: 17, g: 24, b: 39 }
  ],
  18: [ // Drama
    { r: 124, g: 58, b: 237 }, // Violet
    { r: 79, g: 70, b: 229 },  // Indigo
    { r: 31, g: 41, b: 55 },
    { r: 17, g: 24, b: 39 }
  ],
  10751: [ // Family
    { r: 245, g: 158, b: 11 }, // Orange-yellow
    { r: 59, g: 130, b: 246 }, // Blue
    { r: 16, g: 185, b: 129 }, // Green
    { r: 17, g: 24, b: 39 }
  ],
  14: [ // Fantasy
    { r: 139, g: 92, b: 246 }, // Purple
    { r: 236, g: 72, b: 153 }, // Pink
    { r: 30, g: 58, b: 138 },  // Deep Blue
    { r: 17, g: 24, b: 39 }
  ],
  36: [ // History
    { r: 146, g: 64, b: 14 },  // Brown
    { r: 120, g: 113, b: 108 },// Stone
    { r: 41, g: 37, b: 36 },
    { r: 17, g: 24, b: 39 }
  ],
  27: [ // Horror
    { r: 153, g: 27, b: 27 },  // Red/Charcoal
    { r: 31, g: 41, b: 55 },
    { r: 9, g: 9, b: 11 },     // Zinc-950
    { r: 0, g: 0, b: 0 }
  ],
  10402: [ // Music
    { r: 219, g: 39, b: 119 }, // Rose
    { r: 99, g: 102, b: 241 }, // Indigo
    { r: 31, g: 41, b: 55 },
    { r: 17, g: 24, b: 39 }
  ],
  9648: [ // Mystery
    { r: 30, g: 41, b: 59 },   // Slate
    { r: 79, g: 70, b: 229 },  // Indigo
    { r: 124, g: 58, b: 237 }, // Purple
    { r: 17, g: 24, b: 39 }
  ],
  10749: [ // Romance
    { r: 225, g: 29, b: 72 },  // Rose
    { r: 244, g: 63, b: 94 },  // Pinkish Red
    { r: 136, g: 19, b: 55 },  // Dark Rose
    { r: 17, g: 24, b: 39 }
  ],
  878: [ // Science Fiction
    { r: 6, g: 182, b: 212 },  // Cyan
    { r: 59, g: 130, b: 246 }, // Blue
    { r: 124, g: 58, b: 237 }, // Purple
    { r: 17, g: 24, b: 39 }
  ],
  10770: [ // TV Movie
    { r: 107, g: 114, b: 128 },// Grey
    { r: 31, g: 41, b: 55 },
    { r: 17, g: 24, b: 39 },
    { r: 0, g: 0, b: 0 }
  ],
  53: [ // Thriller
    { r: 127, g: 29, b: 29 },  // Blood Red
    { r: 30, g: 41, b: 59 },   // Slate Dark
    { r: 15, g: 23, b: 42 },
    { r: 17, g: 24, b: 39 }
  ],
  10752: [ // War
    { r: 65, g: 78, b: 57 },   // Olive/Military
    { r: 120, g: 113, b: 108 },
    { r: 41, g: 37, b: 36 },
    { r: 17, g: 24, b: 39 }
  ],
  37: [ // Western
    { r: 180, g: 83, b: 9 },   // Orange/Brown
    { r: 146, g: 64, b: 14 },
    { r: 69, g: 26, b: 3 },
    { r: 17, g: 24, b: 39 }
  ]
};

export const DEFAULT_PALETTE: RGBColor[] = [
  { r: 229, g: 9, b: 20 },   // Netflix Red
  { r: 38, g: 38, b: 38 },   // Charcoal
  { r: 17, g: 24, b: 39 },   // Dark Slate
  { r: 0, g: 0, b: 0 }       // Black
];

export function getFallbackPalette(genreIds?: number[]): RGBColor[] {
  if (genreIds && genreIds.length > 0) {
    for (const id of genreIds) {
      if (GENRE_COLOR_MAP[id]) {
        return GENRE_COLOR_MAP[id];
      }
    }
  }
  return DEFAULT_PALETTE;
}

export function extractDominantColors(
  imageUrl: string,
  genreIds?: number[]
): Promise<RGBColor[]> {
  return new Promise((resolve) => {
    const fallback = getFallbackPalette(genreIds);
    if (!imageUrl) {
      resolve(fallback);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(fallback);
          return;
        }

        // Downscale image for fast processing
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        const imgData = ctx.getImageData(0, 0, 50, 50).data;
        const colorCounts: Record<string, { color: RGBColor; count: number }> = {};

        // Simple bucket quantization: group colors into buckets of 16 values
        for (let i = 0; i < imgData.length; i += 4) {
          const a = imgData[i + 3];
          if (a < 200) continue; // Skip semi-transparent pixels

          const r = Math.round(imgData[i] / 16) * 16;
          const g = Math.round(imgData[i + 1] / 16) * 16;
          const b = Math.round(imgData[i + 2] / 16) * 16;
          const key = `${r},${g},${b}`;

          if (colorCounts[key]) {
            colorCounts[key].count++;
          } else {
            colorCounts[key] = { color: { r, g, b }, count: 1 };
          }
        }

        // Sort by popularity
        const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);

        if (sorted.length < 4) {
          resolve(fallback);
          return;
        }

        // Pick top 4 colors, ensuring they are somewhat distinct
        const palette: RGBColor[] = [];
        for (const item of sorted) {
          if (palette.length >= 4) break;

          // Check if color is too close to existing ones in the palette
          const isDistinct = palette.every((c) => {
            const dist = Math.sqrt(
              Math.pow(c.r - item.color.r, 2) +
              Math.pow(c.g - item.color.g, 2) +
              Math.pow(c.b - item.color.b, 2)
            );
            return dist > 40; // distance threshold
          });

          if (isDistinct) {
            palette.push(item.color);
          }
        }

        // Fill remaining spots if we couldn't find 4 distinct colors
        while (palette.length < 4) {
          palette.push(fallback[palette.length] || DEFAULT_PALETTE[palette.length]);
        }

        resolve(palette);
      } catch (err) {
        console.warn("Dominant color extraction failed due to tainted canvas or error:", err);
        resolve(fallback);
      }
    };

    img.onerror = () => {
      resolve(fallback);
    };
  });
}
