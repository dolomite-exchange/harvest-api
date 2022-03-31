const { countFunctionCall } = require('../..')

const getPoolInfo = (poolId, instance) =>
  countFunctionCall(instance.methods.poolInfo(poolId).call())
const getTotalAllocPoint = instance => countFunctionCall(instance.methods.totalAllocPoint().call())
const getStargatePerBlock = instance => countFunctionCall(instance.methods.stargatePerBlock().call())

module.exports = { getPoolInfo, getTotalAllocPoint, getStargatePerBlock }
