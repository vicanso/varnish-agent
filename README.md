# varnish-agent

`varnish-agent`提供界面化的配置管理，配置信息保存于`etcd`中，当配置信息有更新时，自动更新配置并重新加载，方便多实例的配置管理。`varnish-agent`设置的varnish默认的`ttl`为0，因此如果不设置`Cache-Control`的所有请求都为不可缓存，尽量使用`Cache-Control`来控制接口的缓存时间。

需要注意，`varnish-agent`默认的`probe`如下：

```
probe basicProbe {
  .url = "/ping";
  .interval = 3s;
  .timeout = 5s;
  .window = 5;
  .threshold = 3;
}
```

所以对于backend都需要添加相应的health check处理（/ping），如果有需要自定义的，可以去调整`template.vcl`后，自行重新编译。

## 运行

参数说明：

- `CONFIG` 配置etcd的连接地址，此参数必须指定，如`CONFIG=etcd://192.168.31.176:2379/varnish-test`
- `AUTH` agent的认证配置，如`AUTH=user:pwd`，如果不配置则不使用认证，建议指定此参数
- `ADMIN_PATH` 管理后台的路径，如果不配置，则为`/agent`
- `PARAMS` varnish的启动参数，如`PARAMS="-a :8080 -s malloc,256m"`，需要注意的是，varnish的启动参数默认会添加`-F -p default_ttl=0`，而`-a`如果未指定，则指定为`:8080`，`-s`如果未指定，则指定为`malloc,1G`，一般不需要调整此参数


```bash
docker run -d --restart=always \
  -p 8080:8080 \
  -e CONFIG=etcd://10.254.136.81:2379/varnish \
  -e AUTH=user:pwd \
  -e ADMIN_PATH=/@agent \
  --name varnish-agent \
  vicanso/varnish-agent
```

启动成功后，访问`http://127.0.0.1:8080/@agent/`，则可进入管理后台。


### 添加director

![](./images/add-director.png)

![](./images/directors.png)

在更新相关配置后，会自动更新加载最新的配置文件（其它实例也会同时更新），当前最新的配置可在`Basic Info`中查看，需要注意的是，由于file是根据时间生成，因此不同实例有可能不一致，判断配置文件是否一致应该根据`hash`值。

![](./images/basic-info.png)
