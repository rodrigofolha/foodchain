const { ethers } = require("ethers");
const fs = require("fs");

async function deployPoseidon() {
    const provider = new ethers.JsonRpcProvider("YOUR_RPC_URL");
    const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);

    const poseidonData = JSON.parse(fs.readFileSync("Poseidon.json", "utf8"));

    const factory = new ethers.ContractFactory(
        poseidonData.abi,
        poseidonData.bytecode,
        wallet
    );

    console.log("Deploying Poseidon...");
    const poseidonContract = await factory.deploy();
    await poseidonContract.waitForDeployment();

    console.log("Poseidon deployed to:", await poseidonContract.getAddress());
}

deployPoseidon().catch(console.error);
