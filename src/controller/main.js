'use strict'


const parser = require("./parser");
const graphView = require("./graph-view");
const tableView = require("./table-view");
const rest = require("./rest");

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
    const api = rest.createConnection(url, roomName);
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

    const gView = graphView.createView('sigmaContainer');
    const tView = tableView.createMetricTable();
    let tData, gData;
    const processAndDisplay = function(stats) {
        rawDisplay.innerHTML = JSON.stringify(stats, null, 2);
        tData = parser.statsToTable(stats);
        gData = parser.statsToGraph(stats);
        gView.refreshSigma(gData);
        tView.updateMetricTable(tData.WCS, "WCS");
    }

    gView.bindNodeClickEvents(function(e){
        tView.updateMetricTable(tData[e.data.node.id], e.data.node.id);
    });
    //kick off stats polling
    pollStats();
}



module.exports = {
    connect: connect
}