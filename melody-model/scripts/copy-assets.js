const fs = require('fs');
const path = require('path');


const projectRoot = path.join(__dirname, '..');
const source = path.join(projectRoot, 'training-data.json');
const targetDir = path.join(projectRoot, 'dist');
const target = path.join(targetDir, 'training-data.json');

if (!fs.existsSync(source)) {
  console.error('training-data.json not found; cannot copy training data into dist.');

  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`Copied training-data.json to ${target}`);
