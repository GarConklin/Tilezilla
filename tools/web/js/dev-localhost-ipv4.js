/** Windows + Docker: localhost often resolves to ::1 while Tilezilla listens on IPv4 only. */
(function () {
  if (location.hostname !== 'localhost') return;
  const port = location.port ? `:${location.port}` : '';
  location.replace(
    `${location.protocol}//127.0.0.1${port}${location.pathname}${location.search}${location.hash}`,
  );
})();
