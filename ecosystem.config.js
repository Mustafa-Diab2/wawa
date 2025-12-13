module.exports = {
  apps: [
    {
      name: 'wacrm-worker',
      cwd: './worker-service',
      script: 'npm',
      args: 'start',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
      },
      // Restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',

      // Logging
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true,

      // Advanced features
      instances: 1,
      exec_mode: 'fork',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,

      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
