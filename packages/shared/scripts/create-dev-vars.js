const fs = require('fs');

const dest = '.dev.vars';
const content = 'GYOKA_API_KEY=dev\n';

if (fs.existsSync(dest)) {
  console.log(`${dest} already exists. Skipping creation.`);
} else {
  fs.writeFileSync(dest, content);
  console.log(`Created ${dest}.`);
}
