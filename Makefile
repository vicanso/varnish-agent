export GO111MODULE = on

.PHONY: default test test-cover dev

# for dev
dev:
	CONFIG=etcd://127.0.0.1:2379/varnish fresh

# for test
test:
	go test -race -cover ./...

test-cover:
	go test -race -coverprofile=test.out ./... && go tool cover --html=test.out

build-web:
	cd web \
		&& npm i \
		&& npm run build

bench:
	go test -bench=. ./...

build:
	packr2
	go build -tags netgo -o vagent

clean:
	packr2 clean
