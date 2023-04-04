import { configureStore, combineReducers } from '@reduxjs/toolkit';
import type { ThunkAction, Action } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './auth';

function buildReducers() {
  const rootReducer = combineReducers({
    auth: authReducer,
  });
  return rootReducer;
}

export function buildStore() {
  return configureStore({
    reducer: buildReducers(),
  });
}

export type AppStore = ReturnType<typeof buildStore>;
export type AppDispatch = AppStore['dispatch'];
type ClientReducerType = ReturnType<typeof buildReducers>;
export type RootState = ReturnType<ClientReducerType>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;