import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import WorkerRatings from './index';

const WORKER_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const WORKER_2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

const state = (worker, outcome, score) => ({
  worker: worker, known: true, outcome: outcome, score: score, rated: score > 0, canRate: outcome >= 2 && score === 0,
});

describe('WorkerRatings', () => {
  it('renders nothing without workers, and for workers the order reported nothing about', () => {
    expect(render(<WorkerRatings workers={[]} onRate={() => {}} />).container.firstChild).toBeNull();
    expect(render(<WorkerRatings workers={undefined} onRate={() => {}} />).container.firstChild).toBeNull();
    expect(render(<WorkerRatings workers={[state(WORKER_1, 0, 0)]} onRate={() => {}} />).container.firstChild).toBeNull();
    const unknown = { worker: WORKER_1, known: false, outcome: null, score: 0, rated: false, canRate: false };
    expect(render(<WorkerRatings workers={[unknown]} onRate={() => {}} />).container.firstChild).toBeNull();
  });

  it('offers five scores for the worker who delivered and sends the one chosen', () => {
    const rated = [];
    const { container, getByLabelText } = render(
      <WorkerRatings workers={[state(WORKER_1, 3, 0)]} busyWorker={null} onRate={(worker, score) => rated.push([worker, score])} />
    );
    expect(container.textContent).toContain(WORKER_1 + ' delivered this order.');
    expect(container.querySelectorAll('button')).toHaveLength(5);
    expect(container.textContent).toContain('A rating is public');
    expect(container.textContent).not.toMatch(/anonym/i);
    fireEvent.click(getByLabelText('4 of 5'));
    expect(rated).toEqual([[WORKER_1, 4]]);
  });

  it('shows the score already given and no button', () => {
    const { container } = render(<WorkerRatings workers={[state(WORKER_1, 3, 2)]} onRate={() => {}} />);
    expect(container.textContent).toContain('You rated them ★★ (2 of 5).');
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.textContent).not.toContain('A rating is public');
  });

  it('shows each worker of a reopened order: the first cannot be rated by the customer, the second can', () => {
    const rated = [];
    const { container } = render(
      <WorkerRatings workers={[state(WORKER_1, 1, 0), state(WORKER_2, 3, 0)]} onRate={(worker, score) => rated.push([worker, score])} />
    );
    expect(container.textContent).toContain(WORKER_1 + ' left this order before pickup.');
    expect(container.textContent).toContain('Only the establishment can rate a worker who left before pickup.');
    expect(container.textContent).toContain(WORKER_2 + ' delivered this order.');
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(5);
    fireEvent.click(buttons[0]);
    expect(rated).toEqual([[WORKER_2, 1]]);
  });

  it('offers a rating for a worker who left after pickup', () => {
    const { container } = render(<WorkerRatings workers={[state(WORKER_1, 2, 0)]} onRate={() => {}} />);
    expect(container.textContent).toContain(WORKER_1 + ' left this order after pickup.');
    expect(container.querySelectorAll('button')).toHaveLength(5);
  });

  it('shows no button for the worker whose rating is being sent, and disables the others', () => {
    const rated = [];
    const { container } = render(
      <WorkerRatings workers={[state(WORKER_1, 2, 0), state(WORKER_2, 3, 0)]} busyWorker={WORKER_1}
        onRate={(worker, score) => rated.push([worker, score])} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(5);
    buttons.forEach(button => expect(button.disabled).toBe(true));
    fireEvent.click(buttons[2]);
    expect(rated).toEqual([]);
  });
});
