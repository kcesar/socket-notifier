'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { ReactNode, useState } from 'react';

import { Provider } from 'react-redux';
import { UserInfo } from '@/lib/userInfo';
import { AuthActions } from '@/lib/client/store/auth';
import { AppStore, buildStore, useAppDispatch, useAppSelector } from '@/lib/client/store';
import LoginPanel from './LoginPanel';

function InsideStore({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { userInfo } = useAppSelector(state => state.auth);

  children = userInfo ? (
    <>
      <div style={{display:'flex', flexDirection: 'row-reverse'}}>
        <button onClick={() => dispatch(AuthActions.logout())}>logout</button>
      </div>
      {children}
    </>
  ): (<LoginPanel/>);

  return (<>
    {children}
  </>);
}

export default function ClientBody(
  { googleClient, user, children }:
  { googleClient: string, user?: UserInfo, children: ReactNode}
) {
  const [ store ] = useState<AppStore>(buildStore());


  if (!store) {
    return (<>Loading ...</>)
  }

  store.dispatch(AuthActions.set({ userInfo: user }));

  return (
    <Provider store={store}>
      <GoogleOAuthProvider clientId={googleClient}>
        <InsideStore>
          {children}
        </InsideStore>
      </GoogleOAuthProvider>
    </Provider>
  );
}