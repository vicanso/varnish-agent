npm run test

rm -rf coverage

rm -rf node_modules

npm install --production

docker build -t vicanso/varnish-agent .