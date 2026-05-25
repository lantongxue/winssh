export function withBasePath(path = '') {
  const base = import.meta.env.BASE_URL
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return new URL(path, `https://winssh.local${normalizedBase}`).pathname
}
