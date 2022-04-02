import { HardhatUserConfig } from 'hardhat/config'

require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-web3')

const developmentKeys = require('./dev-keys.json')

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 42161,
      forking: {
        url: `https://mainnet.infura.io/v3/${developmentKeys.infuraKey}`,
      },
    },
    arbitrum: {
      url: `https://mainnet.infura.io/v3/${developmentKeys.infuraKey}`,
      chainId: 42161,
      accounts: {
        mnemonic: developmentKeys.privateKey,
      },
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
}

module.exports = config
