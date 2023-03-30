const config = {
    intervals: {
        poll: 3000
    }
};

const connect = function() {
    let freeze = false;
    const urlElem = document.getElementById("url");
    const roomNameElem = document.getElementById("roomName");
    const rawDisplay = document.getElementById("rawContent");
    const startButtonElem = document.getElementById("startButton");
    const freezeButtonElem = document.getElementById("freeze");
    startButtonElem.disabled = true;
    urlElem.disabled = true;
    roomNameElem.disabled = true;
    const url = urlElem.value;
    const roomName = roomNameElem.value;
    const api = createConnection(url, roomName);
    let pollTimeout;
    const pollStats = function() {
        api.stats().then(function(stats){
            if (!freeze) {
                processAndDisplay(stats);
                pollTimeout = setTimeout(pollStats, config.intervals.poll);
            }
        }, function(e) {
            console.log("Failed to poll stats " + e);
            if (!freeze) {
                rawDisplay.innerHTML = "Failed to poll stats " + e;
                pollTimeout = setTimeout(pollStats, config.intervals.poll);
            }
        })
    }

    freezeButtonElem.addEventListener("click", function(){
        if (freezeButtonElem.innerText === "Freeze") {
            freeze = true;
            clearTimeout(pollTimeout);
            freezeButtonElem.innerText = "Unfreeze";
        } else {
            freeze = false;
            pollStats();
            freezeButtonElem.innerText = "Freeze";
        }
    });
    freezeButtonElem.disabled = false;

    const gView = createGraphView('sigmaContainer');
    const tView = createMetricTable();
    let tData, gData;
    const processAndDisplay = function(stats) {
        rawDisplay.innerHTML = JSON.stringify(stats, null, 2);
        tData = statsToTable(stats);
        gData = statsToGraph(stats);
        gView.refreshSigma(gData);
        //flatten tdata
        const flatView = [];
        for (const [k, v] of Object.entries(tData)) {
            flatView.push(...v);
        }
        tView.updateMetricTable(flatView, "WCS");
    }

    gView.bindNodeClickEvents(function(e){
        tView.updateMetricTable(tData[e.data.node.id], e.data.node.id);
    });
    //kick off stats polling
    pollStats();
}
