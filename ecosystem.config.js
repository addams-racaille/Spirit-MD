module.exports = {
  apps: [{
    name: "spirit-md-bot",
    script: "./index.js",
    watch: false,
    max_memory_restart: "4G",
    autorestart: true,
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    env: {
      NODE_ENV: "production"
    }
  }]
};
