import { HardhatUserConfig } from 'hardhat/config'

import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-web3'

require('dotenv').config()

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 42161,
      forking: {
        url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      },
    },
    arbitrum: {
      url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 42161,
      accounts: [process.env.PRIVATE_KEY || ''],
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  typechain: {
    tsNocheck: true,
    externalArtifacts: ['abi/*.json'],
  },
}

export default config
