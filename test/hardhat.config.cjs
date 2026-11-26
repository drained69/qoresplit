// The in-process EVM the contract tests run on. No Foundry or network needed.
module.exports = {
  networks: { hardhat: { hardfork: 'cancun', chainId: 31337, throwOnTransactionFailures: false } },
};
