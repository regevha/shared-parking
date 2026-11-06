import { notification } from 'antd';
import { notifyError } from '../notify';

jest.mock('antd', () => ({ notification: { error: jest.fn() } }));
const mockError = notification.error as jest.Mock;

describe('notifyError', () => {
  it('uses the error message as description', () => {
    notifyError('Title', new Error('boom'), 'fallback');
    expect(mockError).toHaveBeenCalledWith({ message: 'Title', description: 'boom' });
  });
  it('falls back when the error has no message', () => {
    notifyError('Title', {}, 'fallback');
    expect(mockError).toHaveBeenCalledWith({ message: 'Title', description: 'fallback' });
  });
  it('leaves the description empty with no error and no fallback', () => {
    notifyError('Title');
    expect(mockError).toHaveBeenCalledWith({ message: 'Title', description: undefined });
  });
});
