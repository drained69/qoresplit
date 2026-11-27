# Deployments

`diana.json`: the Treaty contract on QoreChain Diana (`0xDfc61ec824205AEF7f2FC80FaD5DBC2Cc987D0a6`, deployed 26 November 2026 at block 10807010, runtime code verified to match this build), the five accounts, and each account's EVM window: the agents' windows allow only the Treaty contract, 30 transactions and about an hour.

`diana-demo.json` is the first full run on Diana (Treaty #1, 26 November 2026), the one the website and the README cite: the Treaty contract on QoreChain Diana, the addresses of every party (owner, research agent, data agent, cleaning agent), and the hash of every transaction in the live run, in order. Each step has its EVM hash (`tx`) and the Cosmos hash the QoreChain explorer lists (`cosmosTx`). To open one, go to https://explore.qore.network, choose **Testnet** at the top, then open `https://explore.qore.network/tx/<cosmosTx>`. The Treaty website shows every transaction directly, read from Diana: `#tx/<contract>/<EVM hash>`.

`runs/`: every later full run, one file per treaty (`runs/treaty-<id>.json`), in the same format. `npm run demo -- --diana` writes a new file there, so the cited record never changes. Treaty #7 (27 November 2026) is another complete 18-transaction run, from the same accounts.
