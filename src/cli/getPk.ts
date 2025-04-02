import { Hex } from "viem";
import { mnemonicToAccount } from "viem/accounts";

/**
 * Derives a private key from a mnemonic phrase using B
 * 
 * @param mnemonic - The mnemonic phrase (12 or 24 words)
 * @param index - The index of the private key to derive (default: 0)
 * @returns The private key as a hex string
 */
export const getPrivateKeyFromMnemonic = (
  mnemonic: string,
  index: number = 0
): Hex => {
  try {
    // Convert mnemonic to seed
    const account = mnemonicToAccount(
      mnemonic,
      {
        accountIndex: 0,
        addressIndex: index
      }
    )

    console.log(`Address: ${account.address}`);
    const privateKey = `0x${Buffer.from(account.getHdKey().privateKey ?? '').toString('hex')}` as Hex;
    console.log(`Private Key: ${privateKey}`);

    return privateKey;
  } catch (error) {
    throw new Error(`Error deriving private key: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Get private key from mnemonic in environment variable
 * 
 * @param index - The index of the private key to derive
 * @returns The private key
 */
export const getPkFromMnemonic = (index: number = 0): Hex => {
  const mnemonic = process.env.MNEMONIC;
  
  if (!mnemonic) {
    throw new Error("MNEMONIC environment variable not set");
  }
  
  return getPrivateKeyFromMnemonic(mnemonic, index);
};

/**
 * Resolves a private key from input, handling both direct keys and numeric indices
 * 
 * @param key - The private key or index to derive from mnemonic
 * @param spinner - Optional ora spinner to update text (if provided)
 * @returns The resolved private key
 */
export const resolvePk = (key: string | undefined, spinner?: { text: string }): string | undefined => {
  if (key !== undefined && !isNaN(Number(key))) {
    const keyIndex = Number(key);
    if (spinner) {
      spinner.text = `Deriving private key from mnemonic with index ${keyIndex}...`;
    }
    return getPkFromMnemonic(keyIndex);
  }
  return key;
};

export default getPkFromMnemonic;
