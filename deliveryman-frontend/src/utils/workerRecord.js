// The worker's public record and the minimums an establishment sets for an order.

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

// GlobalReputation.workers(worker): totalScore, totalRatings, completedOrders,
// leftOrders, ratingsAfterLeaving. `average` is on the x10 scale (45 = 4.5), as the
// contract computes it, or null without ratings.
export function workerRecord(raw) {
  if (!raw) return null;
  const totalScore = count(raw.totalScore !== undefined ? raw.totalScore : raw[0]);
  const totalRatings = count(raw.totalRatings !== undefined ? raw.totalRatings : raw[1]);
  return {
    average: totalRatings > 0 ? Math.floor((totalScore * 10) / totalRatings) : null,
    totalRatings,
    completedOrders: count(raw.completedOrders !== undefined ? raw.completedOrders : raw[2]),
    leftOrders: count(raw.leftOrders !== undefined ? raw.leftOrders : raw[3]),
    ratingsAfterLeaving: count(raw.ratingsAfterLeaving !== undefined ? raw.ratingsAfterLeaving : raw[4]),
  };
}

export function averageText(record) {
  if (!record || record.average === null) return 'No ratings yet';
  return `${(record.average / 10).toFixed(1)} ★ (${record.totalRatings} ${record.totalRatings === 1 ? 'rating' : 'ratings'})`;
}

// Whether a worker meets an order's minimums, by the rule of confirmIntention.
// `reputation` is the answer of Chain.getWorkerReputation: average x10, number of
// ratings, deliveries. A minimum score also needs at least one rating.
export function qualification(reputation, minReputation, minOrders) {
  const minScore = count(minReputation);
  const minDeliveries = count(minOrders);
  if (!reputation || (minScore === 0 && minDeliveries === 0)) return { qualified: true, reason: null };

  const average = count(reputation[0]);
  const ratings = count(reputation[1]);
  const deliveries = count(reputation[2]);
  const reasons = [];
  if (minScore > 0 && ratings === 0) {
    reasons.push(`Requires ${(minScore / 10).toFixed(1)}★ (you have no ratings yet)`);
  } else if (minScore > 0 && average < minScore) {
    reasons.push(`Requires ${(minScore / 10).toFixed(1)}★ (you have ${(average / 10).toFixed(1)}★)`);
  }
  if (minDeliveries > 0 && deliveries < minDeliveries) {
    reasons.push(`Requires ${minDeliveries} deliveries (you have ${deliveries})`);
  }
  return { qualified: reasons.length === 0, reason: reasons.length ? reasons.join(' · ') : null };
}
