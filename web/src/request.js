import axios from "axios";

const ins = axios.create();

ins.interceptors.request.use(config => {
  if (!config.timeout) {
    config.timeout = 10 * 1000;
  }
  return config;
});

ins.interceptors.response.use(null, err => {
  const { response } = err;
  if (response) {
    if (response.data && response.data.message) {
      err.message = response.data.message;
    } else {
      err.message = `unknown error[${response.statusCode || -1}]`;
    }
  }
  return Promise.reject(err);
});

export default ins;
