const fs = require('fs');
let serverJs = fs.readFileSync('server.js', 'utf8');

if (!serverJs.includes("import os from 'os';")) {
    serverJs = serverJs.replace("import fs, { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, appendFileSync, writeFileSync, readFileSync } from 'fs';", "import fs, { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, appendFileSync, writeFileSync, readFileSync } from 'fs';\nimport os from 'os';");
}

const oldMerge = `const mergeFolders = () => {
  const possiblePaths = [
    path.resolve(__dirname, 'data', 'uploads'),
    path.resolve(__dirname, '..', '.builds', 'sanghavi_persistence', 'uploads'),
    path.resolve(__dirname, '..', 'public_html', 'uploads'),
    path.resolve('/', 'files', 'sanghavi_persistence', 'uploads'),
    path.resolve('/', 'uploads')
  ];`;

const newMerge = `const mergeFolders = () => {
  const home = os.homedir();
  const possiblePaths = [
    path.resolve(__dirname, 'data', 'uploads'),
    path.resolve(__dirname, '..', '.builds', 'sanghavi_persistence', 'uploads'),
    path.resolve(__dirname, '..', 'public_html', 'uploads'),
    path.resolve(__dirname, '..', 'nodejs', 'data', 'uploads'),
    path.resolve(__dirname, '..', 'sanghavi_persistence', 'uploads'),
    path.resolve(home, 'nodejs', 'data', 'uploads'),
    path.resolve(home, 'domains', 'studio.sanghavijewellers.com', 'public_html', 'data', 'uploads'),
    path.resolve(home, '.builds', 'sanghavi_persistence', 'uploads'),
    path.resolve(home, 'sanghavi_persistence', 'uploads'),
    path.resolve('/', 'files', 'sanghavi_persistence', 'uploads'),
    path.resolve('/', 'uploads')
  ];`;

serverJs = serverJs.replace(oldMerge, newMerge);
fs.writeFileSync('server.js', serverJs);
console.log('Fixed mergeFolders');
