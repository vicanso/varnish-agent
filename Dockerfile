FROM node:10-alpine as webbuilder

RUN apk update \
  && apk add git \
  && git clone --depth=1 https://github.com/vicanso/varnish-agent.git /varnish-agent \
  && cd /varnish-agent/web \
  && yarn \
  && yarn build \
  && rm -rf node_module

FROM golang:1.12-alpine as builder

COPY --from=webbuilder /varnish-agent /varnish-agent

ENV GOOS linux
ENV GOARCH amd64

RUN apk update \
  && apk add git make g++ bash cmake \
  && go get -u github.com/gobuffalo/packr/v2/packr2 \
  && cd /varnish-agent \
  && make build

FROM alpine

ENV VERSION 6.2.0-r1

COPY --from=builder /varnish-agent/vagent /usr/local/bin/vagent

RUN addgroup -g 1000 vagent \
  && adduser -u 1000 -G vagent -s /bin/sh -D vagent \
  && apk add --no-cache varnish=$VERSION

USER vagent

WORKDIR /home/vagent

CMD ["vagent"]