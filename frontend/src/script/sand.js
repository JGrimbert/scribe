import { createCanvas } from "canvas";
import fs from "fs";
import { createNoise2D } from "simplex-noise";

const SIZE = 256;
const OUT = process.argv[2] || "sand.png";

const noise = createNoise2D(Math.random);

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext("2d");

const img = ctx.createImageData(SIZE, SIZE);

const SCALE = 256;

// 🎨 couleur sable (modifiable)
const tint = { r: 214, g: 194, b: 165 };

for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {

        const u = (x / SIZE) * SCALE;
        const v = (y / SIZE) * SCALE;

        let n =
            noise(u, v) * 0.6 +
            noise(u * 2, v * 2) * 0.3 +
            noise(u * 4, v * 4) * 0.1;

        const val = Math.floor((n + 1) * 0.5 * 255);

        const i = (y * SIZE + x) * 4;

        // 🔥 COLOR TINT (seule modification)
        let t = val / 255;

        // 🌞 remonte globalement la luminance
        t = Math.pow(t, 0.25);

        // 🔥 écrase les noirs (important)
        t = 0.44 + t * 0.88;

// application couleur
        img.data[i]     = tint.r * t;
        img.data[i + 1] = tint.g * t;
        img.data[i + 2] = tint.b * t;
        img.data[i + 3] = 255;
    }
}

ctx.putImageData(img, 0, 0);

// ⚠️ garder ton export tel quel
fs.writeFileSync(OUT, canvas.toBuffer("image/png"));

console.log("✔ generated", OUT);