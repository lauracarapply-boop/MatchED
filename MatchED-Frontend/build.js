const fs = require('fs');
const path = require('path');

const apiUrl = process.env.MATCHED_API_URL || '';

const configPath = path.join(__dirname, 'config.js');
const content = `window.MATCHED_API_URL = ${JSON.stringify(apiUrl)};`;
fs.writeFileSync(configPath, content);

console.log(`config.js written — MATCHED_API_URL = "${apiUrl}"`);
