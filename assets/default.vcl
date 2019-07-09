vcl 4.1;
import std;
import directors;

probe basicProbe {
  .url = "/ping";
  .interval = 3s;
  .timeout = 5s;
  .window = 5;
  .threshold = 3;
}

# backend start
backend agentBackend0 {
  .host = "127.0.0.1";
  .port = "4000";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend apiBackend0 {
  .host = "127.0.0.1";
  .port = "3001";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend apiBackend1 {
  .host = "127.0.0.1";
  .port = "3002";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend aslantBackend0 {
  .host = "127.0.0.1";
  .port = "3003";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend aslantBackend1 {
  .host = "127.0.0.1";
  .port = "3004";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend tinyBackend0 {
  .host = "127.0.0.1";
  .port = "3005";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend tinyBackend1 {
  .host = "127.0.0.1";
  .port = "3006";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend defaultBackend0 {
  .host = "127.0.0.1";
  .port = "3007";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend defaultBackend1 {
  .host = "127.0.0.1";
  .port = "3008";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
# backend end


# init start
sub vcl_init {
  new agentBackend = directors.round_robin();
  agentBackend.add_backend(agentBackend0);
  new apiBackend = directors.round_robin();
  apiBackend.add_backend(apiBackend0);
  apiBackend.add_backend(apiBackend1);
  new aslantBackend = directors.fallback();
  aslantBackend.add_backend(aslantBackend0);
  aslantBackend.add_backend(aslantBackend1);
  new tinyBackend = directors.random();
  tinyBackend.add_backend(tinyBackend0, 1.0);
  tinyBackend.add_backend(tinyBackend1, 1.0);
  new defaultBackend = directors.hash();
  defaultBackend.add_backend(defaultBackend0, 1.0);
  defaultBackend.add_backend(defaultBackend1, 1.0);
  return (ok);
}
# init end



#######################################################################
# Client side


sub vcl_recv {
  // custom ctrl, such as ping
  call custom_ctrl;

  if (req.method == "PRI") {
    /* This will never happen in properly formed traffic (see: RFC7540) */
    return (synth(405, "Not Support PRI"));
  }
  if (req.restarts == 0) {
    /* set X-Forwarded-For */
    if (req.http.X-Forwarded-For) {
      set req.http.X-Forwarded-For = req.http.X-Forwarded-For + ", " + client.ip;
    } else {
      set req.http.X-Forwarded-For = client.ip;
    }
  }



  if (req.http.host == "tiny.aslant.site" && (req.url ~ "^/tiny" || req.url ~ "^/@tiny")) {
    set req.backend_hint = tinyBackend.backend();
  } else if ((req.http.host == "aslant.site" || req.http.host == "www.aslant.site")) {
    set req.backend_hint = aslantBackend.backend();
  } else if ((req.url ~ "^/api" || req.url ~ "^/@api")) {
    set req.backend_hint = apiBackend.backend();
  } else if (true) {
    set req.backend_hint = defaultBackend.backend(req.http.cookie);
  }

  if (req.url ~ "^/agent") {
    set req.backend_hint = agentBackend.backend();
  }

  if (req.method != "GET" &&
    req.method != "HEAD" &&
    req.method != "PUT" &&
    req.method != "POST" &&
    req.method != "TRACE" &&
    req.method != "OPTIONS" &&
    req.method != "DELETE") {
    /* Non-RFC2616 or CONNECT which is weird. */
    return (pipe);
  }

  // Implementing websocket support
  if (req.http.Upgrade ~ "(?i)websocket") {
    return (pipe);
  }


  if (req.method != "GET" && req.method != "HEAD") {
    /* We only deal with GET and HEAD by default */
    return (pass);
  }

  /* Not cacheable */
  if (req.http.Authorization) {
    return (pass);
  }


  # sort the query string
  set req.url = std.querysort(req.url);

  return (hash);
}


sub vcl_pipe {
  # By default Connection: close is set on all piped requests, to stop
  # connection reuse from sending future requests directly to the
  # (potentially) wrong backend. If you do want this to happen, you can undo
  # it here.
  # unset bereq.http.connection;
  return (pipe);
}


sub vcl_pass {
  return (fetch);
}


sub vcl_hash {
  hash_data(req.url);
  if (req.http.host) {
    hash_data(req.http.host);
  } else {
    hash_data(server.ip);
  }
  return (lookup);
}


sub vcl_purge {
  return (synth(200, "Purged"));
}


sub vcl_hit {
  # Deliver the object. If it is stale, a background fetch to refresh it is triggered.
  return (deliver);
}


sub vcl_miss {
  return (fetch);
}


sub vcl_deliver {
  # Happens when we have all the pieces we need, and are about to send the
  # response to the client.
  #
  # You can do accounting or modifying the final object here.
  set resp.http.X-Hits = obj.hits;
  unset resp.http.Via;

  return (deliver);
}



# custom control
sub custom_ctrl{
  #响应healthy检测
  if(req.url == "/ping"){
    return(synth(200, "pong"));
  }
}


sub vcl_synth {
  set resp.http.Cache-Control = "no-store, no-cache, must-revalidate, max-age=0";
  set resp.http.Content-Type = "text/plain; charset=utf-8";
  set resp.body = resp.reason;
  return (deliver);
}


#######################################################################
# Backend Fetch

sub vcl_backend_fetch {

  return (fetch);
}

sub vcl_backend_response {
  # the response body is text, do gzip (judge by response header Content-Type)
  if (!beresp.http.Content-Encoding) {
    if (beresp.http.Content-Type ~ "text" ||
      beresp.http.Content-Type ~ "javascript" ||
      beresp.http.Content-Type ~ "json") {
      set beresp.do_gzip = true;
    }
  }
  if (bereq.uncacheable) {
    return (deliver);
  }
  # The following scenarios set uncacheable
  if (beresp.ttl <= 0s ||
      beresp.http.Set-Cookie ||
      !beresp.http.Cache-Control ||
      beresp.http.Cache-Control ~ "(?i:no-cache|no-store|private)" ||
      beresp.http.Vary == "*") {
    # Hit-For-Pass
    set beresp.uncacheable = true;
    set beresp.ttl = 300s;
    set beresp.grace = 0s;
    return (deliver);
  }

  return (deliver);
}

# convert error response to json
sub vcl_backend_error {
  if (!beresp.http.Content-Type ~ "application/json") {
    set beresp.http.Content-Type = "application/json; charset=utf-8";
    set beresp.body = {"{
  "message": ""} + beresp.reason + {"",
  "statusCode": "} + beresp.status + {"
}
"};
  }
  return (deliver);
}