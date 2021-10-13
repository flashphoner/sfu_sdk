'use strict'

const createView = function(container) {
    //setup sigma
    const s = new sigma({
        renderer: {
            container: container,
            type: 'canvas'
        },
        settings: {
            minArrowSize: 3,
            edgeLabelSize: 'fixed'
        }
    });

    const refreshSigma = function(model) {
        s.graph.clear();
        s.refresh();

        s.graph.read(model);
        s.refresh();
    }

    const bindNodeClickEvents = function (handler) {
        const eventList = 'clickNode doubleClickNode rightClickNode';
        s.bind(eventList, handler);
    };

    return {
        s: s,
        bindNodeClickEvents: bindNodeClickEvents,
        refreshSigma: refreshSigma
    }
}

module.exports = {
    createView: createView
}