const fs = require('fs');

const src = 'wrangler.jsonc.sample';
const dest = 'wrangler.jsonc';

if (fs.existsSync(dest)) {
    console.log(`${dest} already exists. Skipping copy.`);
} else {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} to ${dest}.`);
}