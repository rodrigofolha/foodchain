import React from 'react';
import { CircularProgress } from '@material-ui/core';
import { RatingsContainer, StarButton } from './styles';
import { outcomeText, OUTCOME_LEFT_BEFORE_PICKUP } from '../../utils/orderWorkers';

// The workers of an order the customer can rate or has rated, one block each.
// `workers` are the states of readWorkerRatings; `busyWorker` is the worker whose
// rating is being sent; `onRate(worker, score)` sends one.
export default function WorkerRatings({ workers, busyWorker, onRate }) {
  const shown = (workers || []).filter(state => state.known && outcomeText(state.outcome));
  if (shown.length === 0) return null;

  return (
    <RatingsContainer>
      {shown.map(state => (
        <div className="worker" key={state.worker}>
          <p>Delivery worker <span className="worker-address">{state.worker}</span> {outcomeText(state.outcome)}.</p>
          {state.rated ? <p>You rated them {'★'.repeat(state.score)} ({state.score} of 5).</p> : null}
          {state.canRate && busyWorker === state.worker ? <CircularProgress size={20} /> : null}
          {state.canRate && busyWorker !== state.worker ? (
            <div>
              <p>Rate them:</p>
              {[1, 2, 3, 4, 5].map(score => (
                <StarButton key={score} disabled={!!busyWorker} aria-label={score + ' of 5'}
                  onClick={() => onRate(state.worker, score)}>{'★'.repeat(score)}</StarButton>
              ))}
            </div>
          ) : null}
          {state.outcome === OUTCOME_LEFT_BEFORE_PICKUP
            ? <p>Only the establishment can rate a worker who left before pickup.</p> : null}
        </div>
      ))}
      {shown.some(state => state.canRate)
        ? <p>A rating is public: anyone can see the order, the worker, the score and that the customer gave it. It cannot be changed.</p>
        : null}
    </RatingsContainer>
  );
}
