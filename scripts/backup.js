#!/usr/bin/env node

require('dotenv').config();
const backup = require('../src/utils/backup');
const logger = require('../src/utils/logger');

const args = process.argv.slice(2);
const command = args[0];

const showHelp = () => {
  console.log(`
Database Backup & Restore Utility
==================================

Usage: node scripts/backup.js [command] [options]

Commands:
  create              Create a full backup (database + files)
  create-db           Create database backup only
  create-files        Create files backup only
  restore-db <file>   Restore database from backup file
  restore-files <file> Restore files from backup file
  list                List all available backups
  clean [keep]        Clean old backups (default: keep last 10)

Examples:
  node scripts/backup.js create
  node scripts/backup.js restore-db backups/db_backup_2024-01-01.sql.gz
  node scripts/backup.js clean 5
  `);
};

const main = async () => {
  try {
    switch (command) {
      case 'create':
        console.log('Creating full system backup...');
        const result = await backup.createFullBackup();
        console.log('✓ Backup completed successfully!');
        console.log('Database:', result.database);
        console.log('Files:', result.files);
        break;

      case 'create-db':
        console.log('Creating database backup...');
        const dbFile = await backup.backupDatabase();
        console.log('✓ Database backup created:', dbFile);
        break;

      case 'create-files':
        console.log('Creating files backup...');
        const filesFile = await backup.backupFiles();
        console.log('✓ Files backup created:', filesFile);
        break;

      case 'restore-db':
        if (!args[1]) {
          console.error('Error: Backup file path required');
          console.log('Usage: node scripts/backup.js restore-db <file>');
          process.exit(1);
        }
        console.log('Restoring database from:', args[1]);
        await backup.restoreDatabase(args[1]);
        console.log('✓ Database restored successfully!');
        break;

      case 'restore-files':
        if (!args[1]) {
          console.error('Error: Backup file path required');
          console.log('Usage: node scripts/backup.js restore-files <file>');
          process.exit(1);
        }
        console.log('Restoring files from:', args[1]);
        await backup.restoreFiles(args[1]);
        console.log('✓ Files restored successfully!');
        break;

      case 'list':
        const backups = backup.listBackups();
        if (backups.length === 0) {
          console.log('No backups found');
        } else {
          console.log('\nAvailable Backups:');
          console.log('==================\n');
          backups.forEach(b => {
            const sizeMB = (b.size / 1024 / 1024).toFixed(2);
            console.log(`${b.filename}`);
            console.log(`  Type: ${b.type}`);
            console.log(`  Size: ${sizeMB} MB`);
            console.log(`  Created: ${b.created.toLocaleString()}`);
            console.log('');
          });
        }
        break;

      case 'clean':
        const keepCount = parseInt(args[1]) || 10;
        console.log(`Cleaning old backups (keeping last ${keepCount})...`);
        await backup.cleanOldBackups(keepCount);
        console.log('✓ Old backups cleaned');
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error('Error: Unknown command:', command);
        showHelp();
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    logger.error('Backup script error', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

main();
