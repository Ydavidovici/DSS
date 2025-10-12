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
            script: 'src/server.ts',
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
        },
        {
            name: 'Trading-Bot',
            cwd: 'apps/Trading-Bot',
            script: 'src/bot.py',
            interpreter: '/srv/DSS/apps/Trading-Bot/.venv/bin/python',
            env: {
                ENV: 'production'
            }
        },
        {
            name: 'momentsByTemima-backend',
            cwd: "/root/srv/dss/apps/momentsByTemima/backend",
            interpreter: "/root/srv/dss/apps/momentsByTemima/backend/.venv/bin/python",
            script: "-m",
            args: "uvicorn app.main:app --host 0.0.0.0 --port 8000",
            env: {
                PYTHONPATH: '.',
                NODE_ENV: 'production'
            }
        },
        {
            name: 'momentsByTemima-frontend',
            cwd: 'apps/momentByTemima/frontend',
            script: 'bun run start',
            interpreter: 'bun',
            env: {
                NODE_ENV: 'production'
            }
        },
    ]
};