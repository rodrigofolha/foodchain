import Web3 from 'web3';
import { ethers } from 'ethers';
import {
  ORDER_ACTORS_TOPIC,
  INFORMATION_TOPIC,
  addressTopic,
  orderAddressesFromLogs,
  keepChainOrders,
  commitmentsFromLogs,
  workerCommitment,
  findWorkerCommitment,
  readWorkerInformation,
} from './orderLogs';

const web3 = new Web3();

const STORAGE = '0x00000000000000000000000000000000000000c1';
const OTHER_CONTRACT = '0x00000000000000000000000000000000000000c2';
const ORDER = '0x00000000000000000000000000000000000000aa';
const CUSTOMER = '0x00000000000000000000000000000000000000d1';
const SHOP = '0x00000000000000000000000000000000000000d2';
const FIRST = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const SECOND = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const ZERO = '0x0000000000000000000000000000000000000000';
const DEPLOY_BLOCK = 100;

function actorsLog(order, worker, blockNumber, logIndex = 0) {
  return {
    address: order,
    blockNumber,
    logIndex,
    topics: [ORDER_ACTORS_TOPIC, addressTopic(CUSTOMER), addressTopic(worker === ZERO ? ZERO : SHOP), addressTopic(worker)],
    data: web3.eth.abi.encodeParameter('address', order),
  };
}

function informationLog(emitter, index, position, first, second, blockNumber, logIndex = 0) {
  return {
    address: emitter,
    blockNumber,
    logIndex,
    topics: [INFORMATION_TOPIC, web3.utils.padLeft(web3.utils.numberToHex(index), 64), web3.utils.padLeft(web3.utils.numberToHex(position), 64)],
    data: web3.eth.abi.encodeParameters(['string', 'string'], [first, second]),
  };
}

// A log provider over a fixed list of logs, filtering as a node does:
// by address, by block range and by each topic that is given. With a head, it
// also reports that block number as the chain's last block.
function fakeLogWeb3(allLogs, queries = [], head) {
  const provider = {
    utils: web3.utils,
    eth: {
      abi: web3.eth.abi,
      getPastLogs: async (filter) => {
        queries.push(filter);
        return allLogs.filter((log) =>
          (!filter.address || log.address.toLowerCase() === filter.address.toLowerCase()) &&
          log.blockNumber >= filter.fromBlock &&
          (filter.toBlock === undefined || filter.toBlock === 'latest' || log.blockNumber <= filter.toBlock) &&
          (filter.topics || []).every((topic, i) => topic === null || log.topics[i].toLowerCase() === topic.toLowerCase()));
      },
    },
  };
  if (head !== undefined) provider.eth.getBlockNumber = async () => head;
  return provider;
}

function read(allLogs, account, queries) {
  return readWorkerInformation({
    logWeb3: fakeLogWeb3(allLogs, queries),
    storageAddress: STORAGE,
    orderAddress: ORDER,
    orderIndex: '7',
    account,
    deployBlock: DEPLOY_BLOCK,
  });
}

describe('event topics', () => {
  it('are the hashes of the event signatures', () => {
    expect(ORDER_ACTORS_TOPIC).toBe(ethers.utils.id('OrderActors(address,address,address,address)'));
    expect(INFORMATION_TOPIC).toBe(ethers.utils.id('Information(uint256,uint256,string,string)'));
  });
});

describe('order addresses from OrderActors logs', () => {
  it('lists each order once and skips data that is not one address', () => {
    const logs = [
      actorsLog(ORDER, ZERO, 101),
      actorsLog(ORDER, FIRST, 102),
      { topics: [ORDER_ACTORS_TOPIC], data: '0x1234' },
      { topics: [ORDER_ACTORS_TOPIC], data: web3.eth.abi.encodeParameters(['address', 'uint256'], [OTHER_CONTRACT, 1]) },
      actorsLog(OTHER_CONTRACT, FIRST, 103),
    ];
    expect(orderAddressesFromLogs(logs)).toEqual([ORDER, OTHER_CONTRACT]);
    expect(orderAddressesFromLogs(undefined)).toEqual([]);
  });

  it('drops a log of another contract that names a real order and a worker', () => {
    // a log of another contract with the right topics and the order's address as data
    const forged = Object.assign(actorsLog(ORDER, FIRST, 104), { address: OTHER_CONTRACT });
    expect(orderAddressesFromLogs([forged])).toEqual([]);
    // next to the order's own logs it adds nothing
    expect(orderAddressesFromLogs([forged, actorsLog(ORDER, SECOND, 105)])).toEqual([ORDER]);
  });

  it('drops logs that do not have the shape of the event', () => {
    const own = actorsLog(ORDER, FIRST, 104);
    const data = own.data;
    expect(orderAddressesFromLogs([{ address: ORDER, topics: [ORDER_ACTORS_TOPIC], data }])).toEqual([]);
    expect(orderAddressesFromLogs([{ address: ORDER, topics: own.topics.slice(0, 3), data }])).toEqual([]);
    expect(orderAddressesFromLogs([{ address: ORDER, topics: own.topics.concat([own.topics[1]]), data }])).toEqual([]);
    expect(orderAddressesFromLogs([{ address: ORDER, topics: [INFORMATION_TOPIC].concat(own.topics.slice(1)), data }])).toEqual([]);
    expect(orderAddressesFromLogs([{ topics: own.topics, data }])).toEqual([]);
    expect(orderAddressesFromLogs([{ address: ORDER, topics: own.topics }])).toEqual([]);
    expect(orderAddressesFromLogs([null, 'log', {}])).toEqual([]);
    // the emitter may be written with capital letters
    expect(orderAddressesFromLogs([Object.assign({}, own, { address: ORDER.toUpperCase().replace('0X', '0x') })])).toEqual([ORDER]);
  });

  it('keeps only what Chain.isOrder confirms, and drops an address whose check fails', async () => {
    const asked = [];
    const chain = {
      methods: {
        isOrder: (address) => ({
          call: () => {
            asked.push(address);
            if (address === '0x03') return Promise.reject(new Error('rate limit'));
            return Promise.resolve(address === ORDER || address === '0x07');
          },
        }),
      },
    };
    const addresses = [ORDER, OTHER_CONTRACT, '0x03', '0x04', '0x05', '0x06', '0x07'];
    expect(await keepChainOrders(chain, addresses)).toEqual([ORDER, '0x07']);
    expect(asked).toEqual(addresses);
    expect(await keepChainOrders(chain, [])).toEqual([]);
  });

  it('does not keep an address for an answer that is not exactly true', async () => {
    const chain = { methods: { isOrder: () => ({ call: () => Promise.resolve('0x01') }) } };
    expect(await keepChainOrders(chain, [ORDER])).toEqual([]);
  });
});

describe('the worker\'s own commitment', () => {
  it('numbers the workers in the order of their commitments', () => {
    const commitments = commitmentsFromLogs([
      actorsLog(ORDER, SECOND, 130),
      actorsLog(ORDER, ZERO, 101),
      actorsLog(ORDER, ZERO, 102),
      actorsLog(ORDER, FIRST, 110),
    ]);
    expect(commitments).toEqual([
      { worker: FIRST.toLowerCase(), blockNumber: 110 },
      { worker: SECOND.toLowerCase(), blockNumber: 130 },
    ]);
    expect(workerCommitment(commitments, FIRST)).toEqual({ position: 1, blockNumber: 110 });
    expect(workerCommitment(commitments, SECOND.toLowerCase())).toEqual({ position: 2, blockNumber: 130 });
    expect(workerCommitment(commitments, CUSTOMER)).toBeNull();
  });

  it('orders two commitments of one block by their place in the block', () => {
    const commitments = commitmentsFromLogs([actorsLog(ORDER, SECOND, 110, 9), actorsLog(ORDER, FIRST, 110, 2)]);
    expect(workerCommitment(commitments, SECOND).position).toBe(2);
  });

  it('gives the later commitment to an account that was both workers', () => {
    const commitments = commitmentsFromLogs([actorsLog(ORDER, FIRST, 110), actorsLog(ORDER, FIRST, 140)]);
    expect(workerCommitment(commitments, FIRST)).toEqual({ position: 2, blockNumber: 140 });
  });

  it('asks for the logs of the order only, from the deployment block', async () => {
    const queries = [];
    const logs = [actorsLog(ORDER, FIRST, 110), actorsLog(OTHER_CONTRACT, SECOND, 105)];
    const commitment = await findWorkerCommitment({ logWeb3: fakeLogWeb3(logs, queries), orderAddress: ORDER, account: FIRST, deployBlock: DEPLOY_BLOCK });
    expect(commitment).toEqual({ position: 1, blockNumber: 110 });
    expect(queries).toEqual([{ address: ORDER, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ACTORS_TOPIC] }]);
  });

  it('ignores logs of another contract even if the provider returns them', async () => {
    const provider = fakeLogWeb3([]);
    provider.eth.getPastLogs = async () => [actorsLog(OTHER_CONTRACT, SECOND, 105), actorsLog(ORDER, FIRST, 110)];
    expect(await findWorkerCommitment({ logWeb3: provider, orderAddress: ORDER, account: FIRST, deployBlock: DEPLOY_BLOCK }))
      .toEqual({ position: 1, blockNumber: 110 });
    expect(await findWorkerCommitment({ logWeb3: provider, orderAddress: ORDER, account: SECOND, deployBlock: DEPLOY_BLOCK }))
      .toBeNull();
  });
});

describe('reading what the customer sent', () => {
  const committed = [actorsLog(ORDER, ZERO, 101), actorsLog(ORDER, ZERO, 102), actorsLog(ORDER, FIRST, 110)];

  it('filters by the Storage address, the order index and the worker\'s position, from their commitment', async () => {
    const queries = [];
    const result = await read([...committed, informationLog(STORAGE, 7, 1, 'enc-address', 'enc-items', 112)], FIRST, queries);
    expect(result).toEqual({ commitment: { position: 1, blockNumber: 110 }, information: ['enc-address', 'enc-items'] });
    expect(queries[1]).toEqual({
      address: STORAGE,
      fromBlock: 110,
      toBlock: 'latest',
      topics: [INFORMATION_TOPIC, '0x' + '0'.repeat(63) + '7', '0x' + '0'.repeat(63) + '1'],
    });
  });

  it('answers with empty strings while the customer has sent nothing', async () => {
    expect(await read(committed, FIRST)).toEqual({ commitment: { position: 1, blockNumber: 110 }, information: ['', ''] });
  });

  it('answers with no commitment for an account that is not a worker of the order', async () => {
    const queries = [];
    const result = await read([...committed, informationLog(STORAGE, 7, 1, 'a', 'b', 112)], SECOND, queries);
    expect(result).toEqual({ commitment: null, information: ['', ''] });
    expect(queries).toHaveLength(1);
  });

  it('takes the last post when the customer posted more than once', async () => {
    const logs = [
      ...committed,
      informationLog(STORAGE, 7, 1, 'new-address', 'new-items', 115, 3),
      informationLog(STORAGE, 7, 1, 'old-address', 'old-items', 112),
      informationLog(STORAGE, 7, 1, 'mid-address', 'mid-items', 115, 1),
    ];
    expect((await read(logs, FIRST)).information).toEqual(['new-address', 'new-items']);
  });

  it('gives a second worker their own post, not the first worker\'s', async () => {
    const logs = [
      ...committed,
      informationLog(STORAGE, 7, 1, 'for-first-address', 'for-first-items', 112),
      actorsLog(ORDER, SECOND, 130),
      // posted while the order was reopened: still for the first worker
      informationLog(STORAGE, 7, 1, 'late-first-address', 'late-first-items', 131),
    ];
    expect((await read(logs, SECOND)).information).toEqual(['', '']);

    logs.push(informationLog(STORAGE, 7, 2, 'for-second-address', 'for-second-items', 133));
    expect(await read(logs, SECOND)).toEqual({
      commitment: { position: 2, blockNumber: 130 },
      information: ['for-second-address', 'for-second-items'],
    });
    expect((await read(logs, FIRST)).information).toEqual(['late-first-address', 'late-first-items']);
  });

  it('does not read a post made before the second commitment of an account that was both workers', async () => {
    const logs = [
      ...committed,
      informationLog(STORAGE, 7, 1, 'first-time-address', 'first-time-items', 112),
      actorsLog(ORDER, FIRST, 140),
    ];
    expect(await read(logs, FIRST)).toEqual({ commitment: { position: 2, blockNumber: 140 }, information: ['', ''] });
    logs.push(informationLog(STORAGE, 7, 2, 'second-time-address', 'second-time-items', 141));
    expect((await read(logs, FIRST)).information).toEqual(['second-time-address', 'second-time-items']);
  });

  it('ignores a look-alike log of another contract and the posts of other orders', async () => {
    const logs = [
      ...committed,
      informationLog(OTHER_CONTRACT, 7, 1, 'forged-address', 'forged-items', 120),
      informationLog(STORAGE, 8, 1, 'other-order-address', 'other-order-items', 121),
    ];
    expect((await read(logs, FIRST)).information).toEqual(['', '']);

    // also when the provider does not apply the filter
    const provider = fakeLogWeb3(logs);
    provider.eth.getPastLogs = async (filter) => (filter.address === ORDER ? committed : logs.filter((log) => log.topics[0] === INFORMATION_TOPIC));
    const result = await readWorkerInformation({ logWeb3: provider, storageAddress: STORAGE, orderAddress: ORDER, orderIndex: 7, account: FIRST, deployBlock: DEPLOY_BLOCK });
    expect(result.information).toEqual(['', '']);
  });

  it('never asks for blocks before the deployment block', async () => {
    const queries = [];
    await readWorkerInformation({
      logWeb3: fakeLogWeb3(committed, queries), storageAddress: STORAGE, orderAddress: ORDER, orderIndex: 7, account: FIRST, deployBlock: 500,
    });
    // the commitment itself is before block 500 here, so it is not found
    expect(queries).toHaveLength(1);
    expect(queries[0].fromBlock).toBe(500);
  });

  it('reads a long range of blocks in windows that a public endpoint accepts', async () => {
    const queries = [];
    // the commitment 60,000 blocks after the deployment, the post 100,000 blocks after it,
    // and the chain's last block 120,000 blocks after it
    const logs = [
      actorsLog(ORDER, FIRST, DEPLOY_BLOCK + 60000),
      informationLog(STORAGE, 7, 1, 'enc-address', 'enc-items', DEPLOY_BLOCK + 100000),
    ];
    const result = await readWorkerInformation({
      logWeb3: fakeLogWeb3(logs, queries, DEPLOY_BLOCK + 120000), storageAddress: STORAGE, orderAddress: ORDER, orderIndex: 7, account: FIRST, deployBlock: DEPLOY_BLOCK,
    });
    expect(result).toEqual({ commitment: { position: 1, blockNumber: DEPLOY_BLOCK + 60000 }, information: ['enc-address', 'enc-items'] });
    expect(queries.map((query) => [query.address, query.fromBlock, query.toBlock])).toEqual([
      // the order's logs from the deployment block, in three windows
      [ORDER, DEPLOY_BLOCK, DEPLOY_BLOCK + 44999],
      [ORDER, DEPLOY_BLOCK + 45000, DEPLOY_BLOCK + 89999],
      [ORDER, DEPLOY_BLOCK + 90000, 'latest'],
      // Storage's logs from the commitment, in two
      [STORAGE, DEPLOY_BLOCK + 60000, DEPLOY_BLOCK + 104999],
      [STORAGE, DEPLOY_BLOCK + 105000, 'latest'],
    ]);
  });
});
