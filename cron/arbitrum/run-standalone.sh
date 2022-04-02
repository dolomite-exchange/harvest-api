#!/bin/bash

while true ; do
  echo "#################################################################################################################"
  HARDHAT_NETWORK=hardhat ts-node standalone-runner.ts
  sleep 10
  HARDHAT_NETWORK=cron_mainnet ts-node standalone-runner.ts
  sleep 30
done
