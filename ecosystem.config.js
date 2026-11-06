module.exports = {
  apps: [
    {
      name: 'nestjs-api',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'prod',
        TZ: 'Asia/Seoul',
      },
      error_file: '/dev/null',
      out_file: '/dev/null',
    },
  ],
};
