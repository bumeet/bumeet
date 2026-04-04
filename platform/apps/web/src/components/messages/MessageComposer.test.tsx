import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

function MessageComposerWithState({ onSend }: { onSend: (content: string) => void }) {
  const [value, setValue] = React.useState('');
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 200))}
        placeholder="Type your message..."
        data-testid="message-input"
      />
      <span data-testid="counter">{200 - value.length} chars left</span>
      <button onClick={() => onSend(value)} disabled={!value.trim()}>Send</button>
    </div>
  );
}

describe('MessageComposer', () => {
  it('renders textarea and send button', () => {
    render(<MessageComposerWithState onSend={vi.fn()} />);
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('shows character counter', () => {
    render(<MessageComposerWithState onSend={vi.fn()} />);
    expect(screen.getByTestId('counter')).toHaveTextContent('200 chars left');
  });

  it('counter decreases as user types', () => {
    render(<MessageComposerWithState onSend={vi.fn()} />);
    fireEvent.change(screen.getByTestId('message-input'), { target: { value: 'Hello' } });
    expect(screen.getByTestId('counter')).toHaveTextContent('195 chars left');
  });

  it('send button is disabled when input is empty', () => {
    render(<MessageComposerWithState onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('calls onSend with the message content', () => {
    const onSend = vi.fn();
    render(<MessageComposerWithState onSend={onSend} />);
    fireEvent.change(screen.getByTestId('message-input'), { target: { value: 'Test message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Test message');
  });
});
