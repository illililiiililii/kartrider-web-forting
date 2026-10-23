import {readAccountSession} from './account-session.mjs';
const form = document.querySelector('#account-form');
const message = document.querySelector('#message');
const buttons = [...document.querySelectorAll('button')];

async function submitAccount(action) {
  if (!form.reportValidity()) return;
  buttons.forEach((button) => { button.disabled = true; });
  message.textContent = '계정 서버 확인 중…';
  try {
    const response = await fetch(`/api/auth/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: form.elements.handle.value.trim(),
        password: form.elements.password.value,
      }),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('계정 서버가 실행 중이지 않습니다. node server.mjs로 실행하세요.');
    }
    const result = await response.json();
    if (!response.ok) {
      const errors = {
        HANDLE_TAKEN: '이미 사용 중인 로그인 아이디입니다.',
        INVALID_CREDENTIALS: '로그인 아이디 또는 비밀번호가 맞지 않습니다. 닉네임 변경 후에도 가입할 때의 아이디를 사용하세요.',
        RATE_LIMITED: '시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
        INVALID_CREDENTIAL_FORMAT: '이름은 3~20자, 비밀번호는 8~128자로 입력하세요.',
      };
      throw new Error(errors[result.error] || `로그인 요청 실패 (${response.status})`);
    }
    if(!await readAccountSession())throw new Error('로그인 쿠키가 저장되지 않았습니다. 브라우저의 쿠키 설정을 확인해 주세요.');
    location.assign('/');
  } catch (error) {
    message.textContent = error.message;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

form.addEventListener('submit', (event) => { event.preventDefault(); submitAccount('login'); });
document.querySelector('#register-button').addEventListener('click', () => submitAccount('register'));
