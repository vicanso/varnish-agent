# varnish-agent

通过从consul中获取tag标识为http-backend(通过env来配置)的http服务，生成varnish配置，启动varnish。

## 使用方式

通过指定consul中serive tag，程序定时(60秒间隔)获取，判断当前backend列表与之前的是否有更新；如果有更新，生成新的vcl(/tmp/2015-08-10T05:44:50.727Z.vcl)，加载并使用。

```js
// CONSUL默认为http://localhost:8500

// SERVICE_TAG默认为http-backend
// SERVICE_TAG也可以配置为多个 SERVICE_TAG=test-backend,http-backend
SERVICE_TAG=test-backend CONSUL=http://localhost:8500  node app
// 若使用pm2来启动，可以修改pm2.json的args
```



## API

### /ping

返回当前varnish配置文件的生成时间和版本号（也可用于检测varnish是否可用）

```
2015-08-10T05:44:50.727Z 3790224399
```

### /v-stats

返回varnish性能指标

```json
{
  "createdAt":1439190898729,
  "uptime":5412,
  "sess_conn":9,
  "sess_drop":0,
  "sess_fail":0,
  "sess_pipe_overflow":0,
  "client_req_400":0,
  "client_req_411":0,
  "client_req_413":0,
  "client_req_417":0,
  "client_req":17,
  "cache_hit":0,
  "cache_hitpass":2,
  "cache_miss":3,
  "backend_conn":3,
  "backend_unhealthy":0,
  "backend_busy":0,
  "backend_fail":7,
  "backend_reuse":7,
  "backend_toolate":2,
  "backend_recycle":9,
  "backend_retry":0,
  "fetch_head":0,
  "fetch_length":0,
  "fetch_chunked":9,
  "fetch_eof":0,
  "fetch_bad":0,
  "fetch_close":0,
  "fetch_oldhttp":0,
  "fetch_zero":0,
  "fetch_1xx":0,
  "fetch_204":0,
  "fetch_304":0,
  "fetch_failed":0,
  "pools":2,
  "threads":200,
  "threads_limited":0,
  "threads_created":200,
  "threads_destroyed":0,
  "threads_failed":0,
  "thread_queue_len":0,
  "busy_sleep":0,
  "busy_wakeup":0,
  "sess_queued":0,
  "sess_dropped":0,
  "n_object":2,
  "n_vampireobject":0,
  "n_objectcore":3,
  "n_objecthead":3,
  "n_waitinglist":2,
  "n_backend":3,
  "n_expired":1,
  "n_lru_nuked":0,
  "n_lru_moved":0,
  "losthdr":0,
  "s_sess":9,
  "s_req":17,
  "s_pipe":0,
  "s_pass":13,
  "s_fetch":16,
  "s_synth":1,
  "s_req_hdrbytes":8602,
  "s_req_bodybytes":0,
  "s_resp_hdrbytes":4476,
  "s_resp_bodybytes":10510,
  "s_pipe_hdrbytes":0,
  "s_pipe_in":0,
  "s_pipe_out":0,
  "sess_closed":0,
  "sess_pipeline":0,
  "sess_readahead":0,
  "sess_herd":22,
  "shm_records":8881,
  "shm_writes":7318,
  "shm_flushes":0,
  "shm_cont":2,
  "shm_cycles":0,
  "sms_nreq":0,
  "sms_nobj":0,
  "sms_nbytes":0,
  "sms_balloc":0,
  "sms_bfree":0,
  "backend_req":10,
  "n_vcl":2,
  "n_vcl_avail":2,
  "n_vcl_discard":0,
  "bans":1,
  "bans_completed":1,
  "bans_obj":0,
  "bans_req":0,
  "bans_added":1,
  "bans_deleted":0,
  "bans_tested":0,
  "bans_obj_killed":0,
  "bans_lurker_tested":0,
  "bans_tests_tested":0,
  "bans_lurker_tests_tested":0,
  "bans_lurker_obj_killed":0,
  "bans_dups":0,
  "bans_lurker_contention":0,
  "bans_persisted_bytes":13,
  "bans_persisted_fragmentation":0,
  "n_purges":0,
  "n_obj_purged":0,
  "exp_mailed":3,
  "exp_received":3,
  "hcb_nolock":5,
  "hcb_lock":2,
  "hcb_insert":2,
  "esi_errors":0,
  "esi_warnings":0,
  "vmods":2,
  "n_gzip":9,
  "n_gunzip":0,
  "vsm_free":972032,
  "vsm_used":83962576,
  "vsm_cooling":0,
  "vsm_overflow":0,
  "vsm_overflowed":0
}
```


### /v-vcl

返回当前varnish配置文件内容

```
vcl 4.0;
import std;
import directors;


backend jtvarnish{
  .host = "127.0.0.1";
  .port = "10000";
  .connect_timeout = 3s;
  .first_byte_timeout = 10s;
  .between_bytes_timeout = 2s;
  .probe = {
    .url = "/ping";
    .interval = 3s;
    .timeout = 5s;
    .window = 5;
    .threshold = 3;
  }
}

# backend start
backend supervisor0{
  .host = "192.168.2.2";
  .port = "8010";
  .connect_timeout = 3s;
  .first_byte_timeout = 10s;
  .between_bytes_timeout = 2s;
  .probe = {
    .url = "/ping";
    .interval = 3s;
    .timeout = 5s;
    .window = 5;
    .threshold = 3;
  }
}
# backend end


# ban等操作允许的ip地址，如果允许192.168.55...的ip访问，则为"192.168.55.0"/24;
acl ADMIN {
  "localhost";
}


# init start
sub vcl_init{
  new supervisor = directors.random();
  supervisor.add_backend(supervisor0, 1);
}
# init end


sub vcl_recv {
  call custom_ctrl;
  call ban;
  call purge;

  # 设置x-forwarded-for
  if(req.restarts == 0){
    if(req.http.x-forwarded-for){
      set req.http.x-forwarded-for = req.http.x-forwarded-for + ", " + client.ip;
    }else{
      set req.http.x-forwarded-for = client.ip;
    }
    if(req.http.x-process){
      set req.http.x-process = req.http.x-process + ", varnish-test";
    }else{
      set req.http.x-process = "varnish-test";
    }
  }

  # Normalize the header, remove the port (in case you're testing this on various TCP ports)
  set req.http.Host = regsub(req.http.Host, ":[0-9]+", "");



  # 不同的HOST或url前缀选择不同的backend
  if(req.url ~ "^/supervisor"){
    set req.backend_hint = supervisor.backend();
  }

  # 如果请求类型不是以下几种，使用pipe
  if(req.method != "GET" &&
    req.method != "HEAD" &&
    req.method != "PUT" &&
    req.method != "POST" &&
    req.method != "TRACE" &&
    req.method != "OPTIONS" &&
    req.method != "DELETE"){
    return (pipe);
  }

  # 不缓存数据处理
  if(req.url ~ "^/user" || req.url ~ "\?cache=false" || req.url ~ "&cache=false" || req.http.Cache-Control == "no-cache"){
    return (pass);
  }

  # Normalize the query arguments
  set req.url = std.querysort(req.url);

  # Implementing websocket support (https://www.varnish-cache.org/docs/4.0/users-guide/vcl-example-websockets.html)
  if (req.http.Upgrade ~ "(?i)websocket") {
    return (pipe);
  }

  if(req.http.Authorization){
    return (pass);
  }

  # 如果请求类型不是GET和HEAD，直接pass
  if(req.method != "GET" && req.method != "HEAD"){
    return (pass);
  }

  # Send Surrogate-Capability headers to announce ESI support to backend
  set req.http.Surrogate-Capability = "key=ESI/1.0";

  # 如果能保证到所有其它的请求都是可缓存，无用户无关的，可以使用unset cookie
  # unset req.http.Cookie;
  return (hash);
}


sub vcl_pipe {
  if(req.http.upgrade){
    set bereq.http.upgrade = req.http.upgrade;
  }
  return (pipe);
}


sub vcl_hit{
  if(obj.ttl > 0s){
    return (deliver);
  }
  # 如果backend可用时，在数据过期3s之内使用当前缓存返回
  if(std.healthy(req.backend_hint)){
    if(obj.ttl + 3s > 0s){
      return (deliver);
    }
  }else if(obj.ttl + obj.grace > 0s){
    return (deliver);
  }
  return (fetch);
}


sub vcl_backend_response {
  # 该数据在失效之后，保存多长时间才被删除（用于在服务器down了之后，还可以提供数据给用户）
  set beresp.grace = 30m;
  # 若返回的内容是文本类，则压缩该数据（根据response header的content-type判断）
  if(beresp.http.content-type ~ "text" || beresp.http.content-type ~ "application/javascript" || beresp.http.content-type ~ "application/json"){
    set beresp.do_gzip = true;
  }

  # 如果返回的数据ttl为0，设置为不可缓存
  # 对于Set-Cookie的响应设置为不可缓存
  if(beresp.ttl == 0s || beresp.http.Set-Cookie){
    set beresp.uncacheable = true;
    set beresp.ttl = 120s;
    return (deliver);
  }

  # Pause ESI request and remove Surrogate-Control header
  if (beresp.http.Surrogate-Control ~ "ESI/1.0") {
    unset beresp.http.Surrogate-Control;
    set beresp.do_esi = true;
  }
  return (deliver);
}

sub vcl_deliver {
  # Happens when we have all the pieces we need, and are about to send the
  # response to the client.
  #
  # You can do accounting or modifying the final object here.
  set resp.http.X-hits = obj.hits;
  return (deliver);
}


sub vcl_miss{
  return (fetch);
}


# 生成hash的方法
sub vcl_hash{
  hash_data(req.url);
  if(req.http.host){
    hash_data(req.http.host);
  }else{
    hash_data(server.ip);
  }
  return (lookup);
}


# 自定义的一些url的处理
sub custom_ctrl{
  #响应healthy检测
  if(req.url == "/ping"){
    return(synth(701));
  }
  if(req.url == "/v-servers"){
    return(synth(702));
  }
  if(req.url == "/v-vcl" || req.url == "/v-stats"){
    set req.backend_hint = jtvarnish;
    return(pass);
  }
}


sub vcl_synth {
  set resp.http.Cache-Control = "must-revalidate, max-age=0";
  if(resp.status == 701){
    set resp.status = 200;
    set resp.http.Content-Type = "text/plain; charset=utf-8";
    synthetic("2015-08-10T05:44:50.727Z 3790224399");
  }else if(resp.status == 702){
    set resp.status = 200;
    set resp.http.Content-Type = "text/plain; charset=utf-8";
    synthetic("supervisor,192.168.2.2,8010,,/supervisor");
  }

  return (deliver);
}


# BAN操作
sub ban{
  # 判断请求类型是否为BAN，如果是，判断权限，符合则执行ban操作
  if(req.method == "BAN"){
    if(!client.ip ~ ADMIN){
      return(synth(405, "Not allowed."));
    }
    ban("req.http.host == " + req.http.host + " && req.url ~ " + req.url);
    return(synth(200, "Ban added"));
  }
}


sub purge{
  # Allow purging
  if (req.method == "PURGE") {
    if (!client.ip ~ ADMIN) { # purge is the ACL defined at the begining
      # Not from an allowed IP? Then die with an error.
      return (synth(405, "This IP is not allowed to send PURGE requests."));
    }
    # If you got this stage (and didn't error out above), purge the cached result
    return (purge);
  }
}
```
