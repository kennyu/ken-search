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
    const term = document.getElementById("search_field").value;
    let results = db.exec(`
        SELECT url, title, timestamp, snippet(search_pages, 2, '<b>', '</b>', '', 64)
        FROM search_pages(:term)
        LIMIT 10
    `, {":term": '"' + term + '"'});
    let resultsElement = document.getElementById("search_results");
    if (results[0]) {
        resultsElement.innerText = "";
        for (let result of results[0].values) {
            element = document.createElement("div");

            urlElement = document.createElement("div");
            urlLinkElement = document.createElement("a");
            urlLinkElement.innerHTML = `<a href="${result[0]}">${result[0]}</a>`
            urlLinkElement.addEventListener("click", () => {
                chrome.tabs.create({
                    url: result[0]
                });
            });
            urlElement.appendChild(urlLinkElement);
            element.appendChild(urlElement);
            
            titleElement = document.createElement("div");
            titleElement.innerHTML = result[1];
            element.appendChild(titleElement);
            
            timestampElement = document.createElement("div");
            let timestamp = new Date();
            timestamp.setTime(result[2] * 1000);
            timestampElement.innerHTML = timestamp.toUTCString();
            element.appendChild(timestampElement);
            
            snippetElement = document.createElement("div");
            snippetElement.innerHTML = result[3];
            element.appendChild(snippetElement);

            resultsElement.appendChild(element);
        }
    } else {
        resultsElement.innerText = "No results";
    }
}

const searchField = document.getElementById("search_field");
const searchButton = document.getElementById("search_button");
searchField.addEventListener("keyup", event => {
    if (event.key !== "Enter") {
        return;
    }
    searchButton.click();
    event.preventDefault();
});
searchButton.addEventListener("click", () => search());

console.log(searchButton);