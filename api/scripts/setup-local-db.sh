#!/usr/bin/env bash
set -e

service postgresql start
service redis-server start

# Configure postgresql to listen on all interfaces and allow password auth
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" /etc/postgresql/16/main/postgresql.conf
if ! grep -q "host all all 0.0.0.0/0 md5" /etc/postgresql/16/main/pg_hba.conf; then
  echo "host all all 0.0.0.0/0 md5" >> /etc/postgresql/16/main/pg_hba.conf
  echo "host all all ::0/0 md5" >> /etc/postgresql/16/main/pg_hba.conf
fi
service postgresql restart

su - postgres -c "psql -c \"DO \\\$do\\\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'autoposter') THEN CREATE ROLE autoposter WITH LOGIN PASSWORD 'autoposter_local_secret' SUPERUSER; ELSE ALTER ROLE autoposter WITH PASSWORD 'autoposter_local_secret'; END IF; END \\\$do\\\$;\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = 'autoposter_dev'\" | grep -q 1 || psql -c \"CREATE DATABASE autoposter_dev OWNER autoposter;\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = 'autoposter_test'\" | grep -q 1 || psql -c \"CREATE DATABASE autoposter_test OWNER autoposter;\""

echo "POSTGRES_AND_REDIS_READY"
