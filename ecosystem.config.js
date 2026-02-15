module.exports = {
  apps: [
    {
      name: 'psdprs-backend',
      script: './src/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: true,
      // Crash prevention
      exp_backoff_restart_delay: 100,
      // Graceful shutdown
      shutdown_with_message: true,
      // Auto restart on file changes in development
      ignore_watch: ['node_modules', 'logs', 'uploads', 'backups'],
      // Cron for automatic backups (daily at 2 AM)
      cron_restart: '0 2 * * *'
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo.git',
      path: '/var/www/psdprs',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
