#!/bin/bash
exec env -i HOME=/home/benoit PATH=/home/benoit/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin /home/benoit/.nvm/versions/node/v22.22.0/bin/node /usr/local/bin/openclaw "$@"
