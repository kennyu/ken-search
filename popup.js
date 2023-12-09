const importSrc = async (path) => {
    const src = chrome.runtime.getURL(path);
    const lib = await import(src);
    return lib;
};

let db;
async function main() {
    const sql = await importSrc("sql-wasm-debug.js");
    const shared = await importSrc("shared.js")
    db = await shared.readDB(sql.initSqlJs);
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