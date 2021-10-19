const VAULT_CATEGORIES_IDS = {
  INACTIVE: 'INACTIVE',
  SUSHI: 'SUSHI',
  STABLECOINS: 'STABLECOINS',
  BTC: 'BTC',
  GENERAL: 'GENERAL',
  LIQUIDITY: 'LIQUIDITY',
  ONEINCH: 'ONEINCH',
  SEIGNIORAGE: 'SEIGNIORAGE',
  MSTONKS: 'MSTONKS',
  ETH20: 'ETH20',
  SUSHI_HODL: 'SUSHI_HODL',
  LINK: 'LINK',
  VENUS: 'VENUS',
  PANCAKE: 'PANCAKE',
  GOOSE: 'GOOSE',
  BDOLLAR: 'BDOLLAR',
  NFT: 'NFT',
  SPACE: 'SPACE',
  INACTIVE_BSC: 'INACTIVE_BSC',
  ELLIPSIS: 'ELLIPSIS',
  BELT: 'BELT',
  UNIV3: 'UNIV3',
  LIFT: 'LIFT',
  BALANCER: 'BALANCER',
  AMPLIFARM: 'AMPLIFARM',
  QUICKSWAP: 'QUICKSWAP',
}

const CHAINS_ID = {
  ETH_MAINNET: '1',
  ETH_ROPSTEN: '3',
  BSC_MAINNET: '56',
  MATIC_MAINNET: '137',
}

const GET_PRICE_TYPES = {
  NULL: 'NULL',
  COINGECKO_CONTRACT: 'COINGECKO_CONTRACT',
  COINGECKO_ID: 'COINGECKO_ID',
  F_TOKEN: 'F_TOKEN',
  LP_TOKEN: 'LP_TOKEN',
  TOKEN_TO_USD_FARM: 'TOKEN_TO_USD_FARM',
  UNISWAP_PAIR: 'UNISWAP_PAIR',
  MANUAL: 'MANUAL',
  F_TOKEN_ID: 'F_TOKEN_ID',
  PANCAKESWAP_PAIR: 'PANCAKESWAP_PAIR',
  SUSHISWAP_PAIR: 'SUSHISWAP_PAIR',
  UNISWAP_V3: 'UNISWAP_V3',
  CURVE_POOL: 'CURVE_POOL',
  BALANCER: 'BALANCER',
  FARMSTEAD_USDC: 'FARMSTEAD_USDC',
  BALANCER_POLYGON: 'BALANCER_POLYGON',
}

const ESTIMATED_APY_TYPES = {
  NULL: 'NULL',
  CRV_GENERAL: 'CRV_GENERAL',
  MANUAL: 'MANUAL',
  SNX: 'SNX',
  MANUAL_NON_COMPOUNDING: 'MANUAL_NON_COMPOUNDING',
  COMPOUND: 'COMPOUND',
  SUSHI: 'SUSHI',
  IDLE_FINANCE: 'IDLE_FINANCE',
  NARWHALE: 'NARWHALE',
  BASIS: 'BASIS',
  NATIVE_SUSHI: 'NATIVE_SUSHI',
  SUSHI_PLUS_NATIVE: 'SUSHI_PLUS_NATIVE',
  MUSE: 'MUSE',
  ONEINCH: 'ONEINCH',
  VENUS: 'VENUS',
  PANCAKE: 'PANCAKE',
  VENUS_VAI_STAKING: 'VENUS_VAI_STAKING',
  GOOSE: 'GOOSE',
  BDO: 'BDO',
  ELLIPSIS: 'ELLIPSIS',
  BELT: 'BELT',
  SWIRL: 'SWIRL',
  SPACE: 'SPACE',
  POPSICLE: 'POPSICLE',
  COMPFI: 'COMPFI',
  CONVEX: 'CONVEX',
  BALANCER: 'BALANCER',
  BALANCER_POLYGON: 'BALANCER_POLYGON',
}

const COLLATERAL_TYPE = {
  NULL: 'NULL',
  BTC: 'BTC',
  ETH: 'ETH',
  LP: 'LP',
}

const SUSHI_POOLS_IDS = {
  USDT: 0,
  USDC: 1,
  DAI: 2,
  WBTC: 21,
  SUSHI: 12,
  UST: 85,
  PERP: 156,
}

const BASIS_POOL_IDS = {
  'BAC-DAI': 0,
  'BAS-DAI': 2,
}

const TRADING_APY_TYPES = {
  LP: 'LP',
  BALANCER: 'BALANCER',
  UNIV3: 'UNIV3',
  UNIV3_V2: 'UNIV3_V2',
  RARI_FARMSTEAD_USDC: 'RARI_FARMSTEAD_USDC',
  CONVEX: 'CONVEX',
  BELT: 'BELT',
  VENUS: 'VENUS',
}

const POOL_TYPES = {
  INCENTIVE: 'INCENTIVE',
  PROFIT_SHARING: 'PROFIT_SHARING',
  INCENTIVE_BUYBACK: 'INCENTIVE_BUYBACK',
  INACTIVE: 'INACTIVE',
  UNIV3: 'UNIV3',
}

module.exports = {
  VAULT_CATEGORIES_IDS,
  CHAINS_ID,
  GET_PRICE_TYPES,
  ESTIMATED_APY_TYPES,
  COLLATERAL_TYPE,
  SUSHI_POOLS_IDS,
  BASIS_POOL_IDS,
  TRADING_APY_TYPES,
  POOL_TYPES,
}
