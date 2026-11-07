const fs = require('fs');
const path = require('path');

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (/\.(ejs|js|json|html|css|md)$/i.test(file)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = walkDir('d:/Nightcode/rapira');
const imageRegex = /([a-zA-Z0-9_\-\.\/]+(?:\/images\/|\/uploads\/|cloudinary\.com\/)[a-zA-Z0-9_\-\.\/]+?\.(?:jpg|jpeg|png|webp|avif|svg))/gi;

const foundImages = new Map();

for (const f of allFiles) {
  try {
    const content = fs.readFileSync(f, 'utf8');
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      const img = match[1];
      if (!foundImages.has(img)) {
        foundImages.set(img, new Set());
      }
      foundImages.get(img).add(path.relative('d:/Nightcode/rapira', f));
    }
  } catch (e) {}
}

console.log(`Found ${foundImages.size} unique image references:`);
for (const [img, occurrences] of foundImages.entries()) {
  console.log(`- ${img}`);
  console.log(`    in: ${Array.from(occurrences).slice(0, 3).join(', ')}`);
}

