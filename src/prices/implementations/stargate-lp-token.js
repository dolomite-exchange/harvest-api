const BigNumber = require('bignumber.js')

const stargateContract = require('../../lib/web3/contracts/stargate/contract.json')
const stargateMethods = require('../../lib/web3/contracts/stargate/methods')

const { getTokenPrice } = require('..')
const { getUIData } = require('../../lib/data')
const { UI_DATA_FILES } = require('../../lib/constants')
const { getWeb3 } = require('../../lib/web3')

const getPrice = async (token, underlyingToken) => {
  if (!token || !underlyingToken) {
    console.error('Invalid token or underlyingToken')
    return '0'
  }

  const tokens = await getUIData(UI_DATA_FILES.TOKENS)
  const decimals = tokens[underlyingToken].decimals

  const web3Instance = getWeb3(tokens[token].chain)
  const stargateInstance = new web3Instance.eth.Contract(
    stargateContract.abi,
    tokens[token].tokenAddress,
  )

  const liquidity = await stargateMethods.totalLiquidity(stargateInstance).catch(e => {
    console.error('Could not get totalLiquidity for token ', token)
    return Promise.reject(e)
  })
  const totalSupply = await stargateMethods.totalSupply(stargateInstance).catch(e => {
    console.error('Could not get totalSupply for token ', token)
    return Promise.reject(e)
  })

  const TEN = new BigNumber(10)
  const value = TEN.pow(decimals).times(liquidity).div(totalSupply)
  const underlyingPrice = await getTokenPrice(underlyingToken, tokens[underlyingToken].chain).catch(
    e => {
      console.error('Could not get token price for underlyingToken', underlyingToken, e)
      return Promise.reject(e)
    },
  )

  return value.times(underlyingPrice).toString()
}

module.exports = {
  getPrice,
}
