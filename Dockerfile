# varnish 4.1.0

FROM mhart/alpine-node

MAINTAINER "vicansocanbico@gmail.com"

ADD . /app

EXPOSE 8080

RUN apk add --update varnish && rm -rf /var/cache/apk/*

CMD cd /app && node index
