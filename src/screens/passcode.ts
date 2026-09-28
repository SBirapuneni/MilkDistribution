import { DEMO_ADMIN_PASSCODE, DEMO_MODE, DEMO_PASSCODE, getUserName, setToken, setUserName, verifyToken } from '../api';
import { escapeHtml } from '../util';

export function renderPasscode(container: HTMLElement, onSuccess: () => void) {
  container.innerHTML = `
    <div class="passcode-screen">
      <h1>Milk Distribution</h1>
      <form id="passcode-form">
        <input type="text" id="name-input" placeholder="Your name" autocomplete="name" maxlength="50" value="${escapeHtml(getUserName())}" required />
        <input type="password" id="passcode-input" placeholder="Enter passcode" required />
        <button type="submit">Enter</button>
      </form>
      <p id="passcode-error" class="error"></p>
      <a href="#/order" class="small-link">Shop owner? Place your order here &rarr;</a>
      ${DEMO_MODE ? `<p class="hint">Demo mode — no Google Sheet connected. Passcode is "${DEMO_PASSCODE}" (admin passcode for reopening trips: "${DEMO_ADMIN_PASSCODE}"). Data resets on reload.</p>` : ''}
    </div>
  `;

  const form = container.querySelector<HTMLFormElement>('#passcode-form')!;
  const nameInput = container.querySelector<HTMLInputElement>('#name-input')!;
  const input = container.querySelector<HTMLInputElement>('#passcode-input')!;
  const errorEl = container.querySelector<HTMLParagraphElement>('#passcode-error')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  (nameInput.value ? input : nameInput).focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const name = nameInput.value.trim();
    if (!name) {
      errorEl.textContent = 'Enter your name.';
      return;
    }
    submitBtn.disabled = true;
    const value = input.value.trim();
    try {
      await verifyToken(value);
      setUserName(name);
      setToken(value);
      onSuccess();
    } catch (err) {
      const message = (err as Error).message;
      errorEl.textContent = message.startsWith('Too many') ? message : 'Incorrect passcode or server unreachable.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}
