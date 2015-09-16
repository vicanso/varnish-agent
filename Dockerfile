# varnish 4.0.2

FROM vicanso/varnish

MAINTAINER "vicansocanbico@gmail.com"

ADD . /varnish-agent

EXPOSE 80

RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && cd /varnish-agent && npm install --production  --registry=https://registry.npm.taobao.org

CMD cd /varnish-agent && NODE_ENV=production node app
