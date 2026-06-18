// Base file — TypeScript resolves types from here.
// Metro replaces this with printReceipt.native.ts on iOS/Android and printReceipt.web.ts on web.
export const printHtml = async (_html: string): Promise<void> => {};
