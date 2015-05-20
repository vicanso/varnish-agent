vcl 4.0;
import std;
import directors;


# backend start
<%= backendConfig %>
# backend end


# ban等操作允许的ip地址，如果允许192.168.55...的ip访问，则为"192.168.55.0"/24;
acl ADMIN {
  "localhost";
}


# init start
<%= initConfig %>
# init end


sub vcl_recv {
  call health_check;
  call ban;
  call purge;

  # 设置x-forwarded-for
  if(req.restarts == 0){
    if(req.http.x-forwarded-for){
      set req.http.X-Forwarded-For = req.http.X-Forwarded-For + ", " + client.ip;
    }else{
      set req.http.X-Forwarded-For = client.ip;
    }
  }

  # Normalize the header, remove the port (in case you're testing this on various TCP ports)
  set req.http.Host = regsub(req.http.Host, ":[0-9]+", "");

  # Normalize the query arguments
  set req.url = std.querysort(req.url);

  # 不同的HOST或url前缀选择不同的backend
<%= backendSelectConfig %>

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
  if(req.url ~ "^/user" || req.url ~ "\?cache=false" || req.url ~ "&cache=false"){
    return (pass);
  }

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
  # 如果backend可用时，在数据过期30s之内使用当前缓存返回
  if(std.healthy(req.backend_hint)){
    if(obj.ttl + 30s > 0s){
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


# 用于检测varnish是否可用
sub health_check{
  #响应healthy检测
  if(req.url == "/ping"){
    return(synth(200, "<%= version %>"));
  }
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