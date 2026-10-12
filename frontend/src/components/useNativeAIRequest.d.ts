export default function useNativeAIRequest(): {busy: boolean; cancel: () => void; run: <T>(start: (signal: AbortSignal) => Promise<T>) => Promise<T>};
