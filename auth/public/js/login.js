document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('errorMessage');
  const button = document.getElementById('loginButton');
  errorEl.className = 'msg';
  errorEl.style.display = 'none';
  button.disabled = true;
  button.textContent = 'Logging in…';

  try {
    const response = await fetch('/api/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
      }),
    });
    const data = await response.json();
    if (!data.success) {
      errorEl.textContent = data.error || 'Login failed';
      errorEl.className = 'msg error';
      button.disabled = false;
      button.textContent = 'Log in';
      return;
    }
    const params = new URLSearchParams(location.search);
    const ret = params.get('return') || 'web/index.html';
    window.location.href = ret;
  } catch (err) {
    errorEl.textContent = 'Login failed. Please try again.';
    errorEl.className = 'msg error';
    button.disabled = false;
    button.textContent = 'Log in';
  }
});
