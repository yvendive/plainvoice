import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuyForm } from '@/components/BuyForm';

vi.mock('next-intl', () => ({
  useTranslations: vi.fn().mockImplementation((ns: string) => (key: string) => `${ns}.${key}`),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    <a href={href}>{children}</a>,
}));

const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

describe('BuyForm', () => {
  it('renders the buy button', () => {
    render(<BuyForm locale="de" />);
    expect(screen.getByRole('button', { name: /Buy\.buyButton/ })).toBeInTheDocument();
  });

  it('button is disabled initially (no email, no consent)', () => {
    render(<BuyForm locale="de" />);
    const btn = screen.getByRole('button', { name: /Buy\.buyButton/ });
    expect(btn).toBeDisabled();
  });

  it('button stays disabled with valid email but no consent', async () => {
    render(<BuyForm locale="de" />);
    const emailInput = screen.getByRole('textbox');
    await userEvent.type(emailInput, 'test@example.com');
    const btn = screen.getByRole('button', { name: /Buy\.buyButton/ });
    expect(btn).toBeDisabled();
  });

  it('button stays disabled with consent but invalid email', async () => {
    render(<BuyForm locale="de" />);
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    const btn = screen.getByRole('button', { name: /Buy\.buyButton/ });
    expect(btn).toBeDisabled();
  });

  it('button becomes enabled when email is valid AND consent is ticked', async () => {
    render(<BuyForm locale="de" />);
    const emailInput = screen.getByRole('textbox');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.click(checkbox);
    const btn = screen.getByRole('button', { name: /Buy\.buyButton/ });
    expect(btn).not.toBeDisabled();
  });

  it('POSTs the correct body shape to the Worker on submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/test' }),
    });

    // Intercept location change
    const originalLocation = window.location;
    const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, href: '' } });

    render(<BuyForm locale="de" />);
    const emailInput = screen.getByRole('textbox');
    const checkbox = screen.getByRole('checkbox');

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: /Buy\.buyButton/ }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/checkout');
    const body = JSON.parse(opts.body as string);
    expect(body.email).toBe('user@example.com');
    expect(body.locale).toBe('de');
    expect(body.consentWaiver).toBe(true);
    expect(typeof body.consentTimestamp).toBe('string');

    // restore
    if (locationDescriptor) Object.defineProperty(window, 'location', locationDescriptor);
  });

  it('shows error message when Worker call fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    render(<BuyForm locale="de" />);
    const emailInput = screen.getByRole('textbox');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: /Buy\.buyButton/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Buy.errorGeneric');
  });
});
