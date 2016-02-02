# varnish 4.1.0

FROM vicanso/varnish

MAINTAINER "vicansocanbico@gmail.com"

ADD . /app

EXPOSE 8080

RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && cd /app && npm install --production  --registry=https://registry.npm.taobao.org

CMD cd /app && node index
