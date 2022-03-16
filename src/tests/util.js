const waitForTrack = (pc, track) => {
    return new Promise((resolve, reject) => {
        pc.ontrack = ({transceiver}) => {
            if (transceiver.mid === track.mid) {
                resolve(transceiver.receiver.track);
            }
        }
    });
};

const waitForTracks = (pc, tracks) => {
    return new Promise((resolve, reject) => {
        let waitingFor = tracks.length;
        const trackArrived = () => {
            waitingFor--;
            if (waitingFor === 0) {
                resolve();
            }
        };
        for (const track of tracks) {
            waitForTrack(pc, track).then(trackArrived);
        }
    });
};

const waitForPeerConnectionStableState = (pc) => {
    return waitForPeerConnectionState(pc, "stable");
}

const waitForPeerConnectionState = (pc, state) => {
    return new Promise((resolve, reject) => {
        if (pc.signalingState === state) {
            resolve();
        }
        pc.onsignalingstatechange = (e) => {
            if (pc.signalingState === state) {
                resolve();
            }
        }
    });
};

module.exports = {
    waitForTrack: waitForTrack,
    waitForTracks: waitForTracks,
    waitForPeerConnectionState: waitForPeerConnectionState,
    waitForPeerConnectionStableState: waitForPeerConnectionStableState
}