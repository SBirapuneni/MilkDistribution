import { DEMO_MODE, DEMO_PASSCODE, setToken, verifyToken } from '../api';

export function renderPasscode(container: HTMLElement, onSuccess: () => void) {
  container.innerHTML = `
    <div class="passcode-screen">
      <h1>Milk Distribution</h1>
      <form id="passcode-form">
        <input type="password" id="passcode-input" placeholder="Enter passcode" autofocus required />
        <button type="submit">Enter</button>
      </form>
      <p id="passcode-error" class="error"></p>
      ${DEMO_MODE ? `<p class="hint">Demo mode — no Google Sheet connected. Passcode is "${DEMO_PASSCODE}". Data resets on reload.</p>` : ''}
    </div>
  `;

  const form = container.querySelector<HTMLFormElement>('#passcode-form')!;
  const input = container.querySelector<HTMLInputElement>('#passcode-input')!;
  const errorEl = container.querySelector<HTMLParagraphElement>('#passcode-error')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    submitBtn.disabled = true;
    const value = input.value.trim();
    try {
      await verifyToken(value);
      setToken(value);
      onSuccess();
    } catch {
      errorEl.textContent = 'Incorrect passcode or server unreachable.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}
