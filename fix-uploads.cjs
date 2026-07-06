const fs = require('fs');
let serverJs = fs.readFileSync('server.js', 'utf8');

const oldLogic = `const localDataPath = path.resolve(__dirname, 'data');
const persistencePath = path.resolve(__dirname, '..', 'sanghavi_persistence');
const filesPersistencePath = path.resolve('/', 'files', 'sanghavi_persistence'); // Hardcoded attempt to hit Hostinger /files path

let DATA_ROOT = localDataPath;
if (existsSync(persistencePath)) {
    DATA_ROOT = persistencePath;
    console.log(\`📂 [Sanghavi Studio] Using persistent data directory: \${DATA_ROOT}\`);
} else if (existsSync(filesPersistencePath)) {
    DATA_ROOT = filesPersistencePath;
    console.log(\`📂 [Sanghavi Studio] Using Hostinger files persistent directory: \${DATA_ROOT}\`);
} else {
    console.log(\`📂 [Sanghavi Studio] Using local data directory: \${DATA_ROOT}\`);
}

let UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const publicHtmlUploads = path.resolve(__dirname, '..', 'public_html', 'uploads');
const rootUploads = path.resolve('/', 'uploads');

if (!existsSync(UPLOADS_ROOT) && existsSync(publicHtmlUploads)) {
    UPLOADS_ROOT = publicHtmlUploads;
    console.log(\`📂 [Sanghavi Studio] Found existing uploads in public_html: \${UPLOADS_ROOT}\`);
} else if (!existsSync(UPLOADS_ROOT) && existsSync(rootUploads)) {
    UPLOADS_ROOT = rootUploads;
    console.log(\`📂 [Sanghavi Studio] Found existing uploads in root: \${UPLOADS_ROOT}\`);
}`;

const newLogic = `const DATA_ROOT = path.resolve(__dirname, '..', 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const BACKUPS_ROOT = path.resolve(DATA_ROOT, 'backups');

const ensureFolders = () => {
  try {
    [DATA_ROOT, UPLOADS_ROOT, BACKUPS_ROOT].forEach(dir => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o777 });
    });
    ['300', '720', '1080'].forEach(size => {
      const dir = path.join(UPLOADS_ROOT, size);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o777 });
    });
  } catch(e) {
      console.warn("Folder creation error", e);
  }
};
ensureFolders();

// --- MERGE SCATTERED UPLOADS ---
const mergeFolders = () => {
  const possiblePaths = [
    path.resolve(__dirname, 'data', 'uploads'),
    path.resolve(__dirname, '..', '.builds', 'sanghavi_persistence', 'uploads'),
    path.resolve(__dirname, '..', 'public_html', 'uploads'),
    path.resolve('/', 'files', 'sanghavi_persistence', 'uploads'),
    path.resolve('/', 'uploads')
  ];

  const copyRecursiveSync = (src, dest) => {
    if (!existsSync(src)) return;
    const stats = statSync(src);
    if (stats.isDirectory()) {
      if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
      readdirSync(src).forEach(childItemName => {
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      if (!existsSync(dest)) {
          copyFileSync(src, dest);
          console.log(\`Moved: \${src} -> \${dest}\`);
      }
    }
  };

  possiblePaths.forEach(p => {
    if (p !== UPLOADS_ROOT && existsSync(p)) {
      console.log(\`📦 [Merge] Merging scattered uploads from \${p} into \${UPLOADS_ROOT}\`);
      try {
        copyRecursiveSync(p, UPLOADS_ROOT);
      } catch (e) {
        console.error(\`Failed to merge from \${p}\`, e);
      }
    }
  });
};
mergeFolders();`;

// We also need to remove the old ensureFolders definition.
serverJs = serverJs.replace(oldLogic, newLogic);
serverJs = serverJs.replace(/const BACKUPS_ROOT = path\.resolve\(DATA_ROOT, 'backups'\);\n\nconst ensureFolders = \(\) => {[\s\S]*?ensureFolders\(\);\n/, '');

fs.writeFileSync('server.js', serverJs);
console.log('Fixed uploads logic!');
