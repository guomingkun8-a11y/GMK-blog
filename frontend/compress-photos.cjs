const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DIR = path.join(__dirname, "public", "photos");
const MAX_W = 1600;
const QUALITY = 82;

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".jpg"));
  let totalBefore = 0;
  let totalAfter = 0;

  for (const f of files) {
    const p = path.join(DIR, f);
    const before = fs.statSync(p).size;
    const img = sharp(p).rotate(); // 按 EXIF 自动转正
    const meta = await img.metadata();

    let pipeline = img;
    if (meta.width > MAX_W) {
      pipeline = img.resize({ width: MAX_W, withoutEnlargement: true });
    }

    const buf = await pipeline
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();

    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, p);
    const after = buf.length;
    totalBefore += before;
    totalAfter += after;

    console.log(
      `${f}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB  (${meta.width}x${meta.height})`
    );
  }

  console.log("\n=== 汇总 ===");
  console.log(`总计: ${(totalBefore / 1024).toFixed(0)}KB -> ${(totalAfter / 1024).toFixed(0)}KB`);
  console.log(`节省: ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%`);
})();
