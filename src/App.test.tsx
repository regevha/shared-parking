import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// When localStorage has no token the AuthProvider sets authLoading=false
// immediately without making any API calls, so the Login page renders
// straight away — no mocking required.
test('renders the Login page when unauthenticated', async () => {
  localStorage.clear();
  render(<App />);
  expect(await screen.findByText(/Parking Management/i)).toBeInTheDocument();
});
