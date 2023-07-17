import { ethers } from "hardhat";

async function main() {
  const forceCloseInterval = 60 * 3;
  const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
  const rockPaperScissors = await RockPaperScissors.deploy(forceCloseInterval);
  await rockPaperScissors.waitForDeployment();
  console.log(rockPaperScissors);
  console.log("address", await rockPaperScissors.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
