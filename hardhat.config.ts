import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    hardhat: {},
    mumbai: {
      url: "https://matic-mumbai.chainstacklabs.com",
      accounts: [`${process.env.PRIVATE_KEY}`],
      gasPrice: 8000000000,
    },
    shibuya: {
      url: "https://evm.shibuya.astar.network",
      accounts: [`${process.env.PRIVATE_KEY}`],
      gasPrice: 8000000000,
    },
  },
};

export default config;
