#!/bin/bash

while true ; do
  echo "#################################################################################################################"
  TS_NODE_TRANSPILE_ONLY=1 npx hardhat --network hardhat run ./scripts/standalone-runner.ts
  sleep 10
  TS_NODE_TRANSPILE_ONLY=1 npx hardhat --network arbitrum run ./scripts/standalone-runner.ts
  sleep 30
done
