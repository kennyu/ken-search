let db;
async function main() {
    const sqlSrc = chrome.runtime.getURL("sql-wasm-debug.js");
    const sql = await import(sqlSrc);

    const base64ToArrayBuffer = async (base64) => {
        const response = await fetch("data:application/octet-stream;base64," + base64);
        const blob = await response.blob();
        const promise = new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        });
        const result = await promise;
        return new Uint8Array(result);
      }

    const SQL = await sql.initSqlJs({
        locateFile: file => file
    });

    const blobKV = await chrome.storage.local.get("db");
    const blob = blobKV.db;
    let blobArray;
    if (blob) {
        blobArray = await base64ToArrayBuffer(blob);
    }
    db = new SQL.Database(blobArray);
}

main();

const search = () => {
    const term = document.getElementById("search_term").value;
    let results = db.exec("SELECT url, title, content, timestamp FROM search_pages(:term)", {":term": term});
    let resultsElement = document.getElementById("search_results");
    if (results[0]) {
        resultsElement.innerText = "";
        for (let result of results[0].values) {
            element = document.createElement("div");

            urlElement = document.createElement("div");
            urlElement.innerHTML = result[0];
            element.appendChild(urlElement);
            
            titleElement = document.createElement("div");
            titleElement.innerHTML = result[1];
            element.appendChild(titleElement);
            
            timestampElement = document.createElement("div");
            let timestamp = new Date();
            timestamp.setTime(result[3] * 1000);
            timestampElement.innerHTML = timestamp.toUTCString();
            element.appendChild(timestampElement);

            resultsElement.appendChild(element);
        }
    } else {
        resultsElement.innerText = "No results";
    }
}
const searchButton = document.getElementById("search_button");
searchButton.addEventListener("click", () => search());

console.log(searchButton);