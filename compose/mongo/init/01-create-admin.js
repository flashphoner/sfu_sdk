// Runs once on a fresh /data/db. Creates root user for WCS / billing.
db = db.getSiblingDB('admin');

db.createUser({
    user: 'admin',
    pwd: 'Abcd1111',
    roles: [
        { role: 'userAdminAnyDatabase', db: 'admin' },
        { role: 'readWriteAnyDatabase', db: 'admin' },
        { role: 'dbAdminAnyDatabase',  db: 'admin' },
        { role: 'clusterAdmin',        db: 'admin' }
    ]
});

print('admin user created');
