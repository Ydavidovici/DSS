module.exports = {
    apps: [
        {
            name: 'auth',
            cwd: 'apps/auth',
            script: 'index.ts',
            interpreter: 'bun',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'db-service',
            cwd: 'apps/db-service/src',
            script: 'index.ts',
            interpreter: 'bun',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'ds-frontend',
            cwd: 'apps/ds-frontend',
            script: 'server.js',
            interpreter: 'bun',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'klvn-frontend',
            cwd: 'apps/klvn-frontend',
            script: 'index.js',
            interpreter: 'bun',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'pfm',
            cwd: 'apps/pfm',
            script: 'src/main.py',
            interpreter: '/srv/DSS/apps/pfm/.venv/bin/python',
            env: {
                ENV: 'production'
            }
        }
    ]
};