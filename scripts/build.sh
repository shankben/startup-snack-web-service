#!/bin/bash

set -e

CWD=$(pwd -P)

mkdir -p dist/assets

rsync -azr --delete assets/ dist/assets/

npx tsc
