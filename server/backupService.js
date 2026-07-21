import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import cron from 'node-cron';
import mysqldump from 'mysqldump';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const cleanEnv = (val) => val ? val.toString().replace(/^['"]|['"]$/g, '').trim() : '';

const getDbConfig = () => ({
  host: cleanEnv(process.env.DB_HOST) || 'localhost',
  user: cleanEnv(process.env.DB_USER) || 'root',
  password: cleanEnv(process.env.DB_PASSWORD) || '',
  database: cleanEnv(process.env.DB_NAME) || 'sanghavi_studio'
});

export const getBackupsList = () => {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return [];
  }
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.endsWith('.zip'))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUPS_DIR, f));
      return {
        filename: f,
        size: stats.size,
        createdAt: stats.mtime
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return files;
};

export const triggerBackup = async (triggerType = 'manual') => {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup_${triggerType}_${timestamp}`;
  const sqlDumpPath = path.join(BACKUPS_DIR, `${backupName}.sql`);
  const zipPath = path.join(BACKUPS_DIR, `${backupName}.zip`);

  const dbConfig = getDbConfig();

  try {
    console.log(`[Backup] Starting database dump...`);
    // Need to use default export workaround since mysqldump export format can vary
    const dumpFn = mysqldump.default || mysqldump;
    await dumpFn({
      connection: dbConfig,
      dumpToFile: sqlDumpPath,
    });
    console.log(`[Backup] Database dumped successfully to ${sqlDumpPath}`);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 1 } });

      output.on('close', function() {
        console.log(`[Backup] Zip archive created: ${archive.pointer()} total bytes`);
        if (fs.existsSync(sqlDumpPath)) fs.unlinkSync(sqlDumpPath);
        if (triggerType === 'auto') cleanOldAutoBackups();
        resolve({ success: true, file: zipPath, filename: `${backupName}.zip` });
      });

      archive.on('error', function(err) {
        if (fs.existsSync(sqlDumpPath)) fs.unlinkSync(sqlDumpPath);
        reject(err);
      });

      archive.pipe(output);
      archive.file(sqlDumpPath, { name: `${backupName}.sql` });
      
      if (fs.existsSync(UPLOADS_DIR)) {
          archive.directory(UPLOADS_DIR, 'uploads');
      }

      archive.finalize();
    });

  } catch (err) {
    console.error('[Backup] Backup failed:', err);
    throw err;
  }
};

export const cleanOldAutoBackups = () => {
    try {
        const files = getBackupsList().filter(f => f.filename.includes('_auto_'));
        if (files.length > 7) {
            const filesToDelete = files.slice(7);
            filesToDelete.forEach(f => {
                const filePath = path.join(BACKUPS_DIR, f.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[Backup] Deleted old backup: ${f.filename}`);
                }
            });
        }
    } catch(e) {
        console.error('[Backup] Error cleaning old backups:', e);
    }
};

export const initBackupScheduler = () => {
  // Run daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Backup] Running scheduled daily backup...');
    try {
      await triggerBackup('auto');
    } catch (e) {
      console.error('[Backup] Scheduled backup failed:', e);
    }
  });
  console.log('[Backup] Scheduled daily backups at 02:00 AM');
};
