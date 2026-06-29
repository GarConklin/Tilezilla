/** Show/hide passphrase fields on login and create passport screens. */

export function initPasswordRevealToggles(root = document) {
  root.querySelectorAll('[data-pass-reveal-for]').forEach((btn) => {
    const inputId = btn.getAttribute('data-pass-reveal-for');
    const input = root.getElementById(inputId);
    if (!input) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const showing = input.type === 'password';
      input.type = showing ? 'text' : 'password';
      btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
      btn.setAttribute('aria-label', showing ? 'Hide passphrase' : 'Show passphrase');
    });
  });
}
