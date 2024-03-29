export type Noop = () => void;

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
export const noop: Noop = () => {
  // do nothing
};
