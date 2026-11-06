import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BroadcastSection from '../BroadcastSection';
import { notificationsApi } from '../../../api/notifications';

jest.mock('../../../api/notifications', () => ({ notificationsApi: { broadcast: jest.fn() } }));
const mockBroadcast = notificationsApi.broadcast as jest.Mock;

const sendButton = () => screen.getByRole('button', { name: /send/i });
const messageBox = () => screen.getByRole('textbox');

beforeEach(() => jest.clearAllMocks());

describe('BroadcastSection', () => {
  it('disables Send until a message is typed', () => {
    render(<BroadcastSection />);
    expect(sendButton()).toBeDisabled();
    fireEvent.change(messageBox(), { target: { value: 'Hello' } });
    expect(sendButton()).toBeEnabled();
  });

  it('sends to the default audience "both", then clears the message', async () => {
    mockBroadcast.mockResolvedValue({ status: 'ok', delivered_to: 3 });
    render(<BroadcastSection />);
    fireEvent.change(messageBox(), { target: { value: 'Hello' } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(mockBroadcast).toHaveBeenCalledWith('both', 'Hello'));
    await waitFor(() => expect(messageBox()).toHaveValue(''));
  });

  it('keeps the message and shows no clear when the API fails', async () => {
    mockBroadcast.mockRejectedValue(new Error('nope'));
    render(<BroadcastSection />);
    fireEvent.change(messageBox(), { target: { value: 'Hello' } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(mockBroadcast).toHaveBeenCalled());
    expect(messageBox()).toHaveValue('Hello');
  });

  it('blocks sending while the blackout simulation is on', () => {
    render(<BroadcastSection />);
    fireEvent.change(messageBox(), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('switch'));
    expect(sendButton()).toBeDisabled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
