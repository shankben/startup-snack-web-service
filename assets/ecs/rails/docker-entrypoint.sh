#!/bin/bash
set -e

rm -f /myapp/tmp/pids/server.pid

rake db:create

exec "$@"
