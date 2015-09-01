# varnish 4.0.2

FROM vicanso/varnish

MAINTAINER "vicansocanbico@gmail.com"

ADD . /varnish-agent

EXPOSE 80

RUN cd /varnish-agent && npm install --production  --registry=https://registry.npm.taobao.org

CMD cd /varnish-agent && node app & && varnishd -f /etc/varnish/default.vcl -s malloc,256m -a 0.0.0.0:80 -F
