document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('errorMessage');
  const successEl = document.getElementById('successMessage');
  const button = document.getElementById('registerButton');
  errorEl.className = 'msg';
  successEl.className = 'msg';
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;

  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match.';
    errorEl.className = 'msg error';
    return;
  }

  button.disabled = true;
  button.textContent = 'Creating account…';

  try {
    const response = await fetch('/api/register.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    if (!data.success) {
      errorEl.textContent = data.error || 'Registration failed';
      errorEl.className = 'msg error';
      button.disabled = false;
      button.textContent = 'Create account';
      return;
    }
    successEl.textContent = data.message || 'Check your email to verify your account.';
    successEl.className = 'msg success';
    button.textContent = 'Account created';
  } catch (err) {
    errorEl.textContent = 'Registration failed. Please try again.';
    errorEl.className = 'msg error';
    button.disabled = false;
    button.textContent = 'Create account';
  }
});
