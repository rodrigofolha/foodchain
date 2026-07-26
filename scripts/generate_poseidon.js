const { poseidonContract } = require("circomlibjs");
const fs = require("fs");

const abi = poseidonContract.generateABI(2);
const bytecode = poseidonContract.createCode(2);

fs.writeFileSync("Poseidon.json", JSON.stringify({ abi, bytecode }, null, 2));
console.log("Success! Poseidon.json generated with ABI and Bytecode.");
