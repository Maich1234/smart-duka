import * as Print from 'expo-print';

export const printHtml = async (html: string): Promise<void> => {
  await Print.printAsync({ html });
};
