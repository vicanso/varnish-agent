backend <%= name %>{
  .host = "<%= ip %>";
  .port = "<%= port %>";
  .connect_timeout = 3s;
  .max_connections = 500;
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