// #!/bin/bash
//
// while true ; do
//   echo "#################################################################################################################"
//   TS_NODE_TRANSPILE_ONLY=1 npx hardhat --network hardhat run ./scripts/standalone-runner.ts
//   sleep 10
//   TS_NODE_TRANSPILE_ONLY=1 npx hardhat --network arbitrum run ./scripts/standalone-runner.ts
//   sleep 30
// done

import { execSync } from 'child_process';


async function sleep(ms: number) {
  await new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function start() {
  const isTrue = true;
  while (isTrue) {
    console.log('========================================== New Iteration ===========================================');

    try {
      execSync(
        'TS_NODE_TRANSPILE_ONLY=1 npx hardhat --network hardhat run ./scripts/standalone-runner.ts',
        {
          stdio: 'inherit'
        }
      );
    } catch(e) {} // eslint-disable-line no-empty

    await sleep(10 * 1000);

    try {
      execSync(
        'TS_NODE_TRANSPILE_ONLY=1 npx hardhat --network arbitrum run ./scripts/standalone-runner.ts',
        {
          stdio: 'inherit', // pass stdout to this shell instance, so we can capture it
        }
      );
    } catch(e) {} // eslint-disable-line no-empty

    await sleep(30 * 1000);
    console.log('====================================================================================================');
  }
}

start()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Found error during execution:', e)
    process.exit(-1)
  })
