# EDS Deploy Commands

This directory contains commands for deploying EDS (Ethereum Development Suite) components.

## Repository Deployment

Deploy a new EDS repository using the `repository` command:

```bash
# Basic usage - the CLI will prompt for required parameters
peeramid eds deploy repository

# With parameters provided
peeramid eds deploy repository \
  --owner 0x1234567890123456789012345678901234567890 \
  --name "My Repository" \
  --uri "https://example.com/metadata" \
  --rpc https://rpc.ankr.com/arbitrum_sepolia

# With private key
peeramid eds deploy repository \
  --owner 0x1234567890123456789012345678901234567890 \
  --name "My Repository" \
  --uri "https://example.com/metadata" \
  --key 0x1234567890abcdef... \
  --rpc https://rpc.ankr.com/arbitrum_sepolia

# With mnemonic index
peeramid eds deploy repository \
  --owner 0x1234567890123456789012345678901234567890 \
  --name "My Repository" \
  --uri "https://example.com/metadata" \
  --mnemonic-index 0 \
  --rpc https://rpc.ankr.com/arbitrum_sepolia

# With Envio GraphQL endpoint (optional)
peeramid eds deploy repository \
  --owner 0x1234567890123456789012345678901234567890 \
  --name "My Repository" \
  --uri "https://example.com/metadata" \
  --rpc https://rpc.ankr.com/arbitrum_sepolia \
  --envio https://my-indexer.envio.dev/v1/graphql
```

### Parameters

- `--owner, -o`: Owner address for the repository (required)
- `--name, -n`: Name of the repository (required)
- `--uri, -u`: URI for the repository metadata (required)
- `--rpc, -r`: RPC endpoint URL (optional, can use RPC_URL env var)
- `--mnemonic-index, -i`: Index to derive from mnemonic (optional)
- `--key, -k`: Private key with admin permissions (optional, used if no mnemonic index provided)
- `--envio, -e`: Envio GraphQL endpoint URL (optional, defaults to localhost)

### Environment Variables

- `RPC_URL`: Default RPC endpoint if not provided via CLI
- `PRIVATE_KEY`: Private key for the wallet client (used if no --key or --mnemonic-index provided)
- `INDEXER_URL`: Default Envio GraphQL endpoint

### Private Key Resolution

The command uses the following priority order for private key resolution:

1. `--mnemonic-index` option (derives from mnemonic)
2. `--key` option (direct private key)
3. `PRIVATE_KEY` environment variable

### Output

The command will deploy a new repository contract and print:

- Contract address
- Owner address
- Repository name
- Repository URI

Example output:

```
✔ Repository deployed successfully!

📋 Repository Details:
Address: 0xAbCdEf1234567890123456789012345678901234
Owner: 0x1234567890123456789012345678901234567890
Name: My Repository
URI: https://example.com/metadata
```
