import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber as BigDecimal } from 'bignumber.js';
import * as dotenv from 'dotenv';
import { BaseContract, BigNumber, BigNumberish } from 'ethers';

import * as fs from 'fs';
import { ethers, network, web3 } from 'hardhat';
// Prometheus monitoring
import * as promClient from 'prom-client';
import { Pushgateway } from 'prom-client';

// logic control
import * as nextVaultFile from '../next-vault.json';
import {
  IController,
  IController__factory,
  IERC20,
  IERC20__factory,
  Storage,
  Storage__factory,
  VaultV2,
  VaultV2__factory,
} from '../typechain-types';
import * as vaultDecisionFile from '../vault-decision.json';
import { sleep } from './utils';

const addresses = require('../data/addresses.json');
dotenv.config();

const Registry = promClient.Registry;
const register = new Registry();

/// Only execute the `doHardWork` when the profit share is `greatDealRatio` times better than the gas cost in Ether
const greatDealRatio = 3;

/// Execute a `doHardWork` when at least this many tokens are paid to the platform via the `platform fee`
const minPlatformFeeProfitInEth = ethers.BigNumber.from('5000000000000000'); // 0.005 ETH, target token is ETH

const allVaults = Object.keys(addresses.ARBITRUM_ONE);

// TODO switch to use network-based vaults instead of local file. Check for `{ "inactive": true }` on the object
const vaultIds = allVaults
  .filter(vaultId => addresses.ARBITRUM_ONE[vaultId]?.NewVault)
  .filter(vault => !disableCron(addresses.ARBITRUM_ONE[vault].NewVault));

const currentVaultKey = nextVaultFile.next_vault_key ?? findNextVaultKey(undefined);
const vaultAddress = addresses.ARBITRUM_ONE[currentVaultKey].NewVault;

const oneEth = '1000000000000000000';

let controller: IController;
let vault: VaultV2;
let weth: IERC20;
let targetToken: IERC20;

async function main() {
  const signers = await ethers.getSigners();
  const storage = new BaseContract(
    addresses.ARBITRUM_ONE.Storage,
    Storage__factory.createInterface(),
    signers[0],
  ) as Storage;
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
  const gasPriceWei = await getCurrentGasPriceWei();
  const hint = await vault.getPricePerFullShare();
  console.log('==================================================================');

  if (process.env.HARDHAT_NETWORK === 'hardhat') {
    await executeSimulationForDoHardWork(signers, storage, gasPriceWei, hint, targetToken);
  } else if (process.env.HARDHAT_NETWORK === 'arbitrum') {
    await executeDoHardWork(signers, gasPriceWei, hint);
  }
}

async function executeSimulationForDoHardWork(
  signers: SignerWithAddress[],
  storage: Storage,
  gasPriceWei: BigNumber,
  hint: BigNumber,
  targetToken: IERC20,
) {
  const governanceAddress = await storage.governance();
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [governanceAddress],
  });
  await network.provider.send('hardhat_setBalance', [
    governanceAddress,
    `0x${ethers.BigNumber.from('1000000000000000000').toBigInt().toString(16)}`,
  ]);
  const governance = await ethers.getSigner(governanceAddress);
  await controller.connect(governance).addHardWorker(signers[0].address);

  console.log('Doing simulation on vault:', currentVaultKey);
  console.log('Vault Address:', vaultAddress);

  const currentSimulationBlock = await web3.eth.getBlockNumber();
  console.log('Simulation is occurring at block:', currentSimulationBlock.toString());

  let executeFlag = false;
  const balanceAvailableToInvestOut = await vault.availableToInvestOut();
  const balanceWithInvestment = await vault.underlyingBalanceWithInvestment();

  console.log('Checking if we we need to push funds...');
  const investmentNumerator = new BigDecimal((await vault.vaultFractionToInvestNumerator()).toString());
  const investmentDenominator = new BigDecimal((await vault.vaultFractionToInvestDenominator()).toString());
  const ONE_HUNDRED = new BigDecimal('100');
  console.log(
    'Vault investment ratio:',
    investmentNumerator.toString(),
    '/',
    investmentDenominator.toString(),
    `(${(investmentNumerator.div(investmentDenominator).times(ONE_HUNDRED)).toString()}%)`,
  );

  const underlying = new BaseContract(
    await vault.underlying(),
    IERC20__factory.createInterface(),
    governance,
  ) as IERC20;
  const balanceInVault = await underlying.balanceOf(vaultAddress);
  const baseUnit = new BigDecimal((await vault.underlyingUnit()).toString());
  const symbol = await underlying.symbol();

  console.log(
    'Underlying in vault:     ',
    balanceInVault.toString(),
    `(${new BigDecimal(balanceInVault.toString()).div(baseUnit)} ${symbol})`,
  );
  console.log(
    'Total AUM:               ',
    balanceWithInvestment.toString(),
    `(${new BigDecimal(balanceWithInvestment.toString()).div(baseUnit)} ${symbol})`,
  );
  console.log(
    'Available to invest out: ',
    balanceAvailableToInvestOut.toString(),
    `(${new BigDecimal(balanceAvailableToInvestOut.toString()).div(baseUnit)} ${symbol})`,
  );

  if (balanceAvailableToInvestOut.gt('0')) {
    console.log('Funds need to be pushed into the vault');
    executeFlag = true;
  } else {
    console.log('Funds do not need to be pushed into the vault');
  }

  const profitShareAddress = governanceAddress;
  const ethInProfitShareBefore = await weth.balanceOf(profitShareAddress);
  let ethProfit = ethers.BigNumber.from('0');

  if (!executeFlag) {
    console.log('Performing doHardWork simulation');
    try {
      console.time('doHardWork simulation duration');
      const tx = await controller.doHardWork(vaultAddress, hint, '101', '100', { gasPrice: gasPriceWei });
      console.timeEnd('doHardWork simulation duration');

      const txResult = await ethers.provider.getTransactionReceipt(tx.hash);
      const ethCost = txResult.gasUsed.mul(txResult.effectiveGasPrice);
      const ethInProfitShareAfter = await convertProfitToEth(profitShareAddress, targetToken);
      ethProfit = ethInProfitShareAfter.sub(ethInProfitShareBefore);

      console.log('Gas used:           ', txResult.gasUsed.toString());
      console.log('Profit (ETH):       ', web3.utils.fromWei(ethProfit.toString()));
      console.log('Gas cost (ETH):     ', web3.utils.fromWei(ethCost.toString()));

      if (ethProfit.gt(ethCost.mul(greatDealRatio)) || ethProfit.gte(minPlatformFeeProfitInEth)) {
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

  const decision = {
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
    gasPriceWei,
  );
}

async function executeDoHardWork(
  signers: SignerWithAddress[],
  gasPriceWei: BigNumber,
  hint: BigNumber,
) {
  const executor = signers[0];
  const ethBalance = (await ethers.provider.getBalance(executor.address)).toString();
  console.log('Executor:', executor.address);
  console.log('ETH balance:', ethBalance, `(${new BigDecimal(ethBalance).div(oneEth).toString()})`);
  console.log('Doing real hard work on vault:', currentVaultKey);
  console.log('Vault address:', vaultAddress);

  if (vaultDecisionFile.vaultKey !== currentVaultKey) {
    console.log('ERROR: decision file info does not match vault key. Exiting...');
    return;
  }

  if (vaultDecisionFile.execute) {
    console.log('Mainnet: Sending the tx for vault:', vaultDecisionFile.vaultKey);
    console.log(`Using gas price of ${new BigDecimal(gasPriceWei.toString()).div(1e9).toString()} (gwei)`);
    try {
      const deviationNumerator = '101';
      const deviationDenominator = '100';
      let gasLimit: BigNumberish;
      try {
        gasLimit = await controller.estimateGas.doHardWork(
          vaultAddress,
          hint,
          deviationNumerator,
          deviationDenominator,
        );
      } catch (e) {
        gasLimit = '10000000'; // 10M gas
      }
      console.log(`Using gas limit of ${gasLimit.toString()}`);
      await controller.doHardWork(
        vaultAddress,
        hint,
        deviationNumerator,
        deviationDenominator,
        { gasPrice: gasPriceWei.mul(2) },
      );
    } catch (e) {
      console.log('Error when sending tx: ');
      console.log(e);
      await reportError(currentVaultKey, 0, e);
    }
  } else {
    console.log('Mainnet: NOT sending the tx of ', vaultDecisionFile.vaultKey);
  }

  const nextVaultKey = findNextVaultKey(currentVaultKey);
  const isLastVault = currentVaultKey === vaultIds[vaultIds.length - 1];
  const newNextVault = {
    next_vault_key: nextVaultKey,
  };
  fs.writeFileSync('./next-vault.json', JSON.stringify(newNextVault), 'utf-8');
  console.log('NEXT Vault:', nextVaultKey);

  if (isLastVault) {
    const hours = process.env.WAIT_DURATION_LAST_VAULT_HOURS;
    console.log(`Finished harvesting the last vault. Waiting for ${hours} hours for the next iteration`);
    await sleep(Number(hours) * 60 * 60 * 1000);
  } else {
    const seconds = 15;
    console.log(`Waiting for ${seconds} seconds`);
    await sleep(seconds * 1000);
  }
}

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
    .then(({ resp, body }) => {
      console.log(`Metrics pushed, status ${(resp as any).statusCode} ${body}`);
      register.clear();
    })
    .catch(err => {
      console.log(`Error pushing metrics: ${err}`);
    });
}

async function reportSimulationProfit(
  vault: string,
  block: number,
  ethProfit: BigNumber,
  execute: boolean,
  gasPriceWei: BigNumber,
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
  gasFeeMetric.set(gasPriceWei.toNumber());

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
    name: block === 0 ? 'mainnet_error' : 'simulation_error',
    help: 'error during hardWork execution',
    registers: [register],
  });
  register.registerMetric(errorMetric);
  errorMetric.inc(1);

  const labels: Pushgateway.Parameters = {
    jobName: vaultKey,
    groupings: { instance: 'arbitrum', block: block.toString(), error: error.toString() },
  };
  return pushMetrics(labels);
}

function disableCron(vaultAddress: string): string | undefined {
  return Object.keys(addresses.ARBITRUM_ONE).find(
    key =>
      addresses.ARBITRUM_ONE[key].NewVault &&
      addresses.ARBITRUM_ONE[key].NewVault.toLowerCase() === vaultAddress.toLowerCase() &&
      addresses.ARBITRUM_ONE[key].doHardWork === false,
  );
}

function findNextVaultKey(currentVaultKey?: string) {
  let nextId;
  if (currentVaultKey) {
    const id = vaultIds.findIndex(element => element === currentVaultKey);
    if (id === vaultIds.length - 1) {
      nextId = 0;
    } else {
      nextId = id + 1;
    }
  } else {
    nextId = 0
  }
  return vaultIds[nextId];
}

async function getCurrentGasPriceWei(): Promise<BigNumber> {
  const gasPriceWei = await network.provider.request({
    method: 'eth_gasPrice',
    params: [],
  });
  return ethers.BigNumber.from(gasPriceWei);
}

async function convertProfitToEth(profitShareAddress: string, targetToken: IERC20): Promise<BigNumber> {
  if (targetToken.address === addresses.ARBITRUM_ONE.WETH) {
    return weth.balanceOf(profitShareAddress)
  }

  return Promise.reject(new Error('No conversion function created from targetToken to ETH'));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
