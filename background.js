chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab)  => {
  if ((changeInfo.status === 'complete') && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
  chrome.scripting.executeScript({
      func: () => {
        let body = document.documentElement.innerText;
        return body;
      },
      target: { tabId: tab.id }
    }, (result) => {
      let pageText = result[0].result;
      chrome.scripting.executeScript({
        func: (pageText) => {
          console.log(pageText);
        },
        args: [pageText],
        target: { tabId: tab.id }
      });
    });
  }
})
