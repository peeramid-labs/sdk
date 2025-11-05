# EDS Repository Commands

This directory contains commands for managing existing EDS repositories.

## Available Commands

### Push Release (`push`)

Push a new release to an existing EDS repository:

```bash
# Basic usage - the CLI will prompt for required parameters
peeramid eds repository push

# With all parameters provided
peeramid eds repository push \
  --address 0xAbCdEf1234567890123456789012345678901234 \
  --dist-hash 0x1234567890abcdef... \
  --metadata "Release v1.0.0 with new features" \
  --major 1 --minor 0 --patch 0 \
  --rpc https://rpc.ankr.com/arbitrum_sepolia

# With private key
peeramid eds repository push \
  --address 0xAbCdEf1234567890123456789012345678901234 \
  --dist-hash 0x1234567890abcdef... \
  --metadata "Release v1.0.0 with new features" \
  --key 0x1234567890abcdef... \
  --rpc https://rpc.ankr.com/arbitrum_sepolia
```

#### Parameters

- `--address, -a`: Repository contract address (required)
- `--dist-hash, -d`: Distribution hash (0x...) (required)
- `--metadata, -m`: Metadata string for the release (required)
- `--major`: Major version number (default: 1)
- `--minor`: Minor version number (default: 0)
- `--patch`: Patch version number (default: 0)
- `--rpc, -r`: RPC endpoint URL (optional, can use RPC_URL env var)
- `--mnemonic-index, -i`: Index to derive from mnemonic (optional)
- `--key, -k`: Private key with admin permissions (optional)

#### Output

```
✔ Release pushed successfully!

📦 Release Details:
Repository: 0xAbCdEf1234567890123456789012345678901234
Version: 1.0.0
Distribution Hash: 0x1234567890abcdef...
Metadata: Release v1.0.0 with new features
Transaction Hash: 0xfedcba0987654321...
Block Number: 12345678
```

### Repository Info (`info`)

Get information about an existing EDS repository:

```bash
# Basic usage - the CLI will prompt for repository address
peeramid eds repository info

# With repository address provided
peeramid eds repository info \
  --address 0xAbCdEf1234567890123456789012345678901234 \
  --rpc https://rpc.ankr.com/arbitrum_sepolia
```

#### Parameters

- `--address, -a`: Repository contract address (required)
- `--rpc, -r`: RPC endpoint URL (optional, can use RPC_URL env var)
- `--mnemonic-index, -i`: Index to derive from mnemonic (optional)
- `--key, -k`: Private key (optional)

#### Output

```
✔ Repository information retrieved!

📚 Repository Information:
Address: 0xAbCdEf1234567890123456789012345678901234
Name: My Repository
URI: https://example.com/metadata

📦 Latest Release:
Version: 1.0.0
Distribution Hash: 0x1234567890abcdef...
Metadata: Release v1.0.0 with new features
```

## Environment Variables

- `RPC_URL`: Default RPC endpoint if not provided via CLI
- `PRIVATE_KEY`: Private key for the wallet client (used if no --key or --mnemonic-index provided)

## Private Key Resolution

The commands use the following priority order for private key resolution:

1. `--mnemonic-index` option (derives from mnemonic)
2. `--key` option (direct private key)
3. `PRIVATE_KEY` environment variable

## Examples

### Complete Workflow

1. First, deploy a repository:

```bash
peeramid eds deploy repository \
  --owner 0x1234567890123456789012345678901234567890 \
  --name "My Project Repository" \
  --uri "https://example.com/metadata"
```

2. Then push releases:

```bash
peeramid eds repository push \
  --address 0xAbCdEf1234567890123456789012345678901234 \
  --dist-hash 0x1234567890abcdef... \
  --metadata "Initial release" \
  --major 1 --minor 0 --patch 0
```

3. Check repository info:

```bash
peeramid eds repository info \
  --address 0xAbCdEf1234567890123456789012345678901234
```
