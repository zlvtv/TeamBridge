export default new Proxy(
  {},
  {
    get: (_, prop) => String(prop),
  }
);
