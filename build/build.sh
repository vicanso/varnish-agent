git clone https://github.com/vicanso/varnish-agent.git varnish-agent

cd varnish-agent

rm -rf .git

npm run test

rm -rf coverage

rm -rf node_modules

npm install --production

docker build -t vicanso/varnish-agent .

cd ..

rm -rf varnish-agent