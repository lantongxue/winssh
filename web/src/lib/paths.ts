export function withBasePath(path = '') {
  const normalizedBase = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return new URL(path, `https://winssh.local${normalizedBase}`).pathname
}
