// let worker = new Worker('worker.js');

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
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
});

// Use sql-wasm to interact with a SQLite database
// worker.postMessage({ command: 'init', pageText: pageText });

// worker.onmessage = (event) => {
//   console.log(event.data.result);
// };
