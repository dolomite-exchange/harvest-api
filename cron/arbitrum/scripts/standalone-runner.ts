import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumber } from 'ethers';
import { ethers, web3, network } from 'hardhat';
import { Pushgateway } from 'prom-client';
import {
  IArbitrumGasInfo,
  IArbitrumGasInfo__factory,
  IController,
  IController__factory,
  IERC20,
  IERC20__factory,
  Storage,
  Storage__factory,
  VaultV2,
  VaultV2__factory,
} from '../typechain-types';

const fs = require('fs');

// logic control
const nextVaultFile = require('../next-vault.json');
const vaultDecisionFile = require('../vault-decision.json');

// Prometheus monitoring
const promClient = require('prom-client');
const Registry = promClient.Registry;
const register = new Registry();

require('dotenv').config();

async function pushMetrics(labels: Pushgateway.Parameters) {
  if (process.env.PROMETHEUS_MONITORING_ENABLED !== 'true') {
    return;
  }
  if (!process.env.PROMETHEUS_PUSH_GATEWAY_URL) {
    console.error('No PROMETHEUS_PUSH_GATEWAY_URL found!');
    return;
  }

  const gateway = new promClient.Pushgateway(
    process.env.PROMETHEUS_PUSH_GATEWAY_URL,
    [],
    register,
  );
  return await gateway
    .push(labels)
    .then(({ resp, body }: { resp: any, body: any }) => {
      console.log(`Metrics pushed, status ${resp.statusCode} ${body}`);
      register.clear();
    })
    .catch((err: any) => {
      console.log(`Error pushing metrics: ${err}`);
    });
}

async function reportSimulationProfit(
  vault: string,
  block: number,
  ethProfit: BigNumber,
  execute: boolean,
  gasPrice: BigNumber,
) {
  if (process.env.PROMETHEUS_MONITORING_ENABLED !== 'true') {
    return;
  }

  const profitMetric = new promClient.Gauge({
    name: 'eth_profit',
    help: 'profit shared Ether',
    registers: [register],
  });
  register.registerMetric(profitMetric);
  profitMetric.set(parseInt(web3.utils.fromWei(ethProfit.toString())));

  const blockMetric = new promClient.Gauge({
    name: 'eth_block',
    help: 'block number',
    registers: [register],
  });
  register.registerMetric(blockMetric);
  blockMetric.set(block);

  const executeMetric = new promClient.Gauge({
    name: 'eth_execute_flag',
    help: 'execute flag',
    registers: [register],
  });
  register.registerMetric(executeMetric);
  executeMetric.set(execute ? 1 : 0);

  const gasFeeMetric = new promClient.Gauge({
    name: 'eth_gas_fee',
    help: 'transaction gas fee',
    registers: [register],
  });
  register.registerMetric(gasFeeMetric);
  gasFeeMetric.set(gasPrice.toNumber());

  const labels: Pushgateway.Parameters = {
    jobName: vault,
    groupings: { instance: 'arbitrum' },
  };
  return pushMetrics(labels);
}

async function reportError(vaultKey: string, block: number, error: any) {
  if (process.env.PROMETHEUS_MONITORING_ENABLED !== 'true') {
    return;
  }

  const errorMetric = new promClient.Counter({
    name: block == 0 ? 'mainnet_error' : 'simulation_error',
    help: 'error during hardWork execution',
    registers: [register],
  });
  register.registerMetric(errorMetric);
  errorMetric.inc(1);

  let labels: Pushgateway.Parameters = {
    jobName: vaultKey,
    groupings: { instance: 'arbitrum', block: block.toString(), error: error.toString() },
  };
  return pushMetrics(labels);
}

// Only execute the `doHardWork` when the profit share is `greatDealRatio` times better than the gas cost in Ether
const greatDealRatio = 3;
// Execute a `doHardWork` when at least this many tokens are paid to the platform via the `platform fee`
const minPlatformFeeProfit = ethers.BigNumber.from('5000000000000000'); // 0.005 ETH, target token is ETH

const addresses = require('../../../data/mainnet/addresses.json');
const allVaults = Object.keys(addresses.ARBITRUM_ONE);

function disableCron(vaultAddress: string): string | undefined {
  return Object.keys(addresses.ARBITRUM_ONE).find(
    key =>
      addresses.ARBITRUM_ONE[key].NewVault &&
      addresses.ARBITRUM_ONE[key].NewVault.toLowerCase() === vaultAddress.toLowerCase() &&
      addresses.ARBITRUM_ONE[key].doHardWork === false,
  );
}

const vaultIds = allVaults
  .filter(vaultId => addresses.ARBITRUM_ONE[vaultId]?.NewVault)
  .filter(vault => !disableCron(addresses.ARBITRUM_ONE[vault].NewVault));

// input vault key and output next vault key in the list
function findNextVaultKey(curVault: string) {
  let id = vaultIds.findIndex(element => element == curVault);
  let nextId;

  if (id == vaultIds.length - 1) {
    nextId = 0;
  } else {
    nextId = id + 1;
  }
  return vaultIds[nextId];
}

/**
 * @return The gas price most-recently set in ArbSys, in gwei.
 */
async function getCurrentGasPrice(): Promise<BigNumber> {
  const signer = await ethers.provider.getSigner(0);
  const gasInfo = new BaseContract(
    addresses.ARBITRUM_ONE.IArbitrumGasInfo,
    IArbitrumGasInfo__factory.createInterface(),
    signer,
  ) as IArbitrumGasInfo;

  const result = await gasInfo.getPricesInWei();
  return result[5].div('1000000000');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @return A random number between min and max
 */
function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

let currentVaultKey: string = nextVaultFile.next_vault_key;
let controller: IController;
let vaultAddress = addresses.ARBITRUM_ONE[currentVaultKey].NewVault;
let vault: VaultV2;
let weth: IERC20;
let targetToken: IERC20;

let platformFeeCollected = ethers.BigNumber.from('0');

async function executeSimulationForDoHardWork(
  signers: SignerWithAddress[],
  storage: Storage,
  gasPrice: BigNumber,
  hint: BigNumber,
) {
  const governanceAddress = await storage.governance();
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [governanceAddress],
  });
  const governance = await ethers.getSigner(governanceAddress);
  await controller.connect(governance).addHardWorker(signers[0].address);

  console.log('Executor:', signers[0].address);
  console.log('Doing simulation on vault:', currentVaultKey);
  console.log('Vault Address:', vaultAddress);

  let currentSimulationBlock = await web3.eth.getBlockNumber();
  console.log('Simulation is occurring at block:', currentSimulationBlock);

  let decision;
  let executeFlag = false;
  const availableToInvestOut = await vault.availableToInvestOut();
  const underlyingBalanceWithInvestment = await vault.underlyingBalanceWithInvestment();

  console.log('Checking if we we need to push funds...');
  console.log(
    'Vault investment ratio:',
    (await vault.vaultFractionToInvestNumerator()).toString(),
    '/',
    (await vault.vaultFractionToInvestDenominator()).toString(),
  );

  const underlying = new BaseContract(
    await vault.underlying(),
    IERC20__factory.createInterface(),
    governance,
  ) as IERC20;
  const underlyingInVault = await underlying.balanceOf(vaultAddress);
  console.log('Underlying in vault:     ', underlyingInVault.toString());
  console.log('Total AUM:               ', underlyingBalanceWithInvestment.toString());
  console.log('Available to invest out: ', availableToInvestOut.toString());

  if (availableToInvestOut.gt('0')) {
    console.log('Funds NEED to be pushed');
    executeFlag = true;
  } else {
    console.log('Funds DO NOT need to be pushed');
  }

  const profitShareAddress = governanceAddress;
  const ethInProfitShareBefore = await weth.balanceOf(profitShareAddress);
  let ethProfit = ethers.BigNumber.from('0');

  if (!executeFlag) {
    console.log('======= Doing hardWork ======');
    try {
      console.time('doHardWork simulation');
      const tx = await controller.doHardWork(vaultAddress, hint, '101', '100', { gasPrice });
      console.timeEnd('doHardWork simulation');

      const txResult = await ethers.provider.getTransactionReceipt(tx.hash);
      const ethCost = txResult.gasUsed.mul(txResult.effectiveGasPrice);
      const ethInProfitShareAfter = await weth.balanceOf(profitShareAddress);
      ethProfit = ethInProfitShareAfter.sub(ethInProfitShareBefore);

      console.log('gasUsed:            ', txResult.gasUsed.toString());
      console.log('profit in ETH:      ', web3.utils.fromWei(ethProfit.toString()));
      console.log('Gas cost (ETH):     ', web3.utils.fromWei(ethCost.toString()));

      if (ethProfit.gt(ethCost.mul(greatDealRatio)) || platformFeeCollected > minPlatformFeeProfit) {
        console.log('====> Time to invoke doHardWork ====');
        executeFlag = true;
      } else {
        console.log('Condition not met. `doHardWork` not being executed now');
      }
    } catch (e) {
      console.log('Error during simulation: ');
      console.log(e);
      await reportError(currentVaultKey, currentSimulationBlock, e);
    }
  }
  if (disableCron(vaultAddress)) {
    console.log('[FORCED SKIP]');
    executeFlag = false;
  }

  decision = {
    vaultKey: currentVaultKey,
    execute: executeFlag,
  };

  fs.writeFileSync('./vault-decision.json', JSON.stringify(decision), 'utf-8');
  console.log('Decision wrote in file!');
  await reportSimulationProfit(
    currentVaultKey,
    currentSimulationBlock,
    ethProfit,
    executeFlag,
    gasPrice,
  );
}

async function executeDoHardWork(
  signers: SignerWithAddress[],
  gasPrice: BigNumber,
  hint: BigNumber,
) {
  const hardWorker = signers[0].address;
  console.log('Executor: ', hardWorker);
  console.log('cron_mainnet');

  // vaultDecision is read when the script is first started.
  if (vaultDecisionFile.vaultKey != currentVaultKey) {
    console.log('ERROR: decision file info does not match vault key. Exiting...');
    return;
  }

  if (vaultDecisionFile.execute) {
    console.log('Mainnet: Sending the tx for vault:', vaultDecisionFile.vaultKey);
    try {
      await controller.doHardWork(vaultAddress, hint, '101', '100', { gasPrice: gasPrice.mul(10) });
    } catch (e) {
      console.log('Error when sending tx: ');
      console.log(e);
      await reportError(currentVaultKey, 0, e);
    }
  } else {
    console.log('Mainnet: NOT sending the tx of ', vaultDecisionFile.vaultKey);
  }

  let nextVaultKey = findNextVaultKey(currentVaultKey);
  let isLastVault = currentVaultKey == vaultIds[vaultIds.length - 1];
  let newNextVault = {
    next_vault_key: nextVaultKey,
  };
  fs.writeFileSync('./next-vault.json', JSON.stringify(newNextVault), 'utf-8');
  console.log('NEXT Vault:', nextVaultKey);

  if (isLastVault) {
    // Simulate and execute again in 5 hrs
    console.log('Waiting for 5 hrs for the next round');
    await sleep(5 * 60 * 60 * 1000);
  } else {
    let waitFor = getRandomInt(1000 * 60, 1000 * 60 * 2);
    console.log('Waiting for: ', waitFor);
    await sleep(waitFor);
  }
}

async function main() {
  const signers = await ethers.getSigners();
  const storage = new BaseContract(addresses.ARBITRUM_ONE.Storage, Storage__factory.createInterface(), signers[0]) as Storage;
  controller = new BaseContract(
    await storage.controller(),
    IController__factory.createInterface(),
    signers[0],
  ) as IController;
  vault = new BaseContract(vaultAddress, VaultV2__factory.createInterface(), signers[0]) as VaultV2;
  weth = new BaseContract(addresses.ARBITRUM_ONE.WETH, IERC20__factory.createInterface(), signers[0]) as IERC20;
  targetToken = new BaseContract(
    await controller.targetToken(),
    IERC20__factory.createInterface(),
    signers[0],
  ) as IERC20;
  const gasPrice = await getCurrentGasPrice();
  const hint = await vault.getPricePerFullShare();
  console.log('==================================================================');

  if (process.env.HARDHAT_NETWORK == 'hardhat') {
    await executeSimulationForDoHardWork(signers, storage, gasPrice, hint);
  } else if (process.env.HARDHAT_NETWORK == 'cron_mainnet') {
    await executeDoHardWork(signers, gasPrice, hint);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
