'use client';

import { useAppDispatch } from '@/lib/client/store';
import { AuthActions } from '@/lib/client/store/auth';
import { CredentialResponse, GoogleLogin } from '@react-oauth/google';

export default function LoginPanel() {
  const dispatch = useAppDispatch();

  async function doLogin(data: CredentialResponse) {
    if (!data || !data.credential) {
      throw new Error('login error');
    }
    return await finishLogin(data.credential);
  }
  
  async function finishLogin(token: string) {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const result = await res.json();
      if (res.status === 200) {
        dispatch(AuthActions.set({ userInfo: result }));
      } else {
        alert('Can\'t login: ' + (result.message ?? 'unknown error'));
      }


    } catch (err: unknown) {
      console.log('error logging in')
    }
  }

  return (
    <GoogleLogin
        onSuccess={doLogin}
        onError={() => console.log('Google error')}
      />
  );
}