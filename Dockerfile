# varnish 4.0.2

FROM vicanso/pm2

MAINTAINER "vicansocanbico@gmail.com"

ADD . /varnish-agent

RUN apt-get update -y \
  && apt-get install varnish -y \
  && cd /varnish-agent && npm install --production  --registry=https://registry.npm.taobao.org

CMD cd /varnish-agent && pm2 restart pm2.json && varnishd -f /etc/varnish/default.vcl -s malloc,256m -a 0.0.0.0:80 -F
