const { countFunctionCall } = require('../..')

const deltaCredit = instance => countFunctionCall(instance.methods.deltaCredit().call())
const totalLiquidity = instance => countFunctionCall(instance.methods.totalLiquidity().call())
const totalSupply = instance => countFunctionCall(instance.methods.totalSupply().call())

module.exports = { deltaCredit, totalLiquidity, totalSupply }
