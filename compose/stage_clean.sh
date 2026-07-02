#!/bin/bash

# Stop staging containers
./stage_down.sh

# Clean services
[ -d ./zapp-server/conf ] && sudo rm -rf ./zapp-server/conf
[ -d ./zapp-server/logs ] && sudo rm -rf ./zapp-server/logs

# Clean docker compose environment
rm -rf ./.env

exit 0