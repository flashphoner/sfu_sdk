#!/bin/bash

DOCKER_REPO=dockerhub.flashphoner.com:5000

ZAPP_SERVER_IMAGE=${1:-"$DOCKER_REPO/zapp-server:latest"}
EXT_NET_SUB=172.12.0
ZAPP_SERVER_IP=$EXT_NET_SUB.11
MONGO_IP=$EXT_NET_SUB.13
MINIO_IP=$EXT_NET_SUB.15
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
S3_ENDPOINT=http://$MINIO_IP:9000

# Prepare configs
if [ -d ./zapp-server/conf ]; then
    sudo rm -rf ./zapp-server/conf
fi
mkdir -p ./zapp-server/conf
cp -r ./zapp-server/conf.template/* ./zapp-server/conf/
[ ! -d ./zapp-server/logs ] && mkdir -p ./zapp-server/logs

# Prepare docker compose environment
[ -f ./.env ] && rm -rf ./.env
cp ./.env.template ./.env

# Compose parameters substitution
sed -i "s|\${ZAPP_SERVER_IMAGE}|$ZAPP_SERVER_IMAGE|" ./.env
sed -i "s|\${EXT_NET_SUB}|$EXT_NET_SUB|" ./.env
sed -i "s|\${S3_ACCESS_KEY}|$S3_ACCESS_KEY|" ./.env
sed -i "s|\${S3_SECRET_KEY}|$S3_SECRET_KEY|" ./.env
sed -i "s|\${ZAPP_SERVER_IP}|$ZAPP_SERVER_IP|" ./.env
sed -i "s|\${MONGO_IP}|$MONGO_IP|" ./.env
sed -i "s|\${MINIO_IP}|$MINIO_IP|" ./.env

# Server IP address substitution
sed -i "s|\${ZAPP_SERVER_IP}|$ZAPP_SERVER_IP|" ./zapp-server/conf/app.yaml
# Mongo IP address substitution
sed -i "s|\${MONGO_IP}|$MONGO_IP|" ./zapp-server/conf/app.yaml

# S3 storage configuration substitution for zapp-server
sed -i "s|\${S3_ACCESS_KEY}|$S3_ACCESS_KEY|" ./zapp-server/conf/zclient/conf/zclient_settings.yml
sed -i "s|\${S3_SECRET_KEY}|$S3_SECRET_KEY|" ./zapp-server/conf/zclient/conf/zclient_settings.yml
sed -i "s|\${S3_REGION}|$S3_REGION|" ./zapp-server/conf/zclient/conf/zclient_settings.yml
sed -i "s|\${S3_ENDPOINT}|$S3_ENDPOINT|" ./zapp-server/conf/zclient/conf/zclient_settings.yml

# Prevuious instances cleanup
./stage_down.sh
# Pull a new image and start containers
docker pull "$ZAPP_SERVER_IMAGE" || { echo "Failed to pull $ZAPP_SERVER_IMAGE"; exit 1; }
docker compose up -d
RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo "[init] Adding users..."
    added=0
    for i in $(seq 1 10); do
        if curl -fsS -X POST "http://localhost:8081/rest-api/sfu/zapp/add_users" \
            -H "Content-Type: application/json" \
            -d '{"emails":["bob@flashphoner.com","alice@flashphoner.com","recorder@flashphoner.com","john@flashphoner.com","kiri@flashphoner.com"],"password":"123456"}'
        then
            echo
            echo "[init] users added"
            added=1
            break
        fi
        echo "[init] add_users attempt $i failed, retrying in 3s..."
        sleep 3
    done
    if [ "$added" != "1" ]; then
        echo "[init] ERROR: failed to add users after 10 attempts" >&2
        ./stage_down.sh
        exit 1
    fi
    echo "[init] All done, tests may run"
else
    echo "Docker compose failed with code $RESULT"
    ./stage_down.sh
    exit $RESULT
fi

exit 0