import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LanguageSwitcher } from '../LanguageSwitcher';
import i18n from '../../../i18n';
import { LANGUAGES } from '@ap/shared-constants';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    i18n.changeLanguage(LANGUAGES.EN);
  });

  it('renders all language options in native script and switches language', async () => {
    render(<LanguageSwitcher />);

    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    expect(screen.getByText('ગુજરાતી')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('हिन्दी').click();
    });

    expect(i18n.language).toBe(LANGUAGES.HI);
    expect(localStorage.getItem('ap_language')).toBe(LANGUAGES.HI);

    await act(async () => {
      screen.getByText('ગુજરાતી').click();
    });

    expect(i18n.language).toBe(LANGUAGES.GU);
    expect(localStorage.getItem('ap_language')).toBe(LANGUAGES.GU);
  });
});

