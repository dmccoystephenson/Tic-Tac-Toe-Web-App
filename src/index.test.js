import { act, screen } from '@testing-library/react';

test('the game is mounted into the #root element', () => {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  act(() => {
    require('./index');
  });
  expect(root.contains(screen.getByRole('status'))).toBe(true);
  expect(screen.getByRole('status').textContent).toBe('Next player: X');
});
