module.exports = {
    apps: [
      {
        name: "node_app",
        script: "index.js",
        instances: "max",
        exec_mode: "cluster",
        env: {
          NODE_ENV: "dev",
          MONGODB_URI: "mongodb://mongo_dev:27017/mydatabase_dev",
          REDIS_HOST: "redis_dev",
          REDIS_PORT: 6379
        },
        env_production: {
          NODE_ENV: "prod",
          MONGODB_URI: "mongodb://mongo_prod:27017/mydatabase_prod",
          REDIS_HOST: "redis_prod",
          REDIS_PORT: 6379
        }
      }
    ]
  };
  