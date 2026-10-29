import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { THEMES } from '@ap/shared-constants';

function TestConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolvedTheme">{resolvedTheme}</span>
      <button onClick={() => setTheme(THEMES.DARK)}>Set Dark</button>
      <button onClick={() => setTheme(THEMES.LIGHT)}>Set Light</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to system theme and persists theme changes to localStorage', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme').textContent).toBe(THEMES.SYSTEM);

    act(() => {
      screen.getByText('Set Dark').click();
    });

    expect(screen.getByTestId('theme').textContent).toBe(THEMES.DARK);
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('dark');
    expect(localStorage.getItem('ap_theme')).toBe(THEMES.DARK);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      screen.getByText('Set Light').click();
    });

    expect(screen.getByTestId('theme').textContent).toBe(THEMES.LIGHT);
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('light');
    expect(localStorage.getItem('ap_theme')).toBe(THEMES.LIGHT);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
