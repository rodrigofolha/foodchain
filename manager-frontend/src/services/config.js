//ropsten deployed contract
export const CHAIN_ADDRESS = '0xb7798dFB1847df92d87F8E9405e62374DC3DeADB'; 

export const CHAIN_ABI =
[
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_restaurant",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_deliveryPrice",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_total",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "_items",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_items_client",
				"type": "string"
			}
		],
		"name": "makeOrder",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "orderAddress",
				"type": "uint256"
			}
		],
		"name": "findAddress",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getIndex",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]

export const VIEW_ADDRESS = '0xF66cfC4755F496C14ef29e39BC70DD5f18758B8E'; 

export const VIEW_ABI = 
[
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			}
		],
		"name": "getOrder",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "chainAddress",
				"type": "address"
			}
		],
		"name": "relatedTo",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "id",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "items",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "deliveryPrice",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "step",
						"type": "string"
					},
					{
						"internalType": "address",
						"name": "restaurant",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "code",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "timestamp_creation",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "timestamp_last_step",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "deliveryman",
						"type": "address"
					}
				],
				"internalType": "struct Type[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "chainAddress",
				"type": "address"
			}
		],
		"name": "toBeTaken",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]

//ropsten deployed contract
export const INTERACT_ADDRESS = '0xED72cba2dEF8F8e5c823c17C54F72852637dedd6'; 

export const INTERACT_ABI =
[
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			}
		],
		"name": "callSecondDeliveryman",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			}
		],
		"name": "cancelOrder",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "index",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "storage_address",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "firstHalf",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "secondHalf",
				"type": "bytes32"
			}
		],
		"name": "confirmIntention",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "aval",
				"type": "bool"
			}
		],
		"name": "contestOrder",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "code",
				"type": "uint256"
			}
		],
		"name": "deliveryOrder",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "code",
				"type": "uint256"
			}
		],
		"name": "pickupOrder",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			}
		],
		"name": "prepareOrder",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "orderAddress",
				"type": "address"
			}
		],
		"name": "withdraw",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	}
]

//ropsten deployed contract
export const STORAGE_ADDRESS = '0x4E9125c4222d1D0ad69DF0AbB3bBc9Ade11B8bD2'; 

export const STORAGE_ABI =
[
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "_firstHalf",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "_secondHalf",
				"type": "bytes32"
			}
		],
		"name": "addDeliveryman",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "encrypted_address",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "encrypted_items",
				"type": "string"
			}
		],
		"name": "addInformation",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			}
		],
		"name": "getDeliveryman",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			}
		],
		"name": "readInformation",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]