import { execSync } from 'child_process';


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

    try {
      execSync(
        'TS_NODE_TRANSPILE_ONLY=1 npx hardhat --network arbitrum run ./scripts/standalone-runner.ts',
        {
          stdio: 'inherit', // pass stdout to this shell instance, so we can capture it
        }
      );
    } catch(e) {} // eslint-disable-line no-empty

    console.log('====================================================================================================');
  }
}

start()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Found error during execution:', e)
    process.exit(-1)
  })
