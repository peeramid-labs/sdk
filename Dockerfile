# Use Node.js 22.14.0 as base image
FROM node:22.14.0-alpine

# Set working directory
WORKDIR /app

# Install git and other necessary tools
RUN apk add --no-cache git bash curl jq

# Install pnpm globally
RUN npm install -g pnpm@9.12.3

# Clone the repository and switch to the specific branch
RUN git clone -b 192-sdk-must-work-with-any-chain-without-previous-deployment-aivars https://github.com/peeramid-labs/sdk.git sdk-branch-192

# Change to the project directory
WORKDIR /app/sdk-branch-192

# Install dependencies
RUN pnpm install

# Build the project
RUN pnpm build

# Set default environment variables (can be overridden)
ENV RPC_URL="https://rpc.buildbear.io/sweet-gorgon-268627e3"
ENV MNEMONIC="guilt clock kingdom banana margin rich junk swap during crane staff creek"
ENV VERBOSE_LEVEL=3
ENV VERBOSE=true

# Create entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command (can be overridden)
CMD ["pnpm", "cli", "fellowship", "game", "create", "0x4D3A53F1c86b7BfFD95130d469B898f06B3Eb038", "-i", "1"]
