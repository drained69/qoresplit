// The local Diana stand-in chain for npm run e2e: chain ID 9800 like Diana.
module.exports = {
  networks: { hardhat: { hardfork: 'cancun', chainId: 9800, throwOnTransactionFailures: false } },
};
