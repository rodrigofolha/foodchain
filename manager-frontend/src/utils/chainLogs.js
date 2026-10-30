// Event queries that public RPC endpoints accept.
// Each query names a contract address: publicnode refuses an eth_getLogs without one over more
// than a single block, and one that names more than 10 addresses (ADDRESS_BATCH). Each query
// covers at most MAX_BLOCK_SPAN blocks: publicnode allows 50,000.
export var MAX_BLOCK_SPAN = 45000;
export var ADDRESS_BATCH = 10;
var ORDER_ZONE_SIGNATURE = 'OrderZone(address,string)';

// eth_getLogs over the filter's range in windows of at most MAX_BLOCK_SPAN blocks. With toBlock
// 'latest' (or none) the last window ends at 'latest'. If the chain head cannot be read, or the
// range fits in one window, a single query is made with the filter exactly as given.
export async function getLogsChunked(logWeb3, filter) {
  var from = Number(filter.fromBlock || 0);
  var toLatest = filter.toBlock === undefined || filter.toBlock === null || filter.toBlock === 'latest';
  var head;
  if (toLatest) {
    try { head = Number(await logWeb3.eth.getBlockNumber()); } catch (e) { head = NaN; }
  } else {
    head = Number(filter.toBlock);
  }
  if (!Number.isFinite(head) || head - from + 1 <= MAX_BLOCK_SPAN) {
    return logWeb3.eth.getPastLogs(filter);
  }
  var logs = [];
  for (var start = from; start <= head; start += MAX_BLOCK_SPAN) {
    var end = start + MAX_BLOCK_SPAN - 1;
    var last = end >= head;
    var part = await logWeb3.eth.getPastLogs(Object.assign({}, filter, {
      fromBlock: start,
      toBlock: last && toLatest ? 'latest' : Math.min(end, head)
    }));
    logs = logs.concat(part || []);
  }
  return logs;
}

// The orders that Chain created, from its OrderZone events (one per order with a zone).
export async function chainOrderAddresses(logWeb3, chainAddress, fromBlock) {
  var topic = logWeb3.utils.keccak256(ORDER_ZONE_SIGNATURE);
  var logs = await getLogsChunked(logWeb3, { address: chainAddress, fromBlock: fromBlock, toBlock: 'latest', topics: [topic] });
  var seen = {};
  var orders = [];
  (logs || []).forEach(function(log) {
    if (!log || !log.topics || log.topics.length < 2) return;
    if (log.address && String(log.address).toLowerCase() !== String(chainAddress).toLowerCase()) return;
    var order = '0x' + String(log.topics[1]).slice(-40);
    var key = order.toLowerCase();
    if (!seen[key]) { seen[key] = true; orders.push(order); }
  });
  return orders;
}

// The logs of the given orders that match topics, queried by their addresses in batches.
export async function logsOfOrders(logWeb3, orders, fromBlock, topics) {
  var logs = [];
  for (var i = 0; i < orders.length; i += ADDRESS_BATCH) {
    var part = await getLogsChunked(logWeb3, { address: orders.slice(i, i + ADDRESS_BATCH), fromBlock: fromBlock, toBlock: 'latest', topics: topics });
    logs = logs.concat(part || []);
  }
  return logs;
}

// The logs matching topics of every order of Chain (OrderActors, filtered as the caller needs).
export async function chainOrderLogs(logWeb3, chainAddress, fromBlock, topics) {
  var orders = await chainOrderAddresses(logWeb3, chainAddress, fromBlock);
  return logsOfOrders(logWeb3, orders, fromBlock, topics);
}
