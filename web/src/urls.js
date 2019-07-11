function getURLPrefix() {
  let prefix = "";
  const { pathname } = window.location;
  if (pathname !== "/") {
    const arr = pathname.split("/");
    prefix = `/${arr[1]}`;
  }
  return prefix;
}

const urlPrefix = getURLPrefix();

export const DIRECTORS = `${urlPrefix}/directors`;
export const VCL = `${urlPrefix}/vcl`;
export const CONFIG = `${urlPrefix}/config`;
