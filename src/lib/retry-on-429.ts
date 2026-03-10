export async function retryOn429<T extends { status: number }>(
  operation: () => Promise<T>,
): Promise<T> {
  while (true) {
    const response = await operation();
    if (response.status !== 429) {
      return response;
    }
  }
}
