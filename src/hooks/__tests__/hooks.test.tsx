import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthContext } from '../../contexts/AuthContext';
import { usePermissions } from '../usePermissions';
import { useIsMobile } from '../useIsMobile';
import { makeUser, makeOwnerUser, makeManagerUser } from '../../test-utils/fixtures';
import { UserRole } from '../../types/enums';

const wrap = (user: ReturnType<typeof makeUser> | null) =>
  ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={{ user, token: null, authLoading: false, login: jest.fn(), logout: jest.fn(), updateUser: jest.fn() }}>
      {children}
    </AuthContext.Provider>
  );

describe('usePermissions', () => {
  it.each([
    [makeUser(), UserRole.USER, false, false],
    [makeOwnerUser(), UserRole.OWNER, true, false],
    [makeManagerUser(), UserRole.MANAGER, false, true],
    [null, UserRole.USER, false, false],
  ])('maps %# to role flags', (user, role, isOwner, isManager) => {
    const { result } = renderHook(() => usePermissions(), { wrapper: wrap(user as never) });
    expect(result.current).toEqual({ role, isOwner, isManager });
  });
});

describe('useIsMobile', () => {
  it('follows the media query and reacts to changes', () => {
    let listener: ((e: MediaQueryListEvent) => void) | undefined;
    const original = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: (_: string, l: never) => { listener = l; },
      removeEventListener: jest.fn(),
    })) as never;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    act(() => listener!({ matches: false } as MediaQueryListEvent));
    expect(result.current).toBe(false);
    window.matchMedia = original;
  });
});
