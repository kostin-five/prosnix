const value = process.env.DATABASE_URL;
let url;
try {
  url = new URL(value ?? "");
} catch {
  /* reject below */
}
if (
  !url ||
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  !/(?:^|[_-])test(?:$|[_-])/.test(url.pathname.slice(1))
) {
  console.error(
    "Интеграционные проверки требуют явную локальную DATABASE_URL с test в имени БД. Production запрещён.",
  );
  process.exit(1);
}
