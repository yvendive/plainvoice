import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnlockForm } from '@/components/UnlockForm';

vi.mock('next-intl', () => ({
  useTranslations: vi.fn().mockImplementation((ns: string) => (key: string) => `${ns}.${key}`),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
  mockPush.mockReset();
  localStorage.clear();
  // shouldAdvanceTime lets waitFor's internal setTimeout still fire
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UnlockForm', () => {
  it('renders the activate button and key textarea', () => {
    render(<UnlockForm locale="de" />);
    expect(screen.getByRole('button', { name: /Unlock\.activateButton/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('button is disabled when textarea is empty', () => {
    render(<UnlockForm locale="de" />);
    expect(screen.getByRole('button', { name: /Unlock\.activateButton/ })).toBeDisabled();
  });

  it('happy path: valid key writes localStorage and redirects after 2s', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true }),
    });

    render(<UnlockForm locale="de" />);
    await userEvent.type(screen.getByRole('textbox'), 'VALID-LICENSE-KEY-22CH');
    await userEvent.click(screen.getByRole('button', { name: /Unlock\.activateButton/ }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Unlock.stateSuccess'),
    );

    expect(localStorage.getItem('plainvoice.pro')).toBe('1');
    expect(localStorage.getItem('plainvoice.pro.key')).toBe('VALID-LICENSE-KEY-22CH');

    // Advance the 2-second redirect timer
    await vi.runAllTimersAsync();
    expect(mockPush).toHaveBeenCalledWith('/de');
  });

  it('invalid key: shows error-invalid message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: false }),
    });

    render(<UnlockForm locale="de" />);
    await userEvent.type(screen.getByRole('textbox'), 'WRONG-KEY');
    await userEvent.click(screen.getByRole('button', { name: /Unlock\.activateButton/ }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Unlock.errorInvalid');
    expect(localStorage.getItem('plainvoice.pro')).toBeNull();
  });

  it('network error: shows retry message', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));

    render(<UnlockForm locale="de" />);
    await userEvent.type(screen.getByRole('textbox'), 'SOME-KEY');
    await userEvent.click(screen.getByRole('button', { name: /Unlock\.activateButton/ }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Unlock.errorNetwork');
  });

  it('EN locale: redirect goes to /en after success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true }),
    });

    render(<UnlockForm locale="en" />);
    await userEvent.type(screen.getByRole('textbox'), 'VALID-LICENSE-KEY-22CH');
    await userEvent.click(screen.getByRole('button', { name: /Unlock\.activateButton/ }));

    await waitFor(() => screen.getByRole('status'));
    await vi.runAllTimersAsync();
    expect(mockPush).toHaveBeenCalledWith('/en');
  });
});
