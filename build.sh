npm run init

npm run test

rm -rf coverage

rm -rf node_modules

npm run init-production

docker build -t vicanso/varnish-agent:0.2.2 .