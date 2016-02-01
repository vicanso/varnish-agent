docker build -t varnish-agent .

docker run -d --restart=always -p 8080:8080 -e="LOG=timtam://192.168.2.1:7001" -e="NODE_ENV=production" -e="REGISTER=http://192.168.2.1:2379/backend" varnish-agent