# Deployments

`diana.json`: the Treaty contract on QoreChain Diana (`0xDfc61ec824205AEF7f2FC80FaD5DBC2Cc987D0a6`, deployed 26 November 2026 at block 10807010, runtime code verified to match this build), the five accounts, and each account's EVM window: the agents' windows allow only the Treaty contract, 30 transactions and about an hour.

`npm run demo -- --diana` writes `diana-demo.json` here: the Treaty contract on QoreChain Diana, the addresses of every party (owner, research agent, data agent, cleaning agent), and the hash of every transaction in the live run, in order. Each step has its EVM hash (`tx`) and the Cosmos hash the QoreChain explorer lists (`cosmosTx`). To open one, go to https://explore.qore.network, choose **Testnet** at the top, then open `https://explore.qore.network/tx/<cosmosTx>`. The Treaty website shows every transaction directly, read from Diana: `#tx/<contract>/<EVM hash>`.
