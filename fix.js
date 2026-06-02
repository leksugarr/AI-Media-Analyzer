const fs = require('fs');
const path = require('path');

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJsFiles(filePath));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node fix_backend_url.js <path_to_src>');
  process.exit(1);
}

const files = getAllJsFiles(targetDir);
let fixedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  if (file.includes(`${path.sep}api${path.sep}`)) {
    content = content.replace(/process\.env\.NEXT_PUBLIC_API_URL/g, 'process.env.BACKEND_URL');
  }

  content = content.replace(/const BACKEND\s*=\s*["'`]http:\/\/localhost:5000\/api["'`]/g, 
    'const BACKEND = `${process.env.BACKEND_URL}/api`');
  
  content = content.replace(/const BACKEND_URL\s*=\s*["'`]http:\/\/localhost:5000["'`]/g,
    'const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000"');

  content = content.replace(/fetch\(["'`]http:\/\/localhost:5000\/api\//g,
    'fetch(`${process.env.BACKEND_URL}/api/');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed:', file);
    fixedCount++;
  }
});

console.log(`\nDone! Fixed ${fixedCount} files.`);