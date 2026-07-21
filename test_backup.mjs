import { triggerBackup } from './server/backupService.js';
triggerBackup('manual').then(res => console.log('Success:', res)).catch(console.error);
