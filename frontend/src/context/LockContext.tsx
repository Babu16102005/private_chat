import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { pinLockService } from '../services/pinLockService';

type LockContextValue = {
  isPinEnabled: boolean;
  isLocked: boolean;
  refreshLockState: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lockNow: () => void;
};

const LockContext = createContext<LockContextValue | undefined>(undefined);

export const LockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const refreshLockState = async () => {
    const enabled = await pinLockService.isEnabled();
    setIsPinEnabled(enabled);
    setIsLocked(enabled);
  };

  useEffect(() => {
    refreshLockState();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        pinLockService.isEnabled().then((enabled) => {
          setIsPinEnabled(enabled);
          if (enabled) setIsLocked(true);
        });
      }
    });
    return () => sub.remove();
  }, []);

  const setPin = async (pin: string) => {
    await pinLockService.setPin(pin);
    setIsPinEnabled(true);
    setIsLocked(false);
  };

  const disablePin = async () => {
    await pinLockService.clearPin();
    setIsPinEnabled(false);
    setIsLocked(false);
  };

  const unlock = async (pin: string) => {
    const ok = await pinLockService.verifyPin(pin);
    if (ok) setIsLocked(false);
    return ok;
  };

  return (
    <LockContext.Provider value={{ isPinEnabled, isLocked, refreshLockState, setPin, disablePin, unlock, lockNow: () => setIsLocked(true) }}>
      {children}
    </LockContext.Provider>
  );
};

export const useLock = () => {
  const value = useContext(LockContext);
  if (!value) throw new Error('useLock must be used within LockProvider');
  return value;
};
