export const printHtml = async (html: string): Promise<void> => {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  iframe.contentDocument!.open();
  iframe.contentDocument!.write(html);
  iframe.contentDocument!.close();
  iframe.contentWindow!.focus();
  iframe.contentWindow!.print();
  setTimeout(() => document.body.removeChild(iframe), 2000);
};
