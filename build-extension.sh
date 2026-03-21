#!/bin/bash
set -e

for cmd in zip; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "Error: '$cmd' is required but not installed." >&2
        exit 1
    fi
done

npm install

npx rollup -c rollup.config.js

zip -r singlefile-extension-source.zip manifest.json package.json _locales src rollup*.js eslint.config.mjs build-extension.sh

rm -f singlefile-extension-firefox.zip

cleanup() {
    if [ -f config.copy.js ]; then
        mv config.copy.js src/core/bg/config.js
    fi
}
trap cleanup EXIT

cp src/core/bg/config.js config.copy.js
node -e "const fs=require('fs');const file='src/core/bg/config.js';const updated=fs.readFileSync(file,'utf8').replace(/forceWebAuthFlow: false/g,'forceWebAuthFlow: true');fs.writeFileSync(file,updated);"

zip -r singlefile-extension-firefox.zip manifest.json lib _locales src
mv config.copy.js src/core/bg/config.js
