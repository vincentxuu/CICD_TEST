module.exports = {
    apps: [
      {
        name: "node_app",
        script: "index.js",
        instances: "max",
        exec_mode: "cluster",
        env: {
          NODE_ENV: "development",
          MONGODB_URI: "mongodb://mongodb:27017/mydatabase",
          REDIS_HOST: "redis",
          REDIS_PORT: 6379
        },
        env_production: {
          NODE_ENV: "production",
          MONGODB_URI: "mongodb://mongodb:27017/mydatabase",
          REDIS_HOST: "redis",
          REDIS_PORT: 6379
        }
      }
    ]
  };
  