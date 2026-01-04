const hre = require("hardhat");

async function main() {
  console.log("Deploying Voting contract...");

  // 部署合约
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy();

  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log(`Voting contract deployed to: ${address}`);

  // 添加一些初始候选人
  console.log("Adding initial candidates...");

  await voting.addCandidate("Alice");
  await voting.addCandidate("Bob");
  await voting.addCandidate("Charlie");

  console.log("Initial candidates added: Alice, Bob, Charlie");
  console.log("Deployment complete!");

  // 输出合约地址，供前端使用
  console.log("\n========================================");
  console.log("Contract Address (copy this for frontend):");
  console.log(address);
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});