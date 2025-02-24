/**
 * Permutes an array based on a deterministic permutation
 * @param array - Array to permute
 * @param permutation - Permutation of the array
 * @returns The permuted array
 */
export const permuteArray = <T>({
  array,
  permutation,
}: {
  array: readonly T[];
  permutation: readonly number[] | readonly bigint[];
}): T[] => {
  const permutedArray: T[] = [...array];
  for (let i = 0; i < array.length; i++) {
    permutedArray[Number(permutation[i])] = array[i];
  }
  return permutedArray;
};

/**
 * Reverses a permutation of an array
 * @param array - Array to reverse
 * @param permutation - Permutation of the array
 * @returns The original array
 */
export const reversePermutation = <T>({
  array,
  permutation,
}: {
  array: readonly T[];
  permutation: readonly number[] | readonly bigint[];
}): T[] => {
  const originalArray: T[] = [];
  for (let i = 0; i < array.length; i++) {
    originalArray[i] = array[Number(permutation[i])];
  }
  return originalArray;
};
