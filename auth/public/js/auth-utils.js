async function checkAuthentication() {
  try {
    const response = await fetch('/api/check-session.php');
    if (!response.ok) {
      return { authenticated: false, user: null };
    }
    const data = await response.json();
    return {
      authenticated: !!data.authenticated,
      user: data.user || null,
    };
  } catch (e) {
    return { authenticated: false, user: null };
  }
}

async function logout() {
  await fetch('/api/logout.php', { method: 'POST' });
  window.location.href = '/login.html';
}

async function requireAuth(returnPath) {
  const auth = await checkAuthentication();
  if (!auth.authenticated) {
    const ret = returnPath || location.pathname + location.search;
    window.location.href = '/login.html?return=' + encodeURIComponent(ret);
    return null;
  }
  return auth.user;
}
